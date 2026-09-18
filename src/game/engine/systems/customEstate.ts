/**
 * 地図から買う「実在の場所」（OSM の建物・区画）の値段と売買。
 *
 * 値段 = 敷地の面積 × その場所の土地の単価 × 用途の係数 ＋ 延床面積 × 建物の単価
 * 実勢を参考にしたゲーム用の目安で、実在の所有者・取引とは関係がない。
 */
import { CITY_MAP, isCityId } from '@/game/data/cities';
import { estimateLandValue } from '@/game/data/landValue';
import { COUNTRY_NAME } from '@/game/data/lands';
import { PROPERTY_KIND, PROPERTY_POPULATION, PROPERTY_TERRAIN, type PropertyKind } from '@/game/data/properties';
import { depositsFor, terrainFromTags } from './geology';
import { cellAreaSqm, cellCenter, cellPolygon, cellsOverlap, isPlotId, parsePlotId, plotId, plotName, PLOT_SIZE_MAP, type PlotCell, type PlotSizeId } from '@/game/data/plots';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { LatLon } from '@/utils/geo';
import type { TerrainId } from '@/game/data/terrain';
import type { OsmFeature } from '@/game/services/osm/overpass';
import type { CustomProperty, GameState, LandState } from '@/types/state';
import type { EngineContext } from '../context';
import { creditRankDef } from './contracts';
import { closeDivisionsOnLand } from './business';
import { dropFacilityInvestment } from '../actions/facility';

/** 用途ごとの「土地の値段の掛け率」（更地や農地は安く、街中の商業地はそのまま） */
export const LAND_FACTOR: Record<PropertyKind, number> = {
  land: 0.8,
  farm: 0.15,
  house: 1,
  apartment: 1,
  office: 1,
  retail: 1,
  hotel: 1,
  warehouse: 0.6,
  factory: 0.6,
  resort: 0.9,
};

/** 用途ごとの建物の単価（円/㎡・延床） */
export const BUILD_COST: Record<PropertyKind, number> = {
  land: 0,
  farm: 30_000,
  house: 150_000,
  apartment: 180_000,
  office: 250_000,
  retail: 200_000,
  hotel: 280_000,
  warehouse: 100_000,
  factory: 120_000,
  resort: 250_000,
};


/** 知名度（有名な場所ほど高い）。0〜1 */
export interface Prominence {
  /** 0（無名）〜1（誰もが知る名所） */
  score: number;
  /** 評価額に掛かる倍率 */
  mult: number;
  /** 持ち主が手放すのを渋る上乗せ（買うときだけ掛かる） */
  premium: number;
  label: string;
  reasons: string[];
}

/**
 * 用途ごとの「名が通りやすさ」。
 * 同じ大きさでも、駅前のビルは有名になり、郊外の畑や倉庫はそうならない。
 */
const PROMINENCE_KIND: Record<PropertyKind, number> = {
  land: 0.2,
  farm: 0.2,
  house: 0.3,
  warehouse: 0.5,
  factory: 0.55,
  apartment: 0.7,
  office: 1,
  retail: 1,
  hotel: 1,
  resort: 1,
};

const PROMINENCE_LABEL: readonly { min: number; label: string }[] = [
  { min: 0, label: '無名の物件' },
  { min: 0.18, label: '知られた物件' },
  { min: 0.38, label: '有名な物件' },
  { min: 0.6, label: '地域の顔' },
  { min: 0.8, label: '誰もが知る名所' },
];

function logScore(value: number, from: number, to: number): number {
  if (value <= from) return 0;
  return Math.min(1, Math.log(value / from) / Math.log(to / from));
}

/**
 * その場所がどれだけ知られているか。
 * 名前がある・観光地・大きい・高層・地価が高い、のどれかに当てはまるほど高くなる。
 * 有名な場所はすでに誰かのもので、買うにはかなりの額がかかる。
 */
