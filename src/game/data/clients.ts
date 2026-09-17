/**
 * 取引先（株式に出てくる架空の会社）が欲しがるもの。
 * 営業して契約を取り、納品してお金と信用・関係を得る。
 */
import type { Sector } from './companies';
import type { ResourceId } from './resources';

/** 業種ごとに欲しがる資源（前にあるものほど欲しがる） */
export const SECTOR_NEEDS: Record<Sector, ResourceId[]> = {
  realestate: ['building_material', 'concrete', 'brick', 'glass', 'steel'],
  energy: ['coal', 'crude_oil', 'nuclear_fuel', 'copper', 'steel'],
  mining: ['tool', 'machine_parts', 'steel', 'fuel'],
  construction: ['building_material', 'concrete', 'steel', 'brick', 'machine_parts'],
  logistics: ['fuel', 'car', 'machine_parts', 'rubber'],
  food: ['wheat', 'flour', 'water', 'plastic'],
  shipping: ['fuel', 'steel', 'machine_parts'],
  finance: ['tool', 'electronics', 'glass'],
  heavy: ['steel', 'cast_iron', 'machine_parts', 'iron', 'copper'],
  airline: ['steel', 'fuel', 'electronics', 'machine_parts'],
  it: ['semiconductor', 'electronics', 'plastic', 'copper'],
  semiconductor: ['silicon', 'semiconductor', 'copper', 'glass'],
  trading: ['tool', 'cloth', 'wheat', 'plastic', 'steel'],
  auto: ['steel', 'machine_parts', 'rubber', 'electronics', 'plastic'],
  agri: ['water', 'tool', 'fuel', 'machine_parts'],
  hotel: ['cloth', 'glass', 'building_material', 'flour'],
  steel: ['iron_ore', 'coal', 'scrap_metal', 'iron'],
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
  { min: 0, label: '面識なし', sizeMult: 1, priceMult: 1 },
  { min: 20, label: '取引あり', sizeMult: 1.4, priceMult: 1.05 },
  { min: 45, label: '常連', sizeMult: 2.2, priceMult: 1.12 },
  { min: 70, label: '主要取引先', sizeMult: 3.5, priceMult: 1.2 },
  { min: 90, label: '専属パートナー', sizeMult: 5, priceMult: 1.3 },
];

export function relationTier(relation: number): RelationTier {
  let best = RELATION_TIERS[0];
  for (const t of RELATION_TIERS) if (relation >= t.min) best = t;
  return best;
}

/** 営業にかかる費用（円）。総資産に応じて上がる */
export function pitchCost(assets: number): number {
  return Math.max(2_000, Math.round(assets * 0.0008));
}

/** 営業のクールダウン（秒） */
export const PITCH_COOLDOWN = 120;
/** 商談が消えるまでの秒数 */
export const OFFER_TTL = 600;
/** 納品を落としたときに関係が下がる量 */
export const RELATION_PENALTY = 12;
/** 納品1回で上がる関係 */
export const RELATION_PER_DELIVERY = 4;
