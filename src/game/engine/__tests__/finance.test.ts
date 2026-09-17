import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { GRACE_SECONDS, WAGE_PER_EMPLOYEE, debtLimit, wagePerSec } from '../systems/finance';

function makeEngine(cash = 0) {
  const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  return e;
}

describe('人件費', () => {
  it('従業員を雇うと毎秒お金がかかる', () => {
    const e = makeEngine(100_000);
    expect(wagePerSec(e.state)).toBe(0);
    e.buyFacility('worker_stone', 4);
    expect(wagePerSec(e.state)).toBeCloseTo(4 * WAGE_PER_EMPLOYEE, 6);
    const before = e.state.company.cash;
    e.tick(10);
    expect(before - e.state.company.cash).toBeGreaterThan(4 * WAGE_PER_EMPLOYEE * 10 - 1e-6);
  });

  it('止めている施設の人にも給料は出る', () => {
    const e = makeEngine(100_000);
    e.buyFacility('worker_stone', 2);
    const inst = e.state.facilities.find((f) => f.typeId === 'worker_stone')!;
    e.setFacilityEnabled(inst.id, false);
    expect(wagePerSec(e.state)).toBeCloseTo(2 * WAGE_PER_EMPLOYEE, 6);
  });
});

describe('赤字と倒産', () => {
  it('所持金がマイナスになると利息が付き、猶予のあいだは続けられる', () => {
    const e = makeEngine(100_000);
    e.buyFacility('worker_stone', 10);
    e.state.company.cash = -10_000;
    e.tick(60);
    expect(e.state.company.cash).toBeLessThan(-10_000);
    expect(e.state.company.debtSeconds).toBeGreaterThan(0);
    expect(e.state.prestige.count).toBe(0);
  });

  it('立て直せば猶予はリセットされる', () => {
    const e = makeEngine(100_000);
    e.buyFacility('worker_stone', 2);
    e.state.company.cash = -1000;
    e.tick(10);
    expect(e.state.company.debtSeconds).toBeGreaterThan(0);
    e.state.company.cash = 50_000;
    e.tick(1);
    expect(e.state.company.debtSeconds).toBe(0);
  });

  it('赤字が続くと倒産し、最初からになる', () => {
    const e = makeEngine(100_000);
    e.buyFacility('worker_stone', 3);
    e.state.company.cash = -1000;
    for (let i = 0; i < GRACE_SECONDS + 10; i++) e.tick(1);
    expect(e.state.facilities.length).toBe(0);
    expect(e.state.company.cash).toBeGreaterThanOrEqual(0);
    expect(e.state.stats.bankruptcies).toBe(1);
  });

  it('倒産しても永続ポイント・アップグレード・実績・会社名は残る', () => {
    const e = makeEngine(100_000);
    e.renameCompany('テスト商会');
    e.state.prestige.points = 30;
    e.buyPrestigeUpgrade('start_cash');
    e.state.achievements = { first_stone: 1 };
    const upgrades = { ...e.state.prestige.upgrades };
    e.buyFacility('worker_stone', 3);
    e.state.company.cash = -5_000_000_000;
    e.tick(1);
    expect(e.state.stats.bankruptcies).toBe(1);
    expect(e.state.prestige.points).toBe(30);
    expect(e.state.prestige.upgrades).toEqual(upgrades);
    expect(e.state.achievements.first_stone).toBe(1);
    expect(e.state.company.name).toBe('テスト商会');
    // 開業資金のアップグレードのぶんから再開できる
    expect(e.state.company.cash).toBeGreaterThan(0);
  });

  it('会社が大きいほど耐えられる借金も大きい', () => {
    expect(debtLimit(0)).toBe(2_000_000);
    expect(debtLimit(1_000_000_000)).toBeGreaterThan(debtLimit(1_000_000));
  });
});