export function prominenceOf(f: Pick<OsmFeature, 'areaSqm' | 'levels' | 'kind'> & { named?: boolean; tags?: OsmFeature['tags'] }, unitPrice: number): Prominence {
  const reasons: string[] = [];
  const t = f.tags ?? {};
  let score = 0;
  if (f.named) {
    score += 0.18;
    reasons.push('名前の通った建物');
  }
  const landmark = Boolean(t.tourism || t.historic || t.heritage || t.man_made === 'tower');
  if (landmark) {
    score += 0.22;
    reasons.push('観光地・名所として知られている');
  }
  const floorArea = f.areaSqm * Math.max(1, f.levels);
  const sizeScore = logScore(floorArea, 2_000, 200_000);
  if (sizeScore > 0.25) reasons.push('規模が大きい');
  score += sizeScore * 0.25;
  const levelScore = Math.max(0, Math.min(1, (f.levels - 3) / 27));
  if (levelScore > 0.25) reasons.push('高層の建物');
  score += levelScore * 0.15;
  const priceScore = logScore(unitPrice, 50_000, 2_000_000);
  if (priceScore > 0.4) reasons.push('一等地に建っている');
  score += priceScore * 0.2;
  score = Math.max(0, Math.min(1, score * (PROMINENCE_KIND[f.kind] ?? 1)));
  if (score < 0.18) reasons.length = 0;
  let label = PROMINENCE_LABEL[0].label;
  for (const l of PROMINENCE_LABEL) if (score >= l.min) label = l.label;
  return {
    score,
    // 有名なほど評価額そのものが跳ね上がる（最大 16 倍）
    mult: 1 + 15 * Math.pow(score, 1.8),
    // さらに、持ち主が手放すのを渋るぶんの上乗せ（最大 +80%）
    premium: 1 + score * 0.8,
    label,
    reasons,
  };
}

export interface CustomQuote {
  /** 地価倍率を掛ける前の評価額（円） */
  basePrice: number;
  /** 鉱業権の分（円）。区画だけに付く。地下に眠るものの市場価値のおよそ1% */
  mineralRight?: number;
  /** 土地の単価（円/㎡） */
  unitPrice: number;
  /** 土地の分（円） */
  landPart: number;
  /** 建物の分（円） */
  buildingPart: number;
  cityId: string;
  regionLabel: string;
  country: string;
  /** 知名度（有名な場所ほど高い） */
  prominence: Prominence;
}

/** 面積・階数・場所から評価額を出す */
export function quoteFeature(f: Pick<OsmFeature, 'kind' | 'areaSqm' | 'levels' | 'lat' | 'lon'> & { named?: boolean; tags?: OsmFeature['tags'] }): CustomQuote {
  const v = estimateLandValue({ lat: f.lat, lon: f.lon });
  const prominence = prominenceOf(f, v.unitPrice);
  const landPart = f.areaSqm * v.unitPrice * LAND_FACTOR[f.kind] * prominence.mult;
  const floorArea = f.areaSqm * Math.max(1, f.levels);
  const buildingPart = floorArea * BUILD_COST[f.kind] * prominence.mult;
  const near = v.distanceKm < 3 ? v.nearestCityName : `${v.nearestCityName}から${Math.round(v.distanceKm)}km`;
  return {
    basePrice: Math.max(10_000, Math.round(landPart + buildingPart)),
    unitPrice: v.unitPrice,
    landPart: Math.round(landPart),
    buildingPart: Math.round(buildingPart),
    cityId: v.nearestCityId,
    regionLabel: near,
    country: v.country,
    prominence,
  };
}

/** 地価倍率（買ったあとも近くの都市の地価に連動する） */
function multiplierOf(state: GameState, cityId: string): number {
  return state.estate.cityMult[cityId] ?? 1;
}

export function customProperties(state: GameState): CustomProperty[] {
  return Object.values(state.estate.custom ?? {});
}

export function getCustom(state: GameState, id: string): CustomProperty | null {
  return state.estate.custom?.[id] ?? null;
}

/** いまの評価額（円） */
export function customPrice(state: GameState, cp: CustomProperty): number {
  if (!cp || typeof cp.basePrice !== 'number' || !Number.isFinite(cp.basePrice)) return 0;
  return Math.round(cp.basePrice * multiplierOf(state, cp.cityId));
}

