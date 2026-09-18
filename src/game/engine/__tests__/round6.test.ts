/**
 * 6周目の点検で見つかった不具合の再発を防ぐテスト。
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { BUSINESS_MAP } from '@/game/data/business';
import { FACILITY_MAP, facilityBulkCost } from '@/game/data/facilities';
import { getDivision } from '../systems/business';
import { customPrice, customRentPerSec, getCustom, quotePrice, quoteFeature, quoteRentPerSec } from '../systems/customEstate';
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
    id: 'q1', kind: 'office', label: 'オフィス', name: 'テストビル', named: true,
    lat: 35.6812, lon: 139.7671, areaSqm: 800, levels: 6, polygon: [], ...over,
  };
}

describe('買う前に出る賃料', () => {
  it('買ったあとの賃料と同じ額になる（有名な物件でもずれない）', () => {
    for (const f of [
      feature({ id: 'q1', name: '東京駅', named: true }),
      feature({ id: 'q2', kind: 'retail', name: '商店', named: false, areaSqm: 300, levels: 1 }),
      feature({ id: 'q3', kind: 'warehouse', name: '倉庫', named: false, areaSqm: 4000, levels: 1 }),
      feature({ id: 'q4', kind: 'house', name: '家', named: false, areaSqm: 120, levels: 2 }),
    ]) {
      const e = makeEngine(1e14);
      const q = quoteFeature(f);
      const shown = quoteRentPerSec(e.state, q, f.kind);
      const shownPrice = quotePrice(e.state, q);
      expect(e.buyCustomProperty(f), f.id).toBe(true);
      const cp = getCustom(e.state, f.id)!;
      expect(Math.abs(shown - customRentPerSec(e.state, cp)) / Math.max(1, shown), f.id).toBeLessThan(0.001);
      expect(Math.abs(shownPrice - customPrice(e.state, cp)) / Math.max(1, shownPrice), f.id).toBeLessThan(0.001);
    }
  });
});

describe('買った土地の工場が止まったとき', () => {
  it('運び込む手段がないことが「輸送手段なし」として出る', () => {
    const e = makeEngine(1e13);
    e.debugUnlockAll();
    const f = feature({ id: 'f1', kind: 'factory', label: '工場', areaSqm: 5000, levels: 1 });
    expect(e.buyCustomProperty(f)).toBe(true);
    const land = 'osm:f1';
    e.buyFacility('solar_farm', 5, land);
    e.buyFacility('steel_mill', 3, land);
    e.debugAddResource('iron', 2000);
    e.debugAddResource('coal', 2000);
    e.refreshDerived();
    for (let i = 0; i < 10; i++) e.tick(1);
    // 在庫はまだ無いが、運び込みが要るので「輸送手段なし」になる
    expect(e.derived.lands[land]?.noRoute).toBe(true);
    // トラックを置けば解消し、実際に作れるようになる
    e.buyFacility('truck', 2, land);
    e.refreshDerived();
    for (let i = 0; i < 200; i++) e.tick(1);
    expect(e.derived.lands[land]?.noRoute).toBe(false);
    // 作った鋼鉄は現地では使わないので、本社へ運ばれる
    expect(e.state.inventory.steel ?? 0).toBeGreaterThan(0);
  });
});

describe('少し遅れただけの tick', () => {
  it('イベントが消えずに、戻ってきたときに起きる', () => {
    const run = (dt: number) => {
      clock = 1_000_000;
      const e = new GameEngine({ rng: () => 0.5, now: () => clock });
      e.keepDefaultHq();
      e.debugUnlockAll();
      e.debugAddCash(1e10);
      e.buyFacility('worker_stone', 5);
      e.refreshDerived();
      e.updateSettings({ events: true });
      let n = 0;
      e.addListener((ev) => {
        if (ev.eventId) n++;
      });
      for (let i = 0; i < 3600 / dt; i++) e.tick(dt);
      return n;
    };
    const fine = run(1);
    const laggy = run(1.02); // わずかに遅れた tick
    expect(fine).toBeGreaterThan(0);
    // 遅れただけでイベントが全部消える、ということがない
    expect(laggy).toBeGreaterThan(fine * 0.5);
  });

  it('離れているあいだの倒産は、まとめ進行でも必ず知らされる', () => {
    const e = makeEngine(0);
    // 作業員を3人雇って、手元にはほとんど残さない。
    // 雇う費用は現実の額（1人目15万円）になったので、建設費はデータから出して足す。
    // 石は売らないので収入は無く、給料（3人 × 432円/秒）だけが出ていって資金がショートする。
    e.debugAddCash(facilityBulkCost(FACILITY_MAP['worker_stone'], 0, 3) + 200);
    expect(e.buyFacility('worker_stone', 3)).toBe(3);
    e.refreshDerived();
    const toasts: string[] = [];
    e.addListener((ev, o) => {
      if (o.toast) toasts.push(ev.message);
    });
    const report = e.applyOffline(1800, 1800);
    expect(e.state.stats.bankruptcies).toBe(1);
    expect(report.bankrupted).toBe(true);
    expect(toasts.some((t) => t.includes('倒産'))).toBe(true);
  });
});

describe('事業をたたむとき', () => {
  it('本社が満杯でも在庫は消えず、売れて現金になる', () => {
    const e = makeEngine(1e12);
    e.debugUnlockAll();
    const f = feature({ id: 'c1', kind: 'retail', label: '店舗', areaSqm: 900, levels: 2 });
    e.buyCustomProperty(f);
    e.state.research.completed.retail = true;
    const r = e.openDivision('shop', 'osm:c1');
    const div = getDivision(e.state, r.id!)!;
    e.refreshDerived();
    const cap = e.derived.capacity;
    div.stock = { food: 50 };
    e.debugAddResource('food', cap * 2); // 本社を満杯に
    e.refreshDerived();
    const cashBefore = e.state.company.cash;
    expect(e.closeDivision(div.id)).toBe(true);
    expect(e.state.business.divisions.length).toBe(0);
    // 消えずに現金になっている
    expect(e.state.company.cash).toBeGreaterThan(cashBefore);
  });
});

describe('土地を売ったあとの総資産', () => {
  it('施設ぶんの投資額が帳簿に残らない', () => {
    const e = makeEngine(1e13);
    e.debugUnlockAll();
    const f = feature({ id: 'p1', kind: 'retail', label: '店舗', areaSqm: 4000, levels: 2 });
    e.buyCustomProperty(f);
    e.buyFacility('electronics_factory', 10, 'osm:p1');
    e.refreshDerived();
    expect(e.state.company.facilityInvestment).toBeGreaterThan(0);
    e.sellCustomProperty('p1');
    e.refreshDerived();
    expect(e.state.facilities.filter((x) => x.landId === 'osm:p1').length).toBe(0);
    expect(e.state.company.facilityInvestment).toBe(0);
    // 総資産に幽霊が残らない（現金とほぼ同じになる）
    expect(Math.abs(e.derived.assets - e.state.company.cash) / Math.max(1, e.state.company.cash)).toBeLessThan(0.01);
  });
});

describe('お店の口コミ', () => {
  it('よく売れている店なら、広告なしでも知名度が上がる', () => {
    const e = makeEngine(1e13);
    e.debugUnlockAll();
    const f = feature({ id: 'w1', kind: 'retail', label: '店舗', areaSqm: 2000, levels: 2, lat: 35.68, lon: 139.76 });
    e.buyCustomProperty(f);
    e.state.research.completed.retail = true;
    const def = BUSINESS_MAP.shop;
    const r = e.openDivision('shop', 'osm:w1');
    const div = getDivision(e.state, r.id!)!;
    e.setDivisionStaff(div.id, def.maxStaff);
    div.awareness = 30;
    // 品物を置く場所を広げる。大型倉庫は1棟16億円なので、建設費はデータから出して足す
    e.debugAddCash(facilityBulkCost(FACILITY_MAP['large_warehouse'], 0, 30));
    expect(e.buyFacility('large_warehouse', 30)).toBe(30);
    for (const g of def.goods ?? []) {
      e.debugAddResource(g, 5000);
      e.setRestockTarget(div.id, g, 2000);
    }
    e.refreshDerived();
    const before = div.awareness;
    for (let i = 0; i < 600; i++) {
      for (const g of def.goods ?? []) e.debugAddResource(g, 50);
      e.tick(1);
    }
    expect(div.awareness).toBeGreaterThan(before);
  });
});
