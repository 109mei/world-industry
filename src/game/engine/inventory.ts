import { CONFIG } from '@/game/data/config';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import type { ResourceId } from '@/game/data/resources';
import type { GameState } from '@/types/state';

/** 浮動小数点の誤差で -1e-14 のような値が残らないように丸める */
export function clean(n: number): number {
  if (Math.abs(n) < 1e-9) return 0;
  return n;
}

export function getAmount(state: GameState, id: ResourceId): number {
  return state.inventory[id] ?? 0;
}

/** 倉庫容量（資源ごとの上限） */
export function calcCapacity(state: GameState): number {
  let cap = CONFIG.baseStorage;
  for (const f of state.facilities) {
    if (!isFacilityId(f.typeId)) continue;
    const def = FACILITY_MAP[f.typeId];
    if (def.storageBonus) cap += def.storageBonus * f.count;
  }
  return cap;
}

/**
 * 資源を追加する。容量を超える分は捨てられ、実際に入った量を返す。
 * source: 統計のカテゴリ（採集／生産／クラフト）
 */
export function addResource(state: GameState, id: ResourceId, amount: number, capacity: number, source: 'gathered' | 'produced' | 'crafted' | 'debug'): number {
  if (amount <= 0) return 0;
  const current = state.inventory[id] ?? 0;
  const space = Math.max(0, capacity - current);
  const added = Math.min(space, amount);
  if (added <= 0) return 0;
  state.inventory[id] = clean(current + added);
  state.discovered[id] = true;
  const st = state.stats;
  st.totalObtained[id] = (st.totalObtained[id] ?? 0) + added;
  if (source === 'gathered') st.totalGathered[id] = (st.totalGathered[id] ?? 0) + added;
  if (source === 'produced') st.totalProduced[id] = (st.totalProduced[id] ?? 0) + added;
  return added;
}

export function hasResources(state: GameState, needs: Partial<Record<ResourceId, number>>, times = 1): boolean {
  for (const [id, n] of Object.entries(needs) as [ResourceId, number][]) {
    if ((state.inventory[id] ?? 0) + 1e-9 < n * times) return false;
  }
  return true;
}

export function removeResources(state: GameState, needs: Partial<Record<ResourceId, number>>, times = 1): void {
  for (const [id, n] of Object.entries(needs) as [ResourceId, number][]) {
    state.inventory[id] = clean(Math.max(0, (state.inventory[id] ?? 0) - n * times));
  }
}

/** needs を何回分まかなえるか */
export function maxTimes(state: GameState, needs: Partial<Record<ResourceId, number>>): number {
  let best = Infinity;
  for (const [id, n] of Object.entries(needs) as [ResourceId, number][]) {
    if (n <= 0) continue;
    best = Math.min(best, Math.floor(((state.inventory[id] ?? 0) + 1e-9) / n));
  }
  return best === Infinity ? 0 : best;
}
