import { COMPANIES, POLICY_DEF, type CompanyDef } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { FACILITIES, FACILITY_MAP, facilityCost, isFacilityId, type FacilityDef, type FacilityId } from '@/game/data/facilities';
import { GATHER_ACTIONS, type GatherActionDef, type GatherActionId } from '@/game/data/gathering';
import { MANAGERS, MANAGER_MAP, type ManagerDef } from '@/game/data/managers';
import { PROPERTIES, propertyYield, type PropertyDef } from '@/game/data/properties';
import { RECIPES, type RecipeDef, type RecipeId } from '@/game/data/recipes';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { GameState, LandTemplate, ManagerId } from '@/types/state';
import { craft } from '../actions/craft';
import { buyFacility, facilityCount } from '../actions/facility';
import { gather, previewGather } from '../actions/gather';
import type { EngineContext } from '../context';
import { bestInvestment } from '../analysis/recommend';
import { canBuildOn, ownedLands } from '../land';
import { createInitialAutomation } from '../state/createInitialState';
import { deliverContract } from './contracts';
import { buyProperty, isEstateUnlocked, propertyBuyCost, propertyOwner } from './estate';
import { demandCapacity, demandFactor, sellResource } from './market';
import { buyQuote, buyShares, maxAffordableShares } from './stocks';
import { evaluateCondition, isUnlocked } from './unlocks';

function automationOf(state: GameState): GameState['automation'] {
  if (!state.automation) state.automation = createInitialAutomation();
  return state.automation;
}

export function isManagerHired(state: GameState, id: ManagerId): boolean {
  return !!automationOf(state).managers[id];
}

export function isManagerUnlocked(state: GameState, id: ManagerId, assets: number): boolean {
  return evaluateCondition(MANAGER_MAP[id].unlock, state, { assets, powerCapacity: 0 });
}

/** マネージャー1人の給料（円/秒） */
export function managerSalary(def: ManagerDef, assets: number): number {
  return def.salaryBase + Math.max(0, assets) * CONFIG.automation.salaryAssetRate;
}

/** 雇っている全員の給料（円/秒） */
export function totalSalary(state: GameState, assets: number): number {
  let s = 0;
  for (const m of MANAGERS) if (isManagerHired(state, m.id)) s += managerSalary(m, assets);
  return s;
}

export function hireManager(ctx: EngineContext, id: ManagerId): boolean {
  const { state, derived } = ctx;
  const def = MANAGER_MAP[id];
  const a = automationOf(state);
  if (a.managers[id]) return false;
  if (!isManagerUnlocked(state, id, derived.assets)) return false;
  if (state.company.cash + 1e-9 < def.hireCost) return false;
  state.company.cash -= def.hireCost;
  state.company.totalSpent += def.hireCost;
  a.managers[id] = { hiredAt: ctx.now() };
  ctx.emit('success', `${def.name}を雇いました（採用費 ${def.hireCost.toLocaleString('ja-JP')}円、給料 ${managerSalary(def, derived.assets).toFixed(1)}円/秒）`, { toast: true });
  return true;
}

export function fireManager(ctx: EngineContext, id: ManagerId): boolean {
  const a = automationOf(ctx.state);
  if (!a.managers[id]) return false;
  delete a.managers[id];
  ctx.emit('info', `${MANAGER_MAP[id].name}を解雇しました`, { toast: true });
  return true;
}

// ---------- 各マネージャーの仕事 ----------

function workGather(ctx: EngineContext): void {
  const { state, derived } = ctx;
  const times = Math.max(1, Math.round(CONFIG.automation.gatherPerSecond * CONFIG.automation.intervalSeconds));
  for (const g of GATHER_ACTIONS as readonly GatherActionDef[]) {
    const id = g.id as GatherActionId;
    const p = previewGather(state, id);
    if (!p.available) continue;
    for (let i = 0; i < times; i++) {
      if ((state.inventory[g.resource] ?? 0) >= derived.capacity - 1e-9) break;
      if (gather(ctx, id) > 0) state.stats.autoGathered += 1;
      else break;
    }
  }
}

