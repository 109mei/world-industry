/**
 * 営業 → 契約 → 納品。
 *
 * 取引先は「地図に実在する建物」（工場・営業所・店・倉庫・ホテルなど）。
 * 近所の建物に営業して商談を取り、条件を受けて契約し、期限までに納品する。
 * 名前はもじった架空名で、実在の企業・店舗とは関係がない。
 */
import { KIND_NEEDS, KIND_ORDER_SCALE, OFFER_TTL, PITCH_COOLDOWN, RELATION_PENALTY, RELATION_PER_DELIVERY, isClientKind, pitchCost, relationTier } from '@/game/data/clients';
import { CONFIG } from '@/game/data/config';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { PropertyKind } from '@/game/data/properties';
import type { OsmFeature } from '@/game/services/osm/overpass';
import type { Deal, DealOffer, GameState, SalesClient, SalesState } from '@/types/state';
import type { EngineContext } from '../context';
import { clean } from '../inventory';
import { creditRankDef } from './contracts';
import { estimateLandValue } from '@/game/data/landValue';
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

/** 建物を取引先として覚える（初めて営業したとき） */
export function rememberClient(state: GameState, f: OsmFeature): SalesClient {
  const s = salesState(state);
  const known = s.clients[f.id];
  if (known) return known;
  const place = estimateLandValue({ lat: f.lat, lon: f.lon });
  const client: SalesClient = {
    id: f.id,
    name: f.name,
    label: f.label,
    kind: f.kind,
    lat: f.lat,
    lon: f.lon,
    areaSqm: f.areaSqm,
    levels: f.levels,
    regionLabel: place.distanceKm < 3 ? place.nearestCityName : `${place.nearestCityName}から${Math.round(place.distanceKm)}km`,
    relation: 0,
    lastPitchAt: 0,
    deals: 0,
    deliveries: 0,
    missed: 0,
  };
  s.clients[f.id] = client;
  return client;
}

export function getClient(state: GameState, id: string): SalesClient | null {
  return state.sales?.clients[id] ?? null;
}

/** 営業できるようになっているか（最初の売上で解放） */
export function isSalesUnlocked(state: GameState): boolean {
  return state.company.totalEarned >= CONFIG.contracts.unlockEarned || (state.sales?.deals.length ?? 0) > 0;
}

/** その建物が欲しがっていて、プレイヤーが作れる（作ったことがある）もの */
export function wantedByKind(state: GameState, kind: PropertyKind): ResourceId[] {
  const needs = KIND_NEEDS[kind] ?? [];
  return needs.filter((r) => (state.stats.totalObtained[r] ?? 0) > 0 || (state.inventory[r] ?? 0) > 0);
}

/** 営業の待ち時間（秒）。0 なら今すぐ営業できる。nowMs はミリ秒 */
export function pitchCooldownLeft(state: GameState, clientId: string, nowMs: number): number {
  const c = getClient(state, clientId);
  if (!c) return 0;
  return Math.max(0, PITCH_COOLDOWN - (nowMs - c.lastPitchAt) / 1000);
}

interface PitchTarget {
  id: string;
  name: string;
  label: string;
  kind: PropertyKind;
  lat: number;
  lon: number;
  areaSqm: number;
  levels: number;
}

function targetFromClient(c: SalesClient): PitchTarget {
  return { id: c.id, name: c.name, label: c.label, kind: c.kind, lat: c.lat, lon: c.lon, areaSqm: c.areaSqm, levels: c.levels };
}

/** 地図で見つけた建物（または覚えている取引先）に営業する */
export function pitchToPlace(ctx: EngineContext, target: PitchTarget): { ok: boolean; reason?: string; offers: DealOffer[] } {
  const { state, derived, rng } = ctx;
  if (!isClientKind(target.kind)) return { ok: false, reason: 'ここは取引の相手になりません', offers: [] };
  if (state.estate.custom?.[target.id]) return { ok: false, reason: '自分の持ち物には営業できません', offers: [] };
  const nowMs = ctx.now();
  const known = getClient(state, target.id);
  if (known) {
    const wait = pitchCooldownLeft(state, target.id, nowMs);
    if (wait > 0) return { ok: false, reason: `次の営業まであと ${Math.ceil(wait)} 秒`, offers: [] };
  }
  const wants = wantedByKind(state, target.kind);
  if (wants.length === 0) return { ok: false, reason: 'ここが欲しがるものを、まだ作っていません', offers: [] };
  const cost = pitchCost(derived.assets);
  if (state.company.cash + 1e-9 < cost) return { ok: false, reason: '営業にかかる費用が足りません', offers: [] };

  state.company.cash -= cost;
  state.company.totalSpent += cost;
  const client = known ?? rememberClient(state, { ...target, named: false, polygon: [] } as unknown as OsmFeature);
  client.lastPitchAt = nowMs;

  const rank = creditRankDef(state);
  const tier = relationTier(client.relation);
  const chance = Math.min(0.97, 0.45 + client.relation / 220 + (rank.rewardMult - 1) * 0.6 + (derived.modifiers?.pitchChance ?? 0));
  if (rng() > chance) {
    ctx.emit('info', `${client.name}に営業しましたが、今回は見送られました (-${cost.toLocaleString('ja-JP')}円)`, { toast: true });
    return { ok: true, offers: [] };
  }

  const s = salesState(state);
  const count = client.relation >= 45 ? 2 : 1;
  const floorArea = Math.max(30, client.areaSqm * Math.max(1, client.levels));
  const made: DealOffer[] = [];
  for (let i = 0; i < count; i++) {
    const resource = wants[Math.floor(rng() * wants.length)] as ResourceId;
    const base = referencePrice(state, resource);
    // 建物の大きさで注文の規模が決まる（大きな工場ほど大口）
    const byBuilding = (floorArea / 1000) * (KIND_ORDER_SCALE[client.kind] ?? 10);
    const byValue = Math.max(3, 4000 / Math.max(1, RESOURCE_MAP[resource].basePrice));
    const amountPer = Math.max(3, Math.round(Math.min(byBuilding, byValue * 12) * tier.sizeMult * (0.7 + rng() * 0.6)));
    const unitPrice = Math.max(1, Math.round(base * (1.12 + rng() * 0.25) * tier.priceMult * rank.rewardMult * (derived.modifiers?.dealPrice ?? 1)));
    const deliveries = 3 + Math.floor(rng() * 4) + (client.relation >= 70 ? 3 : 0);
    const intervalSec = Math.round(120 + rng() * 180);
    made.push({ id: s.nextId++, clientId: client.id, resource, amountPer, unitPrice, deliveries, intervalSec, expiresIn: OFFER_TTL });
  }
  s.offers.push(...made);
  ctx.emit('success', `${client.name}から${made.length}件の商談をもらいました (-${cost.toLocaleString('ja-JP')}円)`, { toast: true });
  return { ok: true, offers: made };
}

