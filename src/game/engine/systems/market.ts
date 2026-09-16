import { CONFIG } from '@/game/data/config';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { GameState, MarketResourceState } from '@/types/state';
import { clean } from '../inventory';
import type { EngineContext } from '../context';

export function getMarketState(state: GameState, id: ResourceId): MarketResourceState {
  let m = state.market.prices[id];
  if (!m) {
    m = { modifier: 1, history: [RESOURCE_MAP[id].basePrice] };
    state.market.prices[id] = m;
  }
  return m;
}

export function currentPrice(state: GameState, id: ResourceId): number {
  return RESOURCE_MAP[id].basePrice * getMarketState(state, id).modifier;
}

/** 市場の定期変動 */
export function runMarket(ctx: EngineContext, dt: number): void {
  const { state, rng } = ctx;
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

/** 売却。価格は売る前の価格で計算し、売った後に流動性に応じて価格を下げる */
export function sellResource(ctx: EngineContext, id: ResourceId, amount: number, options: { auto?: boolean } = {}): SellResult {
  const { state } = ctx;
  const def = RESOURCE_MAP[id];
  const have = state.inventory[id] ?? 0;
  const qty = Math.min(Math.floor(have + 1e-9), Math.floor(amount));
  if (!def.sellable || qty <= 0) return { amount: 0, revenue: 0, unitPrice: currentPrice(state, id) };
  const unitPrice = currentPrice(state, id);
  const revenue = Math.floor(unitPrice * qty * 100) / 100;
  state.inventory[id] = clean(have - qty);
  state.company.cash += revenue;
  state.company.totalEarned += revenue;
  state.stats.totalSold[id] = (state.stats.totalSold[id] ?? 0) + qty;
  const m = getMarketState(state, id);
  const impact = Math.min(CONFIG.market.maxSellImpact, (qty / def.liquidity) * CONFIG.market.impactPerLiquidity);
  m.modifier = Math.max(CONFIG.market.minModifier, m.modifier * (1 - impact));
  if (!options.auto) {
    ctx.emit('info', `${def.name}を${qty.toLocaleString('ja-JP')}個売却 (+${Math.floor(revenue).toLocaleString('ja-JP')}円)`);
  }
  return { amount: qty, revenue, unitPrice };
}

/** 自動売却。指定量を超えた分を売る。得た金額を返す */
export function runAutoSell(ctx: EngineContext): number {
  const { state } = ctx;
  let gained = 0;
  for (const [id, cfg] of Object.entries(state.market.autoSell) as [ResourceId, { enabled: boolean; keep: number }][]) {
    if (!cfg?.enabled) continue;
    const have = state.inventory[id] ?? 0;
    const excess = Math.floor(have - cfg.keep);
    if (excess >= 1) {
      gained += sellResource(ctx, id, excess, { auto: true }).revenue;
    }
  }
  return gained;
}