function workCraft(ctx: EngineContext): void {
  const { state } = ctx;
  const a = automationOf(state);
  // 道具を各1本キープ
  for (const r of RECIPES as readonly RecipeDef[]) {
    if (!r.outputTool || !isUnlocked(state, 'recipe', r.id)) continue;
    const stack = state.tools[r.outputTool];
    if (stack && stack.count > 0) continue;
    if (craft(ctx, r.id as RecipeId, 1) > 0) state.stats.autoCrafted += 1;
  }
  // 資源のキープ量
  for (const [rid, target] of Object.entries(a.craftTargets) as [ResourceId, number][]) {
    if (!target || target <= 0) continue;
    const have = state.inventory[rid] ?? 0;
    if (have >= target) continue;
    const recipe = (RECIPES as readonly RecipeDef[]).find((r) => r.outputs && rid in r.outputs && isUnlocked(state, 'recipe', r.id));
    if (!recipe) continue;
    const per = recipe.outputs?.[rid] ?? 1;
    const times = Math.min(50, Math.ceil((target - have) / per));
    const made = craft(ctx, recipe.id as RecipeId, times);
    if (made > 0) state.stats.autoCrafted += made;
  }
}

/** 注文に必要な量（資源ごと）。販売係がいるときは自動売却から除外する */
export function contractReserve(state: GameState): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const c of state.contracts?.active ?? []) out[c.resource] = (out[c.resource] ?? 0) + Math.max(0, c.amount - c.delivered);
  return out;
}

function workSales(ctx: EngineContext): number {
  const { state, derived } = ctx;
  const a = automationOf(state);
  let gained = 0;
  // 注文の納品
  for (const c of [...(state.contracts?.active ?? [])]) deliverContract(ctx, c.id);
  // おまかせ販売
  if (a.smartSell) {
    const cfg = CONFIG.automation;
    const reserve = contractReserve(state);
    for (const [rid, prodRaw] of Object.entries(derived.production) as [ResourceId, number][]) {
      const prod = prodRaw ?? 0;
      if (prod <= 0) continue;
      const def = RESOURCE_MAP[rid];
      if (!def?.sellable) continue;
      if ((derived.consumption[rid] ?? 0) > 0) continue; // どこかで使っている
      if (a.craftTargets[rid]) continue;
      if (state.market.autoSell[rid]?.enabled) continue; // 自分で設定した自動売却を優先
      if (demandFactor(state, rid) < cfg.smartSellMinDemand) continue;
      const keep = Math.max(cfg.smartSellKeepMin, prod * cfg.smartSellKeepSeconds) + (reserve[rid] ?? 0);
      const have = state.inventory[rid] ?? 0;
      const surplus = Math.floor(have - keep);
      if (surplus < 1) continue;
      const qty = Math.min(surplus, Math.max(1, Math.floor(demandCapacity(state, rid) * 0.1)));
      gained += sellResource(ctx, rid, qty, { auto: true }).revenue;
    }
  }
  return gained;
}

function cheapestTransport(state: GameState, land: GameState['lands'][number]): FacilityDef | null {
  let best: { def: FacilityDef; score: number } | null = null;
  for (const def of FACILITIES as readonly FacilityDef[]) {
    if (!def.transport || !isUnlocked(state, 'facility', def.id) || !canBuildOn(def, land).ok) continue;
    if (def.transport.liquidOnly) continue;
    const cost = facilityCost(def, facilityCount(state, def.id as FacilityId, land.id));
    const score = cost / def.transport.capacity; // 1t/秒あたりの費用
    if (!best || score < best.score) best = { def, score };
  }
  return best?.def ?? null;
}

