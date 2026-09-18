/**
 * 5周目の点検で見つかった不具合の再発を防ぐテスト。
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { ACHIEVEMENTS } from '@/game/data/achievements';
import { RESEARCH } from '@/game/data/research';
import { GATHER_ACTIONS } from '@/game/data/gathering';
import { BUSINESS_MAP } from '@/game/data/business';
import { FACILITY_MAP, facilityBulkCost } from '@/game/data/facilities';
import { CARDS } from '@/game/data/cards';
import { divisionBreakdown, getDivision, mineShares } from '../systems/business';
import { ICON_FALLBACK } from '@/utils/assets';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { OsmFeature } from '@/game/services/osm/overpass';

let clock = 1_000_000;

function seeded(seed = 424242) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeEngine(cash = 0) {
  clock = 1_000_000;
  const e = new GameEngine({ rng: seeded(), now: () => clock });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  e.refreshDerived();
  return e;
}

function buyPlace(e: GameEngine, id: string, kind: OsmFeature['kind'] = 'retail'): string {
  const f: OsmFeature = {
    id, kind, label: '店舗', name: 'テスト物件', named: false,
    lat: 35.42, lon: 139.35, areaSqm: 900, levels: 2, polygon: [],
  };
  e.debugAddCash(500_000_000_000);
  if (!e.buyCustomProperty(f)) throw new Error('買えませんでした');
  return `osm:${id}`;
}

describe('自動採集の順番', () => {
  it('まとめて進めても、対象がまんべんなく採集される', () => {
    const run = (dt: number, steps: number) => {
      const e = makeEngine(0);
      e.state.prestige.points = 200;
      e.buyPrestigeUpgrade('auto_gather');
      e.setAutomation('gather', true);
      e.tick(1);
      const got: Record<string, number> = {};
      for (let i = 0; i < steps; i++) {
        e.state.inventory = {};
        for (const l of e.state.lands) l.stock = {};
        e.tick(dt);
      }
      for (const g of GATHER_ACTIONS) got[g.resource] = e.state.stats.totalGathered[g.resource] ?? 0;
      return got;
    };
    const fine = run(0.2, 3000);
    const coarse = run(10, 60);
    const active = Object.keys(fine).filter((k) => fine[k] > 0);
    expect(active.length).toBeGreaterThan(1);
    // まとめ進行で「1度も採れない資源」が出ないこと（昔は偶数個だと半分が0になった）
    for (const k of active) expect(coarse[k], k).toBeGreaterThan(0);
  });
});

describe('鉱区の利益の表示', () => {
  it('掘る力の配分は足して1になる', () => {
    for (const n of [1, 2, 3, 5, 8]) {
      const sum = mineShares(n).reduce((a, b) => a + b, 0);
      expect(sum, `${n}種`).toBeCloseTo(1, 9);
    }
    expect(mineShares(0)).toEqual([]);
  });

  it('鉱脈が複数あるときも、表示の売上が実際に掘る値打ちと合う', () => {
    const e = makeEngine(0);
    e.debugUnlockAll();
    e.debugAddCash(1e12);
    const place = buyPlace(e, 'm901', 'factory');
    const land = e.state.lands.find((l) => l.id === place)!;
    land.survey = 4;
    land.deposits = {
      iron_ore: { total: 1e9, remaining: 1e9 },
      coal: { total: 1e9, remaining: 1e9 },
    };
    const def = BUSINESS_MAP.prospecting;
    e.state.research.completed[def.research] = true;
    const r = e.openDivision('prospecting', place);
    expect(r.ok).toBe(true);
    const div = getDivision(e.state, r.id!)!;
    e.setDivisionStaff(div.id, 10);
    // 倉庫を広げて満杯の影響を外す。
    // 大型倉庫は延床1万㎡級の物流倉庫＝1棟16億円になったので、建設費もデータから出して足す
    // （足さないと1棟も建たず、「満杯の影響を外した」ことにならない）
    const warehouses = 40;
    e.debugAddCash(facilityBulkCost(FACILITY_MAP['large_warehouse'], 0, warehouses));
    expect(e.buyFacility('large_warehouse', warehouses)).toBe(warehouses);
    e.refreshDerived();
    const shown = divisionBreakdown(e.state, div, e.derived.modifiers, e.derived.capacity).revenue;
    const before = { ...e.state.inventory };
    e.tick(1);
    // 実際に掘れた量に基準価格を掛けて、値打ちで比べる。
    // 値段はデータ（RESOURCE_MAP）から引く。表示側（divisionBreakdown）も採掘側（runMine）も
    // 同じ basePrice を見ているので、ここで別の数字を置くと相場を直すたびに食い違う。
    let real = 0;
    let realValue = 0;
    for (const [id, n] of Object.entries(e.state.inventory)) {
      const diff = (n ?? 0) - (before[id as keyof typeof before] ?? 0);
      if (diff <= 0) continue;
      real += diff;
      realValue += diff * (RESOURCE_MAP[id as ResourceId]?.basePrice ?? 0);
    }
    expect(real).toBeGreaterThan(0);
    expect(Math.abs(shown - realValue) / Math.max(1, realValue)).toBeLessThan(0.05);
  });
});

describe('土地を売ったとき', () => {
  it('その土地の事業もたたまれる（土地なしで稼ぎ続けない）', () => {
    const e = makeEngine(0);
    e.debugUnlockAll();
    e.debugAddCash(1e13);
    const place = buyPlace(e, 's901', 'office');
    const def = BUSINESS_MAP.it;
    e.state.research.completed[def.research] = true;
    const r = e.openDivision('it', place);
    expect(r.ok).toBe(true);
    e.setDivisionStaff(r.id!, 10);
    e.refreshDerived();
    expect(e.state.business.divisions.length).toBe(1);
    e.sellCustomProperty('s901');
    expect(e.state.lands.some((l) => l.id === place)).toBe(false);
    expect(e.state.business.divisions.length).toBe(0);
  });

  it('お店をたたむと在庫は本社に戻る', () => {
    const e = makeEngine(0);
    e.debugUnlockAll();
    e.debugAddCash(1e13);
    e.buyFacility('large_warehouse', 20);
    const place = buyPlace(e, 's902');
    e.state.research.completed.retail = true;
    const r = e.openDivision('shop', place);
    const div = getDivision(e.state, r.id!)!;
    div.stock = { food: 120 };
    e.refreshDerived();
    const before = e.state.inventory.food ?? 0;
    e.sellCustomProperty('s902');
    expect(e.state.business.divisions.length).toBe(0);
    expect(e.state.inventory.food ?? 0).toBeGreaterThan(before);
  });
});

describe('実績が達成できる形になっている', () => {
  it('研究をすべて終えると「研究を極める」が成立し、1件残りだと成立しない', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'researcher_all')!;
    const e = makeEngine(0);
    for (const r of RESEARCH.slice(0, RESEARCH.length - 1)) e.state.research.completed[r.id] = true;
    expect(def.check(e.state, e.derived)).toBe(false);
    for (const r of RESEARCH) e.state.research.completed[r.id] = true;
    expect(def.check(e.state, e.derived)).toBe(true);
  });

  it('宝石を磨くと「宝石職人」が成立する', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'gem_cutter')!;
    const e = makeEngine(1_000_000_000);
    e.debugUnlockAll();
    e.debugAddResource('rough_gem', 400);
    e.debugAddResource('water', 400);
    expect(def.check(e.state, e.derived)).toBe(false);
    e.craft('cut_gem', 20);
    expect((e.state.stats.crafted['cut_gem'] ?? 0) >= 10).toBe(true);
    expect(def.check(e.state, e.derived)).toBe(true);
  });

  it('実績の説明と判定が食い違っていない（件数を直書きしていない）', () => {
    const src = ACHIEVEMENTS.map((a) => a.check.toString()).join('\n');
    // 研究の総数を直書きしていないこと
    expect(src).not.toContain('completed).length >= 94');
    for (const a of ACHIEVEMENTS) {
      expect(a.description.length, a.id).toBeGreaterThan(3);
      expect(a.name.length, a.id).toBeGreaterThan(1);
    }
  });
});

describe('アイコンの代わりの絵', () => {
  it('代わりに出す絵の名前は、代わり表の中でぐるぐる回らない', () => {
    for (const [from, to] of Object.entries(ICON_FALLBACK)) {
      expect(from, from).not.toBe(to);
      // 代わりの絵が、さらに別の代わりを必要としない（1回で本物に届く）
      expect(ICON_FALLBACK[to], `${from} -> ${to}`).toBeUndefined();
    }
  });

  it('代わりの絵を用意しているものは、行き先がすべて違う', () => {
    const alts = Object.values(ICON_FALLBACK);
    // 表が空でもよい（本物の絵がそろっている状態）
    expect(new Set(alts).size).toBe(alts.length);
  });

  it('カードはすべて絵の名前を持っていて、番号と一致している', () => {
    for (const c of CARDS) {
      expect(c.art, c.id).toBe(c.id);
      expect(c.id, c.name).toBe(`mc_${String(c.no).padStart(3, '0')}`);
    }
  });
});
