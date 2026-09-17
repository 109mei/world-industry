/**
 * 取引先は「地図に実在する建物」。
 * 近所の工場・営業所・店・倉庫に営業して契約を取り、納品してお金と関係を得る。
 * 名前はもじった架空名で、実在の企業・店舗とは関係がない。
 */
import type { PropertyKind } from './properties';
import type { ResourceId } from './resources';

/** 建物の種類ごとに欲しがるもの（前にあるものほど欲しがる） */
export const KIND_NEEDS: Record<PropertyKind, ResourceId[]> = {
  retail: ['food', 'clothing', 'tool', 'paper', 'plastic', 'furniture'],
  office: ['paper', 'electronics', 'furniture', 'wire', 'plastic'],
  factory: ['steel', 'machine_parts', 'chemical', 'copper', 'plastic', 'cast_iron'],
  warehouse: ['lumber', 'paper', 'fuel', 'tire', 'machine_parts'],
  hotel: ['food', 'cloth', 'clothing', 'furniture', 'glass'],
  apartment: ['furniture', 'glass', 'concrete', 'paint', 'lumber'],
  house: ['lumber', 'brick', 'paint', 'furniture'],
  farm: ['fertilizer', 'tool', 'fuel', 'water', 'machine_parts'],
  resort: ['food', 'clothing', 'furniture', 'glass', 'paint'],
  land: ['concrete', 'brick', 'building_material', 'lumber'],
};

/** 建物の種類ごとの「取引の大きさ」の目安（延床1,000㎡あたりの1回の注文個数） */
export const KIND_ORDER_SCALE: Record<PropertyKind, number> = {
  retail: 26,
  office: 14,
  factory: 40,
  warehouse: 34,
  hotel: 20,
  apartment: 8,
  house: 3,
  farm: 16,
  resort: 18,
  land: 6,
};

/** 関係の段階 */
export interface RelationTier {
  min: number;
  label: string;
  /** 契約の数量と単価に掛かる倍率 */
  sizeMult: number;
  priceMult: number;
}

export const RELATION_TIERS: readonly RelationTier[] = [
  { min: 0, label: '飛び込み', sizeMult: 1, priceMult: 1 },
  { min: 20, label: '取引あり', sizeMult: 1.4, priceMult: 1.05 },
  { min: 45, label: '常連', sizeMult: 2.2, priceMult: 1.12 },
  { min: 70, label: '主要な取引先', sizeMult: 3.5, priceMult: 1.2 },
  { min: 90, label: '専属パートナー', sizeMult: 5, priceMult: 1.3 },
];

export function relationTier(relation: number): RelationTier {
  let best = RELATION_TIERS[0];
  for (const t of RELATION_TIERS) if (relation >= t.min) best = t;
  return best;
}

/** 営業にかかる費用（円）。総資産に応じて上がる */
export function pitchCost(assets: number): number {
  return Math.max(1_000, Math.round(assets * 0.0006));
}

/** 営業の相手になる建物の種類（住宅と更地は相手にしない） */
export function isClientKind(kind: PropertyKind): boolean {
  return kind !== 'house' && kind !== 'land';
}

/** 営業のクールダウン（秒） */
export const PITCH_COOLDOWN = 90;
/** 商談が消えるまでの秒数 */
export const OFFER_TTL = 600;
/** 納品を落としたときに関係が下がる量 */
export const RELATION_PENALTY = 12;
/** 納品1回で上がる関係 */
export const RELATION_PER_DELIVERY = 4;
