/**
 * トレーディングカード。パックを開ける・売る・買う・集める。
 *
 * 相場はカードごとに動く。売れば下がり、買い占めれば上がる。
 * 「熱」（はやり）が全体に掛かるので、はやっているときに売るほど高い。
 * どのパックも、出るカードの値打ちの見込みは値段より小さい（＝開け続けると減る）。
 */
import {
  CARD_BUY_SPREAD,
  CARD_HYPE_MAX,
  CARD_HYPE_MIN,
  CARD_LIQUIDATION,
  CARD_MAP,
  CARD_PRICE_MAX,
  CARD_PRICE_MIN,
  CARDS,
  CARD_SERIES,
  PACK_MAP,
  RARITY_MAP,
  RARITY_ORDER,
  betterRarity,
  cardsOf,
  type CardDef,
  type CardRarity,
  type PackDef,
} from '@/game/data/cards';
import type { CardState, GameState } from '@/types/state';
import type { EngineContext } from '../context';
import { safe } from '@/utils/numbers';

export function createInitialCards(): CardState {
  return { owned: {}, price: {}, hype: 1, nextDriftIn: 45, packsOpened: 0, spent: 0, earned: 0, claimed: {}, bestPull: '' };
}

export function cardState(state: GameState): CardState {
  if (!state.cards) state.cards = createInitialCards();
  return state.cards;
}

export function isCardsUnlocked(state: GameState): boolean {
  return state.research.completed.card_market === true;
}

/** そのカードのいまの値段（円） */
export function cardPrice(state: GameState, id: string): number {
  const def = CARD_MAP[id];
  if (!def) return 0;
  const cs = cardState(state);
  const mult = cs.price[id] ?? 1;
  return Math.max(1, Math.round(def.basePrice * mult * cs.hype));
}

/** 買うときの値段（売値より高い） */
export function cardBuyPrice(state: GameState, id: string): number {
  return Math.ceil(cardPrice(state, id) * CARD_BUY_SPREAD);
}

/** 持っているカード全部の値打ち */
export function collectionValue(state: GameState): number {
  const cs = cardState(state);
  let v = 0;
  for (const [id, n] of Object.entries(cs.owned)) v += cardPrice(state, id) * (n ?? 0);
  return v;
}

export interface SeriesProgress {
  id: string;
  name: string;
  have: number;
  total: number;
  complete: boolean;
  claimed: boolean;
  reward: number;
}

/** 図鑑の埋まり具合 */
export function seriesProgress(state: GameState): SeriesProgress[] {
  const cs = cardState(state);
  return CARD_SERIES.map((s) => {
    const list = cardsOf(s.id);
    const have = list.filter((c) => (cs.owned[c.id] ?? 0) > 0).length;
    return {
      id: s.id,
      name: s.name,
      have,
      total: list.length,
      complete: have >= list.length,
      claimed: cs.claimed[s.id] === true,
      reward: s.reward,
    };
  });
}

/** 図鑑がそろった見返りを受け取る */
export function claimSeries(ctx: EngineContext, seriesId: string): { ok: boolean; reason?: string; reward: number } {
  const { state } = ctx;
  const p = seriesProgress(state).find((s) => s.id === seriesId);
  if (!p) return { ok: false, reason: 'その弾はありません', reward: 0 };
  if (!p.complete) return { ok: false, reason: 'まだそろっていません', reward: 0 };
  if (p.claimed) return { ok: false, reason: 'もう受け取っています', reward: 0 };
  cardState(state).claimed[seriesId] = true;
  state.research.points = safe(state.research.points + p.reward);
  state.research.totalPoints = safe(state.research.totalPoints + p.reward);
  ctx.emit('success', `図鑑「${p.name}」がそろいました！ 研究ポイント +${p.reward.toLocaleString('ja-JP')}`, { toast: true });
  return { ok: true, reward: p.reward };
}

/**
 * パックの中身の見込み（1パックあたり、出るカードを売ったときの手取りの見込み）。
 *
 * カードごとの相場は買い占めで吊り上げられるので、そこは 1 を上限として見る
 * （吊り上げた値段で「開けると得」と表示されてしまうのを防ぐ）。
 * さらに、出たカードを売ると相場が下がるぶんを割り引く。
 */
