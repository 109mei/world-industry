/**
 * 営業 → 契約 → 納品。
 *
 * 取引先（株式市場にいる架空の会社）に営業して商談を取り、条件を受けて契約する。
 * 期限までに納品すると代金・信用・関係が得られ、落とすと関係と信用が下がる。
 */
import { COMPANIES, COMPANY_MAP, isCompanyId, type CompanyDef } from '@/game/data/companies';
import { OFFER_TTL, PITCH_COOLDOWN, RELATION_PENALTY, RELATION_PER_DELIVERY, SECTOR_NEEDS, pitchCost, relationTier } from '@/game/data/clients';
import { CONFIG } from '@/game/data/config';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { ClientState, Deal, DealOffer, GameState, SalesState } from '@/types/state';
import type { EngineContext } from '../context';
import { clean } from '../inventory';
import { creditRankDef } from './contracts';
import { referencePrice } from './market';

/** 落としてよい回数（超えると契約は打ち切り） */
const MAX_MISS = 2;

export function createInitialSales(): SalesState {
  return { clients: {}, offers: [], deals: [], nextId: 1 };
}

export function salesState(state: GameState): SalesState {
  if (!state.sales) state.sales = createInitialSales();
  return state.sales;
}

export function clientState(state: GameState, companyId: string): ClientState {
  const s = salesState(state);
  if (!s.clients[companyId]) s.clients[companyId] = { relation: 0, lastPitchAt: 0, deals: 0, deliveries: 0, missed: 0 };
  return s.clients[companyId];
}

/** 営業できるようになっているか（最初の売上で解放） */
export function isSalesUnlocked(state: GameState): boolean {
  return state.company.totalEarned >= CONFIG.contracts.unlockEarned || (state.sales?.deals.length ?? 0) > 0;
}

/** その会社が欲しがっていて、プレイヤーが作れる（作ったことがある）もの */
export function wantedBy(state: GameState, def: CompanyDef): ResourceId[] {
  const needs = SECTOR_NEEDS[def.sector] ?? [];
  return needs.filter((r) => (state.stats.totalObtained[r] ?? 0) > 0 || (state.inventory[r] ?? 0) > 0);
}

/** 営業の待ち時間（秒）。0 なら今すぐ営業できる。now はミリ秒 */
export function pitchCooldownLeft(state: GameState, companyId: string, nowMs: number): number {
  const c = clientState(state, companyId);
  const elapsed = (nowMs - c.lastPitchAt) / 1000;
  return Math.max(0, PITCH_COOLDOWN - elapsed);
}