/** 買うときに払う額（手数料込み） */
export function customBuyCost(state: GameState, quote: CustomQuote): number {
  const fee = creditRankDef(state).estateFee;
  // 有名な場所は持ち主が手放すのを渋るので、評価額より高く買うことになる
  return Math.ceil(quote.basePrice * multiplierOf(state, quote.cityId) * quote.prominence.premium * (1 + fee));
}

/** 売って受け取る額（手数料引き） */
export function customSellProceeds(state: GameState, cp: CustomProperty): number {
  const fee = creditRankDef(state).estateFee;
  return Math.floor(customPrice(state, cp) * (1 - fee));
}

/**
 * 賃料（円/秒）。
 * 有名な物件は値段こそ跳ね上がるが、入る家賃までは比例して増えない
 * （知名度のぶんを割り戻してから利回りを掛ける）。
 */
export function customRentPerSec(state: GameState, cp: CustomProperty): number {
  const kind = PROPERTY_KIND[cp?.kind];
  if (!kind) return 0;
  const rentable = customPrice(state, cp) / Math.max(1, cp.prominence ?? 1);
  return (rentable * kind.yield) / 3600;
}

/**
 * まだ買っていない建物の「買ったら入る賃料」（円/秒）。
 * 所有後と同じ式で出す。ここを基準価格そのままで出すと、
 * 有名な物件ほど表示が実際の何倍にもなってしまう。
 */
export function quoteRentPerSec(state: GameState, quote: CustomQuote, kindId: PropertyKind): number {
  const kind = PROPERTY_KIND[kindId];
  if (!kind) return 0;
  const rentable = quotePrice(state, quote) / Math.max(1, quote.prominence.mult);
  return (rentable * kind.yield) / 3600;
}

/** まだ買っていない建物の評価額（都市の地価倍率こみ） */
export function quotePrice(state: GameState, quote: CustomQuote): number {
  return Math.round(quote.basePrice * multiplierOf(state, quote.cityId));
}

export function customEstateValue(state: GameState): number {
  let v = 0;
  for (const cp of customProperties(state)) v += customPrice(state, cp);
  return v;
}

/** 壊れた物件（種類や値段が無いもの）を取り除く。読み込み時に一度だけ使う */
export function dropBrokenCustom(state: GameState): number {
  const all = state.estate?.custom;
  if (!all) return 0;
  let removed = 0;
  for (const [id, cp] of Object.entries(all)) {
    if (!cp || !PROPERTY_KIND[cp.kind] || typeof cp.basePrice !== 'number' || !Number.isFinite(cp.basePrice)) {
      delete all[id];
      removed += 1;
    }
  }
  return removed;
}

export function customRentTotal(state: GameState): number {
  let r = 0;
  for (const cp of customProperties(state)) r += customRentPerSec(state, cp);
  return r;
}

/** 地図で買った場所の土地 ID */
export function customLandId(osmId: string): string {
  return `osm:${osmId}`;
}

export function landCustomId(landId: string | undefined | null): string | null {
  if (typeof landId !== 'string') return null;
  return landId.startsWith('osm:') ? landId.slice(4) : null;
}

function countryCodeOf(name: string): LandState['country'] {
  for (const [code, label] of Object.entries(COUNTRY_NAME)) {
    if (label === name) return code as LandState['country'];
  }
  return 'JP';
}

/** その場所と一番近い都市の距離（km） */
function quoteDistanceKm(f: Pick<OsmFeature, 'lat' | 'lon'>): number {
  return estimateLandValue({ lat: f.lat, lon: f.lon }).distanceKm;
}

