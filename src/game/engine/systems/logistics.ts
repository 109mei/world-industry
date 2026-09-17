import { CONFIG } from '@/game/data/config';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { LandRuntime, LandState } from '@/types/state';
import { addToStock, clean } from '../inventory';
import type { EngineContext } from '../context';
import { facilitiesOn, isLiquid, landCapacity, ownedLands, surveyMultiplier, terrainMultiplier } from '../land';
import { creditRankDef } from './contracts';
import { transportEventMultiplier } from './events';

interface Mode {
  capacity: number;
  costPerTon: number;
  liquidOnly: boolean;
}

function transportModes(ctx: EngineContext, land: LandState): Mode[] {
  const mods = ctx.derived.modifiers;
  const rankCost = creditRankDef(ctx.state).transportCost;
  const modes: Mode[] = [];
  for (const inst of facilitiesOn(ctx.state, land.id)) {
    if (!isFacilityId(inst.typeId) || !inst.enabled || inst.count <= 0) continue;
    const t = FACILITY_MAP[inst.typeId].transport;
    if (!t) continue;
    const eventMult = transportEventMultiplier(ctx.derived.eventMods, land.id, t.kind);
    modes.push({ capacity: t.capacity * inst.count * mods.transportCapacity * eventMult, costPerTon: t.costPerTon * mods.transportCost * rankCost, liquidOnly: !!t.liquidOnly });
  }
  // 安い手段から使う
  return modes.sort((a, b) => a.costPerTon - b.costPerTon);
}

/** その土地の施設が毎秒使う資源（入力＋燃料）と作る資源 */
function localRates(ctx: EngineContext, land: LandState): { use: Partial<Record<ResourceId, number>>; make: Partial<Record<ResourceId, number>> } {
  const use: Partial<Record<ResourceId, number>> = {};
  const make: Partial<Record<ResourceId, number>> = {};
  const mods = ctx.derived.modifiers;
  for (const inst of facilitiesOn(ctx.state, land.id)) {
    if (!isFacilityId(inst.typeId) || !inst.enabled || inst.count <= 0) continue;
    const def = FACILITY_MAP[inst.typeId];
    const mult = terrainMultiplier(def, land) * surveyMultiplier(def, land) * (mods.production[def.category] ?? 1) * (ctx.derived.eventMods.landProduction[land.id] ?? 1);
    for (const [rid, rate] of Object.entries(def.production?.inputs ?? {}) as [ResourceId, number][]) use[rid] = (use[rid] ?? 0) + rate * inst.count * mult;
    for (const [rid, rate] of Object.entries(def.fuel ?? {}) as [ResourceId, number][]) use[rid] = (use[rid] ?? 0) + rate * inst.count;
    for (const [rid, rate] of Object.entries(def.production?.outputs ?? {}) as [ResourceId, number][]) make[rid] = (make[rid] ?? 0) + rate * inst.count * mult;
  }
  return { use, make };
}

/**
 * 物流。各土地と本社の間で資源を運ぶ。
 * - 輸出: 土地の在庫のうち、現地で使わない資源（使う資源は数十秒ぶんの在庫を残す）を本社へ
 * - 輸入: 現地の施設が使う資源で、現地生産が足りないものを本社から（数十秒ぶんを目標に）
 * - 輸送能力（t/秒）は土地に配備した輸送手段の合計。安い手段から順に使う
 * - 費用は運んだ重さ × 円/t。所持金が足りなければ運べない
 */
