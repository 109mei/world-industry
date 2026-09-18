/**
 * 貿易。安いところで仕入れ、運び、高いところで売る。
 *
 * 市場（systems/market）が「自分の国の卸売」なら、こちらは「国をまたぐ商売」。
 * ちがいは4つある。
 *   1. 同じ品でも国ごとに値段が違う（産地は安く、足りない国は高い）
 *   2. 運ぶのに時間と運賃がかかる。届くころには相場が動いている
 *   3. 輸入には関税がかかる
 *   4. 為替が動くので、同じ品でも買う時期で値段が変わる
 *
 * 荷は「出した時点で代金が確定」する。届くまでのあいだに相場が動いても、
 * すでに決めた値段は変わらない。動くのは「次に何を買うか」の判断のほうになる。
 */
import { CONTACT_REASONS, COUNTRIES, COUNTRY_MAP, REPEAT_REASONS, distanceBetween, nearestCountry, COUNTRY_PRICE_MAX, COUNTRY_PRICE_MIN, FX_MAX, FX_MIN, SHIP_MODE_MAP, canUseMode, countryBias, shipCost, shipSeconds, type ShipMode } from '@/game/data/trade';
import type { CountryCode } from '@/game/data/lands';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import type { GameState, Shipment, TradeOffer, TradeState } from '@/types/state';
import type { EngineContext } from '../context';
import { hqLocation } from '../hq';
import { addResource } from '../inventory';
import { safe } from '@/utils/numbers';
import { tradeFeeMult } from './synergy';
import { EVENT_MAP, isEventDefId } from '@/game/data/events';
import { eventPriceMultiplier } from './market';

/** 商談が届く間隔（秒） */
const OFFER_INTERVAL = 75;
/** 同時に抱えられる商談の数 */
const MAX_OFFERS = 6;
/** 相場と為替が動く間隔（秒） */
const DRIFT_INTERVAL = 30;
/**
 * 同時に運べる荷の数の、全体の上限。
 * 実際には「持っている乗り物の数」で決まるので、ここは安全弁。
 */
export const MAX_SHIPMENTS = 40;

/** その手段の乗り物を何台持っているか */
export function fleetCount(state: GameState, mode: ShipMode): number {
  const need = SHIP_MODE_MAP[mode]?.fleetId;
  if (!need) return 0;
  let n = 0;
  for (const f of state.facilities) {
    if (!isFacilityId(f.typeId) || f.typeId !== need || !f.enabled) continue;
    n += Math.max(0, Math.floor(f.count));
  }
  return n;
}

/** いま出払っている台数（行きも帰りも「使用中」） */
export function fleetBusy(state: GameState, mode: ShipMode): number {
  return (state.trade?.shipments ?? []).filter((s) => s.mode === mode).length;
}

/** すぐ出せる台数 */
export function fleetIdle(state: GameState, mode: ShipMode): number {
  return Math.max(0, fleetCount(state, mode) - fleetBusy(state, mode));
}

/** 1台で運べる重さ（t） */
export function fleetCapacityTons(mode: ShipMode): number {
  return SHIP_MODE_MAP[mode]?.maxTons ?? 0;
}

export function createInitialTrade(): TradeState {
  const fx: Record<string, number> = {};
  for (const c of COUNTRIES) fx[c.id] = 1;
  return { fx, priceMult: {}, shipments: [], offers: [], nextOfferIn: 40, nextDriftIn: DRIFT_INTERVAL, nextId: 1, spent: 0, earned: 0, freight: 0, duty: 0 };
}

export function tradeState(state: GameState): TradeState {
  if (!state.trade) state.trade = createInitialTrade();
  return state.trade;
}

export function isTradeUnlocked(state: GameState): boolean {
  // 「海外進出」を終えるか、本社のほかに土地を1ヵ所でも持つと、海外と取引できる
  return state.research.completed.overseas === true || (state.lands?.length ?? 0) > 1;
}

const key = (country: CountryCode, resource: ResourceId) => `${country}:${resource}`;

/**
 * 相手国ごとに効いているイベントの倍率。
 * 「関税引き上げ」「通貨高」「港湾スト」は、その国との取引だけに効く。
 */
export interface CountryEventMods {
  /** 関税の倍率 */
  tariff: number;
  /** その国の値段の倍率（通貨の動き） */
  fx: number;
  /** 行き帰りにかかる時間の倍率 */
  time: number;
  /** いま効いているイベントの名前（画面に出す） */
  labels: string[];
}

