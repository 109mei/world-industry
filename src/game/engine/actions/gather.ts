import { GATHER_MAP, type GatherActionId } from '@/game/data/gathering';
import { RESOURCE_MAP } from '@/game/data/resources';
import { TOOL_MAP, type ToolId } from '@/game/data/tools';
import type { GameState } from '@/types/state';
import { addResource } from '../inventory';
import type { EngineContext } from '../context';
import { isUnlocked } from '../systems/unlocks';
import { consumeTool } from './tools';

export interface GatherPreview {
  actionId: GatherActionId;
  available: boolean;
  unlocked: boolean;
  amount: number;
  toolId: ToolId | null;
  reason: string;
}

/** 採集行動の現在の状態（UI 用） */
/**
 * ボタンに出す「1回でどれだけ採れるか」。
 * gatherMult（再出発の「手作業の腕」など）を入れた、実際に入る量を返す。
 * ここを入れ忘れると、ボタンの数字と実際の量が合わなくなる。
 */
export function previewGather(state: GameState, actionId: GatherActionId, gatherMult = 1): GatherPreview {
  const def = GATHER_MAP[actionId];
  // 知らない採集（古いセーブに残った、もう無い行動）は「できない」として黙って返す。
  // ここで落ちると自動化の巡回ごと止まり、ゲームが開けなくなる。
  if (!def) return { actionId, available: false, unlocked: false, amount: 0, toolId: null, reason: '' };
  const unlocked = isUnlocked(state, 'gather', actionId);
  let best: { id: ToolId; mult: number } | null = null;
  for (const toolId of def.tools) {
    const stack = state.tools[toolId];
    if (!stack || stack.count <= 0) continue;
    const mult = TOOL_MAP[toolId].gatherMultiplier[def.resource] ?? 1;
    if (!best || mult > best.mult) best = { id: toolId, mult };
  }
  if (!unlocked) return { actionId, available: false, unlocked: false, amount: 0, toolId: null, reason: def.hint };
  if (def.requiresTool && !best) return { actionId, available: false, unlocked: true, amount: 0, toolId: null, reason: def.hint };
  const amount = (best ? def.baseAmount * best.mult : def.baseAmount) * gatherMult;
  return { actionId, available: true, unlocked: true, amount, toolId: best?.id ?? null, reason: '' };
}

export function gather(ctx: EngineContext, actionId: GatherActionId): number {
  const { state, derived } = ctx;
  const def = GATHER_MAP[actionId];
  if (!def) return 0;
  const preview = previewGather(state, actionId, derived.modifiers?.gatherAmount ?? 1);
  if (!preview.available) return 0;
  state.stats.taps += 1;
  const current = state.inventory[def.resource] ?? 0;
  if (current >= derived.capacity - 1e-9) {
    ctx.emit('warn', `倉庫が満杯です: ${RESOURCE_MAP[def.resource].name}`, { toast: true });
    return 0;
  }
  if (preview.toolId) consumeTool(ctx, preview.toolId);
  return addResource(state, def.resource, preview.amount, derived.capacity, 'gathered');
}
