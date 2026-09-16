import type { ResourceId } from './resources';
import type { UnlockCondition } from './unlockTypes';

export type FacilityCategory =
  | 'RESOURCE'
  | 'PROCESSING'
  | 'MANUFACTURING'
  | 'POWER'
  | 'LOGISTICS'
  | 'COMMERCIAL'
  | 'INFRASTRUCTURE'
  | 'RESEARCH'
  | 'STORAGE';

export const FACILITY_CATEGORY_LABEL: Record<FacilityCategory, string> = {
  RESOURCE: '採集',
  PROCESSING: '加工',
  MANUFACTURING: '製造',
  POWER: '発電',
  LOGISTICS: '物流',
  COMMERCIAL: '商業',
  INFRASTRUCTURE: 'インフラ',
  RESEARCH: '研究',
  STORAGE: '倉庫',
};

/** 施設1単位あたりの生産（毎秒） */
export interface FacilityProduction {
  inputs?: Partial<Record<ResourceId, number>>;
  outputs?: Partial<Record<ResourceId, number>>;
}

export interface FacilityDef {
  id: string;
  name: string;
  nameEn: string;
  category: FacilityCategory;
  icon: string;
  description: string;
  /** 1個目の価格（円） */
  baseCost: number;
  /** 買うたびに価格に掛かる倍率 */
  costGrowth: number;
  /** 所有できる上限（未指定なら無制限） */
  maxCount?: number;
  /** 作業員（従業員数に数える） */
  isWorker?: boolean;
  /** 1単位あたりの従業員数 */
  employees: number;
  production?: FacilityProduction;
  /** 1単位あたりの倉庫容量の増加 */
  storageBonus?: number;
  /** 1単位あたりの電力使用量（MW）。電力システム解放後に使用 */
  powerUse?: number;
  unlock: UnlockCondition;
  hiddenUntilUnlocked?: boolean;
}

