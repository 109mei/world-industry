import type { ResourceId } from './resources';
import type { ToolId } from './tools';
import type { UnlockCondition } from './unlockTypes';

/** 手作業の採集行動（「石を拾う」など）。 */
export interface GatherActionDef {
  id: string;
  resource: ResourceId;
  /** ボタンに表示する動詞 */
  label: string;
  /**
   * 素手での1回あたりの入手量。0 なら道具が必須。
   * 「素手でひとつかみ」＝1kg を基準にしてある。生の資源そのものは安いので、
   * 手で拾って売るだけではほとんど儲からない。クラフトして製品にして初めて値が付く。
   * 道具を使うと倍率がかかるので、そこが道具を作る動機になる。
   */
  baseAmount: number;
  /** 使える道具（効果が高い順に自動選択される）。道具を使うと耐久が1減る */
  tools: ToolId[];
  /** 道具が必須か */
  requiresTool: boolean;
  unlock: UnlockCondition;
  hint: string;
}

export const GATHER_ACTIONS = [
  { id: 'gather_stone', resource: 'stone', label: '石を拾う', baseAmount: 1, tools: [], requiresTool: false, unlock: { type: 'always' }, hint: '' },
  { id: 'gather_wood', resource: 'wood', label: '木を集める', baseAmount: 1, tools: ['stone_axe'], requiresTool: false, unlock: { type: 'always' }, hint: '石の斧があると3倍' },
  { id: 'gather_water', resource: 'water', label: '水を汲む', baseAmount: 1, tools: ['bucket'], requiresTool: false, unlock: { type: 'always' }, hint: 'バケツがあると5倍' },
  { id: 'gather_sand', resource: 'sand', label: '砂を集める', baseAmount: 1, tools: ['shovel'], requiresTool: false, unlock: { type: 'always' }, hint: 'シャベルがあると3倍' },
  { id: 'gather_plant_fiber', resource: 'plant_fiber', label: '繊維を採る', baseAmount: 1, tools: [], requiresTool: false, unlock: { type: 'always' }, hint: '' },
  { id: 'gather_clay', resource: 'clay', label: '粘土を掘る', baseAmount: 1, tools: ['shovel'], requiresTool: false, unlock: { type: 'always' }, hint: 'シャベルがあると3倍' },
  { id: 'gather_scrap', resource: 'scrap_metal', label: '鉄くずを回収', baseAmount: 1, tools: ['stone_hammer'], requiresTool: true, unlock: { type: 'always' }, hint: '石のハンマーが必要' },
  { id: 'gather_sap', resource: 'sap', label: '樹液を採る', baseAmount: 1, tools: ['stone_axe'], requiresTool: false, unlock: { type: 'obtained', resource: 'wood', min: 8 }, hint: '石の斧があると3倍' },
  { id: 'gather_iron_ore', resource: 'iron_ore', label: '鉄鉱石を掘る', baseAmount: 2, tools: ['steel_pickaxe', 'iron_pickaxe', 'stone_pickaxe'], requiresTool: true, unlock: { type: 'toolCrafted', tool: 'stone_pickaxe' }, hint: 'つるはしが必要' },
  { id: 'gather_gold', resource: 'gold_ore', label: '砂金を探す', baseAmount: 0.01, tools: ['shovel'], requiresTool: true, unlock: { type: 'research', research: 'gold_rush' }, hint: 'シャベルが必要。めったに見つからない' },
  { id: 'gather_limestone', resource: 'limestone', label: '石灰石を割る', baseAmount: 1, tools: ['steel_pickaxe', 'iron_pickaxe', 'stone_pickaxe'], requiresTool: true, unlock: { type: 'obtained', resource: 'stone', min: 10 }, hint: 'つるはしが必要。セメントのもと' },
] as const satisfies readonly GatherActionDef[];

export type GatherActionId = (typeof GATHER_ACTIONS)[number]['id'];
export const GATHER_MAP: Record<GatherActionId, GatherActionDef> = Object.fromEntries(GATHER_ACTIONS.map((g) => [g.id, g])) as unknown as Record<GatherActionId, GatherActionDef>;
