import type { ResourceId } from './resources';
import type { TerrainId } from './terrain';
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

/** 輸送手段の種類。イベント（地震・嵐）の影響の判定に使う */
export type TransportKind = 'road' | 'rail' | 'sea' | 'pipe' | 'air';

export const TRANSPORT_KIND_LABEL: Record<TransportKind, string> = {
  road: '陸路',
  rail: '鉄道',
  sea: '海路',
  pipe: 'パイプライン',
  air: '空路',
};

/** 輸送手段としての性能（土地→本社の往復に使う） */
export interface TransportSpec {
  kind: TransportKind;
  /** 1単位あたりの輸送能力（t/秒） */
  capacity: number;
  /** 1t あたりの費用（円） */
  costPerTon: number;
  /** 液体しか運べない（原油・燃料・水） */
  liquidOnly?: boolean;
}

/** どこに建てられるか。hq=本社のみ land=購入した土地のみ any=どこでも */
export type FacilitySite = 'hq' | 'land' | 'any';

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
  /** outputs を土地の鉱脈から掘る（残量がなくなると停止） */
  extractsDeposit?: boolean;
  /** 1単位あたりの倉庫容量の増加（本社の施設は本社、土地の施設はその土地） */
  storageBonus?: number;
  /** 1単位あたりの電力使用量（MW） */
  powerUse?: number;
  /** 1単位あたりの発電量（MW） */
  powerGen?: number;
  /** 最大出力時の燃料消費（毎秒） */
  fuel?: Partial<Record<ResourceId, number>>;
  /** 再生可能エネルギー（燃料不要） */
  renewable?: boolean;
  /** 地形による効率倍率（未指定の地形は 1） */
  terrainBonus?: Partial<Record<TerrainId, number>>;
  /** この地形にしか建てられない */
  allowedTerrain?: TerrainId[];
  /** 建てられる場所 */
  site: FacilitySite;
  /** 人口係数 1 のときの収入（円/秒） */
  income?: number;
  transport?: TransportSpec;
  /** 研究ポイントの生産（/秒） */
  researchRate?: number;
  unlock: UnlockCondition;
  hiddenUntilUnlocked?: boolean;
}

