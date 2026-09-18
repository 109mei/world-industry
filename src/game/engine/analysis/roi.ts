import { FACILITIES, FACILITY_MAP, facilityCost, isFacilityId, type FacilityDef, type FacilityId } from '@/game/data/facilities';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { DerivedState, GameState, LandState } from '@/types/state';
import { facilityCount } from '../actions/facility';
import { canBuildOn, landPopulation, surveyMultiplier, terrainMultiplier } from '../land';
import { currentPrice } from '../systems/market';
import { isUnlocked } from '../systems/unlocks';

/**
 * 資源1個の価値（円）。売れないものは基準価格で評価。
 * 売れるものは、いまの売値（需要の飽和ぶんを引いた値段）。
 *
 * currentPrice にはすでに需要係数が入っているので、ここで重ねて掛けてはいけない
 * （掛けると、たくさん売った直後だけ画面ごとに違う額が出る）。
 */
export function resourceValue(state: GameState, id: ResourceId): number {
  const def = RESOURCE_MAP[id];
  if (!def) return 0;
  return def.sellable ? currentPrice(state, id) : def.basePrice;
}

/**
 * その資源の出力が現金や次の生産につながる見込みがあるか（投資係の判断用）。
 * どこかの施設が使っている・自動売却がある・販売係のおまかせ販売がある・売れない中間材（使う前提）なら true
 */
export function outputRealizable(state: GameState, derived: DerivedState, id: ResourceId): boolean {
  const def = RESOURCE_MAP[id];
  if (!def) return false;
  if (!def.sellable) return true;
  if ((derived.consumption[id] ?? 0) > 0) return true;
  if (state.market.autoSell[id]?.enabled) return true;
  return false;
}

/** 施設1個あたりの生産倍率（地形・調査・研究・イベント） */
export function facilityMult(def: FacilityDef, land: LandState, derived: DerivedState): number {
  return terrainMultiplier(def, land) * surveyMultiplier(def, land) * (derived.modifiers.production[def.category] ?? 1) * (def.production ? derived.eventMods.landProduction[land.id] ?? 1 : 1);
}

/** 生産施設1個の「出力の価値 − 入力の価値」（円/秒）。電力・倉庫などの制約は無視した理論値 */
export function productionValuePerSec(state: GameState, derived: DerivedState, def: FacilityDef, land: LandState, realizedOnly = false): number {
  let v = 0;
  const mult = facilityMult(def, land, derived);
  if (def.production) {
    for (const [rid, rate] of Object.entries(def.production.outputs ?? {}) as [ResourceId, number][]) {
      if (realizedOnly && !outputRealizable(state, derived, rid)) continue;
      v += rate * mult * resourceValue(state, rid);
    }
    for (const [rid, rate] of Object.entries(def.production.inputs ?? {}) as [ResourceId, number][]) v -= rate * mult * resourceValue(state, rid);
  }
  if (def.income !== undefined) v += def.income * landPopulation(land) * derived.modifiers.commercialIncome * derived.eventMods.commercial;
  return v;
}

/** 電力を使う施設が全力で動いたときの価値の合計（円/秒） */
function powerUsersValue(state: GameState, derived: DerivedState): number {
  let v = 0;
  for (const inst of state.facilities) {
    if (!isFacilityId(inst.typeId) || !inst.enabled || inst.count <= 0) continue;
    const def = FACILITY_MAP[inst.typeId];
    if (!def.powerUse) continue;
    const land = state.lands.find((l) => l.id === inst.landId);
    if (!land) continue;
    v += Math.max(0, productionValuePerSec(state, derived, def, land)) * inst.count;
  }
  return v;
}

/**
 * 施設を1個増やしたときに増える収益の見込み（円/秒）。
 * - 生産・商業: 出力の価値 − 入力の価値
 * - 発電所: 電力不足で止まっている分がどれだけ動くか（燃料代を引く）
 * - 倉庫: 満杯で止まっている生産の価値（本社／その土地）
 * - 輸送: 輸送手段がない・混んでいる土地の生産の価値
 */
