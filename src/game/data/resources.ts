/** 資源・素材・製品の定義。ゲームロジックは必ずこのデータを参照する。 */
export type ResourceCategory = 'raw' | 'ore' | 'material' | 'part' | 'product';

export interface ResourceDef {
  id: string;
  name: string;
  nameEn: string;
  category: ResourceCategory;
  /** 市場の基準価格（円） */
  basePrice: number;
  /** 1個あたりの重さ（t）。物流コストの計算用（将来） */
  weight: number;
  /** assets/icons 内のファイル名（拡張子なし） */
  icon: string;
  /** 市場で売れるか */
  sellable: boolean;
  /** この個数を一度に売ると価格が約5%下がる（流動性） */
  liquidity: number;
  /** 最初から資源一覧に表示するか */
  initialDiscovered?: boolean;
  description: string;
}

export const RESOURCES = [
  { id: 'stone', name: '石', nameEn: 'Stone', category: 'raw', basePrice: 2, weight: 0.02, icon: 'icon_resource_stone', sellable: true, liquidity: 4000, initialDiscovered: true, description: '最も基本的な資源。道具や建材の材料になる。' },
  { id: 'wood', name: '木', nameEn: 'Wood', category: 'raw', basePrice: 3, weight: 0.01, icon: 'icon_resource_wood', sellable: true, liquidity: 4000, initialDiscovered: true, description: '道具の柄や燃料に使う。' },
  { id: 'water', name: '水', nameEn: 'Water', category: 'raw', basePrice: 1, weight: 0.01, icon: 'icon_resource_water', sellable: true, liquidity: 8000, initialDiscovered: true, description: '生活と工業の基本。将来は農業や工場で大量に使う。' },
  { id: 'sand', name: '砂', nameEn: 'Sand', category: 'raw', basePrice: 2, weight: 0.02, icon: 'icon_resource_sand', sellable: true, liquidity: 4000, initialDiscovered: true, description: 'ガラスやコンクリートの材料。' },
  { id: 'plant_fiber', name: '植物繊維', nameEn: 'Plant Fiber', category: 'raw', basePrice: 3, weight: 0.005, icon: 'icon_resource_plant_fiber', sellable: true, liquidity: 3000, initialDiscovered: true, description: 'ロープや布の材料。バケツづくりにも使う。' },
  { id: 'scrap_metal', name: '鉄くず', nameEn: 'Scrap Metal', category: 'raw', basePrice: 8, weight: 0.03, icon: 'icon_resource_scrap_metal', sellable: true, liquidity: 1200, initialDiscovered: true, description: '拾い集めた金属くず。精錬すると鉄になる。' },
  { id: 'clay', name: '粘土', nameEn: 'Clay', category: 'raw', basePrice: 3, weight: 0.02, icon: 'icon_resource_clay', sellable: true, liquidity: 3000, initialDiscovered: true, description: 'レンガや陶器の材料。' },
  { id: 'iron_ore', name: '鉄鉱石', nameEn: 'Iron Ore', category: 'ore', basePrice: 12, weight: 0.05, icon: 'icon_resource_iron_ore', sellable: true, liquidity: 1500, description: 'つるはしで採掘できる鉱石。精錬して鉄にする。' },
  { id: 'coal', name: '石炭', nameEn: 'Coal', category: 'ore', basePrice: 10, weight: 0.04, icon: 'icon_resource_coal', sellable: true, liquidity: 1500, description: '鋼鉄の生産や火力発電に使う。土地の鉱脈から採掘する。' },
  { id: 'iron', name: '鉄', nameEn: 'Iron', category: 'material', basePrice: 40, weight: 0.05, icon: 'icon_material_iron', sellable: true, liquidity: 400, description: '鉄鉱石や鉄くずを精錬した金属。工具や機械の材料。' },
  { id: 'steel', name: '鋼鉄', nameEn: 'Steel', category: 'material', basePrice: 120, weight: 0.05, icon: 'icon_material_steel', sellable: true, liquidity: 200, description: '鉄と石炭から作る高強度の金属。製鋼所で生産する。' },
  { id: 'brick', name: 'レンガ', nameEn: 'Brick', category: 'material', basePrice: 5, weight: 0.03, icon: 'icon_facility_brick_factory', sellable: true, liquidity: 2000, description: '粘土を焼いた建材。' },
  { id: 'machine_parts', name: '機械部品', nameEn: 'Machine Parts', category: 'part', basePrice: 220, weight: 0.03, icon: 'icon_part_gear_set', sellable: true, liquidity: 60, description: '鉄から作る部品。高価な製品の材料。' },
  { id: 'tool', name: '工具', nameEn: 'Tools', category: 'product', basePrice: 150, weight: 0.01, icon: 'icon_tool_wrench', sellable: true, liquidity: 80, description: '鉄と木から作る製品。序盤の主力商品。' },
  // ---- 土地・電力・物流以降で使う資源 ----
  { id: 'copper_ore', name: '銅鉱石', nameEn: 'Copper Ore', category: 'ore', basePrice: 18, weight: 0.05, icon: 'icon_resource_copper_ore', sellable: true, liquidity: 1200, description: '銅の原料。土地の鉱脈から採掘する。' },
  { id: 'crude_oil', name: '原油', nameEn: 'Crude Oil', category: 'ore', basePrice: 25, weight: 0.03, icon: 'icon_resource_crude_oil', sellable: true, liquidity: 2000, description: '油田から汲み上げる。精製して燃料にする。パイプラインで運べる。' },
  { id: 'uranium_ore', name: 'ウラン鉱石', nameEn: 'Uranium Ore', category: 'ore', basePrice: 400, weight: 0.05, icon: 'icon_resource_uranium', sellable: true, liquidity: 50, description: '原子力燃料の原料。ごく限られた土地にしかない。' },
  { id: 'wheat', name: '小麦', nameEn: 'Wheat', category: 'raw', basePrice: 6, weight: 0.01, icon: 'icon_resource_wheat', sellable: true, liquidity: 5000, description: '農園で育てる。平原で効率が高い。' },
  { id: 'copper', name: '銅', nameEn: 'Copper', category: 'material', basePrice: 70, weight: 0.05, icon: 'icon_material_copper', sellable: true, liquidity: 300, description: '銅鉱石を精錬した金属。電線や電子部品の材料。' },
  { id: 'fuel', name: '燃料', nameEn: 'Fuel', category: 'material', basePrice: 60, weight: 0.02, icon: 'icon_material_fuel', sellable: true, liquidity: 800, description: '原油を精製した燃料。火力発電やトラックの燃料になる。' },
  { id: 'nuclear_fuel', name: '核燃料', nameEn: 'Nuclear Fuel', category: 'material', basePrice: 20000, weight: 0.01, icon: 'icon_grid_fuel_cell', sellable: false, liquidity: 5, description: 'ウラン鉱石を濃縮した燃料。原子力発電所で使う。' },
  { id: 'electronics', name: '電子部品', nameEn: 'Electronics', category: 'part', basePrice: 900, weight: 0.005, icon: 'icon_material_electronics', sellable: true, liquidity: 40, description: '銅と鋼鉄から作る高付加価値の部品。' },
  { id: 'flour', name: '小麦粉', nameEn: 'Flour', category: 'product', basePrice: 15, weight: 0.01, icon: 'icon_food_flour', sellable: true, liquidity: 3000, description: '小麦を製粉した食品。安定して売れる。' },
] as const satisfies readonly ResourceDef[];

export type ResourceId = (typeof RESOURCES)[number]['id'];

export const RESOURCE_MAP: Record<ResourceId, ResourceDef> = Object.fromEntries(
  RESOURCES.map((r) => [r.id, r]),
) as Record<ResourceId, ResourceDef>;

export const RESOURCE_IDS = RESOURCES.map((r) => r.id) as ResourceId[];

export function getResource(id: ResourceId): ResourceDef {
  return RESOURCE_MAP[id];
}

export function isResourceId(id: string): id is ResourceId {
  return id in RESOURCE_MAP;
}

export const RESOURCE_CATEGORY_LABEL: Record<ResourceCategory, string> = {
  raw: '天然資源',
  ore: '鉱石',
  material: '加工素材',
  part: '部品',
  product: '製品',
};
