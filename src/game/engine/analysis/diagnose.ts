import { FACILITIES, FACILITY_MAP, facilityCost, isFacilityId, type FacilityDef, type FacilityId } from '@/game/data/facilities';
import { RECIPES, type RecipeDef } from '@/game/data/recipes';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { DerivedState, FacilityInstance, GameState, LandState } from '@/types/state';
import { facilityCount } from '../actions/facility';
import { canBuildOn, getLand, isHq } from '../land';
import { isUnlocked } from '../systems/unlocks';
import type { NavTab } from '@/types/ui';

/** 「直す」操作。UI 側でエンジンの操作に対応づける */
export type FixAction =
  | { kind: 'buyFacility'; typeId: FacilityId; landId: string; cost: number }
  | { kind: 'goTab'; tab: NavTab; landId?: string }
  | { kind: 'openResource'; resource: ResourceId }
  | { kind: 'craft'; recipeId: string };

export interface Fix {
  label: string;
  action: FixAction;
  /** 所持金が足りるなど、いま実行できるか */
  enabled: boolean;
}

export interface Diagnosis {
  /** 一行の理由 */
  reason: string;
  fixes: Fix[];
}

/** その資源を作れる施設（その土地に建てられるもの、または本社に建てられるもの）。安い順 */
function producersOf(state: GameState, rid: ResourceId, land: LandState): { def: FacilityDef; land: LandState }[] {
  const out: { def: FacilityDef; land: LandState }[] = [];
  const hq = getLand(state, 'hq')!;
  for (const def of FACILITIES as readonly FacilityDef[]) {
    if (!def.production?.outputs || !(rid in def.production.outputs)) continue;
    if (!isUnlocked(state, 'facility', def.id)) continue;
    // 同じ土地に建てられるならそこ、だめなら本社（本社から輸送される）
    if (canBuildOn(def, land).ok) out.push({ def, land });
    else if (!isHq(land.id) && canBuildOn(def, hq).ok) out.push({ def, land: hq });
  }
  return out.sort((a, b) => facilityCost(a.def, facilityCount(state, a.def.id as FacilityId, a.land.id)) - facilityCost(b.def, facilityCount(state, b.def.id as FacilityId, b.land.id)));
}

function recipeFor(state: GameState, rid: ResourceId): RecipeDef | null {
  for (const r of RECIPES as readonly RecipeDef[]) {
    if (r.outputs && rid in r.outputs && isUnlocked(state, 'recipe', r.id)) return r;
  }
  return null;
}

function buyFix(state: GameState, def: FacilityDef, land: LandState, prefix = ''): Fix {
  const cost = facilityCost(def, facilityCount(state, def.id as FacilityId, land.id));
  const where = isHq(land.id) ? '' : `${land.name}に`;
  return { label: `${prefix}${where}${def.name}を${def.isWorker ? '雇う' : def.transport ? '配備' : '建てる'}（${Math.round(cost).toLocaleString('ja-JP')}円）`, action: { kind: 'buyFacility', typeId: def.id as FacilityId, landId: land.id, cost }, enabled: state.company.cash >= cost };
}