/** 買った場所を「施設を建てられる土地」として登録する */
export function addCustomLand(state: GameState, cp: CustomProperty, depositMult = 1): void {
  const landId = customLandId(cp.id);
  if (state.lands.some((l) => l.id === landId)) return;
  const terrain: TerrainId = cp.terrain ?? PROPERTY_TERRAIN[cp.kind];
  // 建物が建っている場所は掘れない（更地・農地・工場用地・倉庫用地・リゾートだけ）
  const diggable = cp.kind === 'land' || cp.kind === 'farm' || cp.kind === 'factory' || cp.kind === 'warehouse' || cp.kind === 'resort';
  const deposits = diggable ? depositsFor(cp.lat, cp.lon, cp.areaSqm, terrain) : {};
  if (depositMult !== 1) {
    for (const d of Object.values(deposits)) {
      if (!d) continue;
      d.total = Math.round(d.total * depositMult);
      d.remaining = Math.round(d.remaining * depositMult);
    }
  }
  const hasDeposit = Object.keys(deposits).length > 0;
  state.lands.push({
    id: landId,
    name: `${cp.name}（${cp.label}）`,
    region: cp.regionLabel,
    country: countryCodeOf(cp.country),
    terrain,
    purchasedAt: cp.boughtAt,
    // 埋蔵がありそうな土地は「未調査」から始める（調査すると何が埋まっているか分かる）
    survey: hasDeposit ? 0 : 4,
    surveyProgress: null,
    deposits,
    stock: {},
    population: PROPERTY_POPULATION[cp.kind],
    value: cp.basePrice,
  });
}

/** 地図で見つけた場所を買う */
export function buyCustomProperty(ctx: EngineContext, f: OsmFeature): boolean {
  const { state } = ctx;
  if (!state.estate.custom) state.estate.custom = {};
  if (state.estate.custom[f.id]) return false;
  // 区画は、すでに持っている区画と重ならないときだけ買える（鉱脈の二重取りを止める）
  const cell = parsePlotId(f.id);
  if (cell) {
    const clash = overlappingPlot(state, cell);
    if (clash) {
      ctx.emit('warn', `そこは「${clash.name}」と重なっています`, { toast: true });
      return false;
    }
  }
  const quote = quoteAny(f);
  const cost = customBuyCost(state, quote);
  if (state.company.cash + 1e-9 < cost) return false;
  state.company.cash -= cost;
  state.company.totalSpent += cost;
  const quoteTerrain = terrainFromTags(f.tags ?? {}, f.kind, f.lat, quoteDistanceKm(f));
  const cp: CustomProperty = {
    terrain: quoteTerrain,
    id: f.id,
    name: f.name,
    label: f.label,
    kind: f.kind,
    lat: f.lat,
    lon: f.lon,
    areaSqm: f.areaSqm,
    levels: f.levels,
    unitPrice: quote.unitPrice,
    basePrice: quote.basePrice,
    prominence: quote.prominence.mult,
    cityId: isCityId(quote.cityId) ? quote.cityId : 'tokyo',
    regionLabel: quote.regionLabel,
    country: quote.country,
    boughtAt: ctx.now(),
    boughtPrice: cost,
  };
  state.estate.custom[f.id] = cp;
  state.stats.propertiesBought += 1;
  addCustomLand(state, cp, ctx.derived.modifiers?.depositAmount ?? 1);
  ctx.emit('success', `${cp.name}（${cp.label}）を購入しました (-${cost.toLocaleString('ja-JP')}円)。施設を建てられます`, { toast: true });
  return true;
}

/** 買った場所を売る */
export function sellCustomProperty(ctx: EngineContext, id: string): number {
  const { state } = ctx;
  const cp = getCustom(state, id);
  if (!cp) return 0;
  const proceeds = customSellProceeds(state, cp);
  delete state.estate.custom![id];
  const landId = customLandId(id);
  // 先に事業をたたむ（在庫が本社に戻るので、売る前にやる）
  closeDivisionsOnLand(ctx, landId);
  // 施設ぶんの投資額も帳簿から外す（総資産に幽霊が残らないように）
  dropFacilityInvestment(state, landId);
  state.lands = state.lands.filter((l) => l.id !== landId);
  state.facilities = state.facilities.filter((f) => f.landId !== landId);
  state.company.cash += proceeds;
  state.company.totalEarned += proceeds;
  state.stats.propertiesSold += 1;
  state.stats.tradingProfit += proceeds - cp.boughtPrice;
  const diff = proceeds - cp.boughtPrice;
  ctx.emit('info', `${cp.name}を売却しました (+${proceeds.toLocaleString('ja-JP')}円、${diff >= 0 ? '利益' : '損失'} ${Math.abs(Math.round(diff)).toLocaleString('ja-JP')}円)`, { toast: true });
  return proceeds;
}