export const FACILITIES = [
  // ---- 採集（作業員：本社） ----
  {
    id: 'worker_stone', name: '採石作業員', nameEn: 'Quarry Worker', category: 'RESOURCE', icon: 'icon_facility_worker', site: 'hq',
    description: '石を拾い続けてくれる作業員。', baseCost: 30, costGrowth: 1.12, isWorker: true, employees: 1,
    production: { outputs: { stone: 0.2 } }, unlock: { type: 'always' },
  },
  {
    id: 'worker_wood', name: '木材作業員', nameEn: 'Lumber Worker', category: 'RESOURCE', icon: 'icon_facility_logging', site: 'hq',
    description: '木を集め続けてくれる作業員。', baseCost: 45, costGrowth: 1.12, isWorker: true, employees: 1,
    production: { outputs: { wood: 0.15 } }, unlock: { type: 'always' },
  },
  {
    id: 'worker_gatherer', name: '採集作業員', nameEn: 'Gatherer', category: 'RESOURCE', icon: 'icon_facility_farm', site: 'hq',
    description: '水・砂・植物繊維・粘土を少しずつ集める。', baseCost: 60, costGrowth: 1.12, isWorker: true, employees: 1,
    production: { outputs: { water: 0.1, sand: 0.1, plant_fiber: 0.08, clay: 0.05 } }, unlock: { type: 'always' },
  },
  {
    id: 'worker_scrap', name: 'スクラップ回収員', nameEn: 'Scrap Collector', category: 'RESOURCE', icon: 'icon_facility_quarry', site: 'hq',
    description: '鉄くずを回収してくる作業員。', baseCost: 120, costGrowth: 1.15, isWorker: true, employees: 1,
    production: { outputs: { scrap_metal: 0.05 } }, unlock: { type: 'toolCrafted', tool: 'stone_hammer' },
  },
  {
    id: 'worker_miner', name: '採掘作業員', nameEn: 'Miner', category: 'RESOURCE', icon: 'icon_facility_iron_mine', site: 'hq',
    description: '鉄鉱石を掘り続ける作業員。', baseCost: 200, costGrowth: 1.15, isWorker: true, employees: 1,
    production: { outputs: { iron_ore: 0.1 } }, unlock: { type: 'toolCrafted', tool: 'stone_pickaxe' },
  },
  {
    id: 'small_mine', name: '小型採掘機', nameEn: 'Small Mining Machine', category: 'RESOURCE', icon: 'icon_machine_excavator', site: 'hq',
    description: '機械で鉄鉱石を採掘する。作業員より桁違いに速い。', baseCost: 2500, costGrowth: 1.2, employees: 0,
    production: { outputs: { iron_ore: 2 } }, unlock: { type: 'obtained', resource: 'iron_ore', min: 100 },
  },
  // ---- 採集（土地：鉱山・農園） ----
  {
    id: 'quarry', name: '採石場', nameEn: 'Quarry', category: 'RESOURCE', icon: 'icon_facility_quarry', site: 'land',
    description: '土地で石を大量に切り出す。山岳で効率 +50%。', baseCost: 50_000, costGrowth: 1.15, employees: 3,
    production: { outputs: { stone: 3 } }, terrainBonus: { mountain: 1.5, city: 0.5 }, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'lumber_camp', name: '伐採場', nameEn: 'Lumber Camp', category: 'RESOURCE', icon: 'icon_facility_logging', site: 'land',
    description: '土地の森林から木材を切り出す。森林で効率2倍、砂漠では育たない。', baseCost: 60_000, costGrowth: 1.15, employees: 3,
    production: { outputs: { wood: 2 } }, terrainBonus: { forest: 2, river: 1.3, desert: 0.1, snow: 0.5, city: 0.3 }, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'wheat_farm', name: '小麦農園', nameEn: 'Wheat Farm', category: 'RESOURCE', icon: 'icon_facility_wheat_farm', site: 'land',
    description: '小麦を育てる。平原で効率2倍、河川で1.5倍。砂漠や寒冷地では育ちにくい。', baseCost: 80_000, costGrowth: 1.15, employees: 4,
    production: { inputs: { water: 0.5 }, outputs: { wheat: 1.5 } }, terrainBonus: { plains: 2, river: 1.5, forest: 0.7, desert: 0.2, snow: 0.2, mountain: 0.5, city: 0.3 }, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'coal_mine', name: '炭鉱', nameEn: 'Coal Mine', category: 'RESOURCE', icon: 'icon_facility_coal_mine', site: 'land',
    description: '土地の石炭鉱脈を掘る。地質調査済みの土地に建てられ、鉱脈を掘り尽くすと止まる。', baseCost: 150_000, costGrowth: 1.15, employees: 5,
    production: { outputs: { coal: 5 } }, extractsDeposit: true, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'iron_mine', name: '大型鉄鉱山', nameEn: 'Iron Mine', category: 'RESOURCE', icon: 'icon_facility_iron_mine', site: 'land',
    description: '鉄鉱脈から鉄鉱石を大量に掘る。', baseCost: 250_000, costGrowth: 1.15, employees: 6,
    production: { outputs: { iron_ore: 10 } }, extractsDeposit: true, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'copper_mine', name: '銅鉱山', nameEn: 'Copper Mine', category: 'RESOURCE', icon: 'icon_facility_copper_mine', site: 'land',
    description: '銅鉱脈から銅鉱石を掘る。', baseCost: 300_000, costGrowth: 1.15, employees: 6,
    production: { outputs: { copper_ore: 4 } }, extractsDeposit: true, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'oil_well', name: '油井', nameEn: 'Oil Well', category: 'RESOURCE', icon: 'icon_facility_oil_well', site: 'land',
    description: '油田から原油を汲み上げる。', baseCost: 400_000, costGrowth: 1.15, employees: 4,
    production: { outputs: { crude_oil: 5 } }, extractsDeposit: true, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'uranium_mine', name: 'ウラン鉱山', nameEn: 'Uranium Mine', category: 'RESOURCE', icon: 'icon_facility_uranium_mine', site: 'land',
    description: 'ウラン鉱脈からウラン鉱石を掘る。原子力工学の研究が必要。電力 2MW。', baseCost: 5_000_000, costGrowth: 1.2, employees: 10, powerUse: 2,
    production: { outputs: { uranium_ore: 0.1 } }, extractsDeposit: true, unlock: { type: 'research', research: 'nuclear' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'rubber_plantation', name: 'ゴム農園', nameEn: 'Rubber Plantation', category: 'RESOURCE', icon: 'icon_facility_rubber_plantation', site: 'land',
    description: 'ゴムを育てる。水0.3 → ゴム1（毎秒）。森林で効率2倍、砂漠や寒冷地では育たない。', baseCost: 150_000, costGrowth: 1.15, employees: 5,
    production: { inputs: { water: 0.3 }, outputs: { rubber: 1 } }, terrainBonus: { forest: 2, river: 1.3, plains: 0.8, desert: 0.1, snow: 0.1, mountain: 0.5, city: 0.3 }, unlock: { type: 'research', research: 'automotive' }, hiddenUntilUnlocked: true,
  },
  // ---- 加工 ----
  {
    id: 'simple_smelter', name: '簡易製鉄所', nameEn: 'Simple Smelter', category: 'PROCESSING', icon: 'icon_facility_steel_mill', site: 'hq',
    description: '鉄鉱石と木から鉄を作る。鉄鉱石2＋木0.5 → 鉄1（5秒ごと）。', baseCost: 600, costGrowth: 1.18, employees: 0,
    production: { inputs: { iron_ore: 0.4, wood: 0.1 }, outputs: { iron: 0.2 } }, unlock: { type: 'obtained', resource: 'iron', min: 5 },
  },
  {
    id: 'steel_mill', name: '製鋼所', nameEn: 'Steel Mill', category: 'PROCESSING', icon: 'icon_facility_steel_mill', site: 'any',
    description: '鉄と石炭から鋼鉄を作る。鉄2＋石炭1 → 鋼鉄1（毎秒）。電力 2MW。', baseCost: 200_000, costGrowth: 1.18, employees: 8, powerUse: 2,
    production: { inputs: { iron: 2, coal: 1 }, outputs: { steel: 1 } }, unlock: { type: 'obtained', resource: 'coal', min: 50 },
  },
  {
    id: 'copper_smelter', name: '銅精錬所', nameEn: 'Copper Smelter', category: 'PROCESSING', icon: 'icon_facility_aluminum_refinery', site: 'any',
    description: '銅鉱石2 → 銅1（毎秒）。電力 1.5MW。', baseCost: 150_000, costGrowth: 1.18, employees: 6, powerUse: 1.5,
    production: { inputs: { copper_ore: 2 }, outputs: { copper: 1 } }, unlock: { type: 'obtained', resource: 'copper_ore', min: 50 },
  },
  {
    id: 'oil_refinery', name: '製油所', nameEn: 'Oil Refinery', category: 'PROCESSING', icon: 'icon_facility_oil_refinery', site: 'any',
    description: '原油2 → 燃料1（毎秒）。電力 3MW。', baseCost: 400_000, costGrowth: 1.18, employees: 8, powerUse: 3,
    production: { inputs: { crude_oil: 2 }, outputs: { fuel: 1 } }, unlock: { type: 'obtained', resource: 'crude_oil', min: 100 },
  },
  {
    id: 'flour_mill', name: '製粉所', nameEn: 'Flour Mill', category: 'PROCESSING', icon: 'icon_facility_food_factory', site: 'any',
    description: '小麦1 → 小麦粉1（毎秒）。電力 0.5MW。', baseCost: 50_000, costGrowth: 1.15, employees: 3, powerUse: 0.5,
    production: { inputs: { wheat: 1 }, outputs: { flour: 1 } }, unlock: { type: 'obtained', resource: 'wheat', min: 100 },
  },
  {
    id: 'enrichment_plant', name: '核燃料濃縮工場', nameEn: 'Enrichment Plant', category: 'PROCESSING', icon: 'icon_facility_chemical_plant', site: 'any',
    description: 'ウラン鉱石10 → 核燃料1（100秒ごと）。電力 20MW。', baseCost: 20_000_000, costGrowth: 1.25, employees: 30, powerUse: 20,
    production: { inputs: { uranium_ore: 0.1 }, outputs: { nuclear_fuel: 0.01 } }, unlock: { type: 'research', research: 'nuclear' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'concrete_plant', name: 'コンクリート工場', nameEn: 'Concrete Plant', category: 'PROCESSING', icon: 'icon_facility_concrete_plant', site: 'any',
    description: '砂2＋石1＋水1 → コンクリート2（毎秒）。', baseCost: 60_000, costGrowth: 1.18, employees: 4,
    production: { inputs: { sand: 2, stone: 1, water: 1 }, outputs: { concrete: 2 } }, unlock: { type: 'obtained', resource: 'concrete', min: 20 },
  },
  {
    id: 'textile_mill', name: '織物工場', nameEn: 'Textile Mill', category: 'PROCESSING', icon: 'icon_facility_textile_factory', site: 'any',
    description: '植物繊維4＋水1 → 布1（毎秒）。', baseCost: 80_000, costGrowth: 1.18, employees: 5,
    production: { inputs: { plant_fiber: 4, water: 1 }, outputs: { cloth: 1 } }, unlock: { type: 'obtained', resource: 'cloth', min: 5 },
  },
  {
    id: 'foundry', name: '鋳造所', nameEn: 'Foundry', category: 'PROCESSING', icon: 'icon_material_steel_plate', site: 'any',
    description: '鉄くず4＋石炭0.5 → 鋳鉄2（毎秒）。電力 1MW。', baseCost: 120_000, costGrowth: 1.18, employees: 5, powerUse: 1,
    production: { inputs: { scrap_metal: 4, coal: 0.5 }, outputs: { cast_iron: 2 } }, unlock: { type: 'obtained', resource: 'cast_iron', min: 20 },
  },
  {
    id: 'building_material_workshop', name: '建材工房', nameEn: 'Building Material Workshop', category: 'MANUFACTURING', icon: 'icon_marker_construction', site: 'any',
    description: 'レンガ5＋コンクリート2＋縄1 → 建材セット0.5（毎秒）。', baseCost: 150_000, costGrowth: 1.18, employees: 6,
    production: { inputs: { brick: 5, concrete: 2, rope: 1 }, outputs: { building_material: 0.5 } }, unlock: { type: 'obtained', resource: 'building_material', min: 10 },
  },
  {
    id: 'brick_kiln', name: 'レンガ工場', nameEn: 'Brick Kiln', category: 'PROCESSING', icon: 'icon_facility_brick_factory', site: 'any',
    description: '粘土2＋木1 → レンガ3（毎秒）。', baseCost: 40_000, costGrowth: 1.18, employees: 3,
    production: { inputs: { clay: 2, wood: 1 }, outputs: { brick: 3 } }, unlock: { type: 'crafted', recipe: 'fire_brick', min: 5 },
  },
  {
    id: 'glass_factory', name: 'ガラス工場', nameEn: 'Glass Factory', category: 'PROCESSING', icon: 'icon_facility_glass_factory', site: 'any',
    description: '砂3＋石炭0.5 → ガラス1（毎秒）。電力 2MW。', baseCost: 150_000, costGrowth: 1.18, employees: 6, powerUse: 2,
    production: { inputs: { sand: 3, coal: 0.5 }, outputs: { glass: 1 } }, unlock: { type: 'all', conditions: [{ type: 'obtained', resource: 'sand', min: 500 }, { type: 'obtained', resource: 'coal', min: 50 }] },
  },
  {
    id: 'plastic_plant', name: 'プラスチック工場', nameEn: 'Plastic Plant', category: 'PROCESSING', icon: 'icon_facility_plastic_factory', site: 'any',
    description: '原油1.5 → プラスチック1（毎秒）。電力 3MW。', baseCost: 300_000, costGrowth: 1.18, employees: 8, powerUse: 3,
    production: { inputs: { crude_oil: 1.5 }, outputs: { plastic: 1 } }, unlock: { type: 'obtained', resource: 'crude_oil', min: 300 },
  },
  {
    id: 'silicon_plant', name: 'シリコン精製所', nameEn: 'Silicon Plant', category: 'PROCESSING', icon: 'icon_facility_chemical_plant', site: 'any',
    description: '砂10＋石炭2 → シリコンウエハー0.4（毎秒）。電力 8MW。半導体産業の研究が必要。', baseCost: 5_000_000, costGrowth: 1.2, employees: 15, powerUse: 8,
    production: { inputs: { sand: 10, coal: 2 }, outputs: { silicon: 0.4 } }, unlock: { type: 'research', research: 'semiconductor' }, hiddenUntilUnlocked: true,
  },
  // ---- 製造 ----
  {
    id: 'tool_workshop', name: '工具工房', nameEn: 'Tool Workshop', category: 'MANUFACTURING', icon: 'icon_facility_machine_factory', site: 'hq',
    description: '鉄と木から工具を自動で作る。鉄2＋木1 → 工具1（10秒ごと）。', baseCost: 3000, costGrowth: 1.2, employees: 2,
    production: { inputs: { iron: 0.2, wood: 0.1 }, outputs: { tool: 0.1 } }, unlock: { type: 'crafted', recipe: 'craft_tool', min: 5 },
  },
  {
    id: 'parts_workshop', name: '部品工房', nameEn: 'Parts Workshop', category: 'MANUFACTURING', icon: 'icon_part_gear', site: 'hq',
    description: '鉄から機械部品を作る。鉄3＋木1 → 機械部品1（10秒ごと）。', baseCost: 8000, costGrowth: 1.2, employees: 3,
    production: { inputs: { iron: 0.3, wood: 0.1 }, outputs: { machine_parts: 0.1 } }, unlock: { type: 'crafted', recipe: 'craft_machine_parts', min: 3 },
  },
  {
    id: 'electronics_factory', name: '電子部品工場', nameEn: 'Electronics Factory', category: 'MANUFACTURING', icon: 'icon_facility_electronics_factory', site: 'any',
    description: '銅2＋鋼鉄1 → 電子部品1（2.5秒ごと）。電力 5MW。', baseCost: 1_200_000, costGrowth: 1.2, employees: 20, powerUse: 5,
    production: { inputs: { copper: 0.8, steel: 0.4 }, outputs: { electronics: 0.4 } }, unlock: { type: 'research', research: 'advanced_materials' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'car_factory', name: '自動車工場', nameEn: 'Car Factory', category: 'MANUFACTURING', icon: 'icon_facility_vehicle_factory', site: 'any',
    description: '鋼鉄2＋プラスチック1＋ゴム1＋ガラス0.5＋電子部品0.2 → 自動車0.1（10秒に1台）。電力 15MW。', baseCost: 8_000_000, costGrowth: 1.2, employees: 60, powerUse: 15,
    production: { inputs: { steel: 2, plastic: 1, rubber: 1, glass: 0.5, electronics: 0.2 }, outputs: { car: 0.1 } }, unlock: { type: 'research', research: 'automotive' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'chip_fab', name: '半導体工場', nameEn: 'Chip Fab', category: 'MANUFACTURING', icon: 'icon_facility_semiconductor_factory', site: 'any',
    description: 'シリコンウエハー0.4＋銅1＋水4 → 半導体0.2（5秒に1個）。電力 30MW。', baseCost: 15_000_000, costGrowth: 1.2, employees: 80, powerUse: 30,
    production: { inputs: { silicon: 0.4, copper: 1, water: 4 }, outputs: { semiconductor: 0.2 } }, unlock: { type: 'research', research: 'semiconductor' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'robot_factory', name: 'ロボット工場', nameEn: 'Robot Factory', category: 'MANUFACTURING', icon: 'icon_part_robot_arm', site: 'any',
    description: '半導体0.1＋機械部品0.5＋鋼鉄1＋電子部品0.3 → 産業ロボット0.05（20秒に1台）。電力 20MW。', baseCost: 30_000_000, costGrowth: 1.2, employees: 100, powerUse: 20,
    production: { inputs: { semiconductor: 0.1, machine_parts: 0.5, steel: 1, electronics: 0.3 }, outputs: { robot: 0.05 } }, unlock: { type: 'research', research: 'robotics' }, hiddenUntilUnlocked: true,
  },
  // ---- 倉庫 ----
  {
    id: 'small_warehouse', name: '小型倉庫', nameEn: 'Small Warehouse', category: 'STORAGE', icon: 'icon_commercial_warehouse', site: 'hq',
    description: '本社の保管容量が +1,000 される。', baseCost: 400, costGrowth: 1.25, employees: 0,
    storageBonus: 1000, unlock: { type: 'always' },
  },
  {
    id: 'large_warehouse', name: '大型倉庫', nameEn: 'Large Warehouse', category: 'STORAGE', icon: 'icon_logistics_distribution_center', site: 'hq',
    description: '本社の保管容量が +100,000 される。', baseCost: 40000, costGrowth: 1.3, employees: 2,
    storageBonus: 100000, unlock: { type: 'facility', facility: 'small_warehouse', min: 5 },
  },
  {
    id: 'land_warehouse', name: '現地倉庫', nameEn: 'Site Warehouse', category: 'STORAGE', icon: 'icon_logistics_silo', site: 'land',
    description: 'その土地の保管容量が +10,000 される。輸送が追いつかないときの一時保管に。', baseCost: 100_000, costGrowth: 1.25, employees: 1,
    storageBonus: 10_000, unlock: { type: 'landOwned', min: 1 },
  },
  // ---- 発電 ----
  {
    id: 'coal_power', name: '石炭火力発電所', nameEn: 'Coal Power Plant', category: 'POWER', icon: 'icon_power_coal', site: 'any',
    description: '出力 10MW。最大出力で石炭 0.5/秒を消費する。需要ぶんだけ燃やす。', baseCost: 300_000, costGrowth: 1.15, employees: 10,
    powerGen: 10, fuel: { coal: 0.5 }, unlock: { type: 'obtained', resource: 'coal', min: 20 },
  },
  {
    id: 'oil_power', name: '石油火力発電所', nameEn: 'Oil Power Plant', category: 'POWER', icon: 'icon_power_oil', site: 'any',
    description: '出力 25MW。最大出力で燃料 0.4/秒を消費する。', baseCost: 700_000, costGrowth: 1.15, employees: 12,
    powerGen: 25, fuel: { fuel: 0.4 }, unlock: { type: 'obtained', resource: 'fuel', min: 50 },
  },
  {
    id: 'solar_farm', name: '太陽光発電所', nameEn: 'Solar Farm', category: 'POWER', icon: 'icon_power_solar', site: 'any',
    description: '出力 4MW。燃料不要。砂漠で1.5倍、寒冷地では0.5倍。', baseCost: 250_000, costGrowth: 1.15, employees: 1,
    powerGen: 4, renewable: true, terrainBonus: { desert: 1.5, snow: 0.5, forest: 0.8, mountain: 0.9 }, unlock: { type: 'research', research: 'renewables' },
  },
  {
    id: 'wind_farm', name: '風力発電所', nameEn: 'Wind Farm', category: 'POWER', icon: 'icon_power_wind', site: 'any',
    description: '出力 6MW。燃料不要。沿岸で1.5倍、山岳で1.3倍。', baseCost: 400_000, costGrowth: 1.15, employees: 2,
    powerGen: 6, renewable: true, terrainBonus: { coast: 1.5, mountain: 1.3, city: 0.6, forest: 0.7 }, unlock: { type: 'research', research: 'renewables' },
  },
  {
    id: 'hydro_plant', name: '水力発電所', nameEn: 'Hydro Plant', category: 'POWER', icon: 'icon_power_hydro', site: 'land',
    description: '出力 40MW。燃料不要。河川または山岳の土地にしか建てられない。', baseCost: 3_000_000, costGrowth: 1.2, employees: 8,
    powerGen: 40, renewable: true, allowedTerrain: ['river', 'mountain'], terrainBonus: { river: 1.5 }, unlock: { type: 'research', research: 'renewables' },
  },
  {
    id: 'nuclear_plant', name: '原子力発電所', nameEn: 'Nuclear Plant', category: 'POWER', icon: 'icon_power_nuclear', site: 'any',
    description: '出力 500MW。最大出力で核燃料 0.005/秒（200秒に1個）を消費する。', baseCost: 100_000_000, costGrowth: 1.3, employees: 200,
    powerGen: 500, fuel: { nuclear_fuel: 0.005 }, unlock: { type: 'research', research: 'nuclear' }, hiddenUntilUnlocked: true,
  },
  // ---- 物流（土地→本社の輸送手段） ----
  {
    id: 'truck', name: 'トラック', nameEn: 'Truck', category: 'LOGISTICS', icon: 'icon_logistics_truck', site: 'land',
    description: '1台あたり 0.2t/秒を本社と往復で運ぶ。費用 30円/t。地震で道路が傷むと能力が下がる。', baseCost: 20_000, costGrowth: 1.08, employees: 1,
    transport: { kind: 'road', capacity: 0.2, costPerTon: 30 }, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'freight_train', name: '貨物列車', nameEn: 'Freight Train', category: 'LOGISTICS', icon: 'icon_logistics_train', site: 'land',
    description: '1編成あたり 2t/秒。費用 10円/t。地震で線路が傷むと能力が下がる。', baseCost: 500_000, costGrowth: 1.12, employees: 4,
    transport: { kind: 'rail', capacity: 2, costPerTon: 10 }, unlock: { type: 'research', research: 'railway' },
  },
  {
    id: 'cargo_ship', name: '貨物船', nameEn: 'Cargo Ship', category: 'LOGISTICS', icon: 'icon_logistics_ship', site: 'land',
    description: '1隻あたり 10t/秒。費用 4円/t。沿岸・都市の土地にしか配備できない。嵐の間は能力が大きく下がる。', baseCost: 2_000_000, costGrowth: 1.15, employees: 12,
    transport: { kind: 'sea', capacity: 10, costPerTon: 4 }, allowedTerrain: ['coast', 'city'], unlock: { type: 'research', research: 'overseas' },
  },
  {
    id: 'pipeline', name: 'パイプライン', nameEn: 'Pipeline', category: 'LOGISTICS', icon: 'icon_logistics_pipeline', site: 'land',
    description: '1本あたり 5t/秒。費用 2円/t。原油・燃料・水だけ運べる。', baseCost: 1_500_000, costGrowth: 1.2, employees: 2,
    transport: { kind: 'pipe', capacity: 5, costPerTon: 2, liquidOnly: true }, unlock: { type: 'research', research: 'pipeline' },
  },
  {
    id: 'cargo_plane', name: '貨物機', nameEn: 'Cargo Plane', category: 'LOGISTICS', icon: 'icon_logistics_airplane', site: 'land',
    description: '1機あたり 3t/秒。費用 40円/t。どの地形にも配備でき、地震の影響を受けない。嵐の間は飛べない。', baseCost: 8_000_000, costGrowth: 1.15, employees: 8,
    transport: { kind: 'air', capacity: 3, costPerTon: 40 }, unlock: { type: 'research', research: 'aviation' },
  },
  // ---- 商業 ----
  {
    id: 'parking', name: '駐車場', nameEn: 'Parking Lot', category: 'COMMERCIAL', icon: 'icon_commercial_parking', site: 'any',
    description: '人口・交通量に応じて収入を得る。基準 8円/秒。', baseCost: 50_000, costGrowth: 1.15, employees: 0,
    income: 8, unlock: { type: 'assets', min: 300_000 },
  },
  {
    id: 'shop', name: '店舗', nameEn: 'Shop', category: 'COMMERCIAL', icon: 'icon_commercial_shop', site: 'any',
    description: '基準 40円/秒。都市では人口係数3倍。', baseCost: 250_000, costGrowth: 1.15, employees: 3,
    income: 40, unlock: { type: 'facility', facility: 'parking', min: 3 },
  },
  {
    id: 'office', name: 'オフィスビル', nameEn: 'Office', category: 'COMMERCIAL', icon: 'icon_commercial_office', site: 'any',
    description: '基準 300円/秒。電力 1MW。', baseCost: 2_500_000, costGrowth: 1.18, employees: 20, powerUse: 1,
    income: 300, unlock: { type: 'research', research: 'commerce' },
  },
  {
    id: 'datacenter', name: 'データセンター', nameEn: 'Data Center', category: 'COMMERCIAL', icon: 'icon_commercial_datacenter', site: 'any',
    description: '基準 2,500円/秒。電力 10MW。電力が不足すると収入が下がる。', baseCost: 15_000_000, costGrowth: 1.2, employees: 15, powerUse: 10,
    income: 2500, unlock: { type: 'research', research: 'commerce' },
  },
  // ---- 研究 ----
  {
    id: 'research_lab', name: '研究所', nameEn: 'Research Lab', category: 'RESEARCH', icon: 'icon_commercial_rnd_center', site: 'any',
    description: '研究ポイントを 0.2/秒 生み出す。研究は会社画面から行う。', baseCost: 30_000, costGrowth: 1.25, employees: 5,
    researchRate: 0.2, unlock: { type: 'assets', min: 100_000 },
  },
  // ---- v1.0 追加の施設 ----
  {
    id: 'sap_grove', name: '樹液林', nameEn: 'Sap Grove', category: 'RESOURCE', icon: 'icon_chemical_resin', site: 'land',
    description: '木から樹液を集める。森林で効率2倍、平原で1.2倍。', baseCost: 35_000, costGrowth: 1.15, employees: 3,
    production: { outputs: { sap: 2 } }, terrainBonus: { forest: 2, plains: 1.2, mountain: 0.8, desert: 0.1, snow: 0.3, city: 0.2 }, unlock: { type: 'obtained', resource: 'sap', min: 20 },
  },
  {
    id: 'charcoal_kiln', name: '炭焼き窯', nameEn: 'Charcoal Kiln', category: 'PROCESSING', icon: 'icon_resource_coal', site: 'any',
    description: '木3 → 木炭2（毎秒）。石炭の代わりに使える。', baseCost: 30_000, costGrowth: 1.18, employees: 2,
    production: { inputs: { wood: 3 }, outputs: { charcoal: 2 } }, unlock: { type: 'crafted', recipe: 'make_charcoal', min: 3 },
  },
  {
    id: 'sawmill', name: '製材所', nameEn: 'Sawmill', category: 'PROCESSING', icon: 'icon_material_plywood', site: 'any',
    description: '木4 → 板材6（毎秒）。', baseCost: 45_000, costGrowth: 1.18, employees: 3,
    production: { inputs: { wood: 4 }, outputs: { lumber: 6 } }, unlock: { type: 'crafted', recipe: 'saw_lumber', min: 5 },
  },
  {
    id: 'paper_mill', name: '製紙工場', nameEn: 'Paper Mill', category: 'PROCESSING', icon: 'icon_facility_paper_mill', site: 'any',
    description: '植物繊維5＋水2 → 紙4（毎秒）。電力 1MW。', baseCost: 90_000, costGrowth: 1.18, employees: 5, powerUse: 1,
    production: { inputs: { plant_fiber: 5, water: 2 }, outputs: { paper: 4 } }, unlock: { type: 'obtained', resource: 'paper', min: 30 },
  },
  {
    id: 'rubber_boiler', name: 'ゴム加工場', nameEn: 'Rubber Works', category: 'PROCESSING', icon: 'icon_material_rubber', site: 'any',
    description: '樹液4＋木炭1 → ゴム2（毎秒）。', baseCost: 70_000, costGrowth: 1.18, employees: 4,
    production: { inputs: { sap: 4, charcoal: 1 }, outputs: { rubber: 2 } }, unlock: { type: 'crafted', recipe: 'boil_sap', min: 3 },
  },
  {
    id: 'wire_mill', name: '電線工場', nameEn: 'Wire Mill', category: 'PROCESSING', icon: 'icon_material_wire', site: 'any',
    description: '銅1 → 電線2.2（毎秒）。電力 2MW。', baseCost: 200_000, costGrowth: 1.18, employees: 5, powerUse: 2,
    production: { inputs: { copper: 1 }, outputs: { wire: 2.2 } }, unlock: { type: 'obtained', resource: 'wire', min: 20 },
  },
  {
    id: 'chemical_plant', name: '化学工場', nameEn: 'Chemical Plant', category: 'PROCESSING', icon: 'icon_material_chemical', site: 'any',
    description: '原油2＋水1 → 化学薬品2（毎秒）。電力 3MW。', baseCost: 350_000, costGrowth: 1.18, employees: 8, powerUse: 3,
    production: { inputs: { crude_oil: 2, water: 1 }, outputs: { chemical: 2 } }, unlock: { type: 'obtained', resource: 'chemical', min: 20 },
  },
  {
    id: 'paint_factory', name: '塗料工場', nameEn: 'Paint Factory', category: 'MANUFACTURING', icon: 'icon_chemical_paint', site: 'any',
    description: '化学薬品1＋砂2 → 塗料1.5（毎秒）。電力 2MW。', baseCost: 300_000, costGrowth: 1.18, employees: 6, powerUse: 2,
    production: { inputs: { chemical: 1, sand: 2 }, outputs: { paint: 1.5 } }, unlock: { type: 'obtained', resource: 'paint', min: 15 },
  },
  {
    id: 'fertilizer_plant', name: '肥料工場', nameEn: 'Fertilizer Plant', category: 'MANUFACTURING', icon: 'icon_material_fertilizer', site: 'any',
    description: '化学薬品1＋水2 → 肥料2（毎秒）。電力 2MW。', baseCost: 280_000, costGrowth: 1.18, employees: 6, powerUse: 2,
    production: { inputs: { chemical: 1, water: 2 }, outputs: { fertilizer: 2 } }, unlock: { type: 'obtained', resource: 'fertilizer', min: 15 },
  },
  {
    id: 'food_factory', name: '食品工場', nameEn: 'Food Factory', category: 'MANUFACTURING', icon: 'icon_facility_food_factory', site: 'any',
    description: '小麦粉2＋水1 → 加工食品2.5（毎秒）。電力 1MW。', baseCost: 120_000, costGrowth: 1.18, employees: 6, powerUse: 1,
    production: { inputs: { flour: 2, water: 1 }, outputs: { food: 2.5 } }, unlock: { type: 'obtained', resource: 'food', min: 20 },
  },
  {
    id: 'clothing_factory', name: '衣料工場', nameEn: 'Clothing Factory', category: 'MANUFACTURING', icon: 'icon_material_leather', site: 'any',
    description: '布2＋縄1 → 衣類1.2（毎秒）。電力 1MW。', baseCost: 160_000, costGrowth: 1.18, employees: 7, powerUse: 1,
    production: { inputs: { cloth: 2, rope: 1 }, outputs: { clothing: 1.2 } }, unlock: { type: 'obtained', resource: 'clothing', min: 10 },
  },
  {
    id: 'furniture_factory', name: '家具工場', nameEn: 'Furniture Factory', category: 'MANUFACTURING', icon: 'icon_office_chair', site: 'any',
    description: '板材6＋布2 → 家具1（毎秒）。電力 2MW。', baseCost: 400_000, costGrowth: 1.18, employees: 8, powerUse: 2,
    production: { inputs: { lumber: 6, cloth: 2 }, outputs: { furniture: 1 } }, unlock: { type: 'obtained', resource: 'furniture', min: 5 },
  },
  {
    id: 'tire_factory', name: 'タイヤ工場', nameEn: 'Tire Factory', category: 'MANUFACTURING', icon: 'icon_machine_wheel_loader', site: 'any',
    description: 'ゴム3＋布1 → タイヤ1.2（毎秒）。電力 2MW。', baseCost: 350_000, costGrowth: 1.18, employees: 7, powerUse: 2,
    production: { inputs: { rubber: 3, cloth: 1 }, outputs: { tire: 1.2 } }, unlock: { type: 'obtained', resource: 'tire', min: 10 },
  },
  {
    id: 'battery_factory', name: '電池工場', nameEn: 'Battery Factory', category: 'MANUFACTURING', icon: 'icon_facility_battery_factory', site: 'any',
    description: '電線2＋プラスチック1＋化学薬品1 → バッテリー1（毎秒）。電力 4MW。', baseCost: 900_000, costGrowth: 1.18, employees: 10, powerUse: 4,
    production: { inputs: { wire: 2, plastic: 1, chemical: 1 }, outputs: { battery: 1 } }, unlock: { type: 'obtained', resource: 'battery', min: 5 },
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