const NO_COUNTRY_MODS: CountryEventMods = { tariff: 1, fx: 1, time: 1, labels: [] };

/** 燃料の高騰・下落による運賃の倍率（陸海空の共通ぶん） */
export function eventFreightMult(state: GameState): number {
  let mult = 1;
  for (const ev of state.events?.active ?? []) {
    if (!isEventDefId(ev.defId)) continue;
    if (EVENT_MAP[ev.defId].kind === 'fuel') mult *= ev.magnitude;
  }
  return mult;
}

export function countryEventMods(state: GameState, country: CountryCode): CountryEventMods {
  const active = state.events?.active ?? [];
  if (active.length === 0) return NO_COUNTRY_MODS;
  let tariff = 1;
  let fx = 1;
  let time = 1;
  const labels: string[] = [];
  for (const ev of active) {
    if (ev.target !== country || !isEventDefId(ev.defId)) continue;
    const def = EVENT_MAP[ev.defId];
    if (def.kind === 'tariff') tariff *= ev.magnitude;
    else if (def.kind === 'fx') fx *= ev.magnitude;
    else if (def.kind === 'port') time *= ev.magnitude;
    else continue;
    labels.push(def.name);
  }
  return { tariff, fx, time, labels };
}

/** その国での 1個あたりの値段（円）。産地は安く、足りない国は高い。為替と相場が乗る */
export function countryUnitPrice(state: GameState, country: CountryCode, resource: ResourceId): number {
  const def = RESOURCE_MAP[resource];
  if (!def) return 0;
  const ts = tradeState(state);
  const fx = clampFx(ts.fx[country] ?? 1);
  const mult = clampPrice(ts.priceMult[key(country, resource)] ?? 1);
  /*
   * 相場のイベントは世界中の値段に効く。
   * ここを入れないと、ホームに「GPUの値段が2.6倍」と出ているのに
   * 海外の値段だけ動かない、という矛盾が起きる。
   * そのうえで、その国の通貨が動いていれば、その国だけさらに上下する。
   */
  const world = eventPriceMultiplier(state, resource);
  const local = countryEventMods(state, country).fx;
  return Math.max(1, def.basePrice * countryBias(country, resource) * fx * mult * world * local);
}

/** 基準（為替と相場の動きを抜いた、その国の素の値段） */
export function countryBasePrice(resource: ResourceId, country: CountryCode): number {
  const def = RESOURCE_MAP[resource];
  if (!def) return 0;
  return Math.max(1, def.basePrice * countryBias(country, resource));
}

function clampFx(v: number): number {
  return Number.isFinite(v) ? Math.max(FX_MIN, Math.min(FX_MAX, v)) : 1;
}
function clampPrice(v: number): number {
  return Number.isFinite(v) ? Math.max(COUNTRY_PRICE_MIN, Math.min(COUNTRY_PRICE_MAX, v)) : 1;
}

export interface Quote {
  ok: boolean;
  reason?: string;
  /** 品物の代金 */
  goods: number;
  /** 運賃 */
  freight: number;
  /** 関税（輸入のときだけ） */
  duty: number;
  /** 手数料（連携で下がる） */
  fee: number;
  /** 支払い（輸入）または受け取り（輸出）の総額 */
  total: number;
  seconds: number;
  tons: number;
}