function workLogistics(ctx: EngineContext): void {
  const { state, derived } = ctx;
  const cfg = CONFIG.automation;
  const budget = state.company.cash * cfg.logisticsBudgetRatio;
  for (const land of ownedLands(state)) {
    const rt = derived.lands[land.id];
    if (!rt) continue;
    const busy = rt.transportCapacity > 0 && rt.transportUsed / rt.transportCapacity >= cfg.transportBusyRatio;
    if (rt.noRoute || busy) {
      const def = cheapestTransport(state, land);
      if (def) {
        const cost = facilityCost(def, facilityCount(state, def.id as FacilityId, land.id));
        if (cost <= budget) {
          buyFacility(ctx, def.id as FacilityId, 1, land.id);
          continue;
        }
      }
    }
    const full = state.facilities.some((f) => f.landId === land.id && derived.facilityRuntime[f.id]?.status === 'storage_full');
    if (full) {
      const wh = (FACILITIES as readonly FacilityDef[]).find((d) => d.storageBonus && isUnlocked(state, 'facility', d.id) && canBuildOn(d, land).ok);
      if (wh) {
        const cost = facilityCost(wh, facilityCount(state, wh.id as FacilityId, land.id));
        if (cost <= budget) buyFacility(ctx, wh.id as FacilityId, 1, land.id);
      }
    }
  }
  // 本社の倉庫
  const hqFull = state.facilities.some((f) => f.landId === 'hq' && derived.facilityRuntime[f.id]?.status === 'storage_full');
  if (hqFull) {
    const hq = state.lands.find((l) => l.id === 'hq')!;
    const cands = (FACILITIES as readonly FacilityDef[]).filter((d) => d.storageBonus && isUnlocked(state, 'facility', d.id) && canBuildOn(d, hq).ok);
    // 容量あたりの費用が安いもの
    cands.sort((x, y) => facilityCost(x, facilityCount(state, x.id as FacilityId, 'hq')) / (x.storageBonus ?? 1) - facilityCost(y, facilityCount(state, y.id as FacilityId, 'hq')) / (y.storageBonus ?? 1));
    for (const wh of cands) {
      const cost = facilityCost(wh, facilityCount(state, wh.id as FacilityId, 'hq'));
      if (cost <= budget) {
        buyFacility(ctx, wh.id as FacilityId, 1, 'hq');
        break;
      }
    }
  }
}

function workInvest(ctx: EngineContext): void {
  const { state, derived } = ctx;
  const a = automationOf(state);
  const rule = a.invest;
  const surplus = state.company.cash - rule.reserve;
  if (surplus <= 0) return;
  const budget = surplus * CONFIG.automation.investBudgetRatio;
  // 施設
  if (rule.facilities) {
    const best = bestInvestment(state, derived, rule.maxPaybackSeconds, budget, true);
    if (best) buyFacility(ctx, best.typeId, 1, best.landId);
  }
  // 配当の再投資（配当で貯まったぶんを、配当利回りの高い会社に）
  if (rule.dividends && isEstateUnlocked(state, derived.assets) && a.dividendPool > 0) {
    let best: { def: CompanyDef; yieldRate: number } | null = null;
    for (const c of COMPANIES as readonly CompanyDef[]) {
      const rt = derived.companies[c.id];
      const st = state.stocks.companies[c.id];
      if (!rt || !st || st.dissolved || rt.marketCap <= 0) continue;
      const y = (rt.earningsPerHour * POLICY_DEF[st.policy].payout) / rt.marketCap;
      if (!best || y > best.yieldRate) best = { def: c, yieldRate: y };
    }
    if (best) {
      const spend = Math.min(a.dividendPool, state.company.cash - rule.reserve);
      const q0 = maxAffordableShares(state, best.def.id, derived.eventMods.stock);
      let q = q0;
      // 予算内に収まる株数（価格の上昇分も含めて近似）
      for (let i = 0; i < 4 && q > 0; i++) {
        const quote = buyQuote(state, best.def.id, q, derived.eventMods.stock);
        if (quote.total <= spend) break;
        q = Math.floor((q * spend) / quote.total);
      }
      if (q > 0) {
        const before = state.company.cash;
        if (buyShares(ctx, best.def.id, q) > 0) a.dividendPool = Math.max(0, a.dividendPool - (before - state.company.cash));
      }
    }
  }
  // 物件（利回りが高いものから、予算内で）
  if (rule.properties && isEstateUnlocked(state, derived.assets)) {
    const cands = (PROPERTIES as readonly PropertyDef[])
      .filter((p) => propertyOwner(state, p.id).type === 'market' && propertyBuyCost(state, p.id) <= budget)
      .sort((x, y) => propertyYield(y) - propertyYield(x));
    if (cands.length > 0) buyProperty(ctx, cands[0].id);
  }
}

