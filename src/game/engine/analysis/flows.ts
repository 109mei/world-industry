import { FACILITIES, FACILITY_MAP, isFacilityId, type FacilityDef } from '@/game/data/facilities';
import { GATHER_ACTIONS, type GatherActionDef } from '@/game/data/gathering';
import { RECIPES, type RecipeDef } from '@/game/data/recipes';
import type { ResourceId } from '@/game/data/resources';
import type { DerivedState, GameState } from '@/types/state';
import { getLand } from '../land';
import { isUnlocked } from '../systems/unlocks';

export interface Flow {
  /** 施設名（土地名つき） */
  label: string;
  icon: string;
  /** 個/秒（実際の稼働ぶん） */
  rate: number;
  landId: string;
  typeId: string;
}

export interface ResourceFlows {
  producers: Flow[];
  consumers: Flow[];
  /** 本社への輸送（土地→本社、個/秒） */
  imports: number;
  /** 土地への輸送（本社→土地、個/秒） */
  exports: number;
  /** この資源を作れるレシピ（解放済み） */
  recipesMaking: RecipeDef[];
  /** この資源を使うレシピ（解放済み） */
  recipesUsing: RecipeDef[];
  /** この資源を作れる施設（解放済みだが未建設のものも含む） */
  facilitiesMaking: FacilityDef[];
  /** 手作業で採れるか */
  gather: GatherActionDef | null;
}

/** 資源の「作り方」と「使い道」。施設ごとの実流量は derived.facilityRuntime から */
export function resourceFlows(state: GameState, derived: DerivedState, id: ResourceId): ResourceFlows {
  const producers: Flow[] = [];
  const consumers: Flow[] = [];
  for (const inst of state.facilities) {
    if (!isFacilityId(inst.typeId) || inst.count <= 0) continue;
    const rt = derived.facilityRuntime[inst.id];
    if (!rt) continue;
    const def = FACILITY_MAP[inst.typeId];
    const land = getLand(state, inst.landId);
    const where = inst.landId === 'hq' ? '' : `（${land?.name ?? inst.landId}）`;
    const out = rt.outputRates[id] ?? 0;
    const inp = rt.inputRates[id] ?? 0;
    if (out > 0 || (def.production?.outputs && id in def.production.outputs)) producers.push({ label: `${def.name}×${inst.count}${where}`, icon: def.icon, rate: out, landId: inst.landId, typeId: inst.typeId });
    if (inp > 0 || (def.production?.inputs && id in def.production.inputs) || (def.fuel && id in def.fuel)) consumers.push({ label: `${def.name}×${inst.count}${where}`, icon: def.icon, rate: inp, landId: inst.landId, typeId: inst.typeId });
  }
  producers.sort((a, b) => b.rate - a.rate);
  consumers.sort((a, b) => b.rate - a.rate);
  let imports = 0;
  let exports = 0;
  for (const rt of Object.values(derived.lands)) {
    imports += rt.exports[id] ?? 0;
    exports += rt.imports[id] ?? 0;
  }
  const recipesMaking = (RECIPES as readonly RecipeDef[]).filter((r) => r.outputs && id in r.outputs && (isUnlocked(state, 'recipe', r.id) || !r.hiddenUntilUnlocked));
  const recipesUsing = (RECIPES as readonly RecipeDef[]).filter((r) => id in r.inputs && (isUnlocked(state, 'recipe', r.id) || !r.hiddenUntilUnlocked));
  const facilitiesMaking = (FACILITIES as readonly FacilityDef[]).filter((f) => f.production?.outputs && id in f.production.outputs && (isUnlocked(state, 'facility', f.id) || !f.hiddenUntilUnlocked));
  const gather = (GATHER_ACTIONS as readonly GatherActionDef[]).find((g) => g.resource === id) ?? null;
  return { producers, consumers, imports, exports, recipesMaking, recipesUsing, facilitiesMaking, gather };
}