/** 営業する。うまくいけば商談が1〜2件できる */
export function pitchTo(ctx: EngineContext, companyId: string): { ok: boolean; reason?: string; offers: DealOffer[] } {
  const { state, derived, rng } = ctx;
  if (!isCompanyId(companyId)) return { ok: false, reason: '知らない会社です', offers: [] };
  const def = COMPANY_MAP[companyId];
  const stock = state.stocks.companies[companyId];
  if (stock?.dissolved) return { ok: false, reason: 'この会社はもうありません', offers: [] };
  const now = ctx.now();
  const wait = pitchCooldownLeft(state, companyId, now);
  if (wait > 0) return { ok: false, reason: `次の営業まであと ${Math.ceil(wait)} 秒`, offers: [] };
  const wants = wantedBy(state, def);
  if (wants.length === 0) return { ok: false, reason: 'この会社が欲しがるものを、まだ作っていません', offers: [] };
  const cost = pitchCost(derived.assets);
  if (state.company.cash + 1e-9 < cost) return { ok: false, reason: '営業にかかる費用が足りません', offers: [] };

  state.company.cash -= cost;
  state.company.totalSpent += cost;
  const client = clientState(state, companyId);
  client.lastPitchAt = now;

  const rank = creditRankDef(state);
  const tier = relationTier(client.relation);
  // 成功率: 信用と関係が高いほど通りやすい
  const chance = Math.min(0.97, 0.45 + client.relation / 220 + (rank.rewardMult - 1) * 0.6 + (derived.modifiers?.pitchChance ?? 0));
  if (rng() > chance) {
    ctx.emit('info', `${def.name}に営業しましたが、今回は見送られました (-${cost.toLocaleString('ja-JP')}円)`, { toast: true });
    return { ok: true, offers: [] };
  }

  const s = salesState(state);
  const count = client.relation >= 45 ? 2 : 1;
  const made: DealOffer[] = [];
  for (let i = 0; i < count; i++) {
    const resource = wants[Math.floor(rng() * wants.length)] as ResourceId;
    const base = referencePrice(state, resource);
    const rate = derived.production[resource] ?? 0;
    const perBase = rate > 0 ? rate * 60 : Math.max(5, Math.round(3000 / Math.max(1, RESOURCE_MAP[resource].basePrice)));
    const amountPer = Math.max(3, Math.round(perBase * tier.sizeMult * (0.7 + rng() * 0.6)));
    // 相場より高く買ってくれる（信用と関係で上がる）
    const unitPrice = Math.max(1, Math.round(base * (1.12 + rng() * 0.25) * tier.priceMult * rank.rewardMult * (derived.modifiers?.dealPrice ?? 1)));
    const deliveries = 3 + Math.floor(rng() * 4) + (client.relation >= 70 ? 3 : 0);
    const intervalSec = Math.round(120 + rng() * 180);
    made.push({ id: s.nextId++, companyId, resource, amountPer, unitPrice, deliveries, intervalSec, expiresIn: OFFER_TTL });
  }
  s.offers.push(...made);
  ctx.emit('success', `${def.name}から${made.length}件の商談をもらいました (-${cost.toLocaleString('ja-JP')}円)`, { toast: true });
  return { ok: true, offers: made };
}

/** 商談を受けて契約にする */
export function acceptOffer(ctx: EngineContext, offerId: number): boolean {
  const { state } = ctx;
  const s = salesState(state);
  const idx = s.offers.findIndex((o) => o.id === offerId);
  if (idx < 0) return false;
  const o = s.offers[idx];
  s.offers.splice(idx, 1);
  const deal: Deal = {
    id: s.nextId++,
    companyId: o.companyId,
    resource: o.resource,
    amountPer: o.amountPer,
    unitPrice: o.unitPrice,
    deliveriesLeft: o.deliveries,
    intervalSec: o.intervalSec,
    remaining: o.intervalSec,
    missed: 0,
    startedAt: ctx.now(),
  };
  s.deals.push(deal);
  clientState(state, o.companyId).deals += 1;
  const name = isCompanyId(o.companyId) ? COMPANY_MAP[o.companyId].name : o.companyId;
  ctx.emit('success', `${name}と契約しました（${RESOURCE_MAP[o.resource].name} ${o.amountPer}個 × ${o.deliveries}回）`, { toast: true });
  return true;
}

export function declineOffer(state: GameState, offerId: number): boolean {
  const s = salesState(state);
  const idx = s.offers.findIndex((o) => o.id === offerId);
  if (idx < 0) return false;
  s.offers.splice(idx, 1);
  return true;
}

