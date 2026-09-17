/**
 * 買った実在の土地に「何がどれだけ埋まっているか」を決める。
 *
 * - 近い場所は似た埋蔵になるように、約25km四方のマス（地域）ごとに決める
 * - 地形（森・山・平野・沿岸など）で出やすい資源が変わる
 * - 量は面積に比例する
 * 実際の地質とは関係のない、ゲーム用の値。
 */
import type { ResourceId } from '@/game/data/resources';
import type { TerrainId } from '@/game/data/terrain';
import type { OsmTags } from '@/game/data/osmKinds';
import type { PropertyKind } from '@/game/data/properties';

/** 地域のマスの大きさ（度）。約25km */
const CELL = 0.25;

function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 決まった種から 0〜1 の数を順に出す */
function rngFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function regionKey(lat: number, lon: number): string {
  return `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;
}

interface Chance {
  id: ResourceId;
  /** その地形で出る確率 */
  p: number;
  /** 1㎡あたりの基準埋蔵量 */
  per: number;
}

/** 地形ごとの、出る資源と量の目安 */
const TABLE: Record<TerrainId, Chance[]> = {
  mountain: [
    { id: 'stone', p: 1, per: 40 },
    { id: 'iron_ore', p: 0.6, per: 18 },
    { id: 'coal', p: 0.45, per: 22 },
    { id: 'copper_ore', p: 0.35, per: 10 },
    { id: 'uranium_ore', p: 0.07, per: 1.2 },
  ],
  forest: [
    { id: 'wood', p: 1, per: 30 },
    { id: 'stone', p: 0.4, per: 12 },
    { id: 'iron_ore', p: 0.12, per: 6 },
  ],
  plains: [
    { id: 'wheat', p: 0.8, per: 26 },
    { id: 'water', p: 0.6, per: 30 },
    { id: 'coal', p: 0.15, per: 10 },
    { id: 'crude_oil', p: 0.08, per: 8 },
  ],
  desert: [
    { id: 'sand', p: 1, per: 60 },
    { id: 'crude_oil', p: 0.4, per: 20 },
    { id: 'uranium_ore', p: 0.1, per: 1.5 },
    { id: 'copper_ore', p: 0.2, per: 8 },
  ],
  coast: [
    { id: 'sand', p: 0.9, per: 35 },
    { id: 'water', p: 0.8, per: 40 },
    { id: 'crude_oil', p: 0.18, per: 14 },
  ],
  river: [
    { id: 'water', p: 1, per: 60 },
    { id: 'sand', p: 0.6, per: 25 },
    { id: 'clay', p: 0.5, per: 18 },
  ],
  snow: [
    { id: 'stone', p: 0.7, per: 20 },
    { id: 'crude_oil', p: 0.25, per: 16 },
    { id: 'iron_ore', p: 0.2, per: 10 },
    { id: 'uranium_ore', p: 0.05, per: 1 },
  ],
  city: [{ id: 'scrap_metal', p: 0.5, per: 2 }],
  industrial: [
    { id: 'scrap_metal', p: 0.9, per: 6 },
    { id: 'stone', p: 0.3, per: 8 },
  ],
};

/** タグと場所から地形を決める */
export function terrainFromTags(tags: OsmTags, kind: PropertyKind, lat: number, distanceToCityKm: number): TerrainId {
  const lu = tags.landuse;
  const nat = tags.natural;
  if (nat === 'water' || nat === 'beach' || nat === 'coastline' || tags.waterway) return Math.abs(lat) > 55 ? 'snow' : nat === 'beach' ? 'coast' : 'river';
  if (lu === 'forest' || nat === 'wood') return 'forest';
  if (nat === 'desert' || nat === 'sand' || nat === 'scrub') return 'desert';
  if (nat === 'peak' || nat === 'ridge' || lu === 'quarry' || tags.man_made === 'mineshaft') return 'mountain';
  if (lu === 'farmland' || lu === 'farmyard' || lu === 'orchard' || lu === 'meadow' || lu === 'vineyard' || lu === 'allotments') return 'plains';
  if (lu === 'industrial' || kind === 'factory' || kind === 'warehouse') return 'industrial';
  if (Math.abs(lat) > 60) return 'snow';
  if (distanceToCityKm < 12 && (kind === 'retail' || kind === 'office' || kind === 'apartment' || kind === 'hotel' || kind === 'house')) return 'city';
  if (distanceToCityKm < 8) return 'city';
  return 'plains';
}

export interface Deposit {
  total: number;
  remaining: number;
}

/**
 * 埋蔵資源を決める。
 * 同じ地域・同じ地形なら似た結果になり、面積が広いほど量が増える。
 */
export function depositsFor(lat: number, lon: number, areaSqm: number, terrain: TerrainId): Partial<Record<ResourceId, Deposit>> {
  const rng = rngFrom(hash32(`${regionKey(lat, lon)}|${terrain}`));
  // 地域ごとの当たり外れ（0.4〜2.2倍）
  const richness = 0.4 + rng() * 1.8;
  const out: Partial<Record<ResourceId, Deposit>> = {};
  for (const c of TABLE[terrain] ?? []) {
    if (rng() > c.p) continue;
    const spread = 0.6 + rng() * 0.9;
    const total = Math.round(areaSqm * c.per * richness * spread);
    if (total < 50) continue;
    out[c.id] = { total, remaining: total };
  }
  return out;
}

/** 表示用: その地域の当たり外れ（0〜1） */
export function regionRichness(lat: number, lon: number, terrain: TerrainId): number {
  const rng = rngFrom(hash32(`${regionKey(lat, lon)}|${terrain}`));
  return Math.min(1, (0.4 + rng() * 1.8) / 2.2);
}
