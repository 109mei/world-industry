import type { ResourceId } from './resources';
import type { ToolId } from './tools';
import type { UnlockCondition } from './unlockTypes';

export type RecipeCategory = 'tools' | 'materials' | 'parts' | 'products';

/** 手動クラフトのレシピ。工場の生産は facilities.ts の production で定義する。 */
export interface RecipeDef {
  id: string;
  name: string;
  category: RecipeCategory;
  icon: string;
  inputs: Partial<Record<ResourceId, number>>;
  /** 資源としての出力 */
  outputs?: Partial<Record<ResourceId, number>>;
  /** 道具としての出力（1個） */
  outputTool?: ToolId;
  unlock: UnlockCondition;
  /** 解放されるまで一覧に表示しない */
  hiddenUntilUnlocked?: boolean;
  description: string;
}

export const RECIPES = [
  // ---- 道具 ----
  { id: 'craft_stone_hammer', name: '石のハンマー', category: 'tools', icon: 'icon_tool_hammer_stone', inputs: { stone: 3, wood: 2 }, outputTool: 'stone_hammer', unlock: { type: 'always' }, description: '耐久10。鉄くずの回収に必要。' },
  { id: 'craft_stone_axe', name: '石の斧', category: 'tools', icon: 'icon_tool_axe_stone', inputs: { stone: 3, wood: 1 }, outputTool: 'stone_axe', unlock: { type: 'always' }, description: '耐久10。木の採集量が3倍。' },
  { id: 'craft_shovel', name: '簡易シャベル', category: 'tools', icon: 'icon_tool_shovel', inputs: { wood: 2, stone: 1 }, outputTool: 'shovel', unlock: { type: 'always' }, description: '耐久15。砂・粘土の採集量が3倍。' },
  { id: 'craft_bucket', name: 'バケツ', category: 'tools', icon: 'icon_tool_bucket', inputs: { wood: 3, plant_fiber: 2 }, outputTool: 'bucket', unlock: { type: 'always' }, description: '耐久20。水の採集量が5倍。' },
  { id: 'craft_stone_pickaxe', name: '石のつるはし', category: 'tools', icon: 'icon_tool_pickaxe_stone', inputs: { stone: 3, wood: 2 }, outputTool: 'stone_pickaxe', unlock: { type: 'toolCrafted', tool: 'stone_hammer' }, description: '耐久5。鉄鉱石を採掘できる。' },
  { id: 'craft_iron_pickaxe', name: '鉄のつるはし', category: 'tools', icon: 'icon_tool_pickaxe_iron', inputs: { iron: 3, wood: 2 }, outputTool: 'iron_pickaxe', unlock: { type: 'obtained', resource: 'iron', min: 1 }, description: '耐久20。鉱物の採集量 +50%。' },
  { id: 'craft_steel_pickaxe', name: '鋼鉄のつるはし', category: 'tools', icon: 'icon_tool_pickaxe_steel', inputs: { steel: 3, wood: 2 }, outputTool: 'steel_pickaxe', unlock: { type: 'obtained', resource: 'steel', min: 1 }, hiddenUntilUnlocked: true, description: '耐久80。鉱物の採集量 +150%。' },
  // ---- 素材 ----
  { id: 'smelt_scrap', name: '鉄くずを精錬', category: 'materials', icon: 'icon_material_iron', inputs: { scrap_metal: 3, wood: 1 }, outputs: { iron: 1 }, unlock: { type: 'obtained', resource: 'scrap_metal', min: 1 }, description: '鉄くず3と木1を焚き火で溶かして鉄1にする。' },
  { id: 'smelt_iron_ore', name: '鉄鉱石を精錬', category: 'materials', icon: 'icon_material_iron', inputs: { iron_ore: 2, wood: 1 }, outputs: { iron: 1 }, unlock: { type: 'obtained', resource: 'iron_ore', min: 1 }, description: '鉄鉱石2と木1から鉄1を作る。' },
  { id: 'fire_brick', name: 'レンガを焼く', category: 'materials', icon: 'icon_facility_brick_factory', inputs: { clay: 2, wood: 1 }, outputs: { brick: 2 }, unlock: { type: 'always' }, description: '粘土2と木1からレンガ2を焼く。' },
  { id: 'make_rope', name: '縄をよる', category: 'materials', icon: 'icon_part_cable_reel', inputs: { plant_fiber: 3 }, outputs: { rope: 2 }, unlock: { type: 'always' }, description: '植物繊維3から縄2を作る。建材セットや布に使う。' },
  { id: 'weave_cloth', name: '布を織る', category: 'materials', icon: 'icon_material_textile', inputs: { rope: 2, plant_fiber: 4, water: 2 }, outputs: { cloth: 1 }, unlock: { type: 'obtained', resource: 'rope', min: 2 }, description: '縄2・植物繊維4・水2から布1を織る。繊維と水の使い道。' },
  { id: 'mix_concrete', name: 'コンクリートを練る', category: 'materials', icon: 'icon_material_concrete', inputs: { sand: 3, stone: 2, water: 2 }, outputs: { concrete: 2 }, unlock: { type: 'always' }, description: '砂3・石2・水2からコンクリート2を作る。砂と水の使い道。' },
  { id: 'blow_glass', name: 'ガラスを吹く', category: 'materials', icon: 'icon_facility_glass_factory', inputs: { sand: 4, wood: 2 }, outputs: { glass: 1 }, unlock: { type: 'obtained', resource: 'sand', min: 20 }, description: '砂4と木2からガラス1を作る。工場より遅いが序盤から作れる。' },
  { id: 'cast_scrap', name: '鉄くずを鋳る', category: 'materials', icon: 'icon_material_steel_plate', inputs: { scrap_metal: 4, wood: 1 }, outputs: { cast_iron: 2 }, unlock: { type: 'obtained', resource: 'scrap_metal', min: 5 }, description: '鉄くず4と木1から鋳鉄2。精錬より鉄くずを活かせる。' },
  // ---- 部品 ----
  { id: 'craft_machine_parts', name: '機械部品', category: 'parts', icon: 'icon_part_gear_set', inputs: { iron: 3, wood: 1 }, outputs: { machine_parts: 1 }, unlock: { type: 'obtained', resource: 'iron', min: 20 }, description: '鉄3と木1から機械部品1を作る。' },
  { id: 'cast_machine_parts', name: '機械部品（鋳鉄）', category: 'parts', icon: 'icon_part_gear_set', inputs: { cast_iron: 2, rope: 1 }, outputs: { machine_parts: 1 }, unlock: { type: 'obtained', resource: 'cast_iron', min: 2 }, description: '鋳鉄2と縄1から機械部品1。鉄を使わずに作れる。' },
  // ---- 製品 ----
  { id: 'craft_tool', name: '工具', category: 'products', icon: 'icon_tool_wrench', inputs: { iron: 2, wood: 1 }, outputs: { tool: 1 }, unlock: { type: 'obtained', resource: 'iron', min: 1 }, description: '鉄2と木1から工具1を作る。市場で高く売れる。' },
  { id: 'craft_building_material', name: '建材セット', category: 'products', icon: 'icon_marker_construction', inputs: { brick: 10, concrete: 4, rope: 2 }, outputs: { building_material: 1 }, unlock: { type: 'obtained', resource: 'brick', min: 20 }, description: 'レンガ10・コンクリート4・縄2から建材セット1。高く売れる。' },
  // ---- v1.0 追加 ----
  { id: 'make_charcoal', name: '木炭を焼く', category: 'materials', icon: 'icon_resource_coal', inputs: { wood: 3 }, outputs: { charcoal: 2 }, unlock: { type: 'obtained', resource: 'wood', min: 20 }, description: '木3から木炭2。石炭の代わりの燃料になる。' },
  { id: 'saw_lumber', name: '板材に挽く', category: 'materials', icon: 'icon_material_plywood', inputs: { wood: 2 }, outputs: { lumber: 3 }, unlock: { type: 'obtained', resource: 'wood', min: 10 }, description: '木2から板材3。家具や建材のもと。' },
  { id: 'make_paper', name: '紙を漉く', category: 'materials', icon: 'icon_material_paper', inputs: { plant_fiber: 4, water: 2 }, outputs: { paper: 3 }, unlock: { type: 'obtained', resource: 'plant_fiber', min: 20 }, description: '植物繊維4と水2から紙3。' },
  { id: 'boil_sap', name: '樹液を煮る', category: 'materials', icon: 'icon_material_rubber', inputs: { sap: 4, charcoal: 1 }, outputs: { rubber: 2 }, unlock: { type: 'obtained', resource: 'sap', min: 6 }, description: '樹液4と木炭1からゴム2。ゴム農園がなくても作れる。' },
  { id: 'draw_wire', name: '電線を引く', category: 'parts', icon: 'icon_material_wire', inputs: { copper: 1 }, outputs: { wire: 2 }, unlock: { type: 'obtained', resource: 'copper', min: 5 }, description: '銅1から電線2。' },
  { id: 'mix_chemical', name: '化学薬品を作る', category: 'materials', icon: 'icon_material_chemical', inputs: { crude_oil: 2, water: 1 }, outputs: { chemical: 2 }, unlock: { type: 'obtained', resource: 'crude_oil', min: 10 }, description: '原油2と水1から化学薬品2。' },
  { id: 'mix_paint', name: '塗料を作る', category: 'materials', icon: 'icon_chemical_paint', inputs: { chemical: 1, sand: 2 }, outputs: { paint: 1 }, unlock: { type: 'obtained', resource: 'chemical', min: 4 }, description: '化学薬品1と砂2から塗料1。' },
  { id: 'mix_fertilizer', name: '肥料を作る', category: 'materials', icon: 'icon_material_fertilizer', inputs: { chemical: 1, water: 2 }, outputs: { fertilizer: 2 }, unlock: { type: 'obtained', resource: 'chemical', min: 4 }, description: '化学薬品1と水2から肥料2。' },
  { id: 'cook_food', name: '食品を作る', category: 'products', icon: 'icon_food_bread', inputs: { flour: 2, water: 1 }, outputs: { food: 2 }, unlock: { type: 'obtained', resource: 'flour', min: 5 }, description: '小麦粉2と水1から加工食品2。' },
  { id: 'sew_clothing', name: '衣類を仕立てる', category: 'products', icon: 'icon_material_leather', inputs: { cloth: 2, rope: 1 }, outputs: { clothing: 1 }, unlock: { type: 'obtained', resource: 'cloth', min: 4 }, description: '布2と縄1から衣類1。' },
  { id: 'make_furniture', name: '家具を作る', category: 'products', icon: 'icon_office_chair', inputs: { lumber: 6, cloth: 2, tool: 1 }, outputs: { furniture: 1 }, unlock: { type: 'obtained', resource: 'lumber', min: 20 }, description: '板材6・布2・工具1から家具1。高く売れる。' },
  { id: 'make_tire', name: 'タイヤを作る', category: 'parts', icon: 'icon_machine_wheel_loader', inputs: { rubber: 3, cloth: 1 }, outputs: { tire: 1 }, unlock: { type: 'obtained', resource: 'rubber', min: 10 }, description: 'ゴム3と布1からタイヤ1。' },
  { id: 'make_battery', name: 'バッテリーを作る', category: 'parts', icon: 'icon_material_battery', inputs: { wire: 2, plastic: 1, chemical: 1 }, outputs: { battery: 1 }, unlock: { type: 'obtained', resource: 'wire', min: 10 }, description: '電線2・プラスチック1・化学薬品1からバッテリー1。' },
  // ---- 貴金属・宝石 ----
  { id: 'smelt_gold', name: '金を精錬', category: 'materials', icon: 'icon_office_coins', inputs: { gold_ore: 3, coal: 2 }, outputs: { gold: 1 }, unlock: { type: 'obtained', resource: 'gold_ore', min: 1 }, description: '金鉱石3と石炭2から金1を作る。' },
  { id: 'smelt_silver', name: '銀を精錬', category: 'materials', icon: 'icon_material_aluminum', inputs: { silver_ore: 3, coal: 2 }, outputs: { silver: 1 }, unlock: { type: 'obtained', resource: 'silver_ore', min: 1 }, description: '銀鉱石3と石炭2から銀1を作る。' },
  { id: 'cut_gem', name: '原石を磨く', category: 'products', icon: 'icon_resource_gem', inputs: { rough_gem: 4, water: 5 }, outputs: { gem: 1 }, unlock: { type: 'obtained', resource: 'rough_gem', min: 1 }, description: '原石4を磨いて宝石1にする。値段が跳ね上がる。' },
  { id: 'make_gpu', name: 'GPUを作る', category: 'parts', icon: 'icon_part_gpu', inputs: { semiconductor: 2, electronics: 6, plastic: 3, wire: 4 }, outputs: { gpu: 1 }, unlock: { type: 'research', research: 'gpu_fab' }, hiddenUntilUnlocked: true, description: '半導体2・電子部品6・プラスチック3・電線4からGPU1。品薄のときは作るそばから売れる。' },
  { id: 'make_leather', name: '革をなめす', category: 'materials', icon: 'icon_material_leather', inputs: { cloth: 3, chemical: 2 }, outputs: { leather: 2 }, unlock: { type: 'research', research: 'tanning' }, description: '布と化学薬品から革を作る。鞄や家具に使う。' },
] as const satisfies readonly RecipeDef[];

export type RecipeId = (typeof RECIPES)[number]['id'];
export const RECIPE_MAP: Record<RecipeId, RecipeDef> = Object.fromEntries(RECIPES.map((r) => [r.id, r])) as unknown as Record<RecipeId, RecipeDef>;

export const RECIPE_CATEGORY_LABEL: Record<RecipeCategory, string> = {
  tools: '道具',
  materials: '素材',
  parts: '部品',
  products: '製品',
};
export const RECIPE_CATEGORIES: RecipeCategory[] = ['tools', 'materials', 'parts', 'products'];

export function isRecipeId(id: string): id is RecipeId {
  return id in RECIPE_MAP;
}