/** 契約の1回ぶんを納品する */
export function deliverDeal(ctx: EngineContext, dealId: number): boolean {
  const { state, derived } = ctx;
  const s = salesState(state);
  const deal = s.deals.find((d) => d.id === dealId);
  if (!deal) return false;
  const have = state.inventory[deal.resource] ?? 0;
  if (have + 1e-9 < deal.amountPer) return false;
  state.inventory[deal.resource] = clean(have - deal.amountPer);
  const pay = Math.round(deal.amountPer * deal.unitPrice);
  state.company.cash += pay;
  state.company.totalEarned += pay;
  derived.extraIncome += pay;
  state.stats.contractRewards += pay;
  const client = clientState(state, deal.companyId);
  client.relation = Math.min(100, client.relation + RELATION_PER_DELIVERY * (derived.modifiers?.relationGain ?? 1));
  client.deliveries += 1;
  state.contracts.credit += Math.max(5, Math.round(pay / 20_000));
  deal.deliveriesLeft -= 1;
  deal.remaining = deal.intervalSec;
  const name = isCompanyId(deal.companyId) ? COMPANY_MAP[deal.companyId].name : deal.companyId;
  if (deal.deliveriesLeft <= 0) {
    s.deals = s.deals.filter((d) => d.id !== deal.id);
    state.stats.contractsCompleted += 1;
    client.relation = Math.min(100, client.relation + 6);
    ctx.emit('success', `${name}への契約を完了しました (+${pay.toLocaleString('ja-JP')}円)。関係が深まりました`, { toast: true });
  } else {
    ctx.emit('success', `${name}へ納品しました (+${pay.toLocaleString('ja-JP')}円)。残り ${deal.deliveriesLeft} 回`, { toast: true });
  }
  return true;
}

/** 契約を自分から打ち切る（関係が下がる） */
export function cancelDeal(ctx: EngineContext, dealId: number): boolean {
  const { state } = ctx;
  const s = salesState(state);
  const deal = s.deals.find((d) => d.id === dealId);
  if (!deal) return false;
  s.deals = s.deals.filter((d) => d.id !== dealId);
  const client = clientState(state, deal.companyId);
  client.relation = Math.max(0, client.relation - RELATION_PENALTY);
  state.contracts.credit = Math.max(0, state.contracts.credit - 20);
  const name = isCompanyId(deal.companyId) ? COMPANY_MAP[deal.companyId].name : deal.companyId;
  ctx.emit('warn', `${name}との契約を打ち切りました。関係と信用が下がりました`, { toast: true });
  return true;
}

/** 毎 tick: 納期と商談の期限を進める */
export function runSales(ctx: EngineContext, dt: number): void {
  const { state } = ctx;
  const s = salesState(state);
  // 商談の期限
  for (const o of s.offers) o.expiresIn -= dt;
  const expired = s.offers.filter((o) => o.expiresIn <= 0);
  if (expired.length > 0) {
    s.offers = s.offers.filter((o) => o.expiresIn > 0);
    for (const o of expired) {
      const name = isCompanyId(o.companyId) ? COMPANY_MAP[o.companyId].name : o.companyId;
      ctx.emit('info', `${name}の商談が流れました`);
    }
  }
  // 納期
  for (const deal of [...s.deals]) {
    deal.remaining -= dt;
    if (deal.remaining > 0) continue;
    deal.missed += 1;
    deal.remaining = deal.intervalSec;
    const client = clientState(state, deal.companyId);
    client.relation = Math.max(0, client.relation - RELATION_PENALTY);
    client.missed += 1;
    state.contracts.credit = Math.max(0, state.contracts.credit - 30);
    const name = isCompanyId(deal.companyId) ? COMPANY_MAP[deal.companyId].name : deal.companyId;
    if (deal.missed > MAX_MISS) {
      s.deals = s.deals.filter((d) => d.id !== deal.id);
      state.stats.contractsFailed += 1;
      ctx.emit('warn', `${name}への納品が間に合わず、契約が打ち切られました`, { toast: true });
    } else {
      ctx.emit('warn', `${name}への納品が間に合いませんでした（あと${MAX_MISS - deal.missed + 1}回落とすと打ち切り）`, { toast: true });
    }
  }
}

/** 表示用: 取引先の一覧（関係の高い順） */
export function clientList(state: GameState): { def: CompanyDef; client: ClientState }[] {
  return (COMPANIES as readonly CompanyDef[])
    .filter((c) => !state.stocks.companies[c.id]?.dissolved)
    .map((def) => ({ def, client: clientState(state, def.id) }))
    .sort((a, b) => b.client.relation - a.client.relation || a.def.name.localeCompare(b.def.name, 'ja'));
}
