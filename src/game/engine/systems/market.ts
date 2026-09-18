import { CONFIG } from '@/game/data/config';
import { EVENT_MAP, isEventDefId } from '@/game/data/events';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { AutoSellConfig, GameState, MarketResourceState } from '@/types/state';
import { clean } from '../inventory';
import type { EngineContext } from '../context';

export function getMarketState(state: GameState, id: ResourceId): MarketResourceState {
  let m = state.market.prices[id];
  if (!m) {
    m = { modifier: 1, history: [RESOURCE_MAP[id].basePrice], saturation: 0 };
    state.market.prices[id] = m;
  }
  if (typeof m.saturation !== 'number') m.saturation = 0;
  return m;
}

/** イベント（相場高騰・暴落）による価格倍率 */
export function eventPriceMultiplier(state: GameState, id: ResourceId): number {
  let mult = 1;
  for (const ev of state.events?.active ?? []) {
    if (!isEventDefId(ev.defId)) continue;
    const kind = EVENT_MAP[ev.defId].kind;
    // 好景気・不況はすべての資源に効く
    if (kind === 'market_wave') {
      mult *= ev.magnitude;
      continue;
    }
    if (ev.target !== id) continue;
    if (kind === 'boom' || kind === 'crash') mult *= ev.magnitude;
  }
  return mult;
}

/** イベント（需要急増）による需要容量の倍率 */
export function eventDemandMultiplier(state: GameState, id: ResourceId): number {
  let mult = 1;
  for (const ev of state.events?.active ?? []) {
    if (ev.target !== id || !isEventDefId(ev.defId)) continue;
    if (EVENT_MAP[ev.defId].kind === 'demand') mult *= ev.magnitude;
  }
  return mult;
}

/** 需要容量。飽和量がこの値に達すると価格が半分になる */
export function demandCapacity(state: GameState, id: ResourceId): number {
  return RESOURCE_MAP[id].liquidity * CONFIG.market.demandCapacityMult * eventDemandMultiplier(state, id);
}

/** 需要係数 0〜1。1 = まったく飽和していない */
export function demandFactor(state: GameState, id: ResourceId): number {
  const m = getMarketState(state, id);
  return 1 / (1 + m.saturation / demandCapacity(state, id));
}

/** 現在の売値（1個目）。基準価格 × 変動係数 × 需要係数 × イベント倍率 */
export function currentPrice(state: GameState, id: ResourceId): number {
  return RESOURCE_MAP[id].basePrice * getMarketState(state, id).modifier * demandFactor(state, id) * eventPriceMultiplier(state, id);
}

/** 需要を無視した基準の売値（変動係数とイベントのみ） */
export function referencePrice(state: GameState, id: ResourceId): number {
  return RESOURCE_MAP[id].basePrice * getMarketState(state, id).modifier * eventPriceMultiplier(state, id);
}

/** qty 個をまとめて売ったときの売上。需要曲線に沿って1個ごとに価格が下がるぶんを積分する */
export function sellRevenue(state: GameState, id: ResourceId, qty: number): number {
  if (qty <= 0) return 0;
  const ref = referencePrice(state, id);
  const c = demandCapacity(state, id);
  const s0 = getMarketState(state, id).saturation;
  // ∫ ref / (1 + s/c) ds = ref × c × ln((c + s0 + qty) / (c + s0))
  return ref * c * Math.log((c + s0 + qty) / (c + s0));
}

/** 市場の定期変動と需要の回復 */
export function runMarket(ctx: EngineContext, dt: number): void {
  const { state, rng, derived } = ctx;
  // 需要の回復（飽和量の指数減衰）
  const tau = CONFIG.market.demandRecoverySeconds / Math.max(0.1, derived.modifiers.demandRecovery);
  const decay = Math.exp(-dt / tau);
  for (const m of Object.values(state.market.prices)) {
    if (!m || !(m.saturation > 0)) continue;
    m.saturation *= decay;
    if (m.saturation < 0.01) m.saturation = 0;
  }

  state.market.nextUpdateIn -= dt;
  let updates = 0;
  while (state.market.nextUpdateIn <= 0 && updates < 1000) {
    state.market.nextUpdateIn += CONFIG.marketUpdateSeconds;
    updates++;
    for (const id of Object.keys(RESOURCE_MAP) as ResourceId[]) {
      const m = getMarketState(state, id);
      const { minModifier, maxModifier, randomStep, meanReversion, historyLength } = CONFIG.market;
      const noise = (rng() - 0.5) * 2 * randomStep;
      let next = m.modifier + (1 - m.modifier) * meanReversion + noise;
      next = Math.min(maxModifier, Math.max(minModifier, next));
      m.modifier = next;
      m.history.push(Math.round(RESOURCE_MAP[id].basePrice * next * 100) / 100);
      if (m.history.length > historyLength) m.history.splice(0, m.history.length - historyLength);
    }
  }
}