/** 仕入れ・売却の見積もり。押す前に全部見えるようにする */
export function quote(state: GameState, country: CountryCode, resource: ResourceId, qty: number, mode: ShipMode, kind: 'import' | 'export'): Quote {
  const def = RESOURCE_MAP[resource];
  const c = COUNTRY_MAP[country];
  const empty: Quote = { ok: false, goods: 0, freight: 0, duty: 0, fee: 0, total: 0, seconds: 0, tons: 0 };
  if (!def || !c) return { ...empty, reason: 'その品ヵ国はありません' };
  const n = Math.max(0, Math.floor(qty));
  if (n <= 0) return { ...empty, reason: '数量を入れてください' };
  const tons = (def.weight ?? 0.01) * n;
  if (fleetCount(state, mode) <= 0) {
    return { ...empty, reason: `${SHIP_MODE_MAP[mode]?.name ?? ''}を持っていません（施設で「${FACILITY_MAP[SHIP_MODE_MAP[mode].fleetId].name}」を買うと使えます）`, tons };
  }
  if (fleetIdle(state, mode) <= 0) {
    return { ...empty, reason: `${SHIP_MODE_MAP[mode]?.name ?? ''}が全部出払っています（帰ってくるまで待つか、もう1台買う）`, tons };
  }
  const use = canUseMode(mode, c.distanceKm, tons);
  if (!use.ok) return { ...empty, reason: use.reason, tons };
  const unit = countryUnitPrice(state, country, resource);
  const goods = Math.ceil(unit * n);
  // 燃料の高騰・下落は運賃に、関税のイベントは関税に、港の停滞は日数に効く
  const ev = countryEventMods(state, country);
  const freight = Math.ceil(shipCost(mode, c.distanceKm, tons) * (state.events?.active?.length ? eventFreightMult(state) : 1));
  const duty = kind === 'import' ? Math.ceil(goods * c.tariff * ev.tariff) : 0;
  // 手数料は連携（商社など）で下がる
  const feeRate = 0.02 * tradeFeeMult(state);
  const fee = Math.ceil(goods * feeRate);
  const total = kind === 'import' ? goods + freight + duty + fee : Math.max(0, goods - freight - fee);
  const seconds = Math.max(5, Math.round(shipSeconds(mode, c.distanceKm) * ev.time));
  return { ok: true, goods, freight, duty, fee, total, seconds, tons };
}

export interface TradeResult {
  ok: boolean;
  reason?: string;
  shipment?: Shipment;
}

/** 買い付ける。代金は今払い、品は届いてから入る */
export function importOrder(ctx: EngineContext, country: CountryCode, resource: ResourceId, qty: number, mode: ShipMode): TradeResult {
  const { state } = ctx;
  if (!isTradeUnlocked(state)) return { ok: false, reason: 'まだ海外と取引できません' };
  const ts = tradeState(state);
  if (ts.shipments.length >= MAX_SHIPMENTS) return { ok: false, reason: `同時に運べるのは ${MAX_SHIPMENTS} 件までです` };
  const q = quote(state, country, resource, qty, mode, 'import');
  if (!q.ok) return { ok: false, reason: q.reason };
  if (state.company.cash + 1e-9 < q.total) return { ok: false, reason: '所持金が足りません' };
  const n = Math.floor(qty);
  state.company.cash = safe(state.company.cash - q.total);
  state.company.totalSpent = safe(state.company.totalSpent + q.total);
  ts.spent = safe(ts.spent + q.goods);
  ts.freight = safe(ts.freight + q.freight);
  ts.duty = safe(ts.duty + q.duty);
  // まとめて買うと、その国の相場は上がる
  bumpPrice(ts, country, resource, +impact(resource, n));
  const ship: Shipment = {
    id: ts.nextId++, kind: 'import', country, resource, qty: n, mode,
    remaining: q.seconds, totalSeconds: q.seconds, amount: q.total, leg: 'out',
  };
  ts.shipments.push(ship);
  ctx.emit('info', `${COUNTRY_MAP[country].name}から ${RESOURCE_MAP[resource].name}${n.toLocaleString('ja-JP')} を仕入れました（${SHIP_MODE_MAP[mode].name}で ${q.seconds}秒）`, { toast: true });
  return { ok: true, shipment: ship };
}

/** 売り渡す。品は今出して、代金は届いてから入る */
export function exportOrder(ctx: EngineContext, country: CountryCode, resource: ResourceId, qty: number, mode: ShipMode): TradeResult {
  const { state } = ctx;
  if (!isTradeUnlocked(state)) return { ok: false, reason: 'まだ海外と取引できません' };
  const ts = tradeState(state);
  if (ts.shipments.length >= MAX_SHIPMENTS) return { ok: false, reason: `同時に運べるのは ${MAX_SHIPMENTS} 件までです` };
  const have = state.inventory[resource] ?? 0;
  const n = Math.min(Math.floor(have), Math.floor(qty));
  if (n <= 0) return { ok: false, reason: '在庫がありません' };
  const q = quote(state, country, resource, n, mode, 'export');
  if (!q.ok) return { ok: false, reason: q.reason };
  if (q.total <= 0) return { ok: false, reason: '運賃のほうが高く、売っても残りません' };
  state.inventory[resource] = have - n;
  state.stats.totalSold[resource] = (state.stats.totalSold[resource] ?? 0) + n;
  ts.freight = safe(ts.freight + q.freight);
  // たくさん売れば、その国の相場は下がる
  bumpPrice(ts, country, resource, -impact(resource, n));
  const ship: Shipment = {
    id: ts.nextId++, kind: 'export', country, resource, qty: n, mode,
    remaining: q.seconds, totalSeconds: q.seconds, amount: q.total, leg: 'out',
  };
  ts.shipments.push(ship);
  ctx.emit('info', `${COUNTRY_MAP[country].name}へ ${RESOURCE_MAP[resource].name}${n.toLocaleString('ja-JP')} を送りました（着いたら ${Math.round(q.total).toLocaleString('ja-JP')}円）`, { toast: true });
  return { ok: true, shipment: ship };
}

