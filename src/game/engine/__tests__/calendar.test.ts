/**
 * ゲームの中の暦の見張り。
 *
 * 日付がずれる・季節がおかしい・早送りの速さを変えたら過去が変わる、
 * といったことが起きると、給料日も決算も全部おかしくなる。
 */
import { describe, expect, it } from 'vitest';
import { EPOCH, SECONDS_PER_DAY, SEASONS, dateFromDays, formatGameDate, seasonOf, secondsPerDay } from '@/game/data/calendar';
import { GameEngine } from '../GameEngine';
import { dayLength, gameDate } from '../systems/calendar';

function started(): GameEngine {
  const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
  e.updateSettings({ themeChosen: true, nameChosen: true, hqChosen: true, events: false });
  e.keepDefaultHq();
  e.refreshDerived();
  return e;
}

describe('日付の計算', () => {
  it('0日目は会社を興した日', () => {
    const d = dateFromDays(0);
    expect(d.year).toBe(EPOCH.year);
    expect(d.month).toBe(EPOCH.month);
    expect(d.day).toBe(EPOCH.day);
  });

  it('1日ずつ足していくと、月末で正しく繰り上がる', () => {
    // 2025/4/1 から29日進めると 4/30
    expect(formatGameDate(dateFromDays(29))).toContain('4月30日');
    // 30日で 5/1
    expect(formatGameDate(dateFromDays(30))).toContain('5月1日');
  });

  it('1年（365日）進めると、ちょうど1年後の同じ日', () => {
    const d = dateFromDays(365);
    expect(d.year).toBe(EPOCH.year + 1);
    expect(d.month).toBe(EPOCH.month);
    expect(d.day).toBe(EPOCH.day);
  });

  it('うるう年をまたいでもずれない', () => {
    // 2025/4/1 → 2028/2/29 は 1064日後（2028年はうるう年）
    const target = dateFromDays(1064);
    expect(`${target.year}/${target.month}/${target.day}`).toBe('2028/2/29');
  });

  it('曜日が一周する', () => {
    const a = dateFromDays(0);
    const b = dateFromDays(7);
    expect(b.weekday).toBe(a.weekday);
    expect(a.weekdayLabel).toBe('火'); // 2025年4月1日は火曜日
  });

  it('何万日進めても落ちない', () => {
    const d = dateFromDays(50_000);
    expect(Number.isFinite(d.year)).toBe(true);
    expect(d.month).toBeGreaterThanOrEqual(1);
    expect(d.month).toBeLessThanOrEqual(12);
    expect(d.day).toBeGreaterThanOrEqual(1);
    expect(d.day).toBeLessThanOrEqual(31);
  });
});

describe('季節', () => {
  it('12ヵ月すべてが、どれかの季節に入る', () => {
    for (let m = 1; m <= 12; m++) {
      const s = seasonOf(m);
      expect(SEASONS[s].months).toContain(m);
    }
  });

  it('季節の絵が4つそろっている', () => {
    const arts = new Set(Object.values(SEASONS).map((s) => s.art));
    expect(arts.size).toBe(4);
  });
});

describe('早送り', () => {
  it('速さは1つに決まっている（途中で変えられない）', () => {
    expect(secondsPerDay()).toBe(SECONDS_PER_DAY);
    // 1日＝1分。1時間で約2か月ぶん進む
    expect(SECONDS_PER_DAY).toBe(60);
    expect((3600 / SECONDS_PER_DAY) / 30).toBeCloseTo(2, 1);
  });

  it('決めた速さのぶんだけ日付が進む', () => {
    const e = started();
    expect(dayLength(e.state)).toBe(SECONDS_PER_DAY);
    e.advance(SECONDS_PER_DAY * 10);
    expect(gameDate(e.state).elapsedDays).toBe(10);
  });

  it('離れているあいだに進めても、同じ速さで数える', () => {
    const a = started();
    const b = started();
    // 1秒ずつ600回進めても、まとめて600秒進めても、同じ日数になる
    for (let i = 0; i < 600; i++) a.tick(1);
    b.advance(600);
    expect(gameDate(a.state).elapsedDays).toBe(gameDate(b.state).elapsedDays);
  });

  it('会社を始めるまでは時間が進まない', () => {
    const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
    e.updateSettings({ events: false });
    e.advance(5_000);
    expect(gameDate(e.state).elapsedDays).toBe(0);
  });

  it('季節が変わると知らせる', () => {
    const e = started();
    const before = e.state.eventLog.length;
    // 4月から6月へ（約70日）
    e.advance(SECONDS_PER_DAY * 70);
    const msgs = e.state.eventLog.slice(before).map((x) => x.message);
    expect(msgs.some((m) => m.includes('夏になりました'))).toBe(true);
  });
});