/** 表示用: 近くの都市名 */
export function customCityName(cp: CustomProperty): string {
  return isCityId(cp.cityId) ? CITY_MAP[cp.cityId].name : cp.regionLabel;
}


// ---------------------------------------------------------------------------
// 地図のどこでも買える「区画」
// ---------------------------------------------------------------------------

/**
 * 区画を、買う仕組みがそのまま使える形（OSM の建物と同じ形）に仕立てる。
 *
 * タグが無いので用途は「更地」。地形はその場所の緯度と街からの距離で決める。
 * 名前は座標から作るので、同じマスならいつ見ても同じ名前になる。
 */
export function plotFeatureAt(at: LatLon, size: PlotSizeId): OsmFeature {
  return plotFeatureOf(cellAt2(at, size));
}

function cellAt2(at: LatLon, size: PlotSizeId): PlotCell {
  const { deg } = PLOT_SIZE_MAP[size];
  return { size, row: Math.floor(at.lat / deg), col: Math.floor(at.lon / deg) };
}

export function plotFeatureOf(cell: PlotCell): OsmFeature {
  const c = cellCenter(cell);
  const v = estimateLandValue(c);
  const near = v.distanceKm < 3 ? v.nearestCityName : `${v.nearestCityName}から${Math.round(v.distanceKm)}km`;
  return {
    id: plotId(cell),
    kind: 'land',
    label: PLOT_SIZE_MAP[cell.size].name,
    name: plotName(cell, near),
    named: false,
    lat: c.lat,
    lon: c.lon,
    areaSqm: cellAreaSqm(cell),
    levels: 0,
    polygon: cellPolygon(cell),
    tags: {},
  };
}

/** 区画の地形（更地なのでタグは無く、緯度と街からの距離だけで決まる） */
export function plotTerrain(f: Pick<OsmFeature, 'lat' | 'lon'>): TerrainId {
  return terrainFromTags({}, 'land', f.lat, estimateLandValue({ lat: f.lat, lon: f.lon }).distanceKm);
}

/**
 * 地下に眠るものの値打ち（円）。
 * 決め打ちの土地（data/lands.ts）と同じ考え方で、その1%を鉱業権として値段に乗せる。
 * これが無いと、安い山林を大きく買うだけで鉱脈がただで付いてくる。
 */
export const MINERAL_RIGHT_RATIO = 0.01;

export function mineralRightOf(f: Pick<OsmFeature, 'lat' | 'lon' | 'areaSqm'>): number {
  const terrain = plotTerrain(f);
  const deposits = depositsFor(f.lat, f.lon, f.areaSqm, terrain);
  let value = 0;
  for (const [rid, d] of Object.entries(deposits) as [ResourceId, { total: number } | undefined][]) {
    if (!d) continue;
    value += d.total * (RESOURCE_MAP[rid]?.basePrice ?? 0);
  }
  return Math.round(value * MINERAL_RIGHT_RATIO);
}

/** 区画の評価額。更地としての地価に、鉱業権を足す */
export function quotePlot(f: Pick<OsmFeature, 'kind' | 'areaSqm' | 'levels' | 'lat' | 'lon'>): CustomQuote {
  const base = quoteFeature(f);
  const mineralRight = mineralRightOf(f);
  return { ...base, mineralRight, basePrice: base.basePrice + mineralRight };
}

/** 建物でも区画でも、同じ呼び方で値段を出す */
export function quoteAny(f: Pick<OsmFeature, 'id' | 'kind' | 'areaSqm' | 'levels' | 'lat' | 'lon'> & { named?: boolean; tags?: OsmFeature['tags'] }): CustomQuote {
  return isPlotId(f.id) ? quotePlot(f) : quoteFeature(f);
}

/**
 * すでに持っている区画と重なるか。
 * 大きい区画を買ってから、その中の小さい区画をもう一度買う——という
 * 二重取り（鉱脈も二重にもらえる）を止める。
 */
export function overlappingPlot(state: GameState, cell: PlotCell): CustomProperty | null {
  for (const cp of customProperties(state)) {
    const other = parsePlotId(cp?.id ?? '');
    if (other && cellsOverlap(cell, other)) return cp;
  }
  return null;
}