/** 売買が相場に与える影響。流動性の高い品ほど動かない */
function impact(resource: ResourceId, qty: number): number {
  const liq = Math.max(20, RESOURCE_MAP[resource]?.liquidity ?? 200);
  return Math.min(0.35, qty / (liq * 12));
}

function bumpPrice(ts: TradeState, country: CountryCode, resource: ResourceId, delta: number): void {
  const k = key(country, resource);
  const cur = clampPrice(ts.priceMult[k] ?? 1);
  ts.priceMult[k] = clampPrice(cur * (1 + delta));
}

/** 商談を受ける */
export function acceptOffer(ctx: EngineContext, offerId: number, mode: ShipMode = 'ship'): TradeResult {
  const { state } = ctx;
  const ts = tradeState(state);
  const i = ts.offers.findIndex((o) => o.id === offerId);
  if (i < 0) return { ok: false, reason: 'その商談はもうありません' };
  const o = ts.offers[i];
  const country = o.country as CountryCode;
  const resource = o.resource as ResourceId;
  if (o.kind === 'buy') {
    // 相手が買いたい＝こちらが売る。提示額で売れる（相場より良いことが多い）
    const have = state.inventory[resource] ?? 0;
    if (have < o.qty) return { ok: false, reason: `在庫が足りません（${o.qty.toLocaleString('ja-JP')}必要）` };
    if (ts.shipments.length >= MAX_SHIPMENTS) return { ok: false, reason: `同時に運べるのは ${MAX_SHIPMENTS} 件までです` };
    const c = COUNTRY_MAP[country];
    // 相手の場所が分かっているときは、本社からその会社までの実際の距離で運ぶ
    const dist = o.distanceKm ?? c.distanceKm;
    const tons = (RESOURCE_MAP[resource].weight ?? 0.01) * o.qty;
    if (fleetIdle(state, mode) <= 0) return { ok: false, reason: fleetCount(state, mode) <= 0 ? `${SHIP_MODE_MAP[mode].name}を持っていません` : `${SHIP_MODE_MAP[mode].name}が全部出払っています` };
    const use = canUseMode(mode, dist, tons);
    if (!use.ok) return { ok: false, reason: use.reason };
    const freight = shipCost(mode, dist, tons);
    const amount = Math.max(0, Math.ceil(o.unitPrice * o.qty) - freight);
    state.inventory[resource] = have - o.qty;
    state.stats.totalSold[resource] = (state.stats.totalSold[resource] ?? 0) + o.qty;
    ts.freight = safe(ts.freight + freight);
    const ship: Shipment = {
      id: ts.nextId++, kind: 'export', country, resource, qty: o.qty, mode,
      remaining: shipSeconds(mode, dist), totalSeconds: shipSeconds(mode, dist), amount, dealId: o.id, leg: 'out',
      lat: o.lat, lon: o.lon, company: o.company,
    };
    ts.shipments.push(ship);
    ts.offers.splice(i, 1);
    ctx.emit('success', `${o.company}との商談がまとまりました（着いたら ${Math.round(amount).toLocaleString('ja-JP')}円）`, { toast: true });
    return { ok: true, shipment: ship };
  }
  // 相手が売りたい＝こちらが買う。提示額は相場より安いことが多い
  const c = COUNTRY_MAP[country];
  const tons = (RESOURCE_MAP[resource].weight ?? 0.01) * o.qty;
  if (fleetIdle(state, mode) <= 0) return { ok: false, reason: fleetCount(state, mode) <= 0 ? `${SHIP_MODE_MAP[mode].name}を持っていません` : `${SHIP_MODE_MAP[mode].name}が全部出払っています` };
  const use = canUseMode(mode, c.distanceKm, tons);
  if (!use.ok) return { ok: false, reason: use.reason };
  const goods = Math.ceil(o.unitPrice * o.qty);
  const freight = shipCost(mode, c.distanceKm, tons);
  const duty = Math.ceil(goods * c.tariff);
  const total = goods + freight + duty;
  if (state.company.cash + 1e-9 < total) return { ok: false, reason: '所持金が足りません' };
  if (ts.shipments.length >= MAX_SHIPMENTS) return { ok: false, reason: `同時に運べるのは ${MAX_SHIPMENTS} 件までです` };
  state.company.cash = safe(state.company.cash - total);
  state.company.totalSpent = safe(state.company.totalSpent + total);
  ts.spent = safe(ts.spent + goods);
  ts.freight = safe(ts.freight + freight);
  ts.duty = safe(ts.duty + duty);
  const ship: Shipment = {
    id: ts.nextId++, kind: 'import', country, resource, qty: o.qty, mode,
    remaining: shipSeconds(mode, c.distanceKm), totalSeconds: shipSeconds(mode, c.distanceKm), amount: total, dealId: o.id, leg: 'out',
    lat: o.lat, lon: o.lon, company: o.company,
  };
  ts.shipments.push(ship);
  ts.offers.splice(i, 1);
  ctx.emit('success', `${o.company}との商談がまとまりました（${RESOURCE_MAP[resource].name}${o.qty.toLocaleString('ja-JP')}）`, { toast: true });
  return { ok: true, shipment: ship };
}

