/**
 * 「刻み方を変えても結果が変わらない」ことを見張るテスト。
 *
 * ゲームはオンラインでは1秒ずつ、タブ復帰やオフラインではまとめて（最大60秒ずつ）進む。
 * ここがずれると「放置すると損をする／得をする」という理不尽が起きるので、
 * 自動化をいちばん壊れやすいところとして押さえておく。
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';

function seeded(seed = 20260918) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function withGather(level: number) {
  const e = new GameEngine({ rng: seeded(), now: () => 1_000_000 });
  e.keepDefaultHq();
  e.updateSettings({ events: false });
  e.debugAddCash(500_000_000);
  e.debugUnlockAll();
  e.buyFacility('small_warehouse', 5);
  e.buyFacility('large_warehouse', 3);
  e.state.prestige.points = 500;
  for (let i = 0; i < level; i++) e.buyPrestigeUpgrade('auto_gather');
  e.refreshDerived();
  return e;
}

function withBuild(level: number) {
  const e = new GameEngine({ rng: seeded(7), now: () => 1_000_000 });
  e.keepDefaultHq();
  e.updateSettings({ events: false });
  e.debugUnlockAll();
  e.debugAddCash(1e15);
  e.buyFacility('worker_stone', 3);
  e.state.prestige.points = 500;
  for (let i = 0; i < level; i++) e.buyPrestigeUpgrade('auto_build');
  e.refreshDerived();
  return e;
}

const facilityTotal = (e: GameEngine) => e.state.facilities.reduce((a, f) => a + f.count, 0);

describe('自動採集は刻み方で損をしない', () => {
  for (const level of [1, 3, 5]) {
    it(`段階${level}: 1秒刻みとまとめ進行で同じだけ採れる`, () => {
      const fine = withGather(level);
      for (let i = 0; i < 3600; i++) fine.tick(1);
      const coarse = withGather(level);
      for (let i = 0; i < 60; i++) coarse.tick(60);
      const offline = withGather(level);
      offline.applyOffline(3600, 3600);
      // 倉庫の都合で最後の数回が入らないことはあるので、1%の幅を許す
      expect(coarse.state.stats.taps).toBeGreaterThan(fine.state.stats.taps * 0.99);
      expect(offline.state.stats.taps).toBeGreaterThan(fine.state.stats.taps * 0.99);
    });
  }

  it('段階を上げるほど、まとめ進行でもちゃんと速くなる', () => {
    const one = withGather(1);
    const five = withGather(5);
    for (let i = 0; i < 60; i++) one.tick(60);
    for (let i = 0; i < 60; i++) five.tick(60);
    expect(five.state.stats.taps).toBeGreaterThan(one.state.stats.taps * 4);
  });
});

describe('自動クラフトは刻み方で損をしない', () => {
  const make = () => {
    const e = new GameEngine({ rng: seeded(11), now: () => 1_000_000 });
    e.keepDefaultHq();
    e.updateSettings({ events: false });
    e.debugUnlockAll();
    e.debugAddCash(500_000_000);
    e.buyFacility('small_warehouse', 8);
    e.state.prestige.points = 500;
    e.buyPrestigeUpgrade('auto_craft');
    e.toggleAutoRecipe('smelt_scrap');
    e.refreshDerived();
    return e;
  };
  const run = (e: GameEngine, dt: number, total: number) => {
    let made = 0;
    for (let t = 0; t < total; t += dt) {
      e.state.inventory.scrap_metal = 100_000;
      e.state.inventory.wood = 100_000;
      const before = e.state.inventory.iron ?? 0;
      e.tick(dt);
      made += (e.state.inventory.iron ?? 0) - before;
      e.state.inventory.iron = 0;
    }
    return made;
  };

  it('1秒刻みと60秒刻みで、作れる数がほぼ同じ', () => {
    const fine = run(make(), 1, 7200);
    const coarse = run(make(), 60, 7200);
    expect(fine).toBeGreaterThan(0);
    expect(coarse).toBeGreaterThan(fine * 0.98);
  });
});

describe('自動増設は刻み方で頻度が落ちない', () => {
  it('段階3: 1秒刻み・10秒刻み・60秒刻みで増設数がほぼ同じ', () => {
    const counts = [1, 10, 60].map((dt) => {
      const e = withBuild(3);
      const before = facilityTotal(e);
      for (let t = 0; t < 3600; t += dt) {
        e.state.company.cash = 1e15;
        e.tick(dt);
      }
      return facilityTotal(e) - before;
    });
    expect(counts[0]).toBeGreaterThan(0);
    for (const c of counts) expect(c).toBeGreaterThan(counts[0] * 0.9);
  });
});

describe('おかしな時間を渡しても壊れない', () => {
  it('NaN や Infinity では何もしない', () => {
    const e = withGather(1);
    const before = { cash: e.state.company.cash, play: e.state.stats.playtimeSeconds };
    e.tick(NaN);
    e.tick(Infinity);
    e.tick(-5);
    e.advance(NaN);
    e.advance(-1);
    e.applyOffline(NaN);
    expect(e.state.company.cash).toBe(before.cash);
    expect(e.state.stats.playtimeSeconds).toBe(before.play);
    e.tick(1);
    expect(Number.isFinite(e.state.company.cash)).toBe(true);
    expect(Number.isFinite(e.derived.assets)).toBe(true);
  });
});

describe('自動化の時計は溜まり続けない', () => {
  it('8時間まとめて進めても、どの時計も間隔の中に収まる', () => {
    const e = new GameEngine({ rng: seeded(3), now: () => 1_000_000 });
    e.keepDefaultHq();
    e.updateSettings({ events: false });
    e.debugUnlockAll();
    e.debugAddCash(1e12);
    e.state.prestige.points = 500;
    for (const id of ['auto_gather', 'auto_craft', 'auto_survey', 'auto_pitch', 'auto_build']) {
      for (let i = 0; i < 5; i++) e.buyPrestigeUpgrade(id);
    }
    e.refreshDerived();
    e.advance(8 * 3600);
    const t = e.state.automation.timers;
    expect(t.survey ?? 0).toBeLessThan(5);
    expect(t.pitch ?? 0).toBeLessThan(10);
    expect(t.build ?? 0).toBeLessThan(60);
    expect(t.gather ?? 0).toBeLessThanOrEqual(360);
    expect(t.craft ?? 0).toBeLessThanOrEqual(120);
  });
});
