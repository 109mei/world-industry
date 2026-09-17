import { FACILITY_MAP, facilityBulkCost, facilityMaxAffordable, type FacilityId } from '@/game/data/facilities';
import type { FacilityInstance, GameState } from '@/types/state';
import type { EngineContext } from '../context';
import { canBuildOn, getLand } from '../land';
import { isUnlocked } from '../systems/unlocks';

export function findFacility(state: GameState, typeId: FacilityId, landId = 'hq'): FacilityInstance | undefined {
  return state.facilities.find((f) => f.typeId === typeId && f.landId === landId);
}

export function facilityCount(state: GameState, typeId: FacilityId, landId = 'hq'): number {
  return findFacility(state, typeId, landId)?.count ?? 0;
}

/** 施設を count 個買う。'max' なら買えるだけ。実際に買えた個数を返す */
export function buyFacility(ctx: EngineContext, typeId: FacilityId, count: number | 'max' = 1, landId = 'hq'): number {
  const { state } = ctx;
  const def = FACILITY_MAP[typeId];
  if (!isUnlocked(state, 'facility', typeId)) return 0;
  const land = getLand(state, landId);
  if (!land || !canBuildOn(def, land).ok) return 0;
  const owned = facilityCount(state, typeId, landId);
  let n = count === 'max' ? facilityMaxAffordable(def, owned, state.company.cash) : count;
  if (def.maxCount !== undefined) n = Math.min(n, def.maxCount - owned);
  if (n <= 0) return 0;
  const cost = facilityBulkCost(def, owned, n);
  if (cost > state.company.cash + 1e-9) return 0;
  state.company.cash -= cost;
  state.company.totalSpent += cost;
  state.company.facilityInvestment += cost;
  let inst = findFacility(state, typeId, landId);
  if (!inst) {
    inst = { id: `${landId}:${typeId}`, typeId, landId, count: 0, enabled: true };
    // データ定義順に並べる（採集→加工→製造の順で処理するため）
    state.facilities.push(inst);
    const order = Object.keys(FACILITY_MAP);
    state.facilities.sort((a, b) => order.indexOf(a.typeId) - order.indexOf(b.typeId));
  }
  inst.count += n;
  const where = landId === 'hq' ? '' : `${land.name}に`;
  ctx.emit('success', `${where}${def.name}を${n}${def.isWorker ? '人雇用' : def.transport ? '台配備' : '個建設'} (-${Math.round(cost).toLocaleString('ja-JP')}円)`);
  return n;
}

export function setFacilityEnabled(ctx: EngineContext, instanceId: string, enabled: boolean): void {
  const inst = ctx.state.facilities.find((f) => f.id === instanceId);
  if (inst) inst.enabled = enabled;
}