/** 商談を断る */
export function declineOffer(ctx: EngineContext, offerId: number): boolean {
  const ts = tradeState(ctx.state);
  const i = ts.offers.findIndex((o) => o.id === offerId);
  if (i < 0) return false;
  ts.offers.splice(i, 1);
  return true;
}

export interface PitchResult {
  ok: boolean;
  reason?: string;
  /** 相手が受けたか */
  accepted: boolean;
  /** 受けてもらえる見込み（0〜1） */
  chance: number;
  shipment?: Shipment;
}

/**
 * こちらから売り込む。
 * その国の相場より安く出すほど通りやすく、高く出すほど断られる。
 * 断られても品は減らないが、その国はしばらく話を聞いてくれなくなる（相場が少し下がる）。
 */
export function pitch(ctx: EngineContext, country: CountryCode, resource: ResourceId, qty: number, unitPrice: number, mode: ShipMode = 'ship'): PitchResult {
  const { state, rng } = ctx;
  if (!isTradeUnlocked(state)) return { ok: false, reason: 'まだ海外と取引できません', accepted: false, chance: 0 };
  const have = state.inventory[resource] ?? 0;
  const n = Math.min(Math.floor(have), Math.floor(qty));
  if (n <= 0) return { ok: false, reason: '在庫がありません', accepted: false, chance: 0 };
  const local = countryUnitPrice(state, country, resource);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return { ok: false, reason: '値段を入れてください', accepted: false, chance: 0 };
  const chance = pitchChance(local, unitPrice);
  if (rng() > chance) {
    // 断られた。しつこく高値を出すと、その国の相場観が下がる
    bumpPrice(tradeState(state), country, resource, -0.02);
    ctx.emit('warn', `${COUNTRY_MAP[country].name}に断られました（${Math.round(unitPrice).toLocaleString('ja-JP')}円/個は高いと言われた）`, { toast: true });
    return { ok: true, accepted: false, chance };
  }
  const c = COUNTRY_MAP[country];
  const tons = (RESOURCE_MAP[resource].weight ?? 0.01) * n;
  if (fleetIdle(state, mode) <= 0) return { ok: false, reason: fleetCount(state, mode) <= 0 ? `${SHIP_MODE_MAP[mode].name}を持っていません` : `${SHIP_MODE_MAP[mode].name}が全部出払っています`, accepted: false, chance };
  const use = canUseMode(mode, c.distanceKm, tons);
  if (!use.ok) return { ok: false, reason: use.reason, accepted: false, chance };
  const ts = tradeState(state);
  if (ts.shipments.length >= MAX_SHIPMENTS) return { ok: false, reason: `同時に運べるのは ${MAX_SHIPMENTS} 件までです`, accepted: false, chance };
  const freight = shipCost(mode, c.distanceKm, tons);
  const amount = Math.max(0, Math.ceil(unitPrice * n) - freight);
  state.inventory[resource] = have - n;
  state.stats.totalSold[resource] = (state.stats.totalSold[resource] ?? 0) + n;
  ts.freight = safe(ts.freight + freight);
  bumpPrice(ts, country, resource, -impact(resource, n));
  const ship: Shipment = {
    id: ts.nextId++, kind: 'export', country, resource, qty: n, mode,
    remaining: shipSeconds(mode, c.distanceKm), totalSeconds: shipSeconds(mode, c.distanceKm), amount, leg: 'out',
  };
  ts.shipments.push(ship);
  ctx.emit('success', `${c.name}が ${Math.round(unitPrice).toLocaleString('ja-JP')}円/個で買ってくれました`, { toast: true });
  return { ok: true, accepted: true, chance, shipment: ship };
}

