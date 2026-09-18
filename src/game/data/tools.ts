import type { ResourceId } from './resources';

/** 道具の定義。道具は永続装備ではなく、使用回数（耐久）が0になると消滅する。 */
export interface ToolDef {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  /** 使用可能回数 */
  durability: number;
  /** 採集量の倍率（資源ごと）。未指定の資源には効果なし */
  gatherMultiplier: Partial<Record<ResourceId, number>>;
  description: string;
}

export const TOOLS = [
  { id: 'stone_hammer', name: '石のハンマー', nameEn: 'Stone Hammer', icon: 'icon_tool_hammer_stone', durability: 10, gatherMultiplier: { scrap_metal: 1 }, description: '鉄くずを叩いて回収できる。' },
  { id: 'stone_axe', name: '石の斧', nameEn: 'Stone Axe', icon: 'icon_tool_axe_stone', durability: 10, gatherMultiplier: { wood: 3, sap: 3 }, description: '木と樹液の採集量が3倍になる。' },
  { id: 'shovel', name: '簡易シャベル', nameEn: 'Shovel', icon: 'icon_tool_shovel', durability: 15, gatherMultiplier: { sand: 3, clay: 3, gold_ore: 1 }, description: '砂と粘土の採集量が3倍になる。砂金を探すのにも要る。' },
  { id: 'bucket', name: 'バケツ', nameEn: 'Bucket', icon: 'icon_tool_bucket', durability: 20, gatherMultiplier: { water: 5 }, description: '水の採集量が5倍になる。' },
  { id: 'stone_pickaxe', name: '石のつるはし', nameEn: 'Stone Pickaxe', icon: 'icon_tool_pickaxe_stone', durability: 5, gatherMultiplier: { iron_ore: 1, stone: 2, limestone: 2 }, description: '鉄鉱石を採掘できるようになる。石と石灰石は2倍。' },
  { id: 'iron_pickaxe', name: '鉄のつるはし', nameEn: 'Iron Pickaxe', icon: 'icon_tool_pickaxe_iron', durability: 20, gatherMultiplier: { iron_ore: 1.5, stone: 3, limestone: 3 }, description: '鉄鉱石 +50%。石と石灰石は3倍。' },
  { id: 'steel_pickaxe', name: '鋼鉄のつるはし', nameEn: 'Steel Pickaxe', icon: 'icon_tool_pickaxe_steel', durability: 80, gatherMultiplier: { iron_ore: 2.5, stone: 4, limestone: 4 }, description: '鉄鉱石 +150%。石と石灰石は4倍。' },
] as const satisfies readonly ToolDef[];

export type ToolId = (typeof TOOLS)[number]['id'];

export const TOOL_MAP: Record<ToolId, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as unknown as Record<ToolId, ToolDef>;
export const TOOL_IDS = TOOLS.map((t) => t.id) as ToolId[];

export function getTool(id: ToolId): ToolDef {
  return TOOL_MAP[id];
}

export function isToolId(id: string): id is ToolId {
  return id in TOOL_MAP;
}
