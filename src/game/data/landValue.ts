/**
 * 世界のどこでも「土地の単価（円/㎡）」を見積もるためのデータ。
 *
 * 考え方: 値の分かっている地点（アンカー）を置き、そこから離れるほど安くなる関数
 * `値 ÷ (1 + (距離/広がり)^1.25)` の最大値を採る。
 * 都心のアンカーは「広がり」を小さく（0.4km）して鋭いピークにし、
 * 都市圏のアンカーは広く（8〜14km）して郊外の底上げに使う。
 * 数値は公示地価などを参考にしたゲーム用の目安で、実際の取引価格ではない。
 */
import { CITIES, type CityDef } from './cities';
import { distanceKm, type LatLon } from '@/utils/geo';

/** どんな僻地でもこれ以下にはしない（円/㎡） */
export const RURAL_FLOOR = 300;

/** 影響の落ち方。鋭いピーク（狭いアンカー）は速く落ちる */
function falloffOf(spreadKm: number): number {
  if (spreadKm < 2) return 2.2;
  if (spreadKm < 5) return 1.7;
  if (spreadKm < 15) return 1.6;
  return 1.25;
}

export interface ValueAnchor extends LatLon {
  name: string;
  /** その地点の土地の単価（円/㎡） */
  value: number;
  /** 影響が半分になるおおよその距離（km） */
  spread: number;
}

/** 都市（CITIES）の中心の水準と広がり */
export const CITY_VALUE: Record<string, { value: number; spread: number }> = {
  // 日本（都市圏の底上げ用に広め）
  tokyo: { value: 1_200_000, spread: 12 },
  yokohama: { value: 500_000, spread: 8 },
  osaka: { value: 700_000, spread: 10 },
  kyoto: { value: 300_000, spread: 5 },
  kobe: { value: 250_000, spread: 6 },
  nagoya: { value: 400_000, spread: 8 },
  fukuoka: { value: 400_000, spread: 7 },
  iizuka: { value: 45_000, spread: 3.5 },
  kumamoto: { value: 120_000, spread: 5 },
  sapporo: { value: 200_000, spread: 7 },
  niseko: { value: 120_000, spread: 3 },
  hokkaido_rural: { value: 3_000, spread: 40 },
  sendai: { value: 150_000, spread: 5 },
  hiroshima: { value: 150_000, spread: 5 },
  okinawa: { value: 120_000, spread: 5 },
  nagano: { value: 90_000, spread: 4 },
  hamamatsu: { value: 80_000, spread: 5 },
  // 海外
  new_york: { value: 2_500_000, spread: 6 },
  san_francisco: { value: 1_500_000, spread: 6 },
  texas: { value: 20_000, spread: 60 },
  hawaii: { value: 400_000, spread: 6 },
  toronto: { value: 600_000, spread: 8 },
  london: { value: 2_000_000, spread: 8 },
  paris: { value: 1_600_000, spread: 6 },
  berlin: { value: 700_000, spread: 8 },
  singapore: { value: 1_800_000, spread: 8 },
  hong_kong: { value: 2_800_000, spread: 5 },
  shanghai: { value: 1_000_000, spread: 10 },
  seoul: { value: 900_000, spread: 10 },
  taipei: { value: 700_000, spread: 8 },
  dubai: { value: 500_000, spread: 10 },
  sydney: { value: 800_000, spread: 10 },
  outback: { value: 500, spread: 200 },
  bangkok: { value: 300_000, spread: 10 },
  mumbai: { value: 400_000, spread: 8 },
  sao_paulo: { value: 250_000, spread: 10 },
  mato_grosso: { value: 800, spread: 150 },
  atacama: { value: 400, spread: 150 },
};

