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
  { id: 'smelt_scrap', name: '鉄くずを精錬', category: 'materials', icon: 'icon_material_iron', inputs: { scrap_metal: 1.2, wood: 0.8 }, outputs: { iron: 1 }, unlock: { type: 'obtained', resource: 'scrap_metal', min: 1 }, description: '鉄くず1.2kgと木0.8kgを焚き火で溶かして鉄1kgにする。' },
  { id: 'smelt_iron_ore', name: '鉄鉱石を精錬', category: 'materials', icon: 'icon_material_iron', inputs: { iron_ore: 1.6, wood: 0.8 }, outputs: { iron: 1 }, unlock: { type: 'obtained', resource: 'iron_ore', min: 1 }, description: '鉄鉱石1.6kgと木0.8kgから鉄1kgを作る。' },
  { id: 'fire_brick', name: 'レンガを焼く', category: 'materials', icon: 'icon_facility_brick_factory', inputs: { clay: 2, wood: 1 }, outputs: { brick: 2 }, unlock: { type: 'always' }, description: '粘土2kgと木1kgからレンガ2kgを焼く。' },
  { id: 'make_rope', name: '縄をよる', category: 'materials', icon: 'icon_part_cable_reel', inputs: { plant_fiber: 3 }, outputs: { rope: 2 }, unlock: { type: 'always' }, description: '植物繊維3kgから縄2kgを作る。建材セットや布に使う。' },
  { id: 'mix_concrete', name: 'コンクリートを練る', category: 'materials', icon: 'icon_material_concrete', inputs: { sand: 3, stone: 2, water: 2 }, outputs: { concrete: 7 }, unlock: { type: 'always' }, description: '砂3kg・石2kg・水2Lからコンクリート7kgを作る。砂と水の使い道。' },
  { id: 'blow_glass', name: 'ガラスを吹く', category: 'materials', icon: 'icon_facility_glass_factory', inputs: { sand: 4, wood: 2 }, outputs: { glass: 1 }, unlock: { type: 'obtained', resource: 'sand', min: 20 }, description: '砂4kgと木2kgからガラス1kgを作る。工場より遅いが序盤から作れる。' },
  { id: 'cast_scrap', name: '鉄くずを鋳る', category: 'materials', icon: 'icon_material_steel_plate', inputs: { scrap_metal: 2.4, wood: 0.8 }, outputs: { cast_iron: 2 }, unlock: { type: 'obtained', resource: 'scrap_metal', min: 5 }, description: '鉄くず2.4kgと木0.8kgから鋳鉄2kg。精錬より鉄くずを活かせる。' },
  // ---- 部品 ----
  { id: 'craft_machine_parts', name: '機械部品', category: 'parts', icon: 'icon_part_gear_set', inputs: { iron: 6, wood: 2, stone: 2 }, outputs: { machine_parts: 1 }, unlock: { type: 'obtained', resource: 'iron', min: 20 }, description: '鉄6kg・木2kg・石2kgから機械部品1個。手で削り出すので鉄を倍も無駄にする。部品工房なら鉄3kgで済む。' },
  // ---- 製品 ----
  { id: 'craft_tool', name: '工具', category: 'products', icon: 'icon_tool_wrench', inputs: { iron: 4, wood: 2 }, outputs: { tool: 1 }, unlock: { type: 'obtained', resource: 'iron', min: 1 }, description: '鉄4kgと木2kgから工具1個。手打ちなので鉄が倍要る。工具工房なら鉄2kgで作れる。' },
  // ---- v1.0 追加 ----
  { id: 'make_charcoal', name: '木炭を焼く', category: 'materials', icon: 'icon_resource_coal', inputs: { wood: 3 }, outputs: { charcoal: 2 }, unlock: { type: 'obtained', resource: 'wood', min: 20 }, description: '木3kgから木炭2kg。石炭の代わりの燃料になる。' },
  { id: 'saw_lumber', name: '板材に挽く', category: 'materials', icon: 'icon_material_plywood', inputs: { wood: 2 }, outputs: { lumber: 3 }, unlock: { type: 'obtained', resource: 'wood', min: 10 }, description: '木2kgから板材3kg。家具や建材のもと。' },
  { id: 'make_paper', name: '紙を漉く', category: 'materials', icon: 'icon_material_paper', inputs: { plant_fiber: 4, water: 2 }, outputs: { paper: 3 }, unlock: { type: 'obtained', resource: 'plant_fiber', min: 20 }, description: '植物繊維4kgと水2Lから紙3kg。' },
  { id: 'boil_sap', name: '樹液を煮る', category: 'materials', icon: 'icon_material_rubber', inputs: { sap: 4, charcoal: 1 }, outputs: { rubber: 3 }, unlock: { type: 'obtained', resource: 'sap', min: 6 }, description: '樹液4kgと木炭1kgからゴム3kg。ゴム農園がなくても作れる。' },
  // ---- 貴金属・宝石 ----
  { id: 'smelt_gold', name: '金を精錬', category: 'materials', icon: 'icon_office_coins', inputs: { gold_ore: 0.5, coal: 0.2 }, outputs: { gold: 1 }, unlock: { type: 'obtained', resource: 'gold_ore', min: 1 }, description: '金鉱石0.5kgと石炭0.2kgから金1gを作る。' },
  { id: 'smelt_silver', name: '銀を精錬', category: 'materials', icon: 'icon_material_aluminum', inputs: { silver_ore: 0.6, coal: 0.2 }, outputs: { silver: 1 }, unlock: { type: 'obtained', resource: 'silver_ore', min: 1 }, description: '銀鉱石0.6kgと石炭0.2kgから銀1gを作る。' },
  { id: 'cut_gem', name: '原石を磨く', category: 'products', icon: 'icon_resource_gem', inputs: { rough_gem: 4, water: 5 }, outputs: { gem: 1 }, unlock: { type: 'obtained', resource: 'rough_gem', min: 1 }, description: '原石4kgと水5Lから宝石1個。値段が跳ね上がる。' },
  { id: 'make_leather', name: '革をなめす', category: 'materials', icon: 'icon_material_leather', inputs: { cloth: 3, chemical: 1 }, outputs: { leather: 2 }, unlock: { type: 'research', research: 'tanning' }, description: '布3kgと化学薬品1Lから革2kgを作る。鞄や家具に使う。' },
  // ---- v1.6 追加（手で採れるものだけで作れる、最初の一歩） ----
  { id: 'fire_lime', name: '石灰を焼く', category: 'materials', icon: 'icon_material_cement', inputs: { limestone: 2, wood: 0.4 }, outputs: { cement: 1.25 }, unlock: { type: 'obtained', resource: 'limestone', min: 4 }, description: '石灰石2kgと木0.4kgからセメント1.25kg。窯を建てるまでの足がかり。' },
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
