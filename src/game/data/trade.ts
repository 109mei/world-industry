/**
 * 貿易。
 *
 * 同じ品でも、産地では安く、遠い消費地では高い。
 * 安いところで仕入れ、船か飛行機で運び、高いところで売る——これが商売の中身になる。
 *
 * ここにあるのは「国ごとの値段の癖」「距離」「関税」「為替」といった、動かない設定。
 * 実際に値が動くところは systems/trade.ts にある。
 */
import { COUNTRY_NAME, LANDS, type CountryCode } from './lands';
import type { ResourceId } from './resources';

export interface CountryDef {
  id: CountryCode;
  name: string;
  /** 主な港のだいたいの位置。地図に航路を描くのに使う */
  lat: number;
  lon: number;
  /** 日本の港からのおおよその距離（km）。運賃と日数はここから決まる */
  distanceKm: number;
  /** 輸入するときに掛かる関税（0.08 なら 8%） */
  tariff: number;
  /** その国の得意分野。ここに当たる品は安く手に入る */
  strong: ResourceId[];
  /** その国で足りていないもの。ここに当たる品は高く売れる */
  short: ResourceId[];
  note: string;
}

/** 産地は安く、そうでない国は高い。倍率の下限と上限 */
export const STRONG_BIAS = 0.62;
export const SHORT_BIAS = 1.45;

/**
 * 国ごとの設定。実在の国名を借りているが、数字はゲーム用のもの。
 * strong / short は「その国らしさ」を出すためのもので、現実の統計ではない。
 */
export const COUNTRIES: readonly CountryDef[] = [
  {
    id: 'JP', name: COUNTRY_NAME.JP, lat: 35.45, lon: 139.64, distanceKm: 400, tariff: 0,
    strong: ['machine_parts', 'tool', 'robot', 'car'],
    short: ['crude_oil', 'iron_ore', 'coal', 'copper_ore', 'wheat'],
    note: '国内。運賃は安いが、資源はほとんど自前で採れない。',
  },
  {
    id: 'CN', name: COUNTRY_NAME.CN, lat: 31.23, lon: 121.47, distanceKm: 1_800, tariff: 0.04,
    strong: ['steel', 'cloth', 'clothing', 'plastic', 'electronics', 'battery'],
    short: ['crude_oil', 'iron_ore', 'gem', 'gold'],
    note: '工業製品がとにかく安い。近いので運賃も安い。',
  },
  {
    id: 'US', name: COUNTRY_NAME.US, lat: 33.74, lon: -118.26, distanceKm: 10_000, tariff: 0.05,
    strong: ['wheat', 'flour', 'food', 'crude_oil', 'semiconductor', 'gpu'],
    short: ['tire', 'car', 'furniture'],
    note: '農産物と先端品。市場が大きく、たいていのものが売れる。',
  },
  {
    id: 'DE', name: COUNTRY_NAME.DE, lat: 53.55, lon: 9.99, distanceKm: 9_200, tariff: 0.06,
    strong: ['car', 'machine_parts', 'chemical', 'tool'],
    short: ['crude_oil', 'iron_ore', 'copper', 'rubber'],
    note: '機械と化学に強い。資源はほとんど輸入に頼っている。',
  },
  {
    id: 'NO', name: COUNTRY_NAME.NO, lat: 60.39, lon: 5.32, distanceKm: 8_500, tariff: 0.07,
    strong: ['fuel', 'crude_oil', 'chemical', 'fertilizer'],
    short: ['food', 'clothing', 'furniture', 'electronics'],
    note: '電気と燃料が安い。物価が高く、売るには良い相手。',
  },
  {
    id: 'AU', name: COUNTRY_NAME.AU, lat: -20.31, lon: 118.58, distanceKm: 7_800, tariff: 0.03,
    strong: ['iron_ore', 'coal', 'uranium_ore', 'gold_ore', 'rough_gem'],
    short: ['car', 'electronics', 'machine_parts', 'semiconductor'],
    note: '資源の塊。鉄鉱石と石炭を買うならここ。',
  },
  {
    id: 'BR', name: COUNTRY_NAME.BR, lat: -23.96, lon: -46.33, distanceKm: 18_500, tariff: 0.09,
    strong: ['iron_ore', 'copper_ore', 'gold_ore', 'wood', 'rubber', 'sap'],
    short: ['semiconductor', 'gpu', 'robot', 'car'],
    note: '鉄・銅・木材が安い。遠いので運賃と日数がかさむ。',
  },
  {
    id: 'CL', name: COUNTRY_NAME.CL, lat: -33.03, lon: -71.62, distanceKm: 17_200, tariff: 0.08,
    strong: ['copper_ore', 'copper', 'silver_ore', 'silver'],
    short: ['car', 'tool', 'machine_parts', 'food'],
    note: '銅と銀の国。世界の銅はここから出ていく。',
  },
  {
    id: 'SA', name: COUNTRY_NAME.SA, lat: 26.9, lon: 49.6, distanceKm: 9_000, tariff: 0.05,
    strong: ['crude_oil', 'fuel', 'plastic'],
    short: ['wheat', 'food', 'wood', 'steel', 'car'],
    note: '原油はどこよりも安い。食べ物と木は何でも高く売れる。',
  },
  {
    id: 'CA', name: COUNTRY_NAME.CA, lat: 49.29, lon: -123.11, distanceKm: 8_300, tariff: 0.04,
    strong: ['wood', 'lumber', 'paper', 'uranium_ore', 'crude_oil'],
    short: ['electronics', 'clothing', 'semiconductor'],
    note: '木材と原子力燃料。広い国土から資源が出る。',
  },
];

