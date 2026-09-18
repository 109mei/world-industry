/**
 * 7周目の点検で見つかった不具合の再発を防ぐテスト。
 * 「画面に出ている数字が、実際と違う」ものが中心。
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { CONFIG } from '@/game/data/config';
import { BUSINESS_MAP } from '@/game/data/business';
import { getDivision, shopStockCapacity } from '../systems/business';
import { getMarketState } from '../systems/market';
import type { OsmFeature } from '@/game/services/osm/overpass';

let clock = 1_000_000;

function makeEngine(cash = 0) {
  clock = 1_000_000;
  const e = new GameEngine({ rng: () => 0.42, now: () => clock });
  e.keepDefaultHq();
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  e.refreshDerived();
  return e;
}

function feature(over: Partial<OsmFeature> = {}): OsmFeature {
  return {
    id: 'r7', kind: 'retail', label: '店舗', name: 'テスト', named: false,
    lat: 35.42, lon: 139.35, areaSqm: 900, levels: 2, polygon: [], ...over,
  };
}

describe('再出発ポイントの表示', () => {
  it('ポイントだけでは生産が上がらない（表示と実態が食い違わない）', () => {
    const build = (points: number) => {
      const e = makeEngine(1e9);
      e.debugUnlockAll();
      e.state.prestige = { count: points > 0 ? 3 : 0, points, upgrades: {}, history: [] };
      e.buyFacility('worker_stone', 10);
      e.refreshDerived();
      return e.derived.modifiers.production.RESOURCE;
    };
    // 実態: ポイントを持っているだけでは変わらない（強化を買って初めて上がる）
    expect(build(200)).toBeCloseTo(build(0), 9);
  });

  it('使われていない設定値が残っていない', () => {
    const prestige = CONFIG.prestige as Record<string, unknown>;
    expect(prestige.productionPerPoint).toBeUndefined();
    expect(prestige.researchPerPoint).toBeUndefined();
    expect(prestige.startingCashPerPoint).toBeUndefined();
  });

  it('強化を買えば、ちゃんと生産が上がる', () => {
    const e = makeEngine(1e9);
    e.debugUnlockAll();
    e.state.prestige.points = 100;
    const before = e.derived.modifiers.production.RESOURCE;
    e.buyPrestigeUpgrade('production');
    e.refreshDerived();
    expect(e.derived.modifiers.production.RESOURCE).toBeGreaterThan(before);
  });
});

describe('施設の帳簿', () => {
  it('割引で買った施設は、割引後の額だけ帳簿から引かれる', () => {
    const e = makeEngine(1e13);
    e.debugUnlockAll();
    // 建設会社を開いて建設費を割引く
    const place2 = feature({ id: 'b2', kind: 'office', areaSqm: 9000, levels: 3 });
    e.buyCustomProperty(place2);
    const def = BUSINESS_MAP.construction;
    e.state.research.completed[def.research] = true;
    const c = e.openDivision('construction', 'osm:b2');
    e.setDivisionStaff(c.id!, def.maxStaff);
    e.refreshDerived();
    expect(e.derived.modifiers.buildCost).toBeLessThan(1);

    const place1 = feature({ id: 'b1', kind: 'warehouse', areaSqm: 5000, levels: 1 });
    e.buyCustomProperty(place1);
    const base = e.state.company.facilityInvestment;
    e.buyFacility('land_warehouse', 10, 'osm:b1');
    const added = e.state.company.facilityInvestment - base;
    expect(added).toBeGreaterThan(0);
    // 本社にも別に投資する
    e.buyFacility('small_warehouse', 20, 'hq');
    const hqPart = e.state.company.facilityInvestment - base - added;
    expect(hqPart).toBeGreaterThan(0);

    e.sellCustomProperty('b1');
    // 売った土地のぶんだけが消え、本社のぶんは残る
    expect(e.state.company.facilityInvestment).toBeCloseTo(base + hqPart, 0);
  });

  it('帳簿が負にならない', () => {
    const e = makeEngine(1e12);
    e.debugUnlockAll();
    const f = feature({ id: 'b3', kind: 'warehouse', areaSqm: 4000, levels: 1 });
    e.buyCustomProperty(f);
    e.buyFacility('land_warehouse', 5, 'osm:b3');
    e.sellCustomProperty('b3');
    expect(e.state.company.facilityInvestment).toBeGreaterThanOrEqual(0);
  });
});

describe('事業をたたむとき', () => {
  it('在庫が1個も消えない（本社が満杯でも全部売れる）', () => {
    const e = makeEngine(1e12);
    e.debugUnlockAll();
    const f = feature({ id: 'c7', areaSqm: 1200, levels: 2 });
    e.buyCustomProperty(f);
    e.state.research.completed.retail = true;
    const r = e.openDivision('shop', 'osm:c7');
    const div = getDivision(e.state, r.id!)!;
    e.refreshDerived();
    const cap = Math.min(200, shopStockCapacity(e.state, div));
    e.debugAddResource('food', 5000);
    e.restockShop(div.id, 'food', cap);
    const inShop = div.stock.food ?? 0;
    expect(inShop).toBeGreaterThan(0);
    // 本社を満杯にして、戻せない状態にする
    e.state.inventory.food = e.derived.capacity;
    const sat = getMarketState(e.state, 'food').saturation;
    e.closeDivision(div.id);
    const sold = getMarketState(e.state, 'food').saturation - sat;
    // 1個も消えず、全部市場に出ている
    expect(Math.round(sold)).toBe(Math.round(inShop));
  });
});

describe('離席中の倒産', () => {
  it('報告に倒産が載る', () => {
    const e = makeEngine(0);
    e.debugAddCash(200);
    e.buyFacility('worker_stone', 3);
    e.refreshDerived();
    const report = e.applyOffline(1800, 1800);
    expect(report.bankrupted).toBe(true);
  });

  it('倒産していなければ載らない', () => {
    const e = makeEngine(1_000_000);
    e.debugUnlockAll();
    e.buyFacility('worker_stone', 3);
    e.refreshDerived();
    const report = e.applyOffline(600, 600);
    expect(report.bankrupted).toBe(false);
  });
});
