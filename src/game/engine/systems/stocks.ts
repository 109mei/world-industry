import { COMPANIES, COMPANY_MAP, CONTROL_RATIO, POLICY_DEF, isCompanyId, type CompanyDef, type CompanyPolicy } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { PROPERTY_MAP, isPropertyId } from '@/game/data/properties';
import type { CompanyRuntime, CompanyStockState, GameState } from '@/types/state';
import type { EngineContext } from '../context';
import { createInitialCompanyStock, createInitialStocks } from '../state/createInitialState';
import { companyProperties, isEstateUnlocked, propertyPrice, propertyRentPerSec, randn } from './estate';

function stockOf(state: GameState, id: string): CompanyStockState {
  if (!state.stocks) state.stocks = createInitialStocks();
  let s = state.stocks.companies[id];
  if (!s) {
    s = createInitialCompanyStock();
    state.stocks.companies[id] = s;
  }
  return s;
}

/** 会社が持つ物件の評価額（円） */
export function companyPropertyValue(state: GameState, id: string): number {
  let v = 0;
  for (const p of companyProperties(state, id)) v += propertyPrice(state, p);
  return v;
}

/** 会社の1時間あたりの利益（円）。事業＋所有物件の賃料 */
export function companyEarningsPerHour(state: GameState, def: CompanyDef): number {
  const s = stockOf(state, def.id);
  if (s.dissolved) return 0;
  let e = def.baseCap * s.growth * def.earningsYield;
  for (const p of companyProperties(state, def.id)) e += propertyRentPerSec(state, p) * 3600;
  return e;
}

/** 需給を除いた理論株価 */
export function fundamentalPrice(state: GameState, def: CompanyDef): number {
  const s = stockOf(state, def.id);
  return (def.baseCap * s.growth + s.cash + companyPropertyValue(state, def.id)) / def.shares;
}

/** 現在の株価（円/株） */
export function stockPrice(state: GameState, id: string, eventMult = 1): number {
  if (!isCompanyId(id)) return 0;
  const def = COMPANY_MAP[id];
  const s = stockOf(state, id);
  if (s.dissolved) return 0;
  return fundamentalPrice(state, def) * s.sentiment * eventMult;
}

export function ownershipOf(state: GameState, id: string): number {
  if (!isCompanyId(id)) return 0;
  return stockOf(state, id).playerShares / COMPANY_MAP[id].shares;
}

/** 経営権（3分の2以上）を持っているか */
export function hasControl(state: GameState, id: string): boolean {
  if (!isCompanyId(id)) return false;
  const s = stockOf(state, id);
  return !s.dissolved && ownershipOf(state, id) + 1e-9 >= CONTROL_RATIO;
}

/** 経営権を得るのに必要な追加の株数 */
export function sharesToControl(state: GameState, id: string): number {
  if (!isCompanyId(id)) return 0;
  const def = COMPANY_MAP[id];
  const need = Math.ceil(def.shares * CONTROL_RATIO - 1e-6);
  return Math.max(0, need - stockOf(state, id).playerShares);
}

export function companyRuntime(state: GameState, id: string, eventMult = 1): CompanyRuntime {
  const def = COMPANY_MAP[id as keyof typeof COMPANY_MAP];
  const s = stockOf(state, id);
  const price = stockPrice(state, id, eventMult);
  const earnings = companyEarningsPerHour(state, def);
  const ownership = ownershipOf(state, id);
  return {
    price,
    fundamental: fundamentalPrice(state, def),
    marketCap: price * def.shares,
    earningsPerHour: earnings,
    propertyValue: companyPropertyValue(state, id),
    ownership,
    dividendPerSec: s.dissolved ? 0 : (earnings * POLICY_DEF[s.policy].payout * ownership) / 3600,
  };
}

