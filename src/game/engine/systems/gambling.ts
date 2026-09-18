/**
 * 賭け事。自分で遊ぶ側（スロット・ルーレット・カード・パチンコ・宝くじ）。
 *
 * どれも胴元がわずかに有利で、長く遊べば必ず減る。
 * 画面には期待値をそのまま出していて、「増やす手段」ではなく「遊び」として置いている。
 * 本気で稼ぐなら、カジノを建てて開く側に回るほうが早い。
 */
import { GAME_MAP, LOTTERY, expectedReturn, type GameId } from '@/game/data/gambling';
import type { GameState, LotteryState } from '@/types/state';
import type { EngineContext } from '../context';
import { safe } from '@/utils/numbers';

export interface PlayResult {
  ok: boolean;
  reason?: string;
  /** 賭けた額 */
  bet: number;
  /** 返ってきた額 */
  payout: number;
  label: string;
}

/**
 * 1回の賭け金（総資産に応じて上がる）。
 * 所持金の5%を超える賭けはできない。5%が最低額に届かないときは、そもそも遊べない（0 を返す）。
 */
export function betSize(state: GameState, assets: number, gameId: GameId): number {
  const def = GAME_MAP[gameId];
  const scaled = Math.round(def.baseBet * Math.max(1, Math.pow(Math.max(1, assets) / 1_000_000, 0.45)));
  const cap = Math.floor(Math.max(0, state.company.cash) * 0.05);
  if (cap < def.baseBet) return 0;
  return Math.min(Math.max(def.baseBet, scaled), cap);
}

/** 遊ぶ。結果を返す */
export function play(ctx: EngineContext, gameId: GameId): PlayResult {
  const { state, derived, rng } = ctx;
  const def = GAME_MAP[gameId];
  if (!def) return { ok: false, reason: 'その遊びはありません', bet: 0, payout: 0, label: '' };
  if (!state.research.completed.gaming_license) return { ok: false, reason: '研究「遊技場の許可」がまだです', bet: 0, payout: 0, label: '' };
  const bet = betSize(state, derived.assets, gameId);
  if (bet <= 0 || state.company.cash < bet) return { ok: false, reason: `所持金が足りません（1回の賭け金は所持金の5%までで、最低 ${def.baseBet.toLocaleString('ja-JP')}円）`, bet: 0, payout: 0, label: '' };

  state.company.cash = safe(state.company.cash - bet);
  state.company.totalSpent = safe(state.company.totalSpent + bet);
  let r = rng();
  let chosen = def.outcomes[def.outcomes.length - 1];
  for (const o of def.outcomes) {
    r -= o.p;
    if (r <= 0) {
      chosen = o;
      break;
    }
  }
  const payout = Math.round(bet * chosen.payout);
  if (payout > 0) {
    state.company.cash = safe(state.company.cash + payout);
    state.company.totalEarned = safe(state.company.totalEarned + payout);
  }
  const stats = state.stats;
  stats.gambleBet = safe((stats.gambleBet ?? 0) + bet);
  stats.gambleWon = safe((stats.gambleWon ?? 0) + payout);
  if (chosen.payout >= 50) {
    ctx.emit('success', `${def.name}で${chosen.label}！ +${payout.toLocaleString('ja-JP')}円`, { toast: true });
  }
  return { ok: true, bet, payout, label: chosen.label };
}

// ---------- 宝くじ ----------

export function createInitialLottery(): LotteryState {
  return { jackpot: LOTTERY.baseJackpot, nextDrawIn: LOTTERY.intervalSec, tickets: 0, draws: 0, won: 0, lastMessage: '' };
}

export function lotteryState(state: GameState): LotteryState {
  if (!state.lottery) state.lottery = createInitialLottery();
  return state.lottery;
}

/** 当たる確率（買った枚数 ÷ 全体の枚数） */
export function winChance(tickets: number): number {
  return tickets / (tickets + LOTTERY.publicTickets);
}