/** 自動処理（1秒ごと）と給料の支払い。返り値は自動売却などで得た額 */
export function runAutomation(ctx: EngineContext, dt: number): { salaries: number; gained: number } {
  const { state, derived } = ctx;
  const a = automationOf(state);
  const salaryPerSec = totalSalary(state, derived.assets);
  derived.salaryPerSec = salaryPerSec;
  let salaries = 0;
  if (salaryPerSec > 0) {
    salaries = Math.min(state.company.cash, salaryPerSec * dt);
    if (salaries > 0) {
      state.company.cash -= salaries;
      state.company.totalSpent += salaries;
      state.stats.salariesPaid += salaries;
    }
  }
  let gained = 0;
  a.timer -= dt;
  if (a.timer > 0) return { salaries, gained };
  // 長い tick（オフライン計算など）では経過した秒数ぶん繰り返す（上限あり）
  let runs = 0;
  while (a.timer <= 0 && runs < 10) {
    a.timer += CONFIG.automation.intervalSeconds;
    runs++;
  }
  if (a.timer <= 0) a.timer = CONFIG.automation.intervalSeconds;
  // 給料を払えないときは働かない
  if (salaryPerSec > 0 && salaries + 1e-9 < salaryPerSec * dt) return { salaries, gained };
  for (let i = 0; i < runs; i++) {
    if (a.managers.gather) workGather(ctx);
    if (a.managers.craft) workCraft(ctx);
    if (a.managers.sales) gained += workSales(ctx);
  }
  // 重い処理は tick ごとに1回
  if (a.managers.logistics) workLogistics(ctx);
  if (a.managers.invest) workInvest(ctx);
  return { salaries, gained };
}

/** 配当を再投資用の袋に入れる（投資係が使う） */
export function poolDividends(state: GameState, dividends: number): void {
  const a = automationOf(state);
  if (a.managers.invest && a.invest.dividends && dividends > 0) a.dividendPool += dividends;
}

// ---------- 土地のテンプレート ----------

export function saveTemplate(ctx: EngineContext, landId: string, name: string): LandTemplate | null {
  const { state } = ctx;
  const a = automationOf(state);
  const facilities: Record<string, number> = {};
  for (const f of state.facilities) {
    if (f.landId !== landId || f.count <= 0 || !isFacilityId(f.typeId)) continue;
    if (FACILITY_MAP[f.typeId].site === 'hq') continue;
    facilities[f.typeId] = f.count;
  }
  if (Object.keys(facilities).length === 0) return null;
  const id = (a.templates.reduce((m, t) => Math.max(m, t.id), 0) || 0) + 1;
  const t: LandTemplate = { id, name: name.trim().slice(0, 20) || `テンプレート${id}`, facilities, createdAt: ctx.now() };
  a.templates.push(t);
  if (a.templates.length > 12) a.templates.splice(0, a.templates.length - 12);
  ctx.emit('info', `テンプレート「${t.name}」を保存しました（${Object.keys(facilities).length}種類）`, { toast: true });
  return t;
}

export function deleteTemplate(ctx: EngineContext, id: number): boolean {
  const a = automationOf(ctx.state);
  const before = a.templates.length;
  a.templates = a.templates.filter((t) => t.id !== id);
  return a.templates.length < before;
}

/** テンプレートの構成に足りない分を建てる。買えた個数を返す */
export function applyTemplate(ctx: EngineContext, templateId: number, landId: string): number {
  const { state } = ctx;
  const a = automationOf(state);
  const t = a.templates.find((x) => x.id === templateId);
  const land = state.lands.find((l) => l.id === landId);
  if (!t || !land) return 0;
  let bought = 0;
  for (const [typeId, count] of Object.entries(t.facilities)) {
    if (!isFacilityId(typeId)) continue;
    const owned = facilityCount(state, typeId, landId);
    const need = count - owned;
    if (need <= 0) continue;
    bought += buyFacility(ctx, typeId, need, landId) || buyFacility(ctx, typeId, 'max', landId);
  }
  if (bought > 0) ctx.emit('success', `テンプレート「${t.name}」を${land.name}に適用（${bought}個）`, { toast: true });
  else ctx.emit('warn', `テンプレートを適用できませんでした（資金不足か、この土地に建てられません）`, { toast: true });
  return bought;
}

/** テンプレートの合計費用の見積もり（いまの価格で） */
export function templateCost(state: GameState, t: LandTemplate, landId: string): number {
  let total = 0;
  for (const [typeId, count] of Object.entries(t.facilities)) {
    if (!isFacilityId(typeId)) continue;
    const def = FACILITY_MAP[typeId];
    const owned = facilityCount(state, typeId, landId);
    for (let i = owned; i < count; i++) total += facilityCost(def, i);
  }
  return total;
}
