import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import type { ResourceId } from '@/game/data/resources';
import type { PowerRuntime } from '@/types/state';
import { clean } from '../inventory';
import type { EngineContext } from '../context';
import { getLand, stockOf, terrainMultiplier } from '../land';

interface PlantInfo {
  instId: string;
  capacity: number;
  renewable: boolean;
  /** 燃料の置き場（土地の在庫） */
  fuelStock: Partial<Record<ResourceId, number>> | null;
  fuelRates: Partial<Record<ResourceId, number>>;
  count: number;
}

export function createEmptyPower(): PowerRuntime {
  return { capacity: 0, demand: 0, generation: 0, ratio: 1, byFacility: {} };
}

/**
 * 電力の需給を計算し、燃料を消費する。生産処理の前に呼ぶ。
 * - 需要: ON になっている施設の powerUse の合計（全土地共通の送電網）
 * - 供給: 発電所の出力。燃料が足りない分は出力が下がる。再生可能エネルギーを優先して使う
 * - 供給率 = 発電量 / 需要。電力を使う施設の効率に掛かる
 */
export function runPower(ctx: EngineContext, dt: number): void {
  const { state, derived } = ctx;
  const mods = derived.modifiers;
  let demand = 0;
  const plants: PlantInfo[] = [];

  for (const inst of state.facilities) {
    if (!isFacilityId(inst.typeId) || inst.count <= 0 || !inst.enabled) continue;
    const def = FACILITY_MAP[inst.typeId];
    if (def.powerUse) demand += def.powerUse * inst.count;
    if (def.powerGen) {
      const land = getLand(state, inst.landId);
      if (!land) continue;
      let cap = def.powerGen * inst.count * terrainMultiplier(def, land) * mods.powerGeneration * derived.eventMods.power;
      if (def.renewable) cap *= mods.renewableGeneration;
      const fuelRates = def.fuel ?? {};
      const stock = stockOf(state, land);
      // 燃料が足りないぶんは出力が下がる
      let fuelRatio = 1;
      for (const [rid, rate] of Object.entries(fuelRates) as [ResourceId, number][]) {
        const need = rate * inst.count * dt;
        if (need <= 0) continue;
        fuelRatio = Math.min(fuelRatio, Math.min(1, (stock[rid] ?? 0) / need));
      }
      plants.push({ instId: inst.id, capacity: cap * fuelRatio, renewable: !!def.renewable, fuelStock: def.fuel ? stock : null, fuelRates, count: inst.count });
    }
  }

  const renewableCap = plants.filter((p) => p.renewable).reduce((a, p) => a + p.capacity, 0);
  const fuelCap = plants.filter((p) => !p.renewable).reduce((a, p) => a + p.capacity, 0);
  const capacity = renewableCap + fuelCap;
  const genRenew = Math.min(renewableCap, demand);
  const genFuel = Math.min(fuelCap, Math.max(0, demand - genRenew));
  const generation = genRenew + genFuel;
  const ratio = demand <= 1e-9 ? 1 : Math.min(1, generation / demand);
  const fuelLoad = fuelCap > 1e-9 ? genFuel / fuelCap : 0;
  const renewLoad = renewableCap > 1e-9 ? genRenew / renewableCap : 0;

  const byFacility: Record<string, number> = {};
  for (const p of plants) {
    const load = p.renewable ? renewLoad : fuelLoad;
    byFacility[p.instId] = p.capacity * load;
    if (p.fuelStock && load > 0) {
      for (const [rid, rate] of Object.entries(p.fuelRates) as [ResourceId, number][]) {
        const used = rate * p.count * dt * load;
        p.fuelStock[rid] = clean(Math.max(0, (p.fuelStock[rid] ?? 0) - used));
        derived.consumption[rid] = (derived.consumption[rid] ?? 0) + rate * p.count * load;
      }
    }
  }
  state.stats.totalGeneratedMWh += (generation * dt) / 3600;

  const prev = derived.power;
  derived.power = { capacity, demand, generation, ratio, byFacility };
  if (prev.ratio >= 0.999 && ratio < 0.999 && demand > 0) {
    ctx.emit('warn', `電力不足: 需要 ${demand.toFixed(1)}MW に対して発電 ${generation.toFixed(1)}MW`, { toast: true });
  }
}
