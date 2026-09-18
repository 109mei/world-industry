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

/**
 * 変動係数（modifier）が動ける幅。
 * 荒い相場のもの（GPU・暗号資産）は上下に広く動かすので、
 * 「相場が動くとき」「売ったとき」「買ったとき」で同じ幅を使わないと、
 * 下限より安いときに売ると値段が跳ね上がる、といった抜け道ができる。
 */
export function modifierFloor(id: ResourceId): number {
  const vol = RESOURCE_MAP[id]?.volatility ?? 1;
  return CONFIG.market.minModifier / Math.sqrt(vol);
}

export function modifierCeil(id: ResourceId): number {
  const vol = RESOURCE_MAP[id]?.volatility ?? 1;
  return CONFIG.market.maxModifier * vol;
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
          const { randomStep, meanReversion, historyLength } = CONFIG.market;
      // 荒い相場のもの（GPU・暗号資産）は、上下の振れ幅を大きくする
      const vol = RESOURCE_MAP[id].volatility ?? 1;
      const noise = (rng() - 0.5) * 2 * randomStep * vol;
      let next = m.modifier + (1 - m.modifier) * (meanReversion / vol) + noise;
      next = Math.min(modifierCeil(id), Math.max(modifierFloor(id), next));
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
  m.modifier = Math.max(modifierFloor(id), m.modifier * (1 - impact));
}

/** 市場から買うときの上乗せ（仲介料）。売値より高く買うことになる */
export const BUY_SPREAD = 1.25;

/**
 * いま1個いくらで買えるか。
 *
 * 売値に掛かる係数（研究や連携で上がる sellPrice）は買値にも同じだけ掛ける。
 * 片側にだけ掛けると、「買ってすぐ売る」が儲かる抜け道になってしまう。
 */
export function buyPrice(state: GameState, id: ResourceId, sellPriceMult = 1): number {
  return referencePrice(state, id) * BUY_SPREAD * sellPriceMult;
}

/**
 * qty 個をまとめて買うときの合計。
 * たくさん買うほど1個あたりは高くなる（安い在庫から順に無くなっていくのと同じ）。
 * 売るときの積分と向きが反対になっていて、往復すると必ず手数料ぶん損をする。
 */
export function buyCost(state: GameState, id: ResourceId, qty: number, sellPriceMult = 1): number {
  if (qty <= 0) return 0;
  const unit = buyPrice(state, id, sellPriceMult);
  const c = Math.max(1, demandCapacity(state, id));
  return unit * (qty + (qty * qty) / (2 * c));
}

export interface BuyResult {
  amount: number;
  cost: number;
  unitPrice: number;
  reason?: string;
}

/**
 * 市場から買う（転売のための仕入れ）。
 * 売値より 25% 高く買うことになるので、そのまま売り返すと必ず損をする。
 * 相場が上がってから売れば儲かる。たくさん買うと、そのぶん相場が上がる。
 */
export function buyResource(ctx: EngineContext, id: ResourceId, amount: number): BuyResult {
  const { state } = ctx;
  const def = RESOURCE_MAP[id];
  const priceMult = ctx.derived.modifiers?.sellPrice ?? 1;
  const unit = buyPrice(state, id, priceMult);
  if (!def?.buyable) return { amount: 0, cost: 0, unitPrice: unit, reason: 'これは市場から買えません' };
  const room = Math.max(0, ctx.derived.capacity - (state.inventory[id] ?? 0));
  let qty = Math.floor(Math.min(amount, room));
  if (qty <= 0) return { amount: 0, cost: 0, unitPrice: unit, reason: '倉庫に空きがありません' };
  // 買える数は、まとめ買いで単価が上がるぶんも見て決める
  while (qty > 0 && buyCost(state, id, qty, priceMult) > state.company.cash) {
    qty = Math.min(qty - 1, Math.floor(qty * 0.9));
  }
  if (qty <= 0) return { amount: 0, cost: 0, unitPrice: unit, reason: '所持金が足りません' };
  const cost = Math.ceil(buyCost(state, id, qty, priceMult));
  state.company.cash = state.company.cash - cost;
  state.company.totalSpent += cost;
  state.inventory[id] = clean((state.inventory[id] ?? 0) + qty);
  // 買い占めると相場が上がる（売るときの半分の効き。往復で儲からないようにするため）
  const m = getMarketState(state, id);
  const impact = Math.min(CONFIG.market.maxSellImpact, (qty / def.liquidity) * CONFIG.market.impactPerLiquidity) * 0.5;
  m.modifier = Math.min(modifierCeil(id), m.modifier * (1 + impact));
  ctx.emit('info', `${def.name}を${qty.toLocaleString('ja-JP')}個 仕入れました (-${cost.toLocaleString('ja-JP')}円)`);
  return { amount: qty, cost, unitPrice: cost / qty };
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
  m.modifier = Math.max(modifierFloor(id), m.modifier * (1 - impact));
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
