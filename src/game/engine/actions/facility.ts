import { FACILITY_MAP, facilityBulkCost, facilityMaxAffordable, type FacilityId } from '@/game/data/facilities';
import type { FacilityInstance, GameState } from '@/types/state';
import type { EngineContext } from '../context';
import { canBuildOn, getLand } from '../land';
import { buildCostMult } from '../systems/synergy';
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
  // 自社の建設会社があると建設費が安くなる
  const mult = buildCostMult(state);
  let n = count === 'max' ? facilityMaxAffordable(def, owned, state.company.cash / mult) : count;
  if (def.maxCount !== undefined) n = Math.min(n, def.maxCount - owned);
  if (n <= 0) return 0;
  const cost = Math.ceil(facilityBulkCost(def, owned, n) * mult);
  if (cost > state.company.cash + 1e-9) return 0;
  state.company.cash -= cost;
  state.company.totalSpent += cost;
  state.company.facilityInvestment += cost;
  let inst = findFacility(state, typeId, landId);
  if (!inst) {
    inst = { id: `${landId}:${typeId}`, typeId, landId, count: 0, enabled: true, spent: 0 };
    // データ定義順に並べる（採集→加工→製造の順で処理するため）
    state.facilities.push(inst);
    const order = Object.keys(FACILITY_MAP);
    state.facilities.sort((a, b) => order.indexOf(a.typeId) - order.indexOf(b.typeId));
  }
  inst.count += n;
  // 実際に払った額を積む（帳簿から引くときに、割引ぶんまで引きすぎないように）
  inst.spent = (inst.spent ?? 0) + cost;
  const where = landId === 'hq' ? '' : `${land.name}に`;
  ctx.emit('success', `${where}${def.name}を${n}${def.isWorker ? '人雇用' : def.transport ? '台配備' : '個建設'} (-${Math.round(cost).toLocaleString('ja-JP')}円)`);
  return n;
}

/**
 * その土地に建てた施設の投資額を、会社の「施設への投資」から取り除く。
 * 引かないと、売った土地の施設ぶんが総資産に残り続ける
 * （総資産は再出発ポイント・倒産ライン・解放条件に効くので、黙って過大になるのはまずい）。
 */
export function dropFacilityInvestment(state: GameState, landId: string): number {
  let removed = 0;
  for (const inst of state.facilities) {
    if (inst.landId !== landId || inst.count <= 0) continue;
    const def = FACILITY_MAP[inst.typeId as FacilityId];
    if (!def) continue;
    // 実際に払った額があればそれを、無ければ（古いセーブ）定価で見積もる
    removed += inst.spent ?? facilityBulkCost(def, 0, inst.count);
  }
  if (removed > 0) {
    state.company.facilityInvestment = Math.max(0, state.company.facilityInvestment - removed);
  }
  return removed;
}

export function setFacilityEnabled(ctx: EngineContext, instanceId: string, enabled: boolean): void {
  const inst = ctx.state.facilities.find((f) => f.id === instanceId);
  if (inst) inst.enabled = enabled;
}
