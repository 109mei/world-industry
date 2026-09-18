import type { ResourceId } from './resources';
import type { TerrainId } from './terrain';
import type { UnlockCondition } from './unlockTypes';

export type FacilityCategory =
  | 'RESOURCE'
  | 'FLEET'
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
  FLEET: '輸送隊',
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

/**
 * どこに建てられるか。hq=本社のみ、land=地図で買った土地のみ。
 * 本社は「手作業と倉庫」だけの場所にしてあるので、工場・発電所・店・研究所はすべて land。
 */
/**
 * どこに建てられるか。
 * hq=本社のみ、land=地図で買った土地のみ、any=どちらでも。
 * any にしてよいのは倉庫だけ。荷物はどこにでも置けるが、
 * 工場・発電所・店・研究所は土地にしか建たない（本社は手作業と倉庫の場所）。
 */
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
    description: '毎秒200kg。石そのものは1kg3円と安く、売っても給料でほぼ消える。クラフトや建材の材料にすると値が付く。', baseCost: 150_000, costGrowth: 1.12, isWorker: true, employees: 1,
    production: { outputs: { stone: 200 } }, unlock: { type: 'always' },
  },
  {
    id: 'worker_wood', name: '木材作業員', nameEn: 'Lumber Worker', category: 'RESOURCE', icon: 'icon_facility_logging', site: 'hq',
    description: '毎秒30kg。木は1kg25円。燃料にも建材にもなり、序盤はいちばん使い道が広い。', baseCost: 290_000, costGrowth: 1.12, isWorker: true, employees: 1,
    production: { outputs: { wood: 30 } }, unlock: { type: 'always' },
  },
  {
    id: 'worker_gatherer', name: '採集作業員', nameEn: 'Gatherer', category: 'RESOURCE', icon: 'icon_facility_farm', site: 'hq',
    description: '毎秒 水40L・砂40kg・植物繊維12kg・粘土20kg。植物繊維は1kg60円で、縄や布にすると大きく伸びる。', baseCost: 580_000, costGrowth: 1.12, isWorker: true, employees: 1,
    production: { outputs: { water: 40, sand: 40, plant_fiber: 12, clay: 20 } }, unlock: { type: 'always' },
  },
  {
    id: 'worker_scrap', name: 'スクラップ回収員', nameEn: 'Scrap Collector', category: 'RESOURCE', icon: 'icon_facility_quarry', site: 'hq',
    description: '毎秒20kg。鉄くずは1kg45円と序盤でいちばん高い。溶かして鉄にすると95円になる。', baseCost: 420_000, costGrowth: 1.15, isWorker: true, employees: 1,
    production: { outputs: { scrap_metal: 20 } }, unlock: { type: 'toolCrafted', tool: 'stone_hammer' },
  },
  {
    // 本社は「拾い集めて売る」商売。鉱石は土地の鉱山でしか出ないので、
    // 手作業のつぎの一手はこれになる。人手はいるが、回収員より桁違いに集まる。
    id: 'scrap_truck', name: '回収車', nameEn: 'Scrap Truck', category: 'RESOURCE', icon: 'icon_logistics_van', site: 'hq',
    description: '町を回って金属くずを引き取ってくる。毎秒200kg、回収員10人ぶん。', baseCost: 7_700_000, costGrowth: 1.18, employees: 1,
    production: { outputs: { scrap_metal: 200 } }, unlock: { type: 'obtained', resource: 'scrap_metal', min: 30 },
  },
  {
    // 選別して圧縮すると、同じ鉄くずでも溶かしやすくなる（＝取り分が増える）
    id: 'scrap_baler', name: 'スクラップ圧縮機', nameEn: 'Scrap Baler', category: 'RESOURCE', icon: 'icon_facility_recycling_plant', site: 'hq',
    description: '集めた金属くずを選別して圧縮する。人手はいらない。', baseCost: 16_000_000, costGrowth: 1.2, employees: 0,
    production: { outputs: { scrap_metal: 400 } }, unlock: { type: 'obtained', resource: 'scrap_metal', min: 500 },
  },
  {
    id: 'worker_miner', name: '採掘作業員', nameEn: 'Miner', category: 'RESOURCE', icon: 'icon_facility_iron_mine', site: 'land',
    description: '鉄鉱石を掘り続ける作業員。', baseCost: 3_200_000, costGrowth: 1.15, isWorker: true, employees: 1,
    production: { outputs: { iron_ore: 60 } }, unlock: { type: 'toolCrafted', tool: 'stone_pickaxe' },
  },
  {
    id: 'small_mine', name: '小型採掘機', nameEn: 'Small Mining Machine', category: 'RESOURCE', icon: 'icon_machine_excavator', site: 'land',
    description: '機械で鉄鉱石を採掘する。作業員より桁違いに速い。', baseCost: 260_000_000, costGrowth: 1.2, employees: 0,
    production: { outputs: { iron_ore: 2880 } }, unlock: { type: 'obtained', resource: 'iron_ore', min: 100 },
  },
  // ---- 採集（土地：鉱山・農園） ----
  {
    id: 'quarry', name: '採石場', nameEn: 'Quarry', category: 'RESOURCE', icon: 'icon_facility_quarry', site: 'land',
    description: '土地で石を大量に切り出す。山岳で効率 +50%。', baseCost: 63_000_000, costGrowth: 1.15, employees: 3,
    production: { outputs: { stone: 4320 } }, terrainBonus: { mountain: 1.5, city: 0.5 }, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'lumber_camp', name: '伐採場', nameEn: 'Lumber Camp', category: 'RESOURCE', icon: 'icon_facility_logging', site: 'land',
    description: '土地の森林から木材を切り出す。森林で効率2倍、砂漠では育たない。', baseCost: 380_000_000, costGrowth: 1.15, employees: 3,
    production: { outputs: { wood: 2880 } }, terrainBonus: { forest: 2, river: 1.3, desert: 0.1, snow: 0.5, city: 0.3 }, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'wheat_farm', name: '小麦農園', nameEn: 'Wheat Farm', category: 'RESOURCE', icon: 'icon_facility_wheat_farm', site: 'land',
    description: '小麦を育てる。平原で効率2倍、河川で1.5倍。砂漠や寒冷地では育ちにくい。', baseCost: 510_000_000, costGrowth: 1.15, employees: 4,
    production: { inputs: { water: 720 }, outputs: { wheat: 2160 } }, terrainBonus: { plains: 2, river: 1.5, forest: 0.7, desert: 0.2, snow: 0.2, mountain: 0.5, city: 0.3 }, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'coal_mine', name: '炭鉱', nameEn: 'Coal Mine', category: 'RESOURCE', icon: 'icon_facility_coal_mine', site: 'land',
    description: '土地の石炭鉱脈を掘る。地質調査済みの土地に建てられ、鉱脈を掘り尽くすと止まる。', baseCost: 770_000_000, costGrowth: 1.15, employees: 5,
    production: { outputs: { coal: 7200 } }, extractsDeposit: true, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'iron_mine', name: '大型鉄鉱山', nameEn: 'Iron Mine', category: 'RESOURCE', icon: 'icon_facility_iron_mine', site: 'land',
    description: '鉄鉱脈から鉄鉱石を大量に掘る。', baseCost: 1_300_000_000, costGrowth: 1.15, employees: 6,
    production: { outputs: { iron_ore: 14400 } }, extractsDeposit: true, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'copper_mine', name: '銅鉱山', nameEn: 'Copper Mine', category: 'RESOURCE', icon: 'icon_facility_copper_mine', site: 'land',
    description: '銅鉱脈から銅鉱石を掘る。', baseCost: 4_700_000_000, costGrowth: 1.15, employees: 6,
    production: { outputs: { copper_ore: 5760 } }, extractsDeposit: true, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'oil_well', name: '油井', nameEn: 'Oil Well', category: 'RESOURCE', icon: 'icon_facility_oil_well', site: 'land',
    description: '油田から原油を汲み上げる。', baseCost: 2_900_000_000, costGrowth: 1.15, employees: 4,
    production: { outputs: { crude_oil: 7200 } }, extractsDeposit: true, unlock: { type: 'landOwned', min: 1 },
  },
  {
    // 金・銀・宝石は、鉱脈のある土地でしか採れない。
    // 手で砂金を探す道もあるが、量はまるで違う。
    id: 'gold_mine', name: '金鉱山', nameEn: 'Gold Mine', category: 'RESOURCE', icon: 'icon_facility_rare_earth_mine', site: 'land',
    description: '金鉱脈から金鉱石を掘る。当たった土地は宝の山。', baseCost: 120_000_000_000, costGrowth: 1.2, employees: 10,
    production: { outputs: { gold_ore: 864 } }, extractsDeposit: true, unlock: { type: 'research', research: 'deep_mining' },
  },
  {
    id: 'silver_mine', name: '銀鉱山', nameEn: 'Silver Mine', category: 'RESOURCE', icon: 'icon_facility_bauxite_mine', site: 'land',
    description: '銀鉱脈から銀鉱石を掘る。電子部品にも装飾にも使う。', baseCost: 820_000_000, costGrowth: 1.18, employees: 8,
    production: { outputs: { silver_ore: 1728 } }, extractsDeposit: true, unlock: { type: 'research', research: 'deep_mining' },
  },
  {
    id: 'gem_mine', name: '宝石鉱山', nameEn: 'Gem Mine', category: 'RESOURCE', icon: 'icon_marker_mine', site: 'land',
    description: '宝石の原石を掘り出す。当たり外れが大きく、出る量は少ない。', baseCost: 19_000_000_000, costGrowth: 1.22, employees: 12,
    production: { outputs: { rough_gem: 173 } }, extractsDeposit: true, unlock: { type: 'research', research: 'gem_cutting' },
  },
  {
    id: 'uranium_mine', name: 'ウラン鉱山', nameEn: 'Uranium Mine', category: 'RESOURCE', icon: 'icon_facility_uranium_mine', site: 'land',
    description: 'ウラン鉱脈からウラン鉱石を掘る。原子力工学の研究が必要。電力 2MW。', baseCost: 1_100_000_000, costGrowth: 1.2, employees: 10, powerUse: 2,
    production: { outputs: { uranium_ore: 144 } }, extractsDeposit: true, unlock: { type: 'research', research: 'nuclear' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'rubber_plantation', name: 'ゴム農園', nameEn: 'Rubber Plantation', category: 'RESOURCE', icon: 'icon_facility_rubber_plantation', site: 'land',
    description: '水0.3Lからゴム1kg。毎秒1.44t。森林で効率2倍、砂漠や寒冷地では育たない。', baseCost: 1_900_000_000, costGrowth: 1.15, employees: 5,
    production: { inputs: { water: 432 }, outputs: { rubber: 1440 } }, terrainBonus: { forest: 2, river: 1.3, plains: 0.8, desert: 0.1, snow: 0.1, mountain: 0.5, city: 0.3 }, unlock: { type: 'research', research: 'automotive' }, hiddenUntilUnlocked: true,
  },
  // ---- 加工 ----
  {
    id: 'simple_smelter', name: 'スクラップ溶解炉', nameEn: 'Scrap Furnace', category: 'PROCESSING', icon: 'icon_facility_steel_mill', site: 'hq',
    description: '拾い集めた鉄くずを溶かして鉄にする。鉄くず1.2kg＋木0.8kg → 鉄1kg、毎秒33kg。', baseCost: 620_000, costGrowth: 1.18, employees: 0,
    production: { inputs: { scrap_metal: 40, wood: 26 }, outputs: { iron: 33 } }, unlock: { type: 'obtained', resource: 'scrap_metal', min: 5 },
  },
  {
    // 鉱山で掘った鉄鉱石の行き先。これが無いと、鉄鉱石は手作業でしか鉄にできなかった
    id: 'blast_furnace', name: '製鉄所', nameEn: 'Blast Furnace', category: 'PROCESSING', icon: 'icon_facility_iron_mine', site: 'land',
    description: '鉄鉱石1.6kg＋石炭0.5kg → 鉄1kg。毎秒2.88t。電力 3MW。', baseCost: 1_200_000_000, costGrowth: 1.18, employees: 12, powerUse: 3,
    production: { inputs: { iron_ore: 4608, coal: 1440 }, outputs: { iron: 2880 } }, unlock: { type: 'obtained', resource: 'iron_ore', min: 50 },
  },
  {
    id: 'steel_mill', name: '製鋼所', nameEn: 'Steel Mill', category: 'PROCESSING', icon: 'icon_facility_steel_mill', site: 'land',
    description: '鉄1.1kg＋石炭0.2kg → 鋼鉄1kg。毎秒5.76t。電力 2MW。', baseCost: 940_000_000, costGrowth: 1.18, employees: 8, powerUse: 2,
    production: { inputs: { iron: 6336, coal: 1152 }, outputs: { steel: 5760 } }, unlock: { type: 'obtained', resource: 'coal', min: 50 },
  },
  {
    id: 'copper_smelter', name: '銅精錬所', nameEn: 'Copper Smelter', category: 'PROCESSING', icon: 'icon_facility_aluminum_refinery', site: 'land',
    description: '銅精鉱5kg → 銅1kg。毎秒1.44t。電力 1.5MW。', baseCost: 9_600_000_000, costGrowth: 1.18, employees: 6, powerUse: 1.5,
    production: { inputs: { copper_ore: 7200 }, outputs: { copper: 1440 } }, unlock: { type: 'obtained', resource: 'copper_ore', min: 50 },
  },
  {
    id: 'oil_refinery', name: '製油所', nameEn: 'Oil Refinery', category: 'PROCESSING', icon: 'icon_facility_oil_refinery', site: 'land',
    description: '原油1.2L → 燃料1L（原油の85%が燃料になる）。毎秒2.45kL。電力 3MW。', baseCost: 670_000_000, costGrowth: 1.18, employees: 8, powerUse: 3,
    production: { inputs: { crude_oil: 2880 }, outputs: { fuel: 2448 } }, unlock: { type: 'obtained', resource: 'crude_oil', min: 100 },
  },
  {
    id: 'flour_mill', name: '製粉所', nameEn: 'Flour Mill', category: 'PROCESSING', icon: 'icon_facility_food_factory', site: 'land',
    description: '小麦1kg → 小麦粉1kg。毎秒1.44t。電力 0.5MW。', baseCost: 920_000_000, costGrowth: 1.15, employees: 3, powerUse: 0.5,
    production: { inputs: { wheat: 1440 }, outputs: { flour: 1440 } }, unlock: { type: 'obtained', resource: 'wheat', min: 100 },
  },
  {
    id: 'enrichment_plant', name: '核燃料濃縮工場', nameEn: 'Enrichment Plant', category: 'PROCESSING', icon: 'icon_facility_chemical_plant', site: 'land',
    description: 'ウラン鉱石100kg → 核燃料1kg。毎秒7.2kg。電力 20MW。', baseCost: 15_000_000_000, costGrowth: 1.25, employees: 30, powerUse: 20,
    production: { inputs: { uranium_ore: 720 }, outputs: { nuclear_fuel: 7.2 } }, unlock: { type: 'research', research: 'nuclear' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'concrete_plant', name: 'コンクリート工場', nameEn: 'Concrete Plant', category: 'PROCESSING', icon: 'icon_facility_concrete_plant', site: 'land',
    description: '砂2kg＋石1kg＋水1L → コンクリート4kg。毎秒5.76t。', baseCost: 190_000_000, costGrowth: 1.18, employees: 4,
    production: { inputs: { sand: 2880, stone: 1440, water: 1440 }, outputs: { concrete: 5760 } }, unlock: { type: 'obtained', resource: 'concrete', min: 20 },
  },
  {
    id: 'textile_mill', name: '織物工場', nameEn: 'Textile Mill', category: 'PROCESSING', icon: 'icon_facility_textile_factory', site: 'land',
    description: '植物繊維4kg＋水1L → 布1kg。毎秒1.44t。', baseCost: 8_500_000_000, costGrowth: 1.18, employees: 5,
    production: { inputs: { plant_fiber: 5760, water: 1440 }, outputs: { cloth: 1440 } }, unlock: { type: 'obtained', resource: 'plant_fiber', min: 60 },
  },
  {
    id: 'foundry', name: '鋳造所', nameEn: 'Foundry', category: 'PROCESSING', icon: 'icon_material_steel_plate', site: 'land',
    description: '鉄くず1.2kg＋石炭0.2kg → 鋳鉄1kg。毎秒2.88t。電力 1MW。', baseCost: 610_000_000, costGrowth: 1.18, employees: 5, powerUse: 1,
    production: { inputs: { scrap_metal: 3456, coal: 576 }, outputs: { cast_iron: 2880 } }, unlock: { type: 'obtained', resource: 'cast_iron', min: 20 },
  },
  {
    id: 'building_material_workshop', name: '建材工房', nameEn: 'Building Material Workshop', category: 'MANUFACTURING', icon: 'icon_marker_construction', site: 'land',
    description: 'レンガ100kg＋コンクリート80kg＋縄5kg → 建材セット1個。毎秒144個。', baseCost: 11_000_000_000, costGrowth: 1.18, employees: 6,
    production: { inputs: { brick: 14400, concrete: 11520, rope: 720 }, outputs: { building_material: 144 } }, unlock: { type: 'obtained', resource: 'concrete', min: 30 },
  },
  {
    id: 'brick_kiln', name: 'レンガ工場', nameEn: 'Brick Kiln', category: 'PROCESSING', icon: 'icon_facility_brick_factory', site: 'land',
    description: '粘土2kg＋木1kg → レンガ3kg。毎秒4.32t。', baseCost: 430_000_000, costGrowth: 1.18, employees: 3,
    production: { inputs: { clay: 2880, wood: 1440 }, outputs: { brick: 4320 } }, unlock: { type: 'crafted', recipe: 'fire_brick', min: 5 },
  },
  {
    id: 'glass_factory', name: 'ガラス工場', nameEn: 'Glass Factory', category: 'PROCESSING', icon: 'icon_facility_glass_factory', site: 'land',
    description: '砂3kg＋石炭0.5kg → ガラス1kg。毎秒1.44t。電力 2MW。', baseCost: 1_100_000_000, costGrowth: 1.18, employees: 6, powerUse: 2,
    production: { inputs: { sand: 4320, coal: 720 }, outputs: { glass: 1440 } }, unlock: { type: 'all', conditions: [{ type: 'obtained', resource: 'sand', min: 500 }, { type: 'obtained', resource: 'coal', min: 50 }] },
  },
  {
    id: 'plastic_plant', name: 'プラスチック工場', nameEn: 'Plastic Plant', category: 'PROCESSING', icon: 'icon_facility_plastic_factory', site: 'land',
    description: '原油1.5L → プラスチック1kg。毎秒1.44t。電力 3MW。', baseCost: 1_100_000_000, costGrowth: 1.18, employees: 8, powerUse: 3,
    production: { inputs: { crude_oil: 2160 }, outputs: { plastic: 1440 } }, unlock: { type: 'obtained', resource: 'crude_oil', min: 300 },
  },
  {
    id: 'silicon_plant', name: 'シリコン精製所', nameEn: 'Silicon Plant', category: 'PROCESSING', icon: 'icon_facility_chemical_plant', site: 'land',
    description: '砂25kg＋石炭5kg → シリコンウエハー1kg。毎秒576kg。電力 8MW。', baseCost: 14_000_000_000, costGrowth: 1.2, employees: 15, powerUse: 8,
    production: { inputs: { sand: 14400, coal: 2880 }, outputs: { silicon: 576 } }, unlock: { type: 'research', research: 'semiconductor' }, hiddenUntilUnlocked: true,
  },
  // ---- 製造 ----
  {
    id: 'tool_workshop', name: '工具工房', nameEn: 'Tool Workshop', category: 'MANUFACTURING', icon: 'icon_facility_machine_factory', site: 'hq',
    description: '鉄と木から工具を自動で作る。鉄2kg＋木1kg → 工具1個、毎秒1.4個。', baseCost: 2_100_000, costGrowth: 1.2, employees: 2,
    production: { inputs: { iron: 2.9, wood: 1.4 }, outputs: { tool: 1.4 } }, unlock: { type: 'crafted', recipe: 'craft_tool', min: 5 },
  },
  {
    id: 'parts_workshop', name: '部品工房', nameEn: 'Parts Workshop', category: 'MANUFACTURING', icon: 'icon_part_gear', site: 'hq',
    description: '鉄から機械部品を作る。鉄3kg＋木1kg → 機械部品1個、毎秒1.4個。', baseCost: 2_200_000, costGrowth: 1.2, employees: 3,
    production: { inputs: { iron: 4.3, wood: 1.4 }, outputs: { machine_parts: 1.4 } }, unlock: { type: 'crafted', recipe: 'craft_machine_parts', min: 3 },
  },
  {
    // 鋳造所で作った鋳鉄の行き先。鉄を製鉄に回しながら部品を作りたいときに使う
    id: 'cast_parts_workshop', name: '鋳物部品工房', nameEn: 'Cast Parts Workshop', category: 'MANUFACTURING', icon: 'icon_part_gear_set', site: 'hq',
    description: '鋳鉄2kg＋縄1kg → 機械部品1個、毎秒1.4個。鉄を使わずに済む。', baseCost: 2_000_000, costGrowth: 1.2, employees: 3,
    production: { inputs: { cast_iron: 2.9, rope: 1.4 }, outputs: { machine_parts: 1.4 } }, unlock: { type: 'obtained', resource: 'cast_iron', min: 5 },
  },
  {
    id: 'electronics_factory', name: '電子部品工場', nameEn: 'Electronics Factory', category: 'MANUFACTURING', icon: 'icon_facility_electronics_factory', site: 'land',
    description: '銅0.5kg＋鋼鉄0.3kg → 電子部品1個。毎秒576個。電力 5MW。', baseCost: 4_700_000_000, costGrowth: 1.2, employees: 20, powerUse: 5,
    production: { inputs: { copper: 288, steel: 173 }, outputs: { electronics: 576 } }, unlock: { type: 'research', research: 'advanced_materials' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'car_factory', name: '自動車工場', nameEn: 'Car Factory', category: 'MANUFACTURING', icon: 'icon_facility_vehicle_factory', site: 'land',
    description: '1台に鋼鉄900kg・プラスチック300kg・ゴム100kg・ガラス100kg・電子部品400個。毎秒14.4台。電力 15MW。', baseCost: 200_000_000_000, costGrowth: 1.2, employees: 60, powerUse: 15,
    production: { inputs: { steel: 12960, plastic: 4320, rubber: 1440, glass: 1440, electronics: 5760 }, outputs: { car: 14.4 } }, unlock: { type: 'research', research: 'automotive' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'chip_fab', name: '半導体工場', nameEn: 'Chip Fab', category: 'MANUFACTURING', icon: 'icon_facility_semiconductor_factory', site: 'land',
    description: 'シリコンウエハー2kg＋銅5kg＋水20L → 半導体1個。毎秒28.8個。電力 30MW。', baseCost: 5_600_000_000, costGrowth: 1.1, employees: 80, powerUse: 30,
    production: { inputs: { silicon: 57.6, copper: 144, water: 576 }, outputs: { semiconductor: 28.8 } }, unlock: { type: 'research', research: 'semiconductor' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'robot_factory', name: 'ロボット工場', nameEn: 'Robot Factory', category: 'MANUFACTURING', icon: 'icon_part_robot_arm', site: 'land',
    description: '1台に半導体20個・機械部品400個・鋼鉄800kg・電子部品400個。毎秒7.2台。電力 20MW。', baseCost: 250_000_000_000, costGrowth: 1.2, employees: 100, powerUse: 20,
    production: { inputs: { semiconductor: 144, machine_parts: 2880, steel: 5760, electronics: 2880 }, outputs: { robot: 7.2 } }, unlock: { type: 'research', research: 'robotics' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'gpu_factory', name: 'GPU工場', nameEn: 'GPU Factory', category: 'MANUFACTURING', icon: 'icon_facility_gpu_factory', site: 'land',
    description: '1枚に半導体0.5個・電子部品2個・プラスチック1kg・電線1個。毎秒28.8枚。電力 18MW。', baseCost: 17_000_000_000, costGrowth: 1.2, employees: 70, powerUse: 18,
    production: { inputs: { semiconductor: 14.4, electronics: 57.6, plastic: 28.8, wire: 28.8 }, outputs: { gpu: 28.8 } }, unlock: { type: 'research', research: 'gpu_fab' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'mining_rig', name: 'マイニング装置', nameEn: 'Mining Rig', category: 'MANUFACTURING', icon: 'icon_facility_mining_rig', site: 'land',
    description: '毎秒 暗号資産0.006 を掘る。GPUは熱で焼けて毎秒0.086枚ずつ減る。電力 0.9MW。相場しだいで儲けが大きく変わる。', baseCost: 260_000_000, costGrowth: 1.08, employees: 1, powerUse: 0.9,
    production: { inputs: { gpu: 0.0864 }, outputs: { crypto: 0.006 } }, unlock: { type: 'research', research: 'crypto_mining' }, hiddenUntilUnlocked: true,
  },
  // ---- 倉庫 ----
  {
    id: 'small_warehouse', name: '小型倉庫', nameEn: 'Small Warehouse', category: 'STORAGE', icon: 'icon_commercial_warehouse', site: 'any',
    description: '建てた場所の保管容量が、資源1種につき +200t される。在庫は本社と土地でそれぞれ別に貯まる。', baseCost: 40_000_000, costGrowth: 1.25, employees: 0,
    storageBonus: 200_000, unlock: { type: 'always' },
  },
  {
    id: 'large_warehouse', name: '大型倉庫', nameEn: 'Large Warehouse', category: 'STORAGE', icon: 'icon_logistics_distribution_center', site: 'any',
    description: '建てた場所の保管容量が、資源1種につき +3,000t される。延床1万㎡級の物流倉庫。', baseCost: 1_600_000_000, costGrowth: 1.3, employees: 2,
    storageBonus: 3_000_000, unlock: { type: 'facility', facility: 'small_warehouse', min: 5 },
  },
  {
    id: 'land_warehouse', name: '現地倉庫', nameEn: 'Site Warehouse', category: 'STORAGE', icon: 'icon_logistics_silo', site: 'land',
    description: 'その土地の保管容量が、資源1種につき +2,000t される。輸送が追いつかないときの一時保管に。', baseCost: 900_000_000, costGrowth: 1.25, employees: 1,
    storageBonus: 2_000_000, unlock: { type: 'landOwned', min: 1 },
  },
  // ---- 発電 ----
  {
    id: 'coal_power', name: '石炭火力発電所', nameEn: 'Coal Power Plant', category: 'POWER', icon: 'icon_power_coal', site: 'land',
    description: '出力 10MW。最大出力で毎秒 石炭1.6t を燃やす。需要ぶんだけ燃やす。工業地帯で1.1倍、都市では規制が厳しく0.85倍。', baseCost: 2_650_000_000, costGrowth: 1.15, employees: 10,
    powerGen: 10, fuel: { coal: 1600 },
    // 冷却水が要るので海沿い・川沿いが有利。都市部は規制で出力を絞られる
    terrainBonus: { industrial: 1.1, coast: 1.05, river: 1.05, city: 0.85, desert: 0.9, snow: 0.95 },
    unlock: { type: 'obtained', resource: 'coal', min: 20 },
  },
  {
    id: 'oil_power', name: '石油火力発電所', nameEn: 'Oil Power Plant', category: 'POWER', icon: 'icon_power_oil', site: 'land',
    description: '出力 25MW。最大出力で毎秒 燃料1.28kL を燃やす。工業地帯・臨海部で有利、都市では0.85倍。', baseCost: 6_700_000_000, costGrowth: 1.15, employees: 12,
    powerGen: 25, fuel: { fuel: 1280 },
    terrainBonus: { industrial: 1.1, coast: 1.1, river: 1.0, city: 0.85, desert: 0.95, mountain: 0.9 },
    unlock: { type: 'obtained', resource: 'fuel', min: 50 },
  },
  {
    id: 'solar_farm', name: '太陽光発電所', nameEn: 'Solar Farm', category: 'POWER', icon: 'icon_power_solar', site: 'land',
    description: '定格 4MW。ただし日が出ているあいだしか発電しないので、年を通した平均は 0.6MW。燃料不要でどこにでも建てられるのが強み。砂漠1.6倍・平原1.2倍、森林0.6倍・寒冷地0.45倍。', baseCost: 704_000_000, costGrowth: 1.15, employees: 1,
    // powerGen は「年を通した平均の出力」。太陽光の設備利用率は日本でおよそ15%
    powerGen: 0.6, renewable: true,
    terrainBonus: { desert: 1.6, plains: 1.2, coast: 1.05, river: 1.0, industrial: 0.95, mountain: 0.9, city: 0.7, forest: 0.6, snow: 0.45 },
    unlock: { type: 'research', research: 'renewables' },
  },
  {
    id: 'wind_farm', name: '風力発電所', nameEn: 'Wind Farm', category: 'POWER', icon: 'icon_power_wind', site: 'land',
    description: '定格 6MW。風まかせなので年平均は 1.5MW。太陽光より高いが、夜も冬も回る。沿岸1.6倍・山岳1.35倍・寒冷地1.2倍、都市0.5倍・森林0.6倍。', baseCost: 1_914_000_000, costGrowth: 1.15, employees: 2,
    // 陸上風力の設備利用率はおよそ25%
    powerGen: 1.5, renewable: true,
    terrainBonus: { coast: 1.6, mountain: 1.35, snow: 1.2, plains: 1.1, river: 0.9, desert: 0.9, industrial: 0.85, forest: 0.6, city: 0.5 },
    unlock: { type: 'research', research: 'renewables' },
  },
  {
    id: 'hydro_plant', name: '水力発電所', nameEn: 'Hydro Plant', category: 'POWER', icon: 'icon_power_hydro', site: 'land',
    description: '定格 40MW、年平均 22MW。燃料不要で量も読める。河川または山岳の土地にしか建てられない。河川で1.6倍。', baseCost: 12_000_000_000, costGrowth: 1.2, employees: 8,
    // 水量に左右されるので設備利用率はおよそ55%
    powerGen: 22, renewable: true, allowedTerrain: ['river', 'mountain'], terrainBonus: { river: 1.6, mountain: 1 },
    unlock: { type: 'research', research: 'renewables' },
  },
  {
    id: 'nuclear_plant', name: '原子力発電所', nameEn: 'Nuclear Plant', category: 'POWER', icon: 'icon_power_nuclear', site: 'land',
    description: '出力 500MW。燃料は毎秒 核燃料0.9kg で済むが、建てるのに桁違いの金がかかる。大量の冷却水が要るので、海沿い・川沿いでないと出力が落ちる。', baseCost: 400_000_000_000, costGrowth: 1.3, employees: 200,
    powerGen: 500, fuel: { nuclear_fuel: 0.9 },
    // 冷却水がすべて。内陸の乾いた土地では出力を絞らざるを得ない
    terrainBonus: { coast: 1.1, river: 1.05, plains: 0.95, industrial: 1, snow: 0.95, forest: 0.9, mountain: 0.85, city: 0.85, desert: 0.7 },
    unlock: { type: 'research', research: 'nuclear' }, hiddenUntilUnlocked: true,
  },
  {
    id: 'diesel_generator', name: 'ディーゼル発電機', nameEn: 'Diesel Generator', category: 'POWER', icon: 'icon_power_diesel', site: 'land',
    description: '出力 1.5MW。最大出力で毎秒 燃料96L を燃やす。安くてどこにでも置けるが、割高な電気になる。発電所が建つまでのつなぎ。',
    baseCost: 60_000_000, costGrowth: 1.12, employees: 1,
    powerGen: 1.5, fuel: { fuel: 96 },
    // 寒いとかかりが悪く、暑いと出力が落ちる
    terrainBonus: { snow: 0.9, desert: 0.9 },
    unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'micro_hydro', name: '小水力発電所', nameEn: 'Micro Hydro', category: 'POWER', icon: 'icon_grid_hydro_turbine', site: 'land',
    description: '定格 3MW、年平均 1.8MW。川の流れをそのまま使うので、太陽光より1MWあたり安上がりで、量も読める。河川か山岳の土地にだけ建てられる。河川で1.4倍。',
    baseCost: 900_000_000, costGrowth: 1.14, employees: 2,
    // 小水力は流れ込み式で、設備利用率はおよそ60%と高い
    powerGen: 1.8, renewable: true, allowedTerrain: ['river', 'mountain'], terrainBonus: { river: 1.4, mountain: 1 },
    unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'biomass_plant', name: 'バイオマス発電所', nameEn: 'Biomass Plant', category: 'POWER', icon: 'icon_power_generator', site: 'land',
    description: '出力 8MW。最大出力で毎秒 木2.56t を燃やす。木が採れる土地なら燃料を買わずに回せる。森林で1.25倍。',
    baseCost: 3_200_000_000, costGrowth: 1.15, employees: 6,
    powerGen: 8, fuel: { wood: 2560 },
    terrainBonus: { forest: 1.25, plains: 1.1, river: 1.05, city: 0.9, snow: 0.9, desert: 0.8 },
    unlock: { type: 'obtained', resource: 'wood', min: 300 },
  },
  {
    id: 'geothermal_plant', name: '地熱発電所', nameEn: 'Geothermal Plant', category: 'POWER', icon: 'icon_power_geothermal', site: 'land',
    description: '定格 45MW、年平均 36MW。燃料不要で、天気にも昼夜にも左右されない。地熱が使える山岳か寒冷地にだけ建てられる。山岳で1.4倍。',
    baseCost: 27_000_000_000, costGrowth: 1.2, employees: 12,
    // 地熱は止まらないので設備利用率はおよそ80%
    powerGen: 36, renewable: true, allowedTerrain: ['mountain', 'snow'], terrainBonus: { mountain: 1.4, snow: 1.2 },
    unlock: { type: 'research', research: 'renewables' },
  },
  {
    id: 'tidal_plant', name: '潮力発電所', nameEn: 'Tidal Plant', category: 'POWER', icon: 'icon_power_hydro', site: 'land',
    description: '定格 20MW、年平均 6MW。潮が止まる時間があるので出しっぱなしにはできないが、天気には左右されず量が読める。沿岸の土地にだけ建てられる。',
    baseCost: 16_000_000_000, costGrowth: 1.2, employees: 8,
    // 潮力の設備利用率はおよそ30%
    powerGen: 6, renewable: true, allowedTerrain: ['coast'], terrainBonus: { coast: 1 },
    unlock: { type: 'research', research: 'renewables' },
  },
  // ---- 輸送隊（貿易に使う自社の乗り物。本社にも土地にも置ける） ----
  {
    // 買わないと海外と取引できない。1台につき同時に1件の荷を運べる
    id: 'fleet_truck', name: '貿易トラック', nameEn: 'Trade Truck', category: 'FLEET', icon: 'icon_logistics_truck', site: 'any',
    description: '取引先へ荷を届けるための自社の車。1台で1件・20tまで。行って帰るまで次の荷に使えない。土地から本社へ毎秒運ぶ「トラック」とは別もの。', baseCost: 20_000_000, costGrowth: 1.12, employees: 1,
    unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'fleet_ship', name: '貿易船', nameEn: 'Trade Ship', category: 'FLEET', icon: 'icon_logistics_ship', site: 'any',
    description: '取引先へ海を越えて運ぶ自社の船。1隻で1件・40,000tまで。遅いが運賃はいちばん安い。', baseCost: 5_000_000_000, costGrowth: 1.15, employees: 12,
    unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'fleet_plane', name: '貿易機', nameEn: 'Trade Plane', category: 'FLEET', icon: 'icon_logistics_airplane', site: 'any',
    description: '取引先へ急いで届ける自社の飛行機。1機で1件・100tまで。速いが運賃は船の37倍。', baseCost: 12_000_000_000, costGrowth: 1.18, employees: 6,
    unlock: { type: 'research', research: 'aviation' },
  },
  // ---- 物流（土地→本社の輸送手段） ----
  {
    id: 'truck', name: 'トラック', nameEn: 'Truck', category: 'LOGISTICS', icon: 'icon_logistics_truck', site: 'land',
    description: '1台あたり 0.7t/秒（1日42t）を本社と往復で運ぶ。費用 30円/t。地震で道路が傷むと能力が下がる。', baseCost: 20_000_000, costGrowth: 1.08, employees: 1,
    // 大型トラック1台が現実に運ぶのは1日40t前後。1ゲーム日＝実時間60秒なので 40÷60 ≒ 0.7t/秒
    transport: { kind: 'road', capacity: 0.7, costPerTon: 30 }, unlock: { type: 'landOwned', min: 1 },
  },
  {
    id: 'freight_train', name: '貨物列車', nameEn: 'Freight Train', category: 'LOGISTICS', icon: 'icon_logistics_train', site: 'land',
    description: '1編成あたり 22t/秒（1日1,320t）。トラック31台ぶんを4人で動かせる。費用 10円/t。地震で線路が傷むと能力が下がる。', baseCost: 500_000_000, costGrowth: 1.12, employees: 4,
    // 26両編成で1日1,300t前後
    transport: { kind: 'rail', capacity: 22, costPerTon: 10 }, unlock: { type: 'research', research: 'railway' },
  },
  {
    id: 'cargo_ship', name: '貨物船', nameEn: 'Cargo Ship', category: 'LOGISTICS', icon: 'icon_logistics_ship', site: 'land',
    description: '1隻あたり 140t/秒（1日8,400t）。1tあたり4円といちばん安い。沿岸・都市の土地にしか配備できない。嵐の間は能力が大きく下がる。', baseCost: 5_000_000_000, costGrowth: 1.15, employees: 12,
    // 8.2万DWTのバルカーが10日で1航海する見当
    transport: { kind: 'sea', capacity: 140, costPerTon: 4 }, allowedTerrain: ['coast', 'city'], unlock: { type: 'research', research: 'overseas' },
  },
  {
    id: 'pipeline', name: 'パイプライン', nameEn: 'Pipeline', category: 'LOGISTICS', icon: 'icon_logistics_pipeline', site: 'land',
    description: '1本あたり 500t/秒（1日3万t）。費用 2円/t で最安。原油・燃料・水だけ運べる。', baseCost: 1_500_000_000, costGrowth: 1.2, employees: 2,
    transport: { kind: 'pipe', capacity: 500, costPerTon: 2, liquidOnly: true }, unlock: { type: 'research', research: 'pipeline' },
  },
  {
    id: 'cargo_plane', name: '貨物機', nameEn: 'Cargo Plane', category: 'LOGISTICS', icon: 'icon_logistics_airplane', site: 'land',
    description: '1機あたり 3.5t/秒（1日210t）。運べる量は少なく1tあたり40円と高いが、どの地形にも配備でき、地震の影響を受けない。嵐の間は飛べない。', baseCost: 8_000_000_000, costGrowth: 1.15, employees: 8,
    // 777F が100tを1日2便
    transport: { kind: 'air', capacity: 3.5, costPerTon: 40 }, unlock: { type: 'research', research: 'aviation' },
  },
  // ---- 商業 ----
  {
    id: 'parking', name: '駐車場', nameEn: 'Parking Lot', category: 'COMMERCIAL', icon: 'icon_commercial_parking', site: 'land',
    description: '人口・交通量に応じて収入を得る。基準 230円/秒（1日13,800円）。コインパーキング1ヵ所ぶん。', baseCost: 8_300_000, costGrowth: 1.15, employees: 0,
    income: 230, unlock: { type: 'assets', min: 300_000 },
  },
  {
    id: 'shop', name: '店舗', nameEn: 'Shop', category: 'COMMERCIAL', icon: 'icon_commercial_shop', site: 'land',
    description: '基準 2,400円/秒（1日14.4万円）。小売店1軒の粗利ぶん。都市では人口係数3倍。', baseCost: 40_000_000, costGrowth: 1.15, employees: 3,
    income: 2400, unlock: { type: 'facility', facility: 'parking', min: 3 },
  },
  {
    id: 'office', name: 'オフィスビル', nameEn: 'Office', category: 'COMMERCIAL', icon: 'icon_commercial_office', site: 'land',
    description: '基準 45,700円/秒（1日274万円）。中規模のビル1棟ぶんの賃料。電力 0.2MW。', baseCost: 1_500_000_000, costGrowth: 1.18, employees: 3, powerUse: 0.2,
    income: 45700, unlock: { type: 'research', research: 'commerce' },
  },
  {
    id: 'datacenter', name: 'データセンター', nameEn: 'Data Center', category: 'COMMERCIAL', icon: 'icon_commercial_datacenter', site: 'land',
    description: '基準 456,000円/秒（1日2,736万円）。電力 10MW。電力が不足すると収入が下がる。', baseCost: 13_000_000_000, costGrowth: 1.1, employees: 15, powerUse: 10,
    income: 456000, unlock: { type: 'research', research: 'commerce' },
  },
  // ---- 研究 ----
  {
    id: 'research_lab', name: '研究所', nameEn: 'Research Lab', category: 'RESEARCH', icon: 'icon_commercial_rnd_center', site: 'land',
    description: '研究ポイントを 2/秒（1日あたり120）生み出す。ためたポイントは「研究」タブで使う。', baseCost: 60_000_000, costGrowth: 1.25, employees: 5,
    researchRate: 2.0, unlock: { type: 'assets', min: 100_000 },
  },
  // ---- v1.0 追加の施設 ----
  {
    id: 'sap_grove', name: '樹液林', nameEn: 'Sap Grove', category: 'RESOURCE', icon: 'icon_chemical_resin', site: 'land',
    description: '木から樹液を集める。森林で効率2倍、平原で1.2倍。', baseCost: 620_000_000, costGrowth: 1.15, employees: 3,
    production: { outputs: { sap: 2880 } }, terrainBonus: { forest: 2, plains: 1.2, mountain: 0.8, desert: 0.1, snow: 0.3, city: 0.2 }, unlock: { type: 'obtained', resource: 'sap', min: 20 },
  },
  {
    id: 'charcoal_kiln', name: '炭焼き窯', nameEn: 'Charcoal Kiln', category: 'PROCESSING', icon: 'icon_resource_coal', site: 'land',
    description: '木3kg → 木炭2kg。毎秒2.88t。石炭の代わりに使える。', baseCost: 2_400_000_000, costGrowth: 1.18, employees: 2,
    production: { inputs: { wood: 4320 }, outputs: { charcoal: 2880 } }, unlock: { type: 'crafted', recipe: 'make_charcoal', min: 3 },
  },
  {
    id: 'sawmill', name: '製材所', nameEn: 'Sawmill', category: 'PROCESSING', icon: 'icon_material_plywood', site: 'land',
    description: '木4kg → 板材6kg。毎秒8.64t。', baseCost: 3_400_000_000, costGrowth: 1.18, employees: 3,
    production: { inputs: { wood: 5760 }, outputs: { lumber: 8640 } }, unlock: { type: 'crafted', recipe: 'saw_lumber', min: 5 },
  },
  {
    id: 'paper_mill', name: '製紙工場', nameEn: 'Paper Mill', category: 'PROCESSING', icon: 'icon_facility_paper_mill', site: 'land',
    description: '植物繊維5kg＋水2L → 紙4kg。毎秒5.76t。電力 1MW。', baseCost: 2_200_000_000, costGrowth: 1.18, employees: 5, powerUse: 1,
    production: { inputs: { plant_fiber: 7200, water: 2880 }, outputs: { paper: 5760 } }, unlock: { type: 'obtained', resource: 'paper', min: 30 },
  },
  {
    id: 'rubber_boiler', name: 'ゴム加工場', nameEn: 'Rubber Works', category: 'PROCESSING', icon: 'icon_material_rubber', site: 'land',
    description: '樹液4kg＋木炭0.5kg → ゴム2kg。毎秒2.88t。', baseCost: 3_500_000_000, costGrowth: 1.18, employees: 4,
    production: { inputs: { sap: 5760, charcoal: 720 }, outputs: { rubber: 2880 } }, unlock: { type: 'crafted', recipe: 'boil_sap', min: 3 },
  },
  {
    id: 'wire_mill', name: '電線工場', nameEn: 'Wire Mill', category: 'PROCESSING', icon: 'icon_material_wire', site: 'land',
    description: '銅1kg → 電線1.1個。毎秒1,584個。電力 2MW。', baseCost: 8_900_000_000, costGrowth: 1.18, employees: 5, powerUse: 2,
    production: { inputs: { copper: 1440 }, outputs: { wire: 1584 } }, unlock: { type: 'obtained', resource: 'copper', min: 40 },
  },
  {
    id: 'chemical_plant', name: '化学工場', nameEn: 'Chemical Plant', category: 'PROCESSING', icon: 'icon_material_chemical', site: 'land',
    description: '原油2L＋水1L → 化学薬品2L。毎秒2.88kL。電力 3MW。', baseCost: 3_000_000_000, costGrowth: 1.18, employees: 8, powerUse: 3,
    production: { inputs: { crude_oil: 2880, water: 1440 }, outputs: { chemical: 2880 } }, unlock: { type: 'obtained', resource: 'crude_oil', min: 30 },
  },
  {
    id: 'paint_factory', name: '塗料工場', nameEn: 'Paint Factory', category: 'MANUFACTURING', icon: 'icon_chemical_paint', site: 'land',
    description: '化学薬品1L＋砂2kg → 塗料1.5L。毎秒2.16kL。電力 2MW。', baseCost: 5_500_000_000, costGrowth: 1.18, employees: 6, powerUse: 2,
    production: { inputs: { chemical: 1440, sand: 2880 }, outputs: { paint: 2160 } }, unlock: { type: 'obtained', resource: 'chemical', min: 40 },
  },
  {
    id: 'fertilizer_plant', name: '肥料工場', nameEn: 'Fertilizer Plant', category: 'MANUFACTURING', icon: 'icon_material_fertilizer', site: 'land',
    description: '化学薬品0.15L＋水1L → 肥料1個。毎秒2,880個。電力 2MW。', baseCost: 880_000_000, costGrowth: 1.18, employees: 6, powerUse: 2,
    production: { inputs: { chemical: 432, water: 2880 }, outputs: { fertilizer: 2880 } }, unlock: { type: 'obtained', resource: 'chemical', min: 30 },
  },
  {
    id: 'food_factory', name: '食品工場', nameEn: 'Food Factory', category: 'MANUFACTURING', icon: 'icon_facility_food_factory', site: 'land',
    description: '小麦粉2kg＋水1L → 加工食品2.5個。毎秒360個。電力 1MW。', baseCost: 1_200_000_000, costGrowth: 1.18, employees: 6, powerUse: 1,
    production: { inputs: { flour: 288, water: 144 }, outputs: { food: 360 } }, unlock: { type: 'obtained', resource: 'flour', min: 30 },
  },
  {
    id: 'clothing_factory', name: '衣料工場', nameEn: 'Clothing Factory', category: 'MANUFACTURING', icon: 'icon_material_leather', site: 'land',
    description: '布2kg＋縄1kg → 衣類1.2個。毎秒173個。電力 1MW。', baseCost: 2_700_000_000, costGrowth: 1.18, employees: 7, powerUse: 1,
    production: { inputs: { cloth: 288, rope: 144 }, outputs: { clothing: 173 } }, unlock: { type: 'obtained', resource: 'cloth', min: 30 },
  },
  {
    id: 'furniture_factory', name: '家具工場', nameEn: 'Furniture Factory', category: 'MANUFACTURING', icon: 'icon_office_chair', site: 'land',
    description: '板材30kg＋布4kg → 家具1個。毎秒144個。電力 2MW。', baseCost: 36_000_000_000, costGrowth: 1.18, employees: 8, powerUse: 2,
    production: { inputs: { lumber: 4320, cloth: 576 }, outputs: { furniture: 144 } }, unlock: { type: 'obtained', resource: 'lumber', min: 60 },
  },
  {
    id: 'tire_factory', name: 'タイヤ工場', nameEn: 'Tire Factory', category: 'MANUFACTURING', icon: 'icon_machine_wheel_loader', site: 'land',
    description: 'ゴム3kg＋布1kg → タイヤ1.2個。毎秒173個。電力 2MW。', baseCost: 13_000_000_000, costGrowth: 1.18, employees: 7, powerUse: 2,
    production: { inputs: { rubber: 432, cloth: 144 }, outputs: { tire: 173 } }, unlock: { type: 'obtained', resource: 'rubber', min: 40 },
  },
  {
    id: 'battery_factory', name: '電池工場', nameEn: 'Battery Factory', category: 'MANUFACTURING', icon: 'icon_facility_battery_factory', site: 'land',
    description: '電線2個＋プラスチック1kg＋化学薬品1L → バッテリー1個。毎秒144個。電力 4MW。', baseCost: 26_000_000_000, costGrowth: 1.18, employees: 10, powerUse: 4,
    production: { inputs: { wire: 288, plastic: 144, chemical: 144 }, outputs: { battery: 144 } }, unlock: { type: 'obtained', resource: 'wire', min: 40 },
  },
  // ---- v1.6 追加: 建材・軽金属・化学・生活の筋 ----
  {
    id: 'limestone_quarry', name: '石灰石採石場', nameEn: 'Limestone Quarry', category: 'RESOURCE', icon: 'icon_facility_limestone_quarry', site: 'land',
    description: '石灰石を切り出す。山岳で1.3倍、寒冷地で0.9倍。', baseCost: 49_000_000, costGrowth: 1.16, employees: 4,
    production: { outputs: { limestone: 3600 } }, terrainBonus: { mountain: 1.3, desert: 1.1, plains: 1, forest: 0.8, snow: 0.9, city: 0.6 },
    unlock: { type: 'obtained', resource: 'limestone', min: 20 },
  },
  {
    id: 'cement_factory', name: 'セメント工場', nameEn: 'Cement Factory', category: 'PROCESSING', icon: 'icon_facility_cement_factory', site: 'land',
    description: '石灰石1.6kg＋石炭0.1kg → セメント1kg。毎秒17.3t。電力 2MW。', baseCost: 1_100_000_000, costGrowth: 1.18, employees: 8, powerUse: 2,
    production: { inputs: { limestone: 27650, coal: 1728 }, outputs: { cement: 17280 } }, unlock: { type: 'crafted', recipe: 'fire_lime', min: 3 },
  },
  {
    id: 'ready_mix_plant', name: '生コン工場', nameEn: 'Ready-Mix Plant', category: 'PROCESSING', icon: 'icon_machine_mixer_truck', site: 'land',
    description: 'セメント1kg＋砂3kg＋水2L → コンクリート6kg。毎秒8.64t。砂だけで練るより材料が少なくて済む。電力 1MW。', baseCost: 77_000_000, costGrowth: 1.18, employees: 5, powerUse: 1,
    production: { inputs: { cement: 1440, sand: 4320, water: 2880 }, outputs: { concrete: 8640 } }, unlock: { type: 'obtained', resource: 'cement', min: 20 },
  },
  {
    id: 'sulfur_mine', name: '硫黄鉱山', nameEn: 'Sulfur Mine', category: 'RESOURCE', icon: 'icon_facility_sulfur_mine', site: 'land',
    description: '火山性の土地で硫黄を採る。山岳で1.4倍、寒冷地で1.1倍。平地ではほとんど採れない。', baseCost: 170_000_000, costGrowth: 1.18, employees: 5,
    production: { outputs: { sulfur: 1728 } }, terrainBonus: { mountain: 1.4, snow: 1.1, desert: 0.9, plains: 0.4, forest: 0.4, city: 0.2, coast: 0.6, river: 0.5, industrial: 0.6 },
    unlock: { type: 'research', research: 'chemistry' },
  },
  {
    id: 'ammonia_plant', name: 'アンモニア工場', nameEn: 'Ammonia Plant', category: 'PROCESSING', icon: 'icon_facility_ammonia_plant', site: 'land',
    description: '硫黄1kg＋水4L＋石炭1kg → アンモニア1.4kg。毎秒2.02t。電力 3MW。', baseCost: 270_000_000, costGrowth: 1.18, employees: 8, powerUse: 3,
    production: { inputs: { sulfur: 1440, water: 5760, coal: 1440 }, outputs: { ammonia: 2016 } }, unlock: { type: 'obtained', resource: 'sulfur', min: 30 },
  },
  {
    id: 'nitro_fertilizer_plant', name: '窒素肥料工場', nameEn: 'Nitrogen Fertilizer Plant', category: 'PROCESSING', icon: 'icon_facility_fertilizer_plant', site: 'land',
    description: 'アンモニア1kg＋水2L → 肥料2.2個。毎秒3,168個。薬品から作るより多く採れる。電力 2MW。', baseCost: 1_300_000_000, costGrowth: 1.18, employees: 6, powerUse: 2,
    production: { inputs: { ammonia: 1440, water: 2880 }, outputs: { fertilizer: 3168 } }, unlock: { type: 'obtained', resource: 'ammonia', min: 20 },
  },
  {
    id: 'bauxite_mine', name: 'ボーキサイト鉱山', nameEn: 'Bauxite Mine', category: 'RESOURCE', icon: 'icon_facility_bauxite_mine', site: 'land',
    description: 'アルミの原料を掘る。砂漠で1.3倍、山岳で1.2倍。', baseCost: 86_000_000, costGrowth: 1.18, employees: 6,
    production: { outputs: { bauxite: 2304 } }, terrainBonus: { desert: 1.3, mountain: 1.2, plains: 1, forest: 0.8, snow: 0.7, city: 0.5 },
    unlock: { type: 'research', research: 'metallurgy' },
  },
  {
    id: 'aluminum_smelter', name: 'アルミ精錬所', nameEn: 'Aluminum Smelter', category: 'PROCESSING', icon: 'icon_facility_aluminum_refinery', site: 'land',
    description: 'ボーキサイト6kg＋石炭1kg → アルミ1kg。毎秒1.44t。電気を大量に食う（8MW）。安い電気のある土地に建てるのが要。', baseCost: 3_700_000_000, costGrowth: 1.2, employees: 12, powerUse: 8,
    production: { inputs: { bauxite: 8640, coal: 1440 }, outputs: { aluminum: 1440 } }, unlock: { type: 'obtained', resource: 'bauxite', min: 40 },
  },
  {
    id: 'ceramic_kiln', name: '窯業工場', nameEn: 'Ceramic Works', category: 'PROCESSING', icon: 'icon_facility_ceramic_kiln', site: 'land',
    description: '粘土4kg＋砂2kg＋木炭1kg → 陶磁器1.2kg。毎秒173kg。粘土の使い道。電力 1MW。', baseCost: 310_000_000, costGrowth: 1.18, employees: 5, powerUse: 1,
    production: { inputs: { clay: 576, sand: 288, charcoal: 144 }, outputs: { ceramic: 173 } }, unlock: { type: 'obtained', resource: 'clay', min: 80 },
  },
  {
    id: 'printing_plant', name: '印刷工場', nameEn: 'Printing Plant', category: 'MANUFACTURING', icon: 'icon_facility_printing_plant', site: 'land',
    description: '紙4kg＋塗料0.5L → 書籍1個。毎秒144個。紙と塗料の行き先。電力 2MW。', baseCost: 660_000_000, costGrowth: 1.18, employees: 7, powerUse: 2,
    production: { inputs: { paper: 576, paint: 72 }, outputs: { book: 144 } }, unlock: { type: 'obtained', resource: 'paper', min: 60 },
  },
  {
    id: 'leather_goods_factory', name: '革製品工場', nameEn: 'Leather Goods Factory', category: 'MANUFACTURING', icon: 'icon_facility_leather_workshop', site: 'land',
    description: '革3kg＋布1kg＋工具0.05個 → 革製品1個。毎秒144個。工具の使い道。電力 1MW。', baseCost: 6_600_000_000, costGrowth: 1.18, employees: 8, powerUse: 1,
    production: { inputs: { leather: 432, cloth: 144, tool: 7.2 }, outputs: { leather_goods: 144 } }, unlock: { type: 'obtained', resource: 'leather', min: 20 },
  },
  {
    id: 'jewelry_workshop', name: '宝飾工房', nameEn: 'Jewelry Workshop', category: 'MANUFACTURING', icon: 'icon_facility_jewelry_workshop', site: 'land',
    description: '金2.9g＋銀2.9g＋宝石0.86個 → 宝飾品1個。毎秒50.4個。電力 1MW。軽いのに桁違いに高く売れる。', baseCost: 89_000_000_000, costGrowth: 1.22, employees: 10, powerUse: 1,
    production: { inputs: { gold: 144, silver: 144, gem: 43.2 }, outputs: { jewelry: 50.4 } }, unlock: { type: 'research', research: 'gemology' },
  },
  {
    id: 'bearing_factory', name: '軸受工場', nameEn: 'Bearing Factory', category: 'MANUFACTURING', icon: 'icon_facility_bearing_factory', site: 'land',
    description: '鋼鉄2kg＋機械部品0.4個 → ベアリング1.2個。毎秒1,728個。電力 3MW。', baseCost: 9_500_000_000, costGrowth: 1.18, employees: 10, powerUse: 3,
    production: { inputs: { steel: 2880, machine_parts: 576 }, outputs: { bearing: 1728 } }, unlock: { type: 'obtained', resource: 'steel', min: 100 },
  },
  {
    id: 'motor_factory', name: '電動機工場', nameEn: 'Motor Factory', category: 'MANUFACTURING', icon: 'icon_facility_motor_factory', site: 'land',
    description: '銅4kg＋鋼鉄1kg＋ベアリング1個＋電線2個 → 電動機0.8個。毎秒1,152個。電力 4MW。', baseCost: 81_000_000_000, costGrowth: 1.2, employees: 14, powerUse: 4,
    production: { inputs: { copper: 5760, steel: 1440, bearing: 1440, wire: 2880 }, outputs: { motor: 1152 } }, unlock: { type: 'obtained', resource: 'bearing', min: 40 },
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