/** いま買っている枚数での期待値（賭けた額に対して返ってくる割合） */
export function lotteryReturn(state: GameState): number {
  const l = lotteryState(state);
  if (l.tickets <= 0) return 0;
  const spent = l.tickets * LOTTERY.ticketPrice;
  return (winChance(l.tickets) * l.jackpot) / spent;
}

/** 宝くじを買う */
export function buyTickets(ctx: EngineContext, count: number): { ok: boolean; reason?: string; bought: number } {
  const { state } = ctx;
  if (!state.research.completed.gaming_license) return { ok: false, reason: '研究「遊技場の許可」がまだです', bought: 0 };
  const l = lotteryState(state);
  const room = LOTTERY.maxPerDraw - l.tickets;
  if (room <= 0) return { ok: false, reason: 'この回はもう買えません', bought: 0 };
  const affordable = Math.floor(state.company.cash / LOTTERY.ticketPrice);
  const n = Math.max(0, Math.min(Math.floor(count), room, affordable));
  if (n <= 0) return { ok: false, reason: '所持金が足りません', bought: 0 };
  const cost = n * LOTTERY.ticketPrice;
  state.company.cash = safe(state.company.cash - cost);
  state.company.totalSpent = safe(state.company.totalSpent + cost);
  l.tickets += n;
  // 売上の一部が賞金に積まれる（買い占めるほど賞金も増えるが、増えるのは一部だけ）
  l.jackpot = Math.min(LOTTERY.maxJackpot, safe(l.jackpot + cost * LOTTERY.payoutRatio));
  state.stats.gambleBet = safe((state.stats.gambleBet ?? 0) + cost);
  return { ok: true, bought: n };
}

/** 毎 tick: 抽選の時間を進める */
export function runLottery(ctx: EngineContext, dt: number): void {
  const { state, rng } = ctx;
  if (!state.lottery && !state.research.completed.gaming_license) return;
  const l = lotteryState(state);
  l.nextDrawIn -= dt;
  if (l.nextDrawIn > 0) return;
  l.nextDrawIn = LOTTERY.intervalSec;
  l.draws += 1;
  if (l.tickets <= 0) {
    // 誰も（＝自分は）買っていない回。賞金は次に持ち越す
    l.jackpot = Math.min(LOTTERY.maxJackpot, safe(l.jackpot * 1.05));
    l.lastMessage = '買っていないので、賞金は次回に持ち越しです';
    return;
  }
  const chance = winChance(l.tickets);
  const hit = rng() < chance;
  const spent = l.tickets * LOTTERY.ticketPrice;
  if (hit) {
    const prize = Math.round(l.jackpot);
    state.company.cash = safe(state.company.cash + prize);
    state.company.totalEarned = safe(state.company.totalEarned + prize);
    state.stats.gambleWon = safe((state.stats.gambleWon ?? 0) + prize);
    l.won += 1;
    l.jackpot = LOTTERY.baseJackpot;
    l.lastMessage = `当選！ ${prize.toLocaleString('ja-JP')}円（${l.tickets.toLocaleString('ja-JP')}枚・確率 ${(chance * 100).toFixed(2)}%）`;
    ctx.emit('success', `宝くじが当たりました！ +${prize.toLocaleString('ja-JP')}円`, { toast: true });
  } else {
    // はずれ。賞金は次回に持ち越して大きくなる
    l.jackpot = Math.min(LOTTERY.maxJackpot, safe(l.jackpot * 1.08));
    l.lastMessage = `はずれ（${l.tickets.toLocaleString('ja-JP')}枚・確率 ${(chance * 100).toFixed(2)}%）。賞金は次回に持ち越し`;
    ctx.emit('info', `宝くじははずれでした（${spent.toLocaleString('ja-JP')}円）。賞金が次回に積み上がりました`);
  }
  l.tickets = 0;
}

export { expectedReturn };
