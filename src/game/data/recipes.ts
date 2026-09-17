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