export function runLogistics(ctx: EngineContext, dt: number): { cost: number } {
  const { state, derived } = ctx;
  let totalCost = 0;
  const hqCapacity = derived.capacity;
  const buffer = CONFIG.supplyBufferSeconds;

  for (const land of ownedLands(state)) {
    const rt: LandRuntime = derived.lands[land.id] ?? { capacity: landCapacity(state, land, derived.modifiers), transportCapacity: 0, transportUsed: 0, transportCost: 0, exports: {}, imports: {}, noRoute: false };
    rt.exports = {};
    rt.imports = {};
    rt.transportUsed = 0;
    rt.transportCost = 0;
    const modes = transportModes(ctx, land);
    rt.transportCapacity = modes.reduce((a, m) => a + m.capacity, 0);
    const prevNoRoute = rt.noRoute;
    rt.noRoute = modes.length === 0 && Object.values(land.stock).some((v) => (v ?? 0) > 0);
    if (rt.noRoute && !prevNoRoute) ctx.emit('warn', `${land.name}に輸送手段がありません。トラックなどを配備すると本社へ運ばれます`, { toast: true });
    derived.lands[land.id] = rt;
    if (modes.length === 0) continue;

    const remaining = modes.map((m) => m.capacity * dt); // 今回運べる重さ（t）
    const { use, make } = localRates(ctx, land);
    let landCost = 0;

    // 運ぶ量（t）を輸送手段に割り当て、実際に運べた重さと費用を返す
    const ship = (rid: ResourceId, tons: number): { tons: number; cost: number } => {
      let left = tons;
      let cost = 0;
      const liquid = isLiquid(rid);
      for (let i = 0; i < modes.length && left > 1e-12; i++) {
        const m = modes[i];
        if (m.liquidOnly && !liquid) continue;
        const take = Math.min(left, remaining[i]);
        if (take <= 0) continue;
        remaining[i] -= take;
        left -= take;
        cost += take * m.costPerTon;
      }
      return { tons: tons - left, cost };
    };

    // ---- 輸入（本社 → 土地）: 現地の消費が生産を上回る資源 ----
    for (const [rid, rate] of Object.entries(use) as [ResourceId, number][]) {
      const net = rate - (make[rid] ?? 0);
      if (net <= 0) continue;
      const target = net * buffer;
      const have = land.stock[rid] ?? 0;
      const want = Math.min(target - have, state.inventory[rid] ?? 0, Math.max(0, rt.capacity - have));
      if (want <= 1e-9) continue;
      const w = RESOURCE_MAP[rid].weight;
      const affordable = state.company.cash > 0 ? want : 0;
      if (affordable <= 0) continue;
      const shipped = ship(rid, affordable * w);
      const units = w > 0 ? shipped.tons / w : affordable;
      if (units <= 1e-9) continue;
      if (shipped.cost > state.company.cash) {
        // 払える分だけ
        const scale = state.company.cash / shipped.cost;
        applyMove(state.inventory, land.stock, rid, units * scale, rt.capacity, ctx);
        landCost += payCost(ctx, shipped.cost * scale);
        rt.imports[rid] = (units * scale) / dt;
        rt.transportUsed += (shipped.tons * scale) / dt;
        state.stats.totalTransported += shipped.tons * scale;
        continue;
      }
      applyMove(state.inventory, land.stock, rid, units, rt.capacity, ctx);
      landCost += payCost(ctx, shipped.cost);
      rt.imports[rid] = units / dt;
      rt.transportUsed += shipped.tons / dt;
      state.stats.totalTransported += shipped.tons;
    }

    // ---- 輸出（土地 → 本社）: 現地で使わない分 ----
    for (const [rid, amountRaw] of Object.entries(land.stock) as [ResourceId, number][]) {
      const amount = amountRaw ?? 0;
      if (amount <= 1e-9 || !RESOURCE_MAP[rid]) continue;
      const keep = (use[rid] ?? 0) * buffer * 2;
      const hqSpace = Math.max(0, hqCapacity - (state.inventory[rid] ?? 0));
      const want = Math.min(Math.max(0, amount - keep), hqSpace);
      if (want <= 1e-9) continue;
      if (state.company.cash <= 0) continue;
      const w = RESOURCE_MAP[rid].weight;
      const shipped = ship(rid, want * w);
      let units = w > 0 ? shipped.tons / w : want;
      let cost = shipped.cost;
      if (units <= 1e-9) continue;
      if (cost > state.company.cash) {
        const scale = state.company.cash / cost;
        units *= scale;
        cost *= scale;
        shipped.tons *= scale;
      }
      applyMove(land.stock, state.inventory, rid, units, hqCapacity, ctx);
      landCost += payCost(ctx, cost);
      rt.exports[rid] = units / dt;
      rt.transportUsed += shipped.tons / dt;
      state.stats.totalTransported += shipped.tons;
    }
    rt.transportCost = landCost / dt;
    totalCost += landCost;
  }
  derived.transportCost = totalCost / dt;
  state.stats.totalTransportCost += totalCost;
  return { cost: totalCost };
}

function applyMove(from: Partial<Record<ResourceId, number>>, to: Partial<Record<ResourceId, number>>, rid: ResourceId, units: number, capacity: number, ctx: EngineContext): void {
  const moved = addToStock(ctx.state, to, rid, units, capacity, 'transported');
  from[rid] = clean(Math.max(0, (from[rid] ?? 0) - moved));
}

function payCost(ctx: EngineContext, cost: number): number {
  const c = Math.max(0, Math.min(cost, ctx.state.company.cash));
  ctx.state.company.cash = clean(ctx.state.company.cash - c);
  ctx.state.company.totalSpent += c;
  return c;
}
