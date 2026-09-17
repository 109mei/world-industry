import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { RECIPE_MAP, isRecipeId } from '@/game/data/recipes';
import { RESOURCE_MAP, isResourceId } from '@/game/data/resources';
import { TOOL_MAP, isToolId } from '@/game/data/tools';
import type { ConditionNames } from '@/game/engine/systems/unlocks';

/** 解放条件の表示に使う名前解決 */
export const NAMES: ConditionNames = {
  resource: (id) => (isResourceId(id) ? RESOURCE_MAP[id].name : id),
  tool: (id) => (isToolId(id) ? TOOL_MAP[id].name : id),
  recipe: (id) => (isRecipeId(id) ? RECIPE_MAP[id].name : id),
  facility: (id) => (isFacilityId(id) ? FACILITY_MAP[id].name : id),
};

export function formatMW(mw: number): string {
  if (mw >= 1000) return `${(mw / 1000).toFixed(mw >= 10000 ? 0 : 2)}GW`;
  return `${mw.toFixed(mw >= 100 ? 0 : 1)}MW`;
}
