/**
 * ゲームの中の暦を進める。
 *
 * 現実の秒数を、設定した早送りの速さでゲームの日数に直して積んでいく。
 * 月が変わったとき・季節が変わったときだけ知らせる（毎日知らせると通知が埋まる）。
 */
import { SEASONS, dateFromDays, formatGameDate, seasonOf, secondsPerDay } from '@/game/data/calendar';
import type { GameDate } from '@/game/data/calendar';
import type { GameState } from '@/types/state';
import type { EngineContext } from '../context';
import { hasStarted } from '../hq';

export function createInitialCalendar(): NonNullable<GameState['calendar']> {
  return { elapsedDays: 0, lastMonth: 4, lastSeason: 'spring' };
}

/** いまのゲーム内の日付 */
export function gameDate(state: GameState): GameDate {
  return dateFromDays(state.calendar?.elapsedDays ?? 0);
}

/** ゲームの中の1日が、現実の何秒にあたるか（固定） */
export function dayLength(_state?: GameState): number {
  return secondsPerDay();
}

/** ゲーム内の日数を、現実の秒数に直す（納期の表示などに使う） */
export function daysToSeconds(state: GameState, days: number): number {
  return days * dayLength(state);
}

export function runCalendar(ctx: EngineContext, dt: number): void {
  const { state } = ctx;
  // 会社を始めるまでは時間を進めない（最初の選択をしている間に日付が進むのは変）
  if (!hasStarted(state)) return;
  if (!state.calendar) state.calendar = createInitialCalendar();
  const cal = state.calendar;
  const before = dateFromDays(cal.elapsedDays);
  cal.elapsedDays += dt / dayLength(state);
  const now = dateFromDays(cal.elapsedDays);
  if (now.month === before.month && now.year === before.year) return;

  // 月が変わった
  cal.lastMonth = now.month;
  const season = seasonOf(now.month);
  if (season !== cal.lastSeason) {
    cal.lastSeason = season;
    ctx.emit('event', `${SEASONS[season].label}になりました。${SEASONS[season].note}`, { toast: true });
    return;
  }
  // 年が変わったときは、そこも知らせる
  if (now.year !== before.year) {
    ctx.emit('event', `${now.year}年になりました（${formatGameDate(now)}）`, { toast: true });
  }
}
