import { RESEARCH_MAP, isResearchId, type ResearchId } from '@/game/data/research';
import type { GameState } from '@/types/state';
import type { EngineContext } from '../context';

/** 研究ポイントを貯める */
export function runResearchPoints(ctx: EngineContext, dt: number): void {
  const gained = ctx.derived.researchRate * (ctx.derived.eventMods?.researchRate ?? 1) * dt;
  if (gained <= 0) return;
  ctx.state.research.points += gained;
  ctx.state.research.totalPoints += gained;
}

export function canResearch(state: GameState, id: ResearchId): { ok: boolean; reason?: string } {
  const def = RESEARCH_MAP[id];
  if (state.research.completed[id]) return { ok: false, reason: '研究済み' };
  for (const req of def.requires) {
    if (!state.research.completed[req]) return { ok: false, reason: `前提: ${isResearchId(req) ? RESEARCH_MAP[req].name : req}` };
  }
  if (state.research.points + 1e-9 < def.cost) return { ok: false, reason: '研究ポイント不足' };
  return { ok: true };
}

/** 研究を完了する（ポイントを消費） */
export function completeResearch(ctx: EngineContext, id: ResearchId): boolean {
  const { state } = ctx;
  const check = canResearch(state, id);
  if (!check.ok) return false;
  const def = RESEARCH_MAP[id];
  state.research.points -= def.cost;
  state.research.completed[id] = true;
  ctx.emit('unlock', `研究完了: ${def.name}`, { toast: true });
  return true;
}
