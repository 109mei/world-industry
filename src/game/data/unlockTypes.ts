import type { ResourceId } from './resources';
import type { ToolId } from './tools';

/**
 * 解放条件。施設・レシピ・採集行動などに付ける。
 * ゲームロジック側（engine/systems/unlocks.ts）で評価する。
 */
export type UnlockCondition =
  | { type: 'always' }
  /** 累計入手量（採集＋生産＋クラフト）が min 以上 */
  | { type: 'obtained'; resource: ResourceId; min: number }
  /** 累計売却数が min 以上 */
  | { type: 'sold'; resource: ResourceId; min: number }
  /** 所持金が min 以上（一度でも達すればよい） */
  | { type: 'cash'; min: number }
  /** 総資産が min 以上 */
  | { type: 'assets'; min: number }
  /** そのレシピを min 回以上クラフト */
  | { type: 'crafted'; recipe: string; min: number }
  /** その道具を一度でも作った */
  | { type: 'toolCrafted'; tool: ToolId }
  /** その施設を min 個以上所有 */
  | { type: 'facility'; facility: string; min: number }
  /** チュートリアルのステップ番号（0始まり）を超えている */
  | { type: 'tutorialStep'; min: number }
  /** すべての条件を満たす */
  | { type: 'all'; conditions: UnlockCondition[] }
  /** いずれかの条件を満たす */
  | { type: 'any'; conditions: UnlockCondition[] };