/** 覚えている取引先に営業する（取引タブから） */
export function pitchToClient(ctx: EngineContext, clientId: string): { ok: boolean; reason?: string; offers: DealOffer[] } {
  const c = getClient(ctx.state, clientId);
  if (!c) return { ok: false, reason: 'その取引先を知りません', offers: [] };
  return pitchToPlace(ctx, targetFromClient(c));
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
    clientId: o.clientId,
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
  const client = getClient(state, o.clientId);
  if (client) client.deals += 1;
  ctx.emit('success', `${client?.name ?? o.clientId}と契約しました（${RESOURCE_MAP[o.resource].name} ${o.amountPer}個 × ${o.deliveries}回）`, { toast: true });
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
  const pay = Math.round(deal.amountPer * deal.unitPrice * (derived.eventMods?.dealPrice ?? 1));
  state.company.cash += pay;
  state.company.totalEarned += pay;
  derived.extraIncome += pay;
  state.stats.contractRewards += pay;
  const client = getClient(state, deal.clientId);
  if (client) {
    client.relation = Math.min(100, client.relation + RELATION_PER_DELIVERY * (derived.modifiers?.relationGain ?? 1));
    client.deliveries += 1;
  }
  state.contracts.credit += Math.max(5, Math.round(pay / 20_000));
  deal.deliveriesLeft -= 1;
  deal.remaining = deal.intervalSec;
  const name = client?.name ?? deal.clientId;
  if (deal.deliveriesLeft <= 0) {
    s.deals = s.deals.filter((d) => d.id !== deal.id);
    state.stats.contractsCompleted += 1;
    if (client) client.relation = Math.min(100, client.relation + 6);
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
  const client = getClient(state, deal.clientId);
  if (client) client.relation = Math.max(0, client.relation - RELATION_PENALTY);
  state.contracts.credit = Math.max(0, state.contracts.credit - 20);
  ctx.emit('warn', `${client?.name ?? deal.clientId}との契約を打ち切りました。関係と信用が下がりました`, { toast: true });
  return true;
}

/** 毎 tick: 納期と商談の期限を進める */
export function runSales(ctx: EngineContext, dt: number): void {
  const { state } = ctx;
  const s = salesState(state);
  for (const o of s.offers) o.expiresIn -= dt;
  const expired = s.offers.filter((o) => o.expiresIn <= 0);
  if (expired.length > 0) {
    s.offers = s.offers.filter((o) => o.expiresIn > 0);
    for (const o of expired) {
      const c = getClient(state, o.clientId);
      ctx.emit('info', `${c?.name ?? o.clientId}の商談が流れました`);
    }
  }
  for (const deal of [...s.deals]) {
    deal.remaining -= dt;
    if (deal.remaining > 0) continue;
    deal.missed += 1;
    deal.remaining = deal.intervalSec;
    const client = getClient(state, deal.clientId);
    if (client) {
      client.relation = Math.max(0, client.relation - RELATION_PENALTY);
      client.missed += 1;
    }
    state.contracts.credit = Math.max(0, state.contracts.credit - 30);
    const name = client?.name ?? deal.clientId;
    if (deal.missed > MAX_MISS) {
      s.deals = s.deals.filter((d) => d.id !== deal.id);
      state.stats.contractsFailed += 1;
      ctx.emit('warn', `${name}への納品が間に合わず、契約が打ち切られました`, { toast: true });
    } else {
      ctx.emit('warn', `${name}への納品が間に合いませんでした（あと${MAX_MISS - deal.missed + 1}回落とすと打ち切り）`, { toast: true });
    }
  }
}

/** 表示用: 覚えている取引先（関係の高い順） */
export function clientList(state: GameState): SalesClient[] {
  return Object.values(state.sales?.clients ?? {}).sort((a, b) => b.relation - a.relation || a.name.localeCompare(b.name, 'ja'));
}