export const FACILITIES = [
  // ---- 採集（作業員） ----
  {
    id: 'worker_stone', name: '採石作業員', nameEn: 'Quarry Worker', category: 'RESOURCE', icon: 'icon_facility_worker',
    description: '石を拾い続けてくれる作業員。', baseCost: 30, costGrowth: 1.12, isWorker: true, employees: 1,
    production: { outputs: { stone: 0.2 } }, unlock: { type: 'always' },
  },
  {
    id: 'worker_wood', name: '木材作業員', nameEn: 'Lumber Worker', category: 'RESOURCE', icon: 'icon_facility_logging',
    description: '木を集め続けてくれる作業員。', baseCost: 45, costGrowth: 1.12, isWorker: true, employees: 1,
    production: { outputs: { wood: 0.15 } }, unlock: { type: 'always' },
  },
  {
    id: 'worker_gatherer', name: '採集作業員', nameEn: 'Gatherer', category: 'RESOURCE', icon: 'icon_facility_farm',
    description: '水・砂・植物繊維・粘土を少しずつ集める。', baseCost: 60, costGrowth: 1.12, isWorker: true, employees: 1,
    production: { outputs: { water: 0.1, sand: 0.1, plant_fiber: 0.08, clay: 0.05 } }, unlock: { type: 'always' },
  },
  {
    id: 'worker_scrap', name: 'スクラップ回収員', nameEn: 'Scrap Collector', category: 'RESOURCE', icon: 'icon_facility_quarry',
    description: '鉄くずを回収してくる作業員。', baseCost: 120, costGrowth: 1.15, isWorker: true, employees: 1,
    production: { outputs: { scrap_metal: 0.05 } }, unlock: { type: 'toolCrafted', tool: 'stone_hammer' },
  },
  {
    id: 'worker_miner', name: '採掘作業員', nameEn: 'Miner', category: 'RESOURCE', icon: 'icon_facility_iron_mine',
    description: '鉄鉱石を掘り続ける作業員。', baseCost: 200, costGrowth: 1.15, isWorker: true, employees: 1,
    production: { outputs: { iron_ore: 0.1 } }, unlock: { type: 'toolCrafted', tool: 'stone_pickaxe' },
  },
  {
    id: 'small_mine', name: '小型採掘機', nameEn: 'Small Mining Machine', category: 'RESOURCE', icon: 'icon_machine_excavator',
    description: '機械で鉄鉱石を採掘する。作業員より桁違いに速い。', baseCost: 2500, costGrowth: 1.2, employees: 0,
    production: { outputs: { iron_ore: 2 } }, unlock: { type: 'obtained', resource: 'iron_ore', min: 100 },
  },
  // ---- 加工 ----
  {
    id: 'simple_smelter', name: '簡易製鉄所', nameEn: 'Simple Smelter', category: 'PROCESSING', icon: 'icon_facility_steel_mill',
    description: '鉄鉱石と木から鉄を作る。鉄鉱石2＋木0.5 → 鉄1（5秒ごと）。', baseCost: 600, costGrowth: 1.18, employees: 0,
    production: { inputs: { iron_ore: 0.4, wood: 0.1 }, outputs: { iron: 0.2 } }, unlock: { type: 'obtained', resource: 'iron', min: 5 },
  },
  // ---- 製造 ----
  {
    id: 'tool_workshop', name: '工具工房', nameEn: 'Tool Workshop', category: 'MANUFACTURING', icon: 'icon_facility_machine_factory',
    description: '鉄と木から工具を自動で作る。鉄2＋木1 → 工具1（10秒ごと）。', baseCost: 3000, costGrowth: 1.2, employees: 2,
    production: { inputs: { iron: 0.2, wood: 0.1 }, outputs: { tool: 0.1 } }, unlock: { type: 'crafted', recipe: 'craft_tool', min: 5 },
  },
  {
    id: 'parts_workshop', name: '部品工房', nameEn: 'Parts Workshop', category: 'MANUFACTURING', icon: 'icon_part_gear',
    description: '鉄から機械部品を作る。鉄3＋木1 → 機械部品1（10秒ごと）。', baseCost: 8000, costGrowth: 1.2, employees: 3,
    production: { inputs: { iron: 0.3, wood: 0.1 }, outputs: { machine_parts: 0.1 } }, unlock: { type: 'crafted', recipe: 'craft_machine_parts', min: 3 },
  },
  // ---- 倉庫 ----
  {
    id: 'small_warehouse', name: '小型倉庫', nameEn: 'Small Warehouse', category: 'STORAGE', icon: 'icon_commercial_warehouse',
    description: 'すべての資源の保管容量が +1,000 される。', baseCost: 400, costGrowth: 1.25, employees: 0,
    storageBonus: 1000, unlock: { type: 'always' },
  },
  {
    id: 'large_warehouse', name: '大型倉庫', nameEn: 'Large Warehouse', category: 'STORAGE', icon: 'icon_logistics_distribution_center',
    description: 'すべての資源の保管容量が +100,000 される。', baseCost: 40000, costGrowth: 1.3, employees: 2,
    storageBonus: 100000, unlock: { type: 'facility', facility: 'small_warehouse', min: 5 },
  },
] as const satisfies readonly FacilityDef[];

export type FacilityId = (typeof FACILITIES)[number]['id'];
export const FACILITY_MAP: Record<FacilityId, FacilityDef> = Object.fromEntries(FACILITIES.map((f) => [f.id, f])) as unknown as Record<FacilityId, FacilityDef>;
export const FACILITY_CATEGORIES: FacilityCategory[] = ['RESOURCE', 'PROCESSING', 'MANUFACTURING', 'STORAGE', 'POWER', 'LOGISTICS', 'COMMERCIAL', 'INFRASTRUCTURE', 'RESEARCH'];

export function isFacilityId(id: string): id is FacilityId {
  return id in FACILITY_MAP;
}

/** n 個目（0始まり）の購入価格 */
export function facilityCost(def: FacilityDef, owned: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned));
}

/** owned 個所有している状態から count 個買うときの合計 */
export function facilityBulkCost(def: FacilityDef, owned: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += facilityCost(def, owned + i);
  return total;
}

/** 資金 cash で買える最大個数（上限 limit） */
export function facilityMaxAffordable(def: FacilityDef, owned: number, cash: number, limit = 1000): number {
  let n = 0;
  let total = 0;
  while (n < limit) {
    const c = facilityCost(def, owned + n);
    if (total + c > cash) break;
    total += c;
    n++;
    if (def.maxCount !== undefined && owned + n >= def.maxCount) break;
  }
  return n;
}