export function marginalValuePerSec(state: GameState, derived: DerivedState, def: FacilityDef, land: LandState, realizedOnly = false): number {
  if (def.production || def.income !== undefined) return productionValuePerSec(state, derived, def, land, realizedOnly);
  if (def.powerGen) {
    const p = derived.power;
    if (p.demand <= 0) return 0;
    const cap = def.powerGen * terrainMultiplier(def, land) * derived.modifiers.powerGeneration * (def.renewable ? derived.modifiers.renewableGeneration : 1);
    const before = Math.min(1, p.generation / p.demand);
    const after = Math.min(1, (p.generation + cap) / p.demand);
    let v = powerUsersValue(state, derived) * (after - before);
    for (const [rid, rate] of Object.entries(def.fuel ?? {}) as [ResourceId, number][]) v -= rate * resourceValue(state, rid) * (after > before ? 1 : 0);
    return v;
  }
  if (def.storageBonus) {
    let blocked = 0;
    for (const inst of state.facilities) {
      if (inst.landId !== land.id || !isFacilityId(inst.typeId)) continue;
      const rt = derived.facilityRuntime[inst.id];
      if (!rt || rt.blockedOutputs.length === 0) continue;
      const fdef = FACILITY_MAP[inst.typeId];
      blocked += Math.max(0, productionValuePerSec(state, derived, fdef, land)) * inst.count * (1 - rt.efficiency);
    }
    return blocked;
  }
  if (def.transport) {
    const rt = derived.lands[land.id];
    if (!rt) return 0;
    let landValue = 0;
    for (const inst of state.facilities) {
      if (inst.landId !== land.id || !isFacilityId(inst.typeId)) continue;
      landValue += Math.max(0, productionValuePerSec(state, derived, FACILITY_MAP[inst.typeId], land)) * inst.count;
    }
    if (rt.noRoute || rt.transportCapacity <= 0) return landValue;
    if (rt.transportUsed / rt.transportCapacity >= 0.9) return landValue * 0.2;
    return 0;
  }
  return 0;
}

/** 入力資源が足りているか（純増が必要量の半分以上、または在庫が10分ぶん以上） */
export function inputsAvailable(state: GameState, derived: DerivedState, def: FacilityDef, land: LandState): boolean {
  if (!def.production?.inputs) return true;
  const mult = facilityMult(def, land, derived);
  const stock = land.id === 'hq' ? state.inventory : land.stock;
  for (const [rid, rate] of Object.entries(def.production.inputs) as [ResourceId, number][]) {
    const need = rate * mult;
    const net = (derived.production[rid] ?? 0) - (derived.consumption[rid] ?? 0);
    const have = (stock[rid] ?? 0) + (land.id === 'hq' ? 0 : state.inventory[rid] ?? 0);
    if (net >= need * 0.5) continue;
    if (have >= need * 600) continue;
    return false;
  }
  return true;
}

export interface InvestmentOption {
  typeId: FacilityId;
  landId: string;
  cost: number;
  valuePerSec: number;
  /** 回収にかかる秒数（価値が 0 以下なら Infinity） */
  paybackSeconds: number;
  /** 入力資源が足りていて、建てれば動く見込み */
  feasible: boolean;
}

/** いま建てられる施設をすべて評価し、回収が早い順に返す */
export function rankInvestments(state: GameState, derived: DerivedState, options: { affordableOnly?: boolean; maxCash?: number; realizedOnly?: boolean } = {}): InvestmentOption[] {
  const out: InvestmentOption[] = [];
  const cashLimit = options.maxCash ?? state.company.cash;
  for (const def of FACILITIES as readonly FacilityDef[]) {
    const id = def.id as FacilityId;
    if (!isUnlocked(state, 'facility', id)) continue;
    if (def.researchRate) continue; // 研究は現金にならないので対象外
    for (const land of state.lands) {
      if (!canBuildOn(def, land).ok) continue;
      const owned = facilityCount(state, id, land.id);
      if (def.maxCount !== undefined && owned >= def.maxCount) continue;
      const cost = facilityCost(def, owned);
      if (options.affordableOnly && cost > cashLimit) continue;
      const v = marginalValuePerSec(state, derived, def, land, options.realizedOnly === true);
      out.push({ typeId: id, landId: land.id, cost, valuePerSec: v, paybackSeconds: v > 1e-9 ? cost / v : Infinity, feasible: inputsAvailable(state, derived, def, land) });
    }
  }
  return out.sort((a, b) => a.paybackSeconds - b.paybackSeconds);
}