/** 派生情報（株価・評価額・配当）を計算し直す */
export function computeStocks(ctx: EngineContext): void {
  const { state, derived } = ctx;
  const mult = derived.eventMods.stock;
  let value = 0;
  let div = 0;
  for (const c of COMPANIES) {
    const rt = companyRuntime(state, c.id, mult);
    derived.companies[c.id] = rt;
    const s = stockOf(state, c.id);
    // 総資産に入れる評価額は需給で膨らんだ時価ではなく理論値（自分の買いで資産が増えないように）
    value += (s.dissolved ? 0 : rt.fundamental) * s.playerShares;
    div += rt.dividendPerSec;
  }
  derived.stockValue = value;
  derived.dividendPerSec = div;
}

/** 株価の需給係数を1回動かす */
function stepSentiment(ctx: EngineContext, seconds: number): void {
  const { state, rng, derived } = ctx;
  const dtH = seconds / 3600;
  const sq = Math.sqrt(dtH);
  const { sentimentReversion, minSentiment, maxSentiment, historyLength } = CONFIG.stocks;
  for (const c of COMPANIES) {
    const s = stockOf(state, c.id);
    if (s.dissolved) continue;
    let logS = Math.log(s.sentiment);
    logS += -sentimentReversion * dtH * logS + c.volatility * sq * randn(rng);
    s.sentiment = Math.min(maxSentiment, Math.max(minSentiment, Math.exp(logS)));
    s.history.push(Math.round(stockPrice(state, c.id, derived.eventMods.stock) * 100) / 100);
    if (s.history.length > historyLength) s.history.splice(0, s.history.length - historyLength);
  }
}

/** 配当の受け取り・再投資・株価の変動 */
export function runStocks(ctx: EngineContext, dt: number): { dividends: number } {
  const { state } = ctx;
  if (!state.stocks) state.stocks = createInitialStocks();
  const { reinvestEfficiency } = CONFIG.stocks;
  let dividends = 0;
  const hours = dt / 3600;
  for (const c of COMPANIES) {
    const s = stockOf(state, c.id);
    if (s.dissolved) continue;
    const earnings = companyEarningsPerHour(state, c) * hours;
    const payout = POLICY_DEF[s.policy].payout;
    const ownership = s.playerShares / c.shares;
    if (ownership > 0) dividends += earnings * payout * ownership;
    const retained = earnings * (1 - payout);
    // 再投資による成長は事業が大きくなるほど効きにくい（事業価値は指数ではなく直線的に増える）
    s.growth += (retained * reinvestEfficiency) / (c.baseCap * s.growth);
    s.cash += retained * (1 - reinvestEfficiency);
  }
  if (dividends > 0) {
    state.company.cash += dividends;
    state.company.totalEarned += dividends;
    state.stats.dividendsEarned += dividends;
  }
  state.stocks.nextUpdateIn -= dt;
  let guard = 0;
  while (state.stocks.nextUpdateIn <= 0 && guard++ < 1000) {
    stepSentiment(ctx, CONFIG.stocks.updateSeconds);
    state.stocks.nextUpdateIn += CONFIG.stocks.updateSeconds;
  }
  computeStocks(ctx);
  return { dividends };
}

/** 株を q 株買ったときの1株あたりの約定価格（値上がり分とスプレッド込み） */
export function buyQuote(state: GameState, id: string, q: number, eventMult = 1): { unit: number; total: number } {
  if (!isCompanyId(id) || q <= 0) return { unit: 0, total: 0 };
  const def = COMPANY_MAP[id];
  const s = stockOf(state, id);
  const f = q / def.shares;
  const unit = fundamentalPrice(state, def) * s.sentiment * eventMult * (1 + (CONFIG.stocks.impact * f) / 2) * (1 + CONFIG.stocks.spread);
  return { unit, total: unit * q };
}

export function sellQuote(state: GameState, id: string, q: number, eventMult = 1): { unit: number; total: number } {
  if (!isCompanyId(id) || q <= 0) return { unit: 0, total: 0 };
  const def = COMPANY_MAP[id];
  const s = stockOf(state, id);
  const f = q / def.shares;
  const unit = ((fundamentalPrice(state, def) * s.sentiment * eventMult) / (1 + (CONFIG.stocks.impact * f) / 2)) * (1 - CONFIG.stocks.spread);
  return { unit, total: unit * q };
}

