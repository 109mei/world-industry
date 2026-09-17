import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { COMPANIES } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { creditRankOf } from '@/game/data/contracts';
import { GAME_META } from '@/game/data/meta';
import { PROPERTIES } from '@/game/data/properties';
import { diagnoseFacility } from '../analysis/diagnose';
import { rankInvestments } from '../analysis/roi';
import { createInitialState } from '../state/createInitialState';
import { migrateSave } from '../state/migrations';
import { createContract, isContractsUnlocked } from '../systems/contracts';
import { propertyOwner } from '../systems/estate';
import { prestigePoints } from '../systems/prestige';
import { ownershipOf, sharesOf } from '../systems/stocks';

function seeded(seed = 11): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeEngine(cash = 0, seed = 11) {
  const e = new GameEngine({ rng: seeded(seed), now: () => 2_000_000 });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  return e;
}


describe('注文と信用', () => {
  it('累計売上で解放され、納品すると報酬と信用が入る', () => {
    const e = makeEngine(0);
    e.state.tutorial.completed = true;
    expect(isContractsUnlocked(e.state)).toBe(false);
    e.state.company.totalEarned = 10_000;
    e.state.stats.totalObtained['stone'] = 500;
    e.tick(0.2);
    expect(isContractsUnlocked(e.state)).toBe(true);
    const c = createContract({ state: e.state, derived: e.derived, rng: seeded(), now: () => 0, emit: () => ({ id: 0, time: 0, type: 'info', message: '' }), offline: () => false })!;
    expect(c).not.toBeNull();
    expect(c.amount).toBeGreaterThan(0);
    expect(c.reward).toBeGreaterThan(0);
    e.state.contracts.active.push(c);
    e.debugAddResource(c.resource, Math.min(100, c.amount));
    e.derived.capacity = 1_000_000;
    e.state.inventory[c.resource] = c.amount;
    const cash = e.state.company.cash;
    expect(e.deliverContract(c.id)).toBe(c.amount);
    expect(e.state.company.cash).toBeCloseTo(cash + c.reward, 3);
    expect(e.state.contracts.credit).toBe(c.credit);
    expect(e.state.stats.contractsCompleted).toBe(1);
    expect(e.state.contracts.active.length).toBe(0);
  });

  it('期限切れで信用が下がり、時間で注文が湧く', () => {
    const e = makeEngine(0);
    e.state.tutorial.completed = true;
    e.state.company.totalEarned = 10_000;
    e.state.stats.totalObtained['stone'] = 500;
    e.state.contracts.credit = 50;
    e.state.contracts.active.push({ id: 99, client: 'x', resource: 'stone', amount: 10, delivered: 0, reward: 100, credit: 5, remaining: 1, total: 10 });
    e.advance(2);
    expect(e.state.contracts.active.some((c) => c.id === 99)).toBe(false);
    expect(e.state.contracts.credit).toBe(50 - CONFIG.contracts.creditPenalty);
    e.state.contracts.active = [];
    e.state.contracts.nextIn = 1;
    e.advance(2);
    expect(e.state.contracts.active.length).toBe(1);
  });

  it('信用ランクで不動産手数料と輸送費が下がる', () => {
    expect(creditRankOf(0).rank).toBe('E');
    expect(creditRankOf(100).rank).toBe('D');
    expect(creditRankOf(3000).rank).toBe('S');
    expect(creditRankOf(3000).estateFee).toBeLessThan(creditRankOf(0).estateFee);
    expect(creditRankOf(3000).transportCost).toBeLessThan(1);
  });
});

describe('ライバル会社', () => {
  it('不動産解放後、時間がたつと会社が物件を買い、成長重視の会社は増資する', () => {
    const e = makeEngine(1_000_000_000, 3);
    e.state.tutorial.completed = true;
    e.tick(0.2);
    expect(e.isEstateUnlocked()).toBe(true);
    // 会社に現金を持たせ、成長重視に
    for (const c of COMPANIES) {
      e.state.stocks.companies[c.id].cash = 1e12;
      e.state.stocks.companies[c.id].policy = 'growth';
    }
    const marketBefore = PROPERTIES.filter((p) => propertyOwner(e.state, p.id).type === 'market').length;
    const sharesBefore = sharesOf(e.state, COMPANIES[0].id);
    e.advance(3600);
    const marketAfter = PROPERTIES.filter((p) => propertyOwner(e.state, p.id).type === 'market').length;
    expect(marketAfter).toBeLessThan(marketBefore);
    // 市場に一定数は残る
    expect(marketAfter).toBeGreaterThanOrEqual(Math.ceil(PROPERTIES.length * CONFIG.rivals.marketFloorRatio) - COMPANIES.length);
    const issued = COMPANIES.some((c) => sharesOf(e.state, c.id) > c.shares);
    expect(issued).toBe(true);
    void sharesBefore;
  });

  it('経営権を持つ会社は増資しない', () => {
    const e = makeEngine(1e14, 5);
    e.state.tutorial.completed = true;
    e.tick(0.2);
    const c = COMPANIES[0];
    e.state.stocks.companies[c.id].policy = 'growth';
    e.buyShares(c.id, c.shares); // 100%
    expect(ownershipOf(e.state, c.id)).toBeCloseTo(1, 6);
    e.advance(3600);
    expect(sharesOf(e.state, c.id)).toBe(c.shares);
  });
});