/**
 * 売り込みが通る見込み。
 * 相場と同じ値段なら半々、2割安なら通りやすく、2割高ならほとんど通らない。
 */
export function pitchChance(localPrice: number, askPrice: number): number {
  if (localPrice <= 0) return 0;
  const ratio = askPrice / localPrice;
  // ratio 0.8 → 0.95、1.0 → 0.5、1.2 → 0.08
  const x = (1 - ratio) * 9;
  return Math.max(0.01, Math.min(0.97, 1 / (1 + Math.exp(-x))));
}

/** 時間を進める。荷を運び、相場と為替を動かし、商談を出し入れする */
export function runTrade(ctx: EngineContext, dt: number): void {
  const { state, rng } = ctx;
  // まだ海外と取引できないうちは、相場も商談も動かさない
  if (!state.trade && !isTradeUnlocked(state)) return;
  const ts = tradeState(state);

  // 荷を進める
  for (let i = ts.shipments.length - 1; i >= 0; i--) {
    const sh = ts.shipments[i];
    sh.remaining -= dt;
    if (sh.remaining > 0) continue;
    // 帰りの行程が終わった＝その乗り物が空いた
    if (sh.leg === 'back') {
      ts.shipments.splice(i, 1);
      continue;
    }
    // 行きが着いた。荷を降ろして、そのまま帰りに入る
    sh.leg = 'back';
    sh.remaining = sh.totalSeconds;
    const resource = sh.resource as ResourceId;
    if (sh.kind === 'import') {
      const added = addResource(state, resource, sh.qty, ctx.derived.capacity, 'produced');
      if (added < sh.qty - 0.001) {
        ctx.emit('warn', `${RESOURCE_MAP[resource]?.name ?? sh.resource} が届きましたが、倉庫が足りず ${Math.round(sh.qty - added).toLocaleString('ja-JP')} 入りませんでした`, { toast: true });
      } else {
        ctx.emit('success', `${RESOURCE_MAP[resource]?.name ?? sh.resource}${sh.qty.toLocaleString('ja-JP')} が届きました`, { toast: true });
      }
    } else {
      state.company.cash = safe(state.company.cash + sh.amount);
      state.company.totalEarned = safe(state.company.totalEarned + sh.amount);
      ts.earned = safe(ts.earned + sh.amount);
      ctx.emit('success', `${sh.company ?? COUNTRY_MAP[sh.country as CountryCode]?.name ?? ''}へ納品しました（+${Math.round(sh.amount).toLocaleString('ja-JP')}円）`, { toast: true });
    }
  }

  // 相場と為替が動く
  ts.nextDriftIn -= dt;
  let guard = 0;
  while (ts.nextDriftIn <= 0 && guard++ < 200) {
    ts.nextDriftIn += DRIFT_INTERVAL;
    for (const c of COUNTRIES) {
      const cur = clampFx(ts.fx[c.id] ?? 1);
      ts.fx[c.id] = clampFx(cur + (1 - cur) * 0.05 + (rng() - 0.5) * 0.05);
    }
    for (const k of Object.keys(ts.priceMult)) {
      const cur = clampPrice(ts.priceMult[k] ?? 1);
      ts.priceMult[k] = clampPrice(cur + (1 - cur) * 0.06 + (rng() - 0.5) * 0.08);
    }
  }

  // 商談の期限
  for (let i = ts.offers.length - 1; i >= 0; i--) {
    ts.offers[i].expiresIn -= dt;
    if (ts.offers[i].expiresIn <= 0) ts.offers.splice(i, 1);
  }

  // 新しい商談が届く
  ts.nextOfferIn -= dt;
  guard = 0;
  while (ts.nextOfferIn <= 0 && guard++ < 50) {
    ts.nextOfferIn += OFFER_INTERVAL;
    if (!ctx.offline() && ts.offers.length < MAX_OFFERS && isTradeUnlocked(state)) {
      const o = makeOffer(state, rng);
      if (o) {
        o.id = ts.nextId++;
        ts.offers.push(o);
      }
    }
  }
}