/** 所持金で買える最大株数 */
export function maxAffordableShares(state: GameState, id: string, eventMult = 1): number {
  if (!isCompanyId(id)) return 0;
  const def = COMPANY_MAP[id];
  const s = stockOf(state, id);
  const cash = state.company.cash;
  const base = fundamentalPrice(state, def) * s.sentiment * eventMult * (1 + CONFIG.stocks.spread);
  if (base <= 0) return 0;
  let q = Math.floor(cash / base);
  for (let i = 0; i < 4; i++) {
    const f = q / def.shares;
    q = Math.floor(cash / (base * (1 + (CONFIG.stocks.impact * f) / 2)));
  }
  const available = def.shares - s.playerShares;
  return Math.max(0, Math.min(q, available));
}

export function buyShares(ctx: EngineContext, id: string, qty: number): number {
  const { state, derived } = ctx;
  if (!isCompanyId(id)) return 0;
  if (!isEstateUnlocked(state, derived.assets)) return 0;
  const def = COMPANY_MAP[id];
  const s = stockOf(state, id);
  if (s.dissolved) return 0;
  const q = Math.min(Math.floor(qty), def.shares - s.playerShares);
  if (q <= 0) return 0;
  const { unit, total } = buyQuote(state, id, q, derived.eventMods.stock);
  if (state.company.cash + 1e-6 < total) return 0;
  state.company.cash -= total;
  state.company.totalSpent += total;
  s.avgCost = (s.avgCost * s.playerShares + total) / (s.playerShares + q);
  s.playerShares += q;
  const f = q / def.shares;
  s.sentiment = Math.min(CONFIG.stocks.maxSentiment, s.sentiment * (1 + CONFIG.stocks.impact * f));
  computeStocks(ctx);
  const own = s.playerShares / def.shares;
  ctx.emit('info', `${def.name}の株を${q.toLocaleString('ja-JP')}株購入（@${Math.round(unit).toLocaleString('ja-JP')}円、持株比率 ${(own * 100).toFixed(1)}%）`, { toast: true });
  if (own + 1e-9 >= CONTROL_RATIO && own - f + 1e-9 < CONTROL_RATIO) {
    ctx.emit('success', `${def.name}の経営権を握りました。方針の変更・増設・解体・買収ができます`, { toast: true });
  }
  return q;
}

export function sellShares(ctx: EngineContext, id: string, qty: number): number {
  const { state, derived } = ctx;
  if (!isCompanyId(id)) return 0;
  const def = COMPANY_MAP[id];
  const s = stockOf(state, id);
  const q = Math.min(Math.floor(qty), s.playerShares);
  if (q <= 0) return 0;
  const { unit, total } = sellQuote(state, id, q, derived.eventMods.stock);
  state.company.cash += total;
  state.company.totalEarned += total;
  state.stats.tradingProfit += total - q * s.avgCost;
  s.playerShares -= q;
  if (s.playerShares === 0) s.avgCost = 0;
  const f = q / def.shares;
  s.sentiment = Math.max(CONFIG.stocks.minSentiment, s.sentiment / (1 + CONFIG.stocks.impact * f));
  computeStocks(ctx);
  ctx.emit('info', `${def.name}の株を${q.toLocaleString('ja-JP')}株売却（@${Math.round(unit).toLocaleString('ja-JP')}円）`, { toast: true });
  return total;
}

export function setCompanyPolicy(ctx: EngineContext, id: string, policy: CompanyPolicy): boolean {
  const { state } = ctx;
  if (!hasControl(state, id)) return false;
  const s = stockOf(state, id);
  if (s.policy === policy) return true;
  s.policy = policy;
  ctx.emit('info', `${COMPANY_MAP[id as keyof typeof COMPANY_MAP].name}の方針を「${POLICY_DEF[policy].label}」にしました`, { toast: true });
  computeStocks(ctx);
  return true;
}

/** 増設の費用（円） */
export function expandCost(state: GameState, id: string): number {
  if (!isCompanyId(id)) return 0;
  const def = COMPANY_MAP[id];
  const s = stockOf(state, id);
  return Math.ceil(def.baseCap * s.growth * CONFIG.stocks.expandCostRatio);
}