export interface SellResult {
  amount: number;
  revenue: number;
  unitPrice: number;
}

/**
 * 売却。売上は需要曲線を積分した額（大量に売るほど1個あたりは安くなる）。
 * 売った量は市場の飽和量に加わり、短期の変動係数も少し下がる。
 */
/**
 * 市場に出た量を記録して、相場を押し下げる。
 * お店の売上も同じ市場に出ているので、weight を下げて同じ仕組みに通す
 * （そうしないと、お店だけがいくら売っても値崩れしない抜け道になる）。
 */
export function addMarketSupply(state: GameState, id: ResourceId, qty: number, weight = 1): void {
  if (qty <= 0) return;
  const def = RESOURCE_MAP[id];
  if (!def?.sellable) return;
  const m = getMarketState(state, id);
  const effective = qty * weight;
  m.saturation += effective;
  const impact = Math.min(CONFIG.market.maxSellImpact, (effective / def.liquidity) * CONFIG.market.impactPerLiquidity);
  m.modifier = Math.max(CONFIG.market.minModifier, m.modifier * (1 - impact));
}

export function sellResource(ctx: EngineContext, id: ResourceId, amount: number, options: { auto?: boolean } = {}): SellResult {
  const { state } = ctx;
  const def = RESOURCE_MAP[id];
  const have = state.inventory[id] ?? 0;
  const qty = Math.min(Math.floor(have + 1e-9), Math.floor(amount));
  if (!def.sellable || qty <= 0) return { amount: 0, revenue: 0, unitPrice: currentPrice(state, id) };
  const priceMult = ctx.derived.modifiers?.sellPrice ?? 1;
  const unitPrice = currentPrice(state, id) * priceMult;
  const revenue = Math.floor(sellRevenue(state, id, qty) * priceMult * 100) / 100;
  state.inventory[id] = clean(have - qty);
  state.company.cash += revenue;
  state.company.totalEarned += revenue;
  state.stats.totalSold[id] = (state.stats.totalSold[id] ?? 0) + qty;
  if (!state.stats.bestSale || revenue > state.stats.bestSale.revenue) state.stats.bestSale = { resource: id, qty, revenue };
  const m = getMarketState(state, id);
  m.saturation += qty;
  const impact = Math.min(CONFIG.market.maxSellImpact, (qty / def.liquidity) * CONFIG.market.impactPerLiquidity);
  m.modifier = Math.max(CONFIG.market.minModifier, m.modifier * (1 - impact));
  if (!options.auto) {
    ctx.emit('info', `${def.name}を${qty.toLocaleString('ja-JP')}個売却 (+${Math.floor(revenue).toLocaleString('ja-JP')}円)`);
  }
  return { amount: qty, revenue, unitPrice };
}

/**
 * 自動売却。指定量を超えた分を売る。得た金額を返す。
 * 販売係がいるときは、下限価格（相場が安いときは売らない）と注文ぶんの取り置きが効く
 */
export function runAutoSell(ctx: EngineContext): number {
  const { state } = ctx;
  let gained = 0;
  const reserve: Partial<Record<ResourceId, number>> = {};
  for (const c of state.contracts?.active ?? []) reserve[c.resource] = (reserve[c.resource] ?? 0) + Math.max(0, c.amount - c.delivered);
  // 契約している納品ぶんは売らずに残しておく
  for (const d of state.sales?.deals ?? []) reserve[d.resource] = (reserve[d.resource] ?? 0) + d.amountPer;
  for (const [id, cfg] of Object.entries(state.market.autoSell) as [ResourceId, AutoSellConfig][]) {
    if (!cfg?.enabled) continue;
    if (cfg.minPriceRatio && referencePrice(state, id) < RESOURCE_MAP[id].basePrice * cfg.minPriceRatio) continue;
    const have = state.inventory[id] ?? 0;
    const keep = cfg.keep + (reserve[id] ?? 0);
    const excess = Math.floor(have - keep);
    if (excess >= 1) {
      gained += sellResource(ctx, id, excess, { auto: true }).revenue;
    }
  }
  return gained;
}