describe('再出発', () => {
  it('ポイントの計算と、持ち越すもの', () => {
    expect(prestigePoints(5e8)).toBe(0);
    expect(prestigePoints(1e9)).toBe(3);
    expect(prestigePoints(1e10)).toBe(10);
    expect(prestigePoints(1e12)).toBe(100);
    const e = makeEngine(2_000_000_000);
    e.state.tutorial.completed = true;
    e.buyFacility('worker_stone', 5);
    e.state.achievements['first_stone'] = 1;
    e.renameCompany('テスト商会');
    e.tick(0.2);
    expect(e.prestige()).toBe(true);
    expect(e.state.prestige.count).toBe(1);
    expect(e.state.prestige.points).toBe(4); // sqrt(20) = 4.47 → 4
    expect(e.state.facilities.length).toBe(0);
    expect(e.state.company.name).toBe('テスト商会');
    expect(e.state.achievements['first_stone']).toBe(1);
    expect(e.state.company.cash).toBe(CONFIG.prestige.startingCashPerPoint * 4);
    expect(e.derived.modifiers.production['RESOURCE']).toBeCloseTo(1 + CONFIG.prestige.productionPerPoint * 4, 6);
    // 生産ボーナスが効く
    e.buyFacility('worker_stone', 1);
    e.tick(1);
    expect(e.derived.production['stone']).toBeCloseTo(0.2 * (1 + CONFIG.prestige.productionPerPoint * 4), 6);
    // 足りなければできない
    const e2 = makeEngine(1000);
    expect(e2.prestige()).toBe(false);
  });
});

describe('診断とおすすめ', () => {
  it('材料不足の施設に「直す」操作が出る', () => {
    const e = makeEngine(100_000);
    e.state.tutorial.completed = true;
    e.state.stats.totalObtained['iron'] = 10;
    e.tick(0.2);
    expect(e.buyFacility('simple_smelter', 1)).toBe(1);
    e.advance(2);
    const inst = e.state.facilities.find((f) => f.typeId === 'simple_smelter')!;
    expect(e.derived.facilityRuntime[inst.id].status).toBe('no_input');
    const d = diagnoseFacility(e.state, e.derived, inst)!;
    expect(d).not.toBeNull();
    expect(d.reason).toContain('鉄鉱石');
    expect(d.fixes.length).toBeGreaterThan(0);
  });


  it('投資の順位づけ: 回収が早い順で、価格の高いものは後ろ', () => {
    const e = makeEngine(1_000_000);
    e.state.tutorial.completed = true;
    e.tick(0.2);
    const ranked = rankInvestments(e.state, e.derived, { affordableOnly: true });
    expect(ranked.length).toBeGreaterThan(0);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i].paybackSeconds).toBeGreaterThanOrEqual(ranked[i - 1].paybackSeconds);
    expect(ranked[0].typeId).toBe('worker_stone');
  });

  it('施設ごとの実流量が記録される', () => {
    const e = makeEngine(1000);
    e.buyFacility('worker_stone', 2);
    e.tick(1);
    const inst = e.state.facilities.find((f) => f.typeId === 'worker_stone')!;
    expect(e.derived.facilityRuntime[inst.id].outputRates['stone']).toBeCloseTo(0.4, 6);
  });
});

describe('セーブの移行 v4 → v6', () => {
  it('古いセーブに注文・再出発が補われ、自動化のデータは捨てられる', () => {
    const old = createInitialState(1000) as unknown as Record<string, unknown>;
    old.saveVersion = 4;
    old.automation = { managers: { gather: { hiredAt: 1, paid: 0 } } };
    old.contracts = undefined;
    delete old.contracts;
    delete old.prestige;
    const stocks = old.stocks as { companies: Record<string, Record<string, unknown>>; rivalIn?: number };
    delete stocks.rivalIn;
    for (const c of Object.values(stocks.companies)) delete c.extraShares;
    const m = migrateSave(old);
    expect(m.saveVersion).toBe(GAME_META.saveVersion);
    expect('automation' in (m as unknown as Record<string, unknown>)).toBe(false);
    expect(m.contracts.active).toEqual([]);
    expect(m.prestige.points).toBe(0);
    expect(m.stocks.rivalIn).toBeGreaterThan(0);
    expect(m.stocks.companies[COMPANIES[0].id].extraShares).toBe(0);
    expect(m.stats.contractsCompleted).toBe(0);
    // 移行後もエンジンが動く
    const e = new GameEngine({ state: m, rng: seeded(), now: () => 2000 });
    e.advance(5);
    expect(e.state.stats.playtimeSeconds).toBeGreaterThan(0);
  });
});