export function expandCompany(ctx: EngineContext, id: string): boolean {
  const { state } = ctx;
  if (!hasControl(state, id)) return false;
  const def = COMPANY_MAP[id as keyof typeof COMPANY_MAP];
  const s = stockOf(state, id);
  const cost = expandCost(state, id);
  if (state.company.cash + 1e-6 < cost) return false;
  state.company.cash -= cost;
  state.company.totalSpent += cost;
  s.growth *= 1 + CONFIG.stocks.expandGain;
  s.expansions += 1;
  computeStocks(ctx);
  ctx.emit('success', `${def.name}を増設しました（事業規模 +${Math.round(CONFIG.stocks.expandGain * 100)}%、-${cost.toLocaleString('ja-JP')}円）`, { toast: true });
  return true;
}

/** 買収の費用（残りの株をプレミアム付きで買う） */
export function acquireCost(state: GameState, id: string, eventMult = 1): number {
  if (!isCompanyId(id)) return 0;
  const def = COMPANY_MAP[id];
  const s = stockOf(state, id);
  const remaining = def.shares - s.playerShares;
  return Math.ceil(remaining * stockPrice(state, id, eventMult) * (1 + CONFIG.stocks.acquirePremium));
}

/** 完全買収。残りの株をすべて買い、会社の物件を受け取る */
export function acquireCompany(ctx: EngineContext, id: string): boolean {
  const { state, derived } = ctx;
  if (!hasControl(state, id)) return false;
  const def = COMPANY_MAP[id as keyof typeof COMPANY_MAP];
  const s = stockOf(state, id);
  const remaining = def.shares - s.playerShares;
  const cost = acquireCost(state, id, derived.eventMods.stock);
  if (state.company.cash + 1e-6 < cost) return false;
  state.company.cash -= cost;
  state.company.totalSpent += cost;
  if (remaining > 0) s.avgCost = (s.avgCost * s.playerShares + cost) / def.shares;
  s.playerShares = def.shares;
  const props = companyProperties(state, id);
  for (const p of props) {
    delete state.estate.companyOwned[p];
    state.estate.owned[p] = { boughtAt: ctx.now(), boughtPrice: propertyPrice(state, p) };
    state.stats.propertiesBought += 1;
  }
  state.stats.companiesAcquired += 1;
  computeStocks(ctx);
  const names = props.map((p) => (isPropertyId(p) ? PROPERTY_MAP[p].name : p));
  ctx.emit('success', `${def.name}を完全買収しました${names.length > 0 ? `。物件を受け取りました: ${names.join('、')}` : ''}`, { toast: true });
  return true;
}

/** 解体したときに受け取る額（円） */
export function liquidationValue(state: GameState, id: string): number {
  if (!isCompanyId(id)) return 0;
  const def = COMPANY_MAP[id];
  const s = stockOf(state, id);
  const { liquidationPropertyRatio, liquidationBusinessRatio } = CONFIG.stocks;
  const total = s.cash + companyPropertyValue(state, id) * liquidationPropertyRatio + def.baseCap * s.growth * liquidationBusinessRatio;
  return Math.floor(total * ownershipOf(state, id));
}

/** 解体。資産を売り払い、持株比率ぶんを受け取る。会社の物件は市場に戻る */
export function dissolveCompany(ctx: EngineContext, id: string): boolean {
  const { state } = ctx;
  if (!hasControl(state, id)) return false;
  const def = COMPANY_MAP[id as keyof typeof COMPANY_MAP];
  const s = stockOf(state, id);
  const payout = liquidationValue(state, id);
  state.company.cash += payout;
  state.company.totalEarned += payout;
  state.stats.tradingProfit += payout - s.playerShares * s.avgCost;
  for (const p of companyProperties(state, id)) delete state.estate.companyOwned[p];
  s.dissolved = true;
  s.playerShares = 0;
  s.avgCost = 0;
  state.stats.companiesDissolved += 1;
  computeStocks(ctx);
  ctx.emit('success', `${def.name}を解体しました (+${payout.toLocaleString('ja-JP')}円)`, { toast: true });
  return true;
}
