import { TOOL_MAP, type ToolId } from '@/game/data/tools';
import type { GameState } from '@/types/state';
import type { EngineContext } from '../context';

export function addTool(state: GameState, toolId: ToolId, count = 1): void {
  const def = TOOL_MAP[toolId];
  const stack = state.tools[toolId];
  if (!stack || stack.count <= 0) {
    state.tools[toolId] = { count, durability: def.durability };
  } else {
    stack.count += count;
  }
  state.stats.toolsCrafted[toolId] = (state.stats.toolsCrafted[toolId] ?? 0) + count;
}

/** 道具を1回使う。耐久が0になったらその1本は消滅し、次の1本に切り替わる */
export function consumeTool(ctx: EngineContext, toolId: ToolId): void {
  const { state } = ctx;
  const stack = state.tools[toolId];
  if (!stack || stack.count <= 0) return;
  stack.durability -= 1;
  if (stack.durability <= 0) {
    stack.count -= 1;
    state.stats.toolsBroken += 1;
    const def = TOOL_MAP[toolId];
    if (stack.count <= 0) {
      delete state.tools[toolId];
      ctx.emit('warn', `${def.name}が壊れました（残り0本）`, { toast: true });
    } else {
      stack.durability = def.durability;
      ctx.emit('info', `${def.name}が壊れました（残り${stack.count}本）`);
    }
  }
}
