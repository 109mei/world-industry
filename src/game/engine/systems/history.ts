/**
 * グラフ用の記録。一定の間隔で「総資産・収支・従業員数」を積んでいく。
 * 画面で推移を見せるためだけのもので、ゲームの計算には使わない。
 */
import type { GameState, HistoryState } from '@/types/state';
import type { EngineContext } from '../context';
import { safe } from '@/utils/numbers';

/** 何秒ごとに1点 記録するか */
export const SAMPLE_SECONDS = 10;
/** 何点まで残すか（10秒 × 180 = 30分ぶん） */
export const MAX_POINTS = 180;

export function historyState(state: GameState): HistoryState {
  if (!state.history) state.history = { assets: [], income: [], employees: [], nextIn: 0 };
  return state.history;
}

function push(arr: number[], v: number): void {
  arr.push(safe(v));
  if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
}

export function runHistory(ctx: EngineContext, dt: number): void {
  const { state, derived } = ctx;
  const h = historyState(state);
  h.nextIn -= dt;
  if (h.nextIn > 0) return;
  h.nextIn = SAMPLE_SECONDS;
  push(h.assets, derived.assets);
  push(h.income, derived.incomePerSec);
  push(h.employees, derived.employees);
}