/**
 * 商談を1件作る。
 *
 * 話を持ってくるのは、**地図で見つけた実在の建物**だけ。
 * まだ誰とも会っていないうちは、話は来ない（地図へ出て営業するところから始まる）。
 * 架空の商社から都合よく声がかかることはない。
 *
 * 「買いたい」はこちらが持っている品から、「売りたい」はその会社らしい品から選ぶ。
 */
function makeOffer(state: GameState, rng: () => number): TradeOffer | null {
  const clients = Object.values(state.sales?.clients ?? {}).filter((c) => c && Number.isFinite(c.lat) && Number.isFinite(c.lon));
  if (clients.length === 0) return null;
  const client = clients[Math.min(clients.length - 1, Math.floor(rng() * clients.length))];
  const hq = hqLocation(state);
  const distanceKm = Math.max(5, distanceBetween(hq, { lat: client.lat, lon: client.lon }));
  const country = nearestCountry({ lat: client.lat, lon: client.lon });
  // 一度でも納めた相手なら、その縁で話が来る
  const repeat = (client.deliveries ?? 0) > 0;
  const pool = repeat ? REPEAT_REASONS : CONTACT_REASONS;
  const reason = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const base = {
    id: 0,
    company: client.name,
    place: client.regionLabel || '近所',
    lat: client.lat,
    lon: client.lon,
    distanceKm,
    country,
    reason,
    clientId: client.id,
    expiresIn: 120 + Math.floor(rng() * 150),
  };

  const wantBuy = rng() < 0.6;
  if (wantBuy) {
    const held = (Object.keys(state.inventory) as ResourceId[]).filter((r) => (state.inventory[r] ?? 0) >= 10 && RESOURCE_MAP[r]?.sellable);
    if (held.length === 0) return null;
    const resource = held[Math.min(held.length - 1, Math.floor(rng() * held.length))];
    const have = Math.floor(state.inventory[resource] ?? 0);
    const qty = Math.max(5, Math.floor(have * (0.2 + rng() * 0.5)));
    const local = countryUnitPrice(state, country, resource);
    // 向こうから来る話は、相場よりやや良い（1.0〜1.35倍）。付き合いが長いほど良くなる
    const bonus = repeat ? 0.1 : 0;
    const unitPrice = Math.ceil(local * (1 + bonus + rng() * 0.35));
    return { ...base, kind: 'buy', resource, qty, unitPrice, dueSeconds: 0 };
  }

  // その会社が扱っていそうな品（その国が得意なもの）を売り込んでくる
  const c = COUNTRY_MAP[country];
  const sellPool = c.strong.filter((r) => RESOURCE_MAP[r]);
  if (sellPool.length === 0) return null;
  const resource = sellPool[Math.min(sellPool.length - 1, Math.floor(rng() * sellPool.length))];
  const local = countryUnitPrice(state, country, resource);
  const unitPrice = Math.max(1, Math.floor(local * (0.7 + rng() * 0.3)));
  const qty = [20, 50, 100, 200, 500][Math.min(4, Math.floor(rng() * 5))];
  return { ...base, kind: 'sell', resource, qty, unitPrice };
}

/** その品を、いちばん安く買える国といちばん高く売れる国 */
export function bestMarkets(state: GameState, resource: ResourceId): { cheapest: CountryCode; dearest: CountryCode; low: number; high: number } {
  let cheapest: CountryCode = 'JP';
  let dearest: CountryCode = 'JP';
  let low = Infinity;
  let high = -Infinity;
  for (const c of COUNTRIES) {
    const p = countryUnitPrice(state, c.id, resource);
    if (p < low) { low = p; cheapest = c.id; }
    if (p > high) { high = p; dearest = c.id; }
  }
  return { cheapest, dearest, low, high };
}