/** 都心の一等地など、都市の中心とは別に鋭いピークを作るアンカー */
export const EXTRA_ANCHORS: ValueAnchor[] = [
  // 東京
  { name: '銀座', lat: 35.6717, lon: 139.7649, value: 67_000_000, spread: 0.4 },
  { name: '新宿三丁目', lat: 35.691, lon: 139.704, value: 42_000_000, spread: 0.4 },
  { name: '丸の内', lat: 35.6815, lon: 139.7645, value: 37_600_000, spread: 0.5 },
  { name: '渋谷', lat: 35.6613, lon: 139.6985, value: 35_300_000, spread: 0.4 },
  { name: '赤坂', lat: 35.67, lon: 139.74, value: 7_110_000, spread: 0.8 },
  { name: '池袋', lat: 35.7295, lon: 139.7109, value: 20_000_000, spread: 0.4 },
  { name: '品川', lat: 35.6285, lon: 139.7387, value: 9_000_000, spread: 0.6 },
  // 大阪・京都・神戸
  { name: '梅田', lat: 34.7025, lon: 135.4959, value: 24_700_000, spread: 0.5 },
  { name: '心斎橋・難波', lat: 34.6738, lon: 135.501, value: 25_000_000, spread: 0.6 },
  { name: '四条河原町', lat: 35.0038, lon: 135.769, value: 9_000_000, spread: 0.5 },
  { name: '三宮', lat: 34.695, lon: 135.195, value: 7_000_000, spread: 0.5 },
  // 名古屋・横浜
  { name: '名駅', lat: 35.1709, lon: 136.8815, value: 20_000_000, spread: 0.5 },
  { name: '栄', lat: 35.168, lon: 136.908, value: 12_000_000, spread: 0.5 },
  { name: '横浜駅西口', lat: 35.466, lon: 139.62, value: 13_000_000, spread: 0.5 },
  { name: 'みなとみらい', lat: 35.456, lon: 139.633, value: 5_000_000, spread: 0.7 },
  // 九州・その他
  { name: '天神', lat: 33.5904, lon: 130.4017, value: 14_000_000, spread: 0.6 },
  { name: '博多駅前', lat: 33.5897, lon: 130.4207, value: 9_000_000, spread: 0.6 },
  { name: '大通（札幌）', lat: 43.0596, lon: 141.3541, value: 5_000_000, spread: 0.6 },
  { name: '仙台駅前', lat: 38.2601, lon: 140.8819, value: 4_000_000, spread: 0.6 },
  { name: '紙屋町（広島）', lat: 34.3955, lon: 132.4577, value: 3_500_000, spread: 0.6 },
  { name: '国際通り（那覇）', lat: 26.2135, lon: 127.6869, value: 2_000_000, spread: 0.5 },
  { name: '熊本・下通', lat: 32.8, lon: 130.708, value: 2_500_000, spread: 0.5 },
  { name: '飯塚駅前', lat: 33.6459, lon: 130.6915, value: 80_000, spread: 1.2 },
  { name: '北九州', lat: 33.8835, lon: 130.8752, value: 250_000, spread: 5 },
  { name: '久留米', lat: 33.3192, lon: 130.5083, value: 100_000, spread: 4 },
  { name: '下関', lat: 33.9578, lon: 130.9414, value: 90_000, spread: 4 },
  { name: '岡山', lat: 34.6618, lon: 133.9349, value: 200_000, spread: 5 },
  { name: '新潟', lat: 37.9161, lon: 139.0364, value: 130_000, spread: 5 },
  { name: '金沢', lat: 36.578, lon: 136.6486, value: 150_000, spread: 4 },
  { name: '静岡', lat: 34.9756, lon: 138.3828, value: 180_000, spread: 4 },
  { name: '千葉', lat: 35.6073, lon: 140.1063, value: 300_000, spread: 6 },
  { name: 'さいたま', lat: 35.8617, lon: 139.6455, value: 350_000, spread: 6 },
  { name: '鹿児島', lat: 31.5966, lon: 130.5571, value: 130_000, spread: 4 },
  { name: '松山', lat: 33.8416, lon: 132.7657, value: 110_000, spread: 4 },
  { name: '高松', lat: 34.3428, lon: 134.0466, value: 110_000, spread: 4 },
  // 国・地域全体の底上げ（地方部でも極端に安くなりすぎないように）
  { name: '日本', lat: 36.2, lon: 138.2, value: 8_000, spread: 300 },
  { name: '西日本', lat: 33.8, lon: 131.5, value: 7_000, spread: 200 },
  { name: '北米', lat: 39.5, lon: -98.0, value: 4_000, spread: 1500 },
  { name: 'ヨーロッパ', lat: 48.5, lon: 10.0, value: 8_000, spread: 900 },
  { name: '東アジア', lat: 33.0, lon: 118.0, value: 8_000, spread: 900 },
  { name: '東南アジア', lat: 8.0, lon: 106.0, value: 4_000, spread: 900 },
  { name: '南アジア', lat: 22.0, lon: 78.0, value: 4_000, spread: 900 },
  { name: '南米', lat: -15.0, lon: -55.0, value: 2_000, spread: 1200 },
  { name: 'アフリカ', lat: 5.0, lon: 20.0, value: 1_500, spread: 1500 },
  { name: 'オセアニア', lat: -28.0, lon: 140.0, value: 2_000, spread: 1200 },
];

interface Anchor extends ValueAnchor {
  cityId?: string;
  country?: string;
}

let anchorCache: Anchor[] | null = null;

function anchors(): Anchor[] {
  if (anchorCache) return anchorCache;
  const fromCities = (CITIES as readonly CityDef[])
    .filter((c) => CITY_VALUE[c.id] !== undefined)
    .map((c) => ({ name: c.name, lat: c.lat, lon: c.lon, value: CITY_VALUE[c.id].value, spread: CITY_VALUE[c.id].spread, cityId: c.id, country: c.country }));
  anchorCache = [...fromCities, ...EXTRA_ANCHORS];
  return anchorCache;
}

export interface ValueEstimate {
  /** 土地の単価（円/㎡） */
  unitPrice: number;
  /** 値のもとになったアンカー（表示用） */
  anchorName: string;
  /** もっとも近い都市 */
  nearestCityId: string;
  nearestCityName: string;
  country: string;
  distanceKm: number;
}

/** その場所の土地の単価を見積もる */
export function estimateLandValue(at: LatLon): ValueEstimate {
  let best = RURAL_FLOOR;
  let bestName = '地方';
  let nearestCity = { id: 'tokyo', name: '東京', country: '日本', d: Number.POSITIVE_INFINITY };
  for (const a of anchors()) {
    const d = distanceKm(a, at);
    if (a.cityId && d < nearestCity.d) nearestCity = { id: a.cityId, name: a.name, country: a.country ?? '日本', d };
    const v = a.value / (1 + Math.pow(d / a.spread, falloffOf(a.spread)));
    if (v > best) {
      best = v;
      bestName = a.name;
    }
  }
  return {
    unitPrice: Math.max(RURAL_FLOOR, Math.round(best)),
    anchorName: bestName,
    nearestCityId: nearestCity.id,
    nearestCityName: nearestCity.name,
    country: nearestCity.country,
    distanceKm: nearestCity.d,
  };
}
