import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { FacilityRuntime, FacilityStatus } from '@/types/state';
import { addResource, clean } from '../inventory';
import type { EngineContext } from '../context';

/**
 * 施設の生産処理。1 tick 分（dt 秒）を進める。
 * - 入力が足りなければ足りる分だけ稼働（効率低下）
 * - 出力の倉庫が満杯なら停止
 * - 施設の順番はデータ定義順（採集→加工→製造）なので、同じ tick 内で採れた鉱石を製鉄所が使える
 */
export function runProduction(ctx: EngineContext, dt: number): void {
  const { state, derived } = ctx;
  const capacity = derived.capacity;
  const production: Partial<Record<ResourceId, number>> = {};
  const consumption: Partial<Record<ResourceId, number>> = {};
  const prevRuntime = derived.facilityRuntime;
  const runtime: Record<string, FacilityRuntime> = {};

  for (const inst of state.facilities) {
    if (!isFacilityId(inst.typeId)) continue;
    const def = FACILITY_MAP[inst.typeId];
    const prod = def.production;
    if (!prod || inst.count <= 0) {
      runtime[inst.id] = { status: 'idle', efficiency: 0, missingInputs: [], blockedOutputs: [] };
      continue;
    }
    if (!inst.enabled) {
      runtime[inst.id] = { status: 'disabled', efficiency: 0, missingInputs: [], blockedOutputs: [] };
      continue;
    }

    let efficiency = 1;
    const missingInputs: ResourceId[] = [];
    const blockedOutputs: ResourceId[] = [];

    // 入力の制約
    if (prod.inputs) {
      for (const [id, rate] of Object.entries(prod.inputs) as [ResourceId, number][]) {
        const need = rate * inst.count * dt;
        if (need <= 0) continue;
        const have = state.inventory[id] ?? 0;
        const ratio = Math.min(1, have / need);
        if (ratio < efficiency) efficiency = ratio;
        if (ratio < 0.999) missingInputs.push(id);
      }
    }
    // 出力（倉庫）の制約
    if (prod.outputs) {
      for (const [id, rate] of Object.entries(prod.outputs) as [ResourceId, number][]) {
        const want = rate * inst.count * dt;
        if (want <= 0) continue;
        const space = Math.max(0, capacity - (state.inventory[id] ?? 0));
        const ratio = Math.min(1, space / want);
        if (ratio < efficiency) efficiency = ratio;
        if (ratio < 0.999) blockedOutputs.push(id);
      }
    }
    if (efficiency < 1e-6) efficiency = 0;

    if (efficiency > 0) {
      if (prod.inputs) {
        for (const [id, rate] of Object.entries(prod.inputs) as [ResourceId, number][]) {
          const used = rate * inst.count * dt * efficiency;
          state.inventory[id] = clean(Math.max(0, (state.inventory[id] ?? 0) - used));
          consumption[id] = (consumption[id] ?? 0) + rate * inst.count * efficiency;
        }
      }
      if (prod.outputs) {
        for (const [id, rate] of Object.entries(prod.outputs) as [ResourceId, number][]) {
          addResource(state, id, rate * inst.count * dt * efficiency, capacity, 'produced');
          production[id] = (production[id] ?? 0) + rate * inst.count * efficiency;
        }
      }
    }

    let status: FacilityStatus = 'running';
    if (efficiency === 0) status = blockedOutputs.length > 0 ? 'storage_full' : 'no_input';
    else if (efficiency < 0.999) status = 'partial';

    runtime[inst.id] = { status, efficiency, missingInputs, blockedOutputs };

    // 稼働→停止 に変わった瞬間だけ通知する
    const prev = prevRuntime[inst.id];
    if (prev && prev.status !== status && (status === 'no_input' || status === 'storage_full')) {
      if (status === 'storage_full') ctx.emit('warn', `${def.name}が停止: 倉庫が満杯です`, { toast: true });
      else ctx.emit('warn', `${def.name}が停止: ${missingInputs.map((m) => resourceName(m)).join('・')}が不足しています`, { toast: true });
    }
  }

  derived.production = production;
  derived.consumption = consumption;
  derived.facilityRuntime = runtime;
}

function resourceName(id: ResourceId): string {
  return RESOURCE_MAP[id]?.name ?? id;
}
