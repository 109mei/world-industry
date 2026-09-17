import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { FacilityRuntime, FacilityStatus } from '@/types/state';
import { addToStock, clean } from '../inventory';
import type { EngineContext } from '../context';
import { getLand, landPopulation, stockOf, surveyMultiplier, terrainMultiplier } from '../land';

/**
 * 施設の生産処理。1 tick 分（dt 秒）を進める。
 * - 入力が足りなければ足りる分だけ稼働（効率低下）
 * - 出力の倉庫（本社 or その土地）が満杯なら停止
 * - 鉱脈から掘る施設は残量がなくなると停止
 * - 電力を使う施設は供給率ぶんだけ稼働
 * - 施設の順番はデータ定義順（採集→加工→製造）なので、同じ tick 内で採れた鉱石を製鉄所が使える
 * 商業施設の収入と研究ポイントもここで計算する。
 */
export function runProduction(ctx: EngineContext, dt: number): { commercialIncome: number } {
  const { state, derived } = ctx;
  const mods = derived.modifiers;
  const production: Partial<Record<ResourceId, number>> = {};
  const consumption: Partial<Record<ResourceId, number>> = { ...derived.consumption };
  const prevRuntime = derived.facilityRuntime;
  const runtime: Record<string, FacilityRuntime> = {};
  const powerRatio = derived.power.ratio;
  let commercialIncome = 0;
  let researchRate = 0;

  for (const inst of state.facilities) {
    if (!isFacilityId(inst.typeId)) continue;
    const def = FACILITY_MAP[inst.typeId];
    const land = getLand(state, inst.landId);
    const idle = (): void => {
      runtime[inst.id] = { status: 'idle', efficiency: 0, missingInputs: [], blockedOutputs: [], powerRatio: 1, depleted: [] };
    };
    if (!land || inst.count <= 0) {
      idle();
      continue;
    }
    if (!inst.enabled) {
      runtime[inst.id] = { status: 'disabled', efficiency: 0, missingInputs: [], blockedOutputs: [], powerRatio: 1, depleted: [] };
      continue;
    }
    const pr = def.powerUse ? powerRatio : 1;

    // ---- 商業施設 ----
    if (def.income !== undefined) {
      const income = def.income * inst.count * landPopulation(land) * mods.commercialIncome * pr;
      commercialIncome += income;
      runtime[inst.id] = { status: pr <= 1e-6 ? 'no_power' : pr < 0.999 ? 'partial' : 'running', efficiency: pr, missingInputs: [], blockedOutputs: [], powerRatio: pr, depleted: [] };
      continue;
    }
    // ---- 研究所 ----
    if (def.researchRate) {
      researchRate += def.researchRate * inst.count * pr;
      runtime[inst.id] = { status: 'running', efficiency: pr, missingInputs: [], blockedOutputs: [], powerRatio: pr, depleted: [] };
      continue;
    }
    // ---- 発電所（出力は power.ts で計算済み） ----
    if (def.powerGen) {
      const out = derived.power.byFacility[inst.id] ?? 0;
      const cap = def.powerGen * inst.count * terrainMultiplier(def, land);
      const eff = cap > 0 ? Math.min(1, out / cap) : 0;
      const fuelMissing: ResourceId[] = [];
      const stock = stockOf(state, land);
      for (const rid of Object.keys(def.fuel ?? {}) as ResourceId[]) if ((stock[rid] ?? 0) <= 1e-9) fuelMissing.push(rid);
      const status: FacilityStatus = fuelMissing.length > 0 && eff <= 1e-6 ? 'no_input' : eff <= 1e-6 ? 'idle' : eff < 0.999 ? 'partial' : 'running';
      runtime[inst.id] = { status, efficiency: eff, missingInputs: fuelMissing, blockedOutputs: [], powerRatio: 1, depleted: [] };
      continue;
    }
    const prod = def.production;
    if (!prod) {
      idle();
      continue;
    }

    const stock = stockOf(state, land);
    const capacity = derived.lands[land.id]?.capacity ?? derived.capacity;
    const mult = terrainMultiplier(def, land) * surveyMultiplier(def, land) * (mods.production[def.category] ?? 1);
    let efficiency = pr;
    const missingInputs: ResourceId[] = [];
    const blockedOutputs: ResourceId[] = [];
    const depleted: ResourceId[] = [];

    // 入力の制約
    if (prod.inputs) {
      for (const [id, rate] of Object.entries(prod.inputs) as [ResourceId, number][]) {
        const need = rate * inst.count * mult * dt;
        if (need <= 0) continue;
        const have = stock[id] ?? 0;
        const ratio = Math.min(1, have / need);
        if (ratio < efficiency) efficiency = ratio;
        if (ratio < 0.999) missingInputs.push(id);
      }
    }
    // 出力（倉庫・鉱脈）の制約
    if (prod.outputs) {
      for (const [id, rate] of Object.entries(prod.outputs) as [ResourceId, number][]) {
        const want = rate * inst.count * mult * dt;
        if (want <= 0) continue;
        const space = Math.max(0, capacity - (stock[id] ?? 0));
        const ratio = Math.min(1, space / want);
        if (ratio < efficiency) efficiency = ratio;
        if (ratio < 0.999) blockedOutputs.push(id);
        if (def.extractsDeposit) {
          const dep = land.deposits[id];
          const remaining = dep?.remaining ?? 0;
          const dr = Math.min(1, remaining / want);
          if (dr < efficiency) efficiency = dr;
          if (dr < 0.999) depleted.push(id);
        }
      }
    }
    if (efficiency < 1e-6) efficiency = 0;

    if (efficiency > 0) {
      if (prod.inputs) {
        for (const [id, rate] of Object.entries(prod.inputs) as [ResourceId, number][]) {
          const perSec = rate * inst.count * mult * efficiency;
          stock[id] = clean(Math.max(0, (stock[id] ?? 0) - perSec * dt));
          consumption[id] = (consumption[id] ?? 0) + perSec;
        }
      }
      if (prod.outputs) {
        for (const [id, rate] of Object.entries(prod.outputs) as [ResourceId, number][]) {
          const perSec = rate * inst.count * mult * efficiency;
          const amount = perSec * dt;
          if (def.extractsDeposit) {
            const dep = land.deposits[id];
            if (dep) {
              dep.remaining = clean(Math.max(0, dep.remaining - amount));
              // 試掘済みの土地で実際に掘ると「確定」になる
              if (land.survey === 3) land.survey = 4;
            }
          }
          addToStock(state, stock, id, amount, capacity, 'produced');
          production[id] = (production[id] ?? 0) + perSec;
        }
      }
    }

    let status: FacilityStatus = 'running';
    if (efficiency === 0) {
      if (depleted.length > 0 && depleted.some((d) => (land.deposits[d]?.remaining ?? 0) <= 1e-9)) status = 'depleted';
      else if (blockedOutputs.length > 0) status = 'storage_full';
      else if (missingInputs.length > 0) status = 'no_input';
      else if (pr <= 1e-6) status = 'no_power';
      else status = 'no_input';
    } else if (efficiency < 0.999) status = 'partial';

    runtime[inst.id] = { status, efficiency, missingInputs, blockedOutputs, powerRatio: pr, depleted };

    // 稼働→停止 に変わった瞬間だけ通知する
    const prev = prevRuntime[inst.id];
    if (prev && prev.status !== status && (status === 'no_input' || status === 'storage_full' || status === 'depleted' || status === 'no_power')) {
      const where = land.id === 'hq' ? '' : `（${land.name}）`;
      if (status === 'storage_full') ctx.emit('warn', `${def.name}${where}が停止: 倉庫が満杯です`, { toast: true });
      else if (status === 'depleted') ctx.emit('warn', `${def.name}${where}が停止: ${depleted.map(resourceName).join('・')}の鉱脈が枯渇しました`, { toast: true });
      else if (status === 'no_power') ctx.emit('warn', `${def.name}${where}が停止: 電力がありません`, { toast: true });
      else ctx.emit('warn', `${def.name}${where}が停止: ${missingInputs.map(resourceName).join('・')}が不足しています`, { toast: true });
    }
  }

  derived.production = production;
  derived.consumption = consumption;
  derived.facilityRuntime = runtime;
  derived.commercialIncome = commercialIncome;
  derived.researchRate = researchRate;
  return { commercialIncome };
}

function resourceName(id: ResourceId): string {
  return RESOURCE_MAP[id]?.name ?? id;
}