/** 施設が止まっている／減速している理由と、直すための操作 */
export function diagnoseFacility(state: GameState, derived: DerivedState, inst: FacilityInstance): Diagnosis | null {
  if (!isFacilityId(inst.typeId)) return null;
  const def = FACILITY_MAP[inst.typeId];
  const rt = derived.facilityRuntime[inst.id];
  const land = getLand(state, inst.landId);
  if (!rt || !land || inst.count <= 0) return null;
  const fixes: Fix[] = [];
  const name = (rid: ResourceId) => RESOURCE_MAP[rid]?.name ?? rid;

  if (rt.status === 'disabled') return null;
  if (rt.status === 'depleted') {
    fixes.push({ label: '別の土地を探す（地図）', action: { kind: 'goTab', tab: 'map' }, enabled: true });
    return { reason: `${rt.depleted.map(name).join('・')}の鉱脈を掘り尽くしました`, fixes };
  }
  if (rt.status === 'storage_full' || (rt.status === 'partial' && rt.blockedOutputs.length > 0 && rt.missingInputs.length === 0)) {
    const outs = rt.blockedOutputs;
    for (const rid of outs.slice(0, 2)) {
      if (RESOURCE_MAP[rid]?.sellable && isHq(land.id)) fixes.push({ label: `${name(rid)}を売る／自動売却を設定`, action: { kind: 'openResource', resource: rid }, enabled: true });
    }
    const warehouses = (FACILITIES as readonly FacilityDef[]).filter((d) => d.storageBonus && isUnlocked(state, 'facility', d.id) && canBuildOn(d, land).ok);
    for (const w of warehouses.slice(0, 2)) fixes.push(buyFix(state, w, land));
    if (!isHq(land.id)) {
      const rtl = derived.lands[land.id];
      if (rtl?.noRoute || (rtl && rtl.transportCapacity > 0 && rtl.transportUsed / rtl.transportCapacity > 0.9)) {
        const transports = (FACILITIES as readonly FacilityDef[]).filter((d) => d.transport && isUnlocked(state, 'facility', d.id) && canBuildOn(d, land).ok);
        for (const t of transports.slice(0, 1)) fixes.push(buyFix(state, t, land, '本社へ運ぶ: '));
      }
    }
    return { reason: `${outs.map(name).join('・')}の倉庫が満杯です`, fixes };
  }
  if (rt.status === 'no_power' || (rt.status === 'partial' && rt.powerRatio < 0.999 && rt.missingInputs.length === 0 && rt.blockedOutputs.length === 0)) {
    const plants = (FACILITIES as readonly FacilityDef[]).filter((d) => d.powerGen && isUnlocked(state, 'facility', d.id));
    let added = 0;
    for (const p of plants) {
      const target = canBuildOn(p, land).ok ? land : state.lands.find((l) => canBuildOn(p, l).ok);
      if (!target) continue;
      fixes.push(buyFix(state, p, target));
      if (++added >= 2) break;
    }
    // 燃料切れの発電所があれば
    const starving = state.facilities.filter((f) => isFacilityId(f.typeId) && FACILITY_MAP[f.typeId].powerGen && derived.facilityRuntime[f.id]?.status === 'no_input');
    if (starving.length > 0) {
      const fuel = derived.facilityRuntime[starving[0].id]?.missingInputs[0];
      if (fuel) fixes.unshift({ label: `発電所の燃料（${name(fuel)}）を確保する`, action: { kind: 'openResource', resource: fuel }, enabled: true });
    }
    fixes.push({ label: '発電の状況を見る（FACTORY）', action: { kind: 'goTab', tab: 'factory', landId: land.id }, enabled: true });
    return { reason: `電力が不足しています（供給率 ${(rt.powerRatio * 100).toFixed(0)}%）`, fixes };
  }
  if (rt.status === 'no_input' || (rt.status === 'partial' && rt.missingInputs.length > 0)) {
    const ins = rt.missingInputs;
    for (const rid of ins.slice(0, 2)) {
      const recipe = recipeFor(state, rid);
      if (recipe) fixes.push({ label: `${recipe.name}（クラフト）`, action: { kind: 'craft', recipeId: recipe.id }, enabled: true });
      for (const p of producersOf(state, rid, land).slice(0, 2)) fixes.push(buyFix(state, p.def, p.land));
    }
    if (!isHq(land.id)) {
      const rtl = derived.lands[land.id];
      const hqHas = ins.some((rid) => (state.inventory[rid] ?? 0) > 0);
      if (rtl?.noRoute && hqHas) {
        const transports = (FACILITIES as readonly FacilityDef[]).filter((d) => d.transport && isUnlocked(state, 'facility', d.id) && canBuildOn(d, land).ok);
        for (const t of transports.slice(0, 1)) fixes.unshift(buyFix(state, t, land, '本社から運ぶ: '));
      }
    }
    if (fixes.length === 0) fixes.push({ label: `${name(ins[0])}の入手方法を見る`, action: { kind: 'openResource', resource: ins[0] }, enabled: true });
    return { reason: `${ins.map(name).join('・')}が足りません`, fixes };
  }
  if (rt.status === 'idle' && def.powerGen) {
    return { reason: '電力の需要がないので待機しています（問題ありません）', fixes: [] };
  }
  return null;
}