export function packValue(state: GameState, def: PackDef): number {
  const cs = cardState(state);
  const hype = Math.max(CARD_HYPE_MIN, Math.min(CARD_HYPE_MAX, cs.hype));
  let v = 0;
  for (const rarity of RARITY_ORDER) {
    const rate = def.rates[rarity] ?? 0;
    if (rate <= 0) continue;
    const pool = poolFor(def, rarity);
    if (pool.length === 0) continue;
    const avg =
      pool.reduce((a, c) => a + c.basePrice * Math.min(1, cs.price[c.id] ?? 1) * hype, 0) / pool.length;
    v += rate * avg;
  }
  return v * def.cards * CARD_LIQUIDATION;
}

/** そのパックから出うるカード */
function poolFor(def: PackDef, rarity: CardRarity): CardDef[] {
  return CARDS.filter((c) => c.rarity === rarity && (!def.series || def.series.includes(c.series)));
}

/**
 * レア度をひとつ引く。出ないレア度（確率0）には絶対に当たらない。
 * 良いほうから順に足していくので、確率の合計が1に満たなくても
 * あふれた分はいちばん弱いレア度に落ちる（得な方向へはずれない）。
 */
function rollRarity(def: PackDef, r: number): CardRarity {
  let acc = 0;
  const order = [...RARITY_ORDER].reverse();
  let lowest: CardRarity = 'n';
  for (const id of order) {
    const rate = def.rates[id] ?? 0;
    if (rate <= 0) continue;
    lowest = id;
    acc += rate;
    if (r < acc) return id;
  }
  return lowest;
}

export interface PullResult {
  ok: boolean;
  reason?: string;
  /** 出たカード（出た順） */
  cards: string[];
  cost: number;
  /** 出たものの値打ちの合計 */
  value: number;
  /** いちばん良かったレア度 */
  best: CardRarity;
}

/** パックを開ける */
export function openPack(ctx: EngineContext, packId: string, count = 1): PullResult {
  const { state, rng } = ctx;
  const def = PACK_MAP[packId];
  if (!def) return { ok: false, reason: 'そのパックはありません', cards: [], cost: 0, value: 0, best: 'n' };
  if (!isCardsUnlocked(state)) return { ok: false, reason: '研究「カード相場」がまだです', cards: [], cost: 0, value: 0, best: 'n' };
  const n = Math.max(1, Math.floor(count));
  const cost = def.cost * n;
  if (state.company.cash + 1e-9 < cost) return { ok: false, reason: '所持金が足りません', cards: [], cost: 0, value: 0, best: 'n' };
  state.company.cash = safe(state.company.cash - cost);
  state.company.totalSpent = safe(state.company.totalSpent + cost);
  const cs = cardState(state);
  cs.spent = safe(cs.spent + cost);
  cs.packsOpened += n;

  const out: string[] = [];
  let best: CardRarity | '' = '';
  for (let i = 0; i < def.cards * n; i++) {
    const rarity = rollRarity(def, rng());
    let pool = poolFor(def, rarity);
    // 万一そのレア度の絵柄が1枚も無いパックでも、必ず1枚は出す
    if (pool.length === 0) pool = poolFor(def, 'n');
    if (pool.length === 0) pool = CARDS.filter((c) => !def.series || def.series.includes(c.series));
    if (pool.length === 0) continue;
    const c = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
    out.push(c.id);
    cs.owned[c.id] = (cs.owned[c.id] ?? 0) + 1;
    // 実際に引けたカードのレア度で数える（プールが空で差し替わったときもずれない）
    if (best === '' || betterRarity(c.rarity, best)) best = c.rarity;
    // 出回った分だけ、そのカードの相場は少し下がる
    bump(cs, c.id, -0.012 * RARITY_MAP[c.rarity].priceMult ** 0.25);
  }
  const value = out.reduce((a, id) => a + cardPrice(state, id), 0);
  const top: CardRarity = best === '' ? 'n' : best;
  // SSR より上が出たときだけ知らせる（N や R でいちいち鳴らない）
  if (best !== '' && betterRarity(best, 'sr')) {
    cs.bestPull = out.find((id) => CARD_MAP[id]?.rarity === best) ?? cs.bestPull;
    const name = CARD_MAP[cs.bestPull ?? '']?.name ?? '';
    ctx.emit('success', `${RARITY_MAP[best].name}「${name}」が出ました！`, { toast: true });
  }
  return { ok: true, cards: out, cost, value, best: top };
}

