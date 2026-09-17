import { RECIPE_MAP, type RecipeId } from '@/game/data/recipes';
import type { ResourceId } from '@/game/data/resources';
import type { GameState } from '@/types/state';
import { addResource, hasResources, maxTimes, removeResources } from '../inventory';
import type { EngineContext } from '../context';
import { isUnlocked } from '../systems/unlocks';
import { addTool } from './tools';

export function craftableTimes(state: GameState, recipeId: RecipeId): number {
  if (!isUnlocked(state, 'recipe', recipeId)) return 0;
  return maxTimes(state, RECIPE_MAP[recipeId].inputs);
}

/** レシピを times 回実行する。実際に作れた回数を返す */
export function craft(ctx: EngineContext, recipeId: RecipeId, times = 1): number {
  const { state, derived } = ctx;
  const def = RECIPE_MAP[recipeId];
  if (!isUnlocked(state, 'recipe', recipeId)) return 0;
  const possible = Math.min(times, maxTimes(state, def.inputs));
  if (possible <= 0 || !hasResources(state, def.inputs, possible)) return 0;

  // 出力先の倉庫に空きがないときは作らない（材料が消えてしまうのを防ぐ）
  if (def.outputs) {
    for (const [id, n] of Object.entries(def.outputs) as [ResourceId, number][]) {
      const space = derived.capacity - (state.inventory[id] ?? 0);
      if (space < n) {
        ctx.emit('warn', `倉庫が満杯のため作れません: ${def.name}`, { toast: true });
        return 0;
      }
    }
  }
  let made = possible;
  if (def.outputs) {
    for (const [id, n] of Object.entries(def.outputs) as [ResourceId, number][]) {
      const space = derived.capacity - (state.inventory[id] ?? 0);
      made = Math.min(made, Math.floor(space / n));
    }
  }
  if (made <= 0) return 0;

  removeResources(state, def.inputs, made);
  const yieldMult = derived.modifiers?.craftYield ?? 1;
  if (def.outputs) {
    for (const [id, n] of Object.entries(def.outputs) as [ResourceId, number][]) {
      addResource(state, id, n * made * yieldMult, derived.capacity, 'crafted');
    }
  }
  if (def.outputTool) addTool(state, def.outputTool, made);
  state.stats.crafted[recipeId] = (state.stats.crafted[recipeId] ?? 0) + made;
  return made;
}
