/**
 * 「画面に出る数字」と「実際に起きること」が合っているかを見張るテスト。
 * ここがずれると、遊んでいる人が判断を間違える（表示より安く売れる、表示より高く請求される）。
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { BUSINESS_MAP } from '@/game/data/business';
import { divisionBreakdown, divisionWage, getDivision } from '../systems/business';
import { previewGather } from '../actions/gather';
import { resourceValue } from '../analysis/roi';
import { buyCost, currentPrice, sellRevenue } from '../systems/market';
import type { OsmFeature } from '@/game/services/osm/overpass';

let clock = 1_000_000;

function makeEngine(cash = 0) {
  clock = 1_000_000;
  const e = new GameEngine({ rng: () => 0.42, now: () => clock });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  e.refreshDerived();
  return e;
}

function buyPlace(e: GameEngine, id: string): string {
  const f: OsmFeature = {
    id, kind: 'retail', label: '店舗', name: 'テスト商会', named: false,
    lat: 35.42, lon: 139.35, areaSqm: 900, levels: 2, polygon: [],
  };
  e.debugAddCash(500_000_000_000);
  if (!e.buyCustomProperty(f)) throw new Error('買えませんでした');
  return `osm:${id}`;
}

describe('採集ボタンの数字', () => {
  it('ボタンの「+N」は、実際に入る量と同じ', () => {
    const e = makeEngine(0);
    e.state.prestige.points = 500;
    for (let i = 0; i < 10; i++) e.buyPrestigeUpgrade('gather');
    e.refreshDerived();
    expect(e.derived.modifiers.gatherAmount).toBeGreaterThan(1);
    const shown = previewGather(e.state, 'gather_stone', e.derived.modifiers.gatherAmount).amount;
    const before = e.state.inventory.stone ?? 0;
    e.gather('gather_stone');
    const got = (e.state.inventory.stone ?? 0) - before;
    expect(got).toBeCloseTo(shown, 6);
  });
});

describe('在庫の値打ち', () => {
  it('どの画面でも同じ額になる（需要係数を二重に掛けない）', () => {
    const e = makeEngine(1_000_000_000);
    e.debugAddResource('stone', 3000);
    e.sell('stone', 2000); // わざと飽和させる
    e.refreshDerived();
    // roi の1個あたりの評価と、市場のいまの値段が一致する
    expect(resourceValue(e.state, 'stone')).toBeCloseTo(currentPrice(e.state, 'stone'), 9);
  });

  it('「全部売ると」の額は、実際に売った額と同じ', () => {
    const e = makeEngine(1_000_000_000);
    e.debugAddResource('stone', 3000);
    e.refreshDerived();
    const have = Math.floor(e.state.inventory.stone ?? 0);
    const shown = sellRevenue(e.state, 'stone', have) * (e.derived.modifiers.sellPrice ?? 1);
    const before = e.state.company.cash;
    e.sell('stone', 'all');
    const got = e.state.company.cash - before;
    // 端数（小数第2位で丸め）ぶんの差は許す
    expect(Math.abs(got - shown)).toBeLessThan(Math.max(1, shown * 0.001));
  });

  it('1個あたりの値段 × 個数は、まとめ売りの額より大きい（だから「値打ち」に使わない）', () => {
    const e = makeEngine(1_000_000_000);
    e.debugAddResource('stone', 5000);
    e.refreshDerived();
    const spot = currentPrice(e.state, 'stone') * 5000;
    const real = sellRevenue(e.state, 'stone', 5000);
    expect(spot).toBeGreaterThan(real);
  });
});

describe('仕入れボタンの合計額', () => {
  it('ボタンに出す合計額と、実際の請求額が同じ', () => {
    for (const n of [1, 10, 100, 1000]) {
      const e = makeEngine(1_000_000_000_000);
      // 倉庫を広げて、容量で頭打ちにならないようにする
      e.debugUnlockAll();
      e.buyFacility('small_warehouse', 20);
      e.buyFacility('large_warehouse', 20);
      e.refreshDerived();
      const shown = buyCost(e.state, 'gpu', n, e.derived.modifiers.sellPrice ?? 1);
      const r = e.buyResource('gpu', n);
      expect(r.amount, `${n}個`).toBe(n);
      expect(Math.abs(r.cost - shown), `${n}個`).toBeLessThan(1.5);
    }
  });
});

describe('事業の利益の表示', () => {
  const openIt = (e: GameEngine, place: string, staff: number) => {
    const def = BUSINESS_MAP.it;
    e.state.research.completed[def.research] = true;
    e.debugAddCash(def.setupCost * 10 + 1_000_000_000);
    const r = e.openDivision('it', place);
    if (!r.ok || r.id === undefined) throw new Error(r.reason);
    e.setDivisionStaff(r.id, staff);
    const div = getDivision(e.state, r.id)!;
    div.brand = 60;
    div.awareness = 60;
    e.refreshDerived();
    return div;
  };

  it('人件費の表示は、実際に引かれる額と同じ', () => {
    const e = makeEngine(0);
    const div = openIt(e, buyPlace(e, 'd901'), 10);
    // 人件費が下がる研究をすべて入れて、倍率が1でない状態にする
    for (const id of Object.keys(e.state.research.completed)) void id;
    e.state.prestige.points = 0;
    e.debugUnlockAll();
    e.refreshDerived();
    // wageCost は tick の中で決まるので、1秒進めてから比べる
    e.tick(1);
    const shown = divisionWage(e.state, div, e.derived.modifiers.wage);
    expect(e.derived.wageCost).toBeGreaterThan(0);
    expect(shown).toBeCloseTo(e.derived.wageCost, 6);
  });

  it('製品の売上の表示は、実際に入る額と同じ（研究の倍率を含む）', () => {
    const e = makeEngine(0);
    const div = openIt(e, buyPlace(e, 'd902'), 12);
    // 製品を1件出す
    e.state.research.completed.cybersecurity = true;
    e.refreshDerived();
    e.startProject(div.id, 'it_security');
    for (let i = 0; i < 4000 && div.products.length === 0; i++) e.tick(1);
    expect(div.products.length).toBeGreaterThan(0);
    // 製品収入の倍率を上げる
    e.state.research.completed.gpu_design = true;
    e.refreshDerived();
    expect(e.derived.modifiers.productRevenue).toBeGreaterThan(1);

    const shown = divisionBreakdown(e.state, div, e.derived.modifiers).revenue;
    const before = div.totalEarned;
    e.tick(1);
    const real = div.totalEarned - before;
    expect(real).toBeGreaterThan(0);
    // 1秒ぶんの実収入と、表示の「売上 /秒」がほぼ同じ
    expect(Math.abs(real - shown) / Math.max(1, shown)).toBeLessThan(0.05);
  });
});