/** 相場を動かす（0.25〜6 のあいだ） */
function bump(cs: CardState, id: string, delta: number): void {
  const cur = cs.price[id] ?? 1;
  cs.price[id] = Math.max(CARD_PRICE_MIN, Math.min(CARD_PRICE_MAX, cur * (1 + delta)));
}

/** カードを売る */
export function sellCard(ctx: EngineContext, id: string, count: number): { ok: boolean; reason?: string; sold: number; revenue: number } {
  const { state } = ctx;
  const def = CARD_MAP[id];
  if (!def) return { ok: false, reason: 'そのカードはありません', sold: 0, revenue: 0 };
  const cs = cardState(state);
  const have = cs.owned[id] ?? 0;
  const n = Math.min(have, Math.max(1, Math.floor(count)));
  if (n <= 0) return { ok: false, reason: '持っていません', sold: 0, revenue: 0 };
  let revenue = 0;
  for (let i = 0; i < n; i++) {
    revenue += cardPrice(state, id);
    bump(cs, id, -0.035);
  }
  cs.owned[id] = have - n;
  if (cs.owned[id] <= 0) delete cs.owned[id];
  state.company.cash = safe(state.company.cash + revenue);
  state.company.totalEarned = safe(state.company.totalEarned + revenue);
  cs.earned = safe(cs.earned + revenue);
  ctx.emit('info', `「${def.name}」を${n}枚 売りました (+${Math.round(revenue).toLocaleString('ja-JP')}円)`);
  return { ok: true, sold: n, revenue };
}

/** カードを買う（売値より高い。買い占めると相場が上がる） */
export function buyCard(ctx: EngineContext, id: string, count: number): { ok: boolean; reason?: string; bought: number; cost: number } {
  const { state } = ctx;
  const def = CARD_MAP[id];
  if (!def) return { ok: false, reason: 'そのカードはありません', bought: 0, cost: 0 };
  if (!isCardsUnlocked(state)) return { ok: false, reason: '研究「カード相場」がまだです', bought: 0, cost: 0 };
  const cs = cardState(state);
  const n = Math.max(1, Math.floor(count));
  let cost = 0;
  let bought = 0;
  for (let i = 0; i < n; i++) {
    const price = cardBuyPrice(state, id);
    if (state.company.cash < cost + price) break;
    cost += price;
    bought++;
    bump(cs, id, 0.04);
  }
  if (bought <= 0) return { ok: false, reason: '所持金が足りません', bought: 0, cost: 0 };
  state.company.cash = safe(state.company.cash - cost);
  state.company.totalSpent = safe(state.company.totalSpent + cost);
  cs.spent = safe(cs.spent + cost);
  cs.owned[id] = (cs.owned[id] ?? 0) + bought;
  ctx.emit('info', `「${def.name}」を${bought}枚 買いました (-${cost.toLocaleString('ja-JP')}円)`);
  return { ok: true, bought, cost };
}

/** 相場がゆっくり動く。売られていないカードは値を戻していく */
export function runCards(ctx: EngineContext, dt: number): void {
  const { state, rng } = ctx;
  if (!state.cards) return;
  const cs = state.cards;
  cs.nextDriftIn -= dt;
  let steps = 0;
  while (cs.nextDriftIn <= 0 && steps < 200) {
    cs.nextDriftIn += 45;
    steps++;
    // はやりの上下（0.5〜2.4）
    cs.hype = Math.max(CARD_HYPE_MIN, Math.min(CARD_HYPE_MAX, cs.hype + (1 - cs.hype) * 0.06 + (rng() - 0.5) * 0.14));
    for (const id of Object.keys(cs.price)) {
      const cur = cs.price[id] ?? 1;
      const next = cur + (1 - cur) * 0.05 + (rng() - 0.5) * 0.06;
      cs.price[id] = Math.max(CARD_PRICE_MIN, Math.min(CARD_PRICE_MAX, next));
    }
  }
}