export const COUNTRY_MAP: Record<CountryCode, CountryDef> = Object.fromEntries(COUNTRIES.map((c) => [c.id, c])) as Record<CountryCode, CountryDef>;

export function isCountryCode(v: unknown): v is CountryCode {
  return typeof v === 'string' && v in COUNTRY_MAP;
}

/** その国に鉱脈のある資源（土地のデータから引く。産地はやはり安い） */
const DEPOSIT_BY_COUNTRY = (() => {
  const out: Partial<Record<CountryCode, Set<string>>> = {};
  for (const l of LANDS) {
    const set = out[l.country as CountryCode] ?? new Set<string>();
    for (const k of Object.keys(l.deposits)) set.add(k);
    out[l.country as CountryCode] = set;
  }
  return out;
})();

/**
 * 国と品の組み合わせから決まる、小さな地域差（0.86〜1.14）。
 * 得意でも苦手でもない品にも「その国なりの値段」があるようにするためのもの。
 * これが無いと、目立つ品以外はどの国でも同じ値段になって、商売にならない。
 * 同じ組み合わせなら必ず同じ値になる（毎回ばらつくと相場が読めない）。
 */
function regionalBias(country: CountryCode, resource: ResourceId): number {
  let h = 2166136261;
  const s = `${country}/${resource}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const t = ((h >>> 0) % 10_000) / 10_000; // 0〜1
  return 0.86 + t * 0.28;
}

/**
 * その国での値段の癖（1 が世界の基準）。
 * 得意なもの・鉱脈のあるものは安く、足りていないものは高い。
 * どちらでもない品にも、小さな地域差がつく。
 */
export function countryBias(country: CountryCode, resource: ResourceId): number {
  const def = COUNTRY_MAP[country];
  if (!def) return 1;
  const region = regionalBias(country, resource);
  if (def.strong.includes(resource)) return STRONG_BIAS * region;
  if (def.short.includes(resource)) return SHORT_BIAS * region;
  if (DEPOSIT_BY_COUNTRY[country]?.has(resource)) return 0.75 * region;
  return region;
}

export type ShipMode = 'truck' | 'ship' | 'air';

export interface ShipModeDef {
  id: ShipMode;
  name: string;
  icon: string;
  /** この手段を使うために買う施設の id。持っていないと使えない */
  fleetId: 'fleet_truck' | 'fleet_ship' | 'fleet_plane';
  /** 10,000km を運ぶのにかかる秒数 */
  secondsPer10000km: number;
  /** 1t を 1,000km 運ぶ運賃（円） */
  costPerTonPer1000km: number;
  /** 1回で運べる重さの上限（t） */
  maxTons: number;
  /** 国内（この距離まで）でしか使えない。0 なら制限なし */
  domesticOnlyKm: number;
  note: string;
}

export const SHIP_MODES: readonly ShipModeDef[] = [
  { id: 'truck', name: 'トラック', icon: 'icon_logistics_truck', fleetId: 'fleet_truck', secondsPer10000km: 400, costPerTonPer1000km: 900, maxTons: 20, domesticOnlyKm: 2_000, note: '国内だけ。少量なら小回りがきく。' },
  { id: 'ship', name: '船', icon: 'icon_logistics_ship', fleetId: 'fleet_ship', secondsPer10000km: 150, costPerTonPer1000km: 24, maxTons: 40_000, domesticOnlyKm: 0, note: '安くて大量に運べる。そのかわり遅い。' },
  { id: 'air', name: '飛行機', icon: 'icon_logistics_airplane', fleetId: 'fleet_plane', secondsPer10000km: 26, costPerTonPer1000km: 900, maxTons: 100, domesticOnlyKm: 0, note: '速いが高い。急ぎの契約はこれで間に合わせる。' },
];

export const SHIP_MODE_MAP: Record<ShipMode, ShipModeDef> = Object.fromEntries(SHIP_MODES.map((m) => [m.id, m])) as Record<ShipMode, ShipModeDef>;

/** 何秒で届くか（最短20秒） */
export function shipSeconds(mode: ShipMode, distanceKm: number): number {
  const def = SHIP_MODE_MAP[mode];
  if (!def) return 60;
  return Math.max(20, Math.round((distanceKm / 10_000) * def.secondsPer10000km));
}

/** 運賃（円） */
export function shipCost(mode: ShipMode, distanceKm: number, tons: number): number {
  const def = SHIP_MODE_MAP[mode];
  if (!def) return 0;
  return Math.ceil(def.costPerTonPer1000km * (distanceKm / 1_000) * Math.max(0.001, tons));
}

/** その手段が使えるか */
export function canUseMode(mode: ShipMode, distanceKm: number, tons: number): { ok: boolean; reason?: string } {
  const def = SHIP_MODE_MAP[mode];
  if (!def) return { ok: false, reason: 'その手段はありません' };
  if (def.domesticOnlyKm > 0 && distanceKm > def.domesticOnlyKm) return { ok: false, reason: '遠すぎます（国内向け）' };
  if (tons > def.maxTons) return { ok: false, reason: `1回で運べるのは ${def.maxTons.toLocaleString('ja-JP')}t まで` };
  return { ok: true };
}

/** 為替が動く幅 */
export const FX_MIN = 0.7;
export const FX_MAX = 1.4;
/** 国ごとの相場が動く幅 */
export const COUNTRY_PRICE_MIN = 0.55;
export const COUNTRY_PRICE_MAX = 1.9;

/**
 * 取引相手の会社名を作るための部品。
 * すべて架空で、実在の企業とは関係がない。
 * 「国から話が来る」のではなく「どこかの会社から話が来る」ようにするために使う。
 */
const FIRM_HEAD: Record<CountryCode, string[]> = {
  JP: ['旭', '大和', '三洋', '明和', '第一', '新東', '丸伊', '光和', '中央', '東邦'],
  CN: ['華南', '長江', '東方', '金陽', '大成', '恒通', '広利', '鴻運'],
  US: ['Redstone', 'Pacific', 'Ironbridge', 'Summit', 'Lakeside', 'Northgate', 'Baytown'],
  DE: ['Rheinwerk', 'Stahlhof', 'Nordmann', 'Alpenberg', 'Westtor', 'Eisenfeld'],
  NO: ['Fjordvik', 'Nordlys', 'Havsund', 'Bergvik', 'Storvik'],
  AU: ['Redearth', 'Pilbarra', 'Southern Cross', 'Goldfield', 'Coralbay'],
  BR: ['Rio Verde', 'Serra Alta', 'Amazonia', 'Porto Novo', 'Minas'],
  CL: ['Andes', 'Valparaiso', 'Cobre Sur', 'Atacama', 'Puerto Claro'],
  SA: ['Al Nahda', 'Desert Gate', 'Rub Al', 'Najd', 'Gulf Star'],
  CA: ['Maple Ridge', 'Northwood', 'Lakeshore', 'Prairie', 'Bayview'],
};

const FIRM_TAIL: Record<CountryCode, string[]> = {
  JP: ['商事', '物産', '産業', '興業', '通商', '産機'],
  CN: ['貿易', '実業', '集団', '進出口'],
  US: ['Trading', 'Commodities', 'Supply Co.', 'Industries', 'Materials'],
  DE: ['Handel', 'Rohstoffe', 'GmbH', 'Werke'],
  NO: ['Handel', 'Trading', 'AS'],
  AU: ['Resources', 'Trading', 'Minerals', 'Pty'],
  BR: ['Comercio', 'Recursos', 'Trading'],
  CL: ['Comercial', 'Minerales', 'Trading'],
  SA: ['Trading', 'Petrochem', 'Holding'],
  CA: ['Resources', 'Trading', 'Forest Co.'],
};

/** その国の、架空の取引会社の名前を1つ作る */
export function firmName(country: CountryCode, seed: number): string {
  const heads = FIRM_HEAD[country] ?? FIRM_HEAD.JP;
  const tails = FIRM_TAIL[country] ?? FIRM_TAIL.JP;
  const h = heads[Math.abs(Math.floor(seed)) % heads.length];
  const t = tails[Math.abs(Math.floor(seed / 7)) % tails.length];
  return country === 'JP' || country === 'CN' ? `${h}${t}` : `${h} ${t}`;
}

/** 2点間のだいたいの距離（km）。地球を丸い球とみなした計算 */
export function distanceBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s1 = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s1))));
}

/** いちばん近い国を返す（取引先の建物がどの国にあるかを見るのに使う） */
export function nearestCountry(at: { lat: number; lon: number }): CountryCode {
  let best: CountryCode = 'JP';
  let bestD = Infinity;
  for (const c of COUNTRIES) {
    const d = distanceBetween(at, { lat: c.lat, lon: c.lon });
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

/**
 * どうやってこちらを知ったか。
 * 「どこかの国が」ではなく「この会社が、こういう経緯で」話を持ってきた、と分かるようにする。
 */
export const CONTACT_REASONS = [
  '広告を見て',
  '電話で問い合わせが来て',
  'うわさを聞いて',
  '近くを通りかかって',
  '同業者の紹介で',
  '取引先からの口づて',
] as const;

/** 前に納品したことのある相手からの話 */
export const REPEAT_REASONS = [
  '前に納めた縁で',
  '品物が良かったからと',
  '同じ条件でまた、と',
] as const;
