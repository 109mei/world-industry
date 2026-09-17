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
import type { TerrainId } from '@/game/data/terrain';
import type { OsmFeature } from '@/game/services/osm/overpass';
import type { CustomProperty, GameState, LandState } from '@/types/state';
import type { EngineContext } from '../context';
import { creditRankDef } from './contracts';

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

export interface CustomQuote {
  /** 地価倍率を掛ける前の評価額（円） */
  basePrice: number;
  /** 土地の単価（円/㎡） */
  unitPrice: number;
  /** 土地の分（円） */
  landPart: number;
  /** 建物の分（円） */
  buildingPart: number;
  cityId: string;
  regionLabel: string;
  country: string;
}

/** 面積・階数・場所から評価額を出す */
export function quoteFeature(f: Pick<OsmFeature, 'kind' | 'areaSqm' | 'levels' | 'lat' | 'lon'>): CustomQuote {
  const v = estimateLandValue({ lat: f.lat, lon: f.lon });
  const landPart = f.areaSqm * v.unitPrice * LAND_FACTOR[f.kind];
  const floorArea = f.areaSqm * Math.max(1, f.levels);
  const buildingPart = floorArea * BUILD_COST[f.kind];
  const near = v.distanceKm < 3 ? v.nearestCityName : `${v.nearestCityName}から${Math.round(v.distanceKm)}km`;
  return {
    basePrice: Math.max(10_000, Math.round(landPart + buildingPart)),
    unitPrice: v.unitPrice,
    landPart: Math.round(landPart),
    buildingPart: Math.round(buildingPart),
    cityId: v.nearestCityId,
    regionLabel: near,
    country: v.country,
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
  return Math.round(cp.basePrice * multiplierOf(state, cp.cityId));
}

/** 買うときに払う額（手数料込み） */
export function customBuyCost(state: GameState, quote: CustomQuote): number {
  const fee = creditRankDef(state).estateFee;
  return Math.ceil(quote.basePrice * multiplierOf(state, quote.cityId) * (1 + fee));
}

/** 売って受け取る額（手数料引き） */
export function customSellProceeds(state: GameState, cp: CustomProperty): number {
  const fee = creditRankDef(state).estateFee;
  return Math.floor(customPrice(state, cp) * (1 - fee));
}

/** 賃料（円/秒） */
export function customRentPerSec(state: GameState, cp: CustomProperty): number {
  return (customPrice(state, cp) * PROPERTY_KIND[cp.kind].yield) / 3600;
}

export function customEstateValue(state: GameState): number {
  let v = 0;
  for (const cp of customProperties(state)) v += customPrice(state, cp);
  return v;
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

export function landCustomId(landId: string): string | null {
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
  const quote = quoteFeature(f);
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
