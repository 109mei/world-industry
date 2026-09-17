import { CONFIG } from '@/game/data/config';
import { CONTRACT_CLIENTS, creditRankOf, type CreditRankDef } from '@/game/data/contracts';
import { RESOURCES, RESOURCE_MAP, type ResourceDef, type ResourceId } from '@/game/data/resources';
import type { Contract, GameState } from '@/types/state';
import { clean } from '../inventory';
import type { EngineContext } from '../context';
import { createInitialContracts } from '../state/createInitialState';

/** 現在の信用ランクの定義 */
export function creditRankDef(state: GameState): CreditRankDef {
  return creditRankOf(state.contracts?.credit ?? 0);
}

/** 注文システムが解放されているか（累計売上で解放） */
export function isContractsUnlocked(state: GameState): boolean {
  return state.company.totalEarned >= CONFIG.contracts.unlockEarned || (state.contracts?.active.length ?? 0) > 0 || state.stats.contractsCompleted > 0;
}

/** 注文に出す資源の候補（入手したことがあり、売れるもの）。製品・部品は重みを高く */
function candidateResources(state: GameState): { id: ResourceId; weight: number }[] {
  const out: { id: ResourceId; weight: number }[] = [];
  for (const r of RESOURCES as readonly ResourceDef[]) {
    const id = r.id as ResourceId;
    if (!r.sellable) continue;
    const obtained = state.stats.totalObtained[id] ?? 0;
    if (obtained < 10) continue;
    const weight = r.category === 'product' ? 4 : r.category === 'part' ? 3 : r.category === 'material' ? 2 : 1;
    out.push({ id, weight });
  }
  return out;
}

function pickWeighted<T extends { weight: number }>(items: T[], rng: () => number): T | null {
  const total = items.reduce((a, b) => a + b.weight, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1] ?? null;
}

/** 注文を1件作る（候補がなければ null） */
export function createContract(ctx: EngineContext): Contract | null {
  const { state, derived, rng } = ctx;
  const cands = candidateResources(state);
  const pick = pickWeighted(cands, rng);
  if (!pick) return null;
  const cfg = CONFIG.contracts;
  const def = RESOURCE_MAP[pick.id];
  const rate = derived.production[pick.id] ?? 0;
  // 生産量 × 秒数（生産していない資源は少なめ）。価格が高いものは少なく
  const byRate = rate * cfg.amountSeconds;
  const byPrice = Math.max(1, Math.round(20_000 / Math.max(1, def.basePrice)));
  let amount = Math.max(cfg.minAmount, Math.round(byRate > 0 ? byRate : byPrice));
  if (def.basePrice >= 5000) amount = Math.max(1, Math.round(amount / 10));
  amount = Math.max(1, Math.round(amount * (0.7 + rng() * 0.6)));
  const rank = creditRankDef(state);
  const mult = cfg.minRewardMult + rng() * (cfg.maxRewardMult - cfg.minRewardMult);
  const reward = Math.round(amount * def.basePrice * mult * rank.rewardMult);
  const credit = Math.round(cfg.creditPerContract * Math.max(1, Math.log10(Math.max(10, reward)) - 2));
  const total = Math.round(cfg.minDuration + rng() * (cfg.maxDuration - cfg.minDuration));
  const client = CONTRACT_CLIENTS[Math.floor(rng() * CONTRACT_CLIENTS.length)];
  return { id: state.contracts.nextId++, client, resource: pick.id, amount, delivered: 0, reward, credit, remaining: total, total };
}

/** 注文の発生と期限の管理 */
export function runContracts(ctx: EngineContext, dt: number): void {
  const { state, rng } = ctx;
  if (!state.contracts) state.contracts = createInitialContracts();
  const c = state.contracts;
  if (!isContractsUnlocked(state)) return;
  const cfg = CONFIG.contracts;
  // 期限
  for (const ct of [...c.active]) {
    ct.remaining -= dt;
    if (ct.remaining <= 0) {
      c.active = c.active.filter((x) => x.id !== ct.id);
      c.credit = Math.max(0, c.credit - cfg.creditPenalty);
      state.stats.contractsFailed += 1;
      ctx.emit('warn', `注文が期限切れ: ${ct.client}の${RESOURCE_MAP[ct.resource].name}×${ct.amount.toLocaleString('ja-JP')}（信用 -${cfg.creditPenalty}）`, { toast: true });
    }
  }
  // 発生
  c.nextIn -= dt;
  if (c.nextIn <= 0) {
    c.nextIn = cfg.minIntervalSeconds + rng() * (cfg.maxIntervalSeconds - cfg.minIntervalSeconds);
    if (c.active.length < cfg.maxActive && !ctx.offline()) {
      const ct = createContract(ctx);
      if (ct) {
        c.active.push(ct);
        ctx.emit('info', `新しい注文: ${ct.client}が${RESOURCE_MAP[ct.resource].name}×${ct.amount.toLocaleString('ja-JP')}を求めています（報酬 ${ct.reward.toLocaleString('ja-JP')}円）`, { toast: true });
      }
    }
  }
}

/** 注文に納品する。amount 省略で残り全部（在庫の範囲）。実際に納めた個数を返す */
export function deliverContract(ctx: EngineContext, contractId: number, amount?: number): number {
  const { state } = ctx;
  const ct = state.contracts.active.find((x) => x.id === contractId);
  if (!ct) return 0;
  const need = ct.amount - ct.delivered;
  const have = Math.floor((state.inventory[ct.resource] ?? 0) + 1e-9);
  const qty = Math.max(0, Math.min(need, have, amount === undefined ? need : Math.floor(amount)));
  if (qty <= 0) return 0;
  state.inventory[ct.resource] = clean((state.inventory[ct.resource] ?? 0) - qty);
  ct.delivered += qty;
  state.stats.totalSold[ct.resource] = (state.stats.totalSold[ct.resource] ?? 0) + qty;
  if (ct.delivered >= ct.amount) {
    state.contracts.active = state.contracts.active.filter((x) => x.id !== ct.id);
    state.company.cash += ct.reward;
    state.company.totalEarned += ct.reward;
    state.stats.contractRewards += ct.reward;
    ctx.derived.extraIncome += ct.reward;
    state.stats.contractsCompleted += 1;
    const before = creditRankDef(state).rank;
    state.contracts.credit += ct.credit;
    const after = creditRankDef(state).rank;
    ctx.emit('success', `注文を達成: ${ct.client}に${RESOURCE_MAP[ct.resource].name}×${ct.amount.toLocaleString('ja-JP')}を納品（+${ct.reward.toLocaleString('ja-JP')}円、信用 +${ct.credit}）`, { toast: true });
    if (before !== after) ctx.emit('success', `信用ランクが ${after} に上がりました（${creditRankDef(state).label}）`, { toast: true });
  } else {
    ctx.emit('info', `${RESOURCE_MAP[ct.resource].name}を${qty.toLocaleString('ja-JP')}個納品（残り ${(ct.amount - ct.delivered).toLocaleString('ja-JP')}）`);
  }
  return qty;
}

/** 注文を断る（信用は下がらないが、次の注文まで待つ） */
export function declineContract(ctx: EngineContext, contractId: number): boolean {
  const { state } = ctx;
  const ct = state.contracts.active.find((x) => x.id === contractId);
  if (!ct) return false;
  state.contracts.active = state.contracts.active.filter((x) => x.id !== ct.id);
  ctx.emit('info', `注文を断りました: ${ct.client}`);
  return true;
}
