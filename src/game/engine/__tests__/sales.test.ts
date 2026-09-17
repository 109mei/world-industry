import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { COMPANIES } from '@/game/data/companies';
import { KIND_NEEDS, isClientKind } from '@/game/data/clients';
import { PROPERTY_KIND, type PropertyKind } from '@/game/data/properties';
import { RESOURCES } from '@/game/data/resources';
import type { OsmFeature } from '@/game/services/osm/overpass';
import { clientList, getClient, isSalesUnlocked, salesState, wantedByKind } from '../systems/sales';

function seeded(seed = 11): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

let clock = 1_000_000;

function makeEngine(cash = 0) {
  clock = 1_000_000;
  const e = new GameEngine({ rng: seeded(), now: () => clock });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  return e;
}

/** 地図で見つけた建物のかわり */
function place(id = 'w1', kind: OsmFeature['kind'] = 'factory'): OsmFeature {
  return {
    id,
    kind,
    label: '工場',
    name: 'テスト工業',
    named: true,
    lat: 34.7,
    lon: 135.5,
    areaSqm: 4000,
    levels: 2,
    polygon: [],
  };
}

/** 営業できる状態（売上と在庫）を作る */
function prepare(e: GameEngine, kind: OsmFeature['kind'] = 'factory') {
  const res = KIND_NEEDS[kind][0];
  e.state.company.totalEarned = 100_000;
  e.state.stats.totalObtained[res] = 10_000;
  e.state.inventory[res] = 10_000;
  return res;
}

describe('取引先のデータ', () => {
  it('すべての建物の種類に欲しがるものがあり、実在する資源を指している', () => {
    const ids = new Set(RESOURCES.map((r) => r.id as string));
    for (const kind of Object.keys(PROPERTY_KIND) as PropertyKind[]) {
      const needs = KIND_NEEDS[kind];
      expect(needs, kind).toBeTruthy();
      expect(needs.length).toBeGreaterThan(0);
      for (const n of needs) expect(ids.has(n), `${kind}: ${n}`).toBe(true);
    }
  });

  it('住宅と更地は営業の相手にならない', () => {
    expect(isClientKind('house')).toBe(false);
    expect(isClientKind('land')).toBe(false);
    expect(isClientKind('factory')).toBe(true);
  });
});

describe('営業', () => {
  it('売上がないと使えない', () => {
    const e = makeEngine(1_000_000);
    expect(isSalesUnlocked(e.state)).toBe(false);
  });

  it('営業すると費用がかかり、商談が来て取引先として覚える', () => {
    const e = makeEngine(1_000_000);
    prepare(e);
    const f = place();
    const before = e.state.company.cash;
    let got = 0;
    for (let i = 0; i < 8 && got === 0; i++) {
      e.pitchToPlace(f);
      got = salesState(e.state).offers.length;
      clock += 200_000; // クールダウンを進める
    }
    expect(e.state.company.cash).toBeLessThan(before);
    expect(got).toBeGreaterThan(0);
    expect(getClient(e.state, f.id)).toBeTruthy();
    expect(clientList(e.state).length).toBe(1);
  });

  it('営業には間隔がある', () => {
    const e = makeEngine(1_000_000);
    prepare(e);
    const f = place('w2');
    e.pitchToPlace(f);
    const r = e.pitchToPlace(f);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('営業');
  });

  it('作れないものしか欲しがらない建物には営業できない', () => {
    const e = makeEngine(1_000_000);
    e.state.company.totalEarned = 100_000;
    const r = e.pitchToPlace(place('w3'));
    expect(r.ok).toBe(false);
  });

  it('住宅には営業できない', () => {
    const e = makeEngine(1_000_000);
    prepare(e, 'house');
    const r = e.pitchToPlace({ ...place('w4', 'house'), label: '住宅' });
    expect(r.ok).toBe(false);
  });

  it('自分が買った建物には営業できない', () => {
    const e = makeEngine(1_000_000);
    prepare(e);
    const f = place('w5');
    e.state.estate.custom = { ...(e.state.estate.custom ?? {}), [f.id]: { boughtAt: 0, boughtPrice: 1 } as never };
    const r = e.pitchToPlace(f);
    expect(r.ok).toBe(false);
  });

  it('大きい建物ほど注文が大きい', () => {
    function firstOffer(areaSqm: number) {
      const e = makeEngine(50_000_000);
      prepare(e);
      const f = { ...place('w9'), areaSqm };
      for (let i = 0; i < 20 && salesState(e.state).offers.length === 0; i++) {
        e.pitchToPlace(f);
        clock += 200_000;
      }
      return salesState(e.state).offers[0];
    }
    const small = firstOffer(200);
    const big = firstOffer(60_000);
    expect(small).toBeTruthy();
    expect(big).toBeTruthy();
    expect(big.amountPer).toBeGreaterThan(small.amountPer);
  });
});

describe('契約と納品', () => {
  function withOffer() {
    const e = makeEngine(5_000_000);
    prepare(e);
    const f = place('w10');
    for (let i = 0; i < 12 && salesState(e.state).offers.length === 0; i++) {
      e.pitchToPlace(f);
      clock += 200_000;
    }
    return { e, id: f.id, offer: salesState(e.state).offers[0] };
  }

  it('商談を受けると契約になり、納品でお金と関係が増える', () => {
    const { e, id, offer } = withOffer();
    expect(offer).toBeTruthy();
    expect(offer.clientId).toBe(id);
    expect(e.acceptOffer(offer.id)).toBe(true);
    const deal = salesState(e.state).deals[0];
    expect(deal).toBeTruthy();
    e.state.inventory[deal.resource] = deal.amountPer * 10;
    const cashBefore = e.state.company.cash;
    const relBefore = getClient(e.state, id)!.relation;
    expect(e.deliverDeal(deal.id)).toBe(true);
    expect(e.state.company.cash).toBeGreaterThan(cashBefore);
    expect(getClient(e.state, id)!.relation).toBeGreaterThan(relBefore);
    expect(getClient(e.state, id)!.deliveries).toBe(1);
  });

  it('在庫が足りなければ納品できない', () => {
    const { e, offer } = withOffer();
    e.acceptOffer(offer.id);
    const deal = salesState(e.state).deals[0];
    e.state.inventory[deal.resource] = 0;
    expect(e.deliverDeal(deal.id)).toBe(false);
  });

  it('納期を落とすと関係と信用が下がり、続けて落とすと打ち切られる', () => {
    const { e, id, offer } = withOffer();
    e.acceptOffer(offer.id);
    const deal = salesState(e.state).deals[0];
    e.state.inventory[deal.resource] = 0;
    getClient(e.state, id)!.relation = 50;
    e.state.contracts.credit = 500;
    for (let i = 0; i < 4; i++) e.tick(deal.intervalSec + 1);
    expect(getClient(e.state, id)!.relation).toBeLessThan(50);
    expect(e.state.contracts.credit).toBeLessThan(500);
    expect(salesState(e.state).deals.length).toBe(0);
  });

  it('打ち切ると関係が下がる', () => {
    const { e, id, offer } = withOffer();
    e.acceptOffer(offer.id);
    const deal = salesState(e.state).deals[0];
    getClient(e.state, id)!.relation = 40;
    expect(e.cancelDeal(deal.id)).toBe(true);
    expect(getClient(e.state, id)!.relation).toBeLessThan(40);
    expect(salesState(e.state).deals.length).toBe(0);
  });

  it('覚えた取引先には取引タブからも営業できる', () => {
    const { e, id } = withOffer();
    clock += 200_000;
    const r = e.pitchToClient(id);
    expect(r.ok).toBe(true);
  });

  it('商談は時間で流れる', () => {
    const { e } = withOffer();
    const before = salesState(e.state).offers.length;
    expect(before).toBeGreaterThan(0);
    e.tick(1200);
    expect(salesState(e.state).offers.length).toBe(0);
  });
});

describe('欲しがるもの', () => {
  it('作ったことがあるものだけが候補になる', () => {
    const e = makeEngine();
    expect(wantedByKind(e.state, 'factory')).toEqual([]);
    const res = KIND_NEEDS.factory[0];
    e.state.stats.totalObtained[res] = 5;
    expect(wantedByKind(e.state, 'factory')).toContain(res);
  });
});

describe('セーブの移行 v7 → v8', () => {
  it('古い注文は片付き、営業の器ができる', async () => {
    const { migrateSave } = await import('../state/migrations');
    const { GAME_META } = await import('@/game/data/meta');
    const v7 = {
      saveVersion: 7,
      company: { cash: 500 },
      lands: [],
      contracts: { active: [{ id: 1, client: 'x', resource: 'stone', amount: 5, delivered: 0, reward: 100, credit: 5, remaining: 10, total: 20 }], nextIn: 10, nextId: 2, credit: 250 },
    };
    const s = migrateSave(v7);
    expect(s.saveVersion).toBe(GAME_META.saveVersion);
    expect(s.contracts.active).toEqual([]);
    expect(s.contracts.credit).toBe(250);
    expect(s.sales).toBeTruthy();
    expect(s.sales?.deals).toEqual([]);
  });
});

describe('自分の行動が株価に効く', () => {
  it('同じものを作ると競合の会社は下がり、材料を供給する会社は上がる', async () => {
    const { influenceOn } = await import('../systems/influence');
    const e = makeEngine();
    const mining = COMPANIES.find((c) => c.sector === 'mining')!;
    const steel = COMPANIES.find((c) => c.sector === 'steel')!;
    // 鉄鉱石を大量に掘っている状態
    e.derived.production.iron_ore = 8000;
    const m = influenceOn(e.state, e.derived, mining);
    const s = influenceOn(e.state, e.derived, steel);
    expect(m.total).toBeLessThan(0); // 鉱業は競合
    expect(s.total).toBeGreaterThan(0); // 鉄鋼は材料が入る
  });

  it('少し掘ったぐらいでは業界は動かない', async () => {
    const { influenceOn } = await import('../systems/influence');
    const e = makeEngine();
    const mining = COMPANIES.find((c) => c.sector === 'mining')!;
    e.derived.production.iron_ore = 5;
    expect(Math.abs(influenceOn(e.state, e.derived, mining).total)).toBeLessThan(0.01);
  });

  it('物件を買い集めると不動産業が下がる', async () => {
    const { influenceOn } = await import('../systems/influence');
    const e = makeEngine();
    const realestate = COMPANIES.find((c) => c.sector === 'realestate')!;
    const before = influenceOn(e.state, e.derived, realestate).total;
    for (let i = 0; i < 200; i++) e.state.estate.owned[`x${i}`] = { boughtAt: 0, boughtPrice: 1 };
    const after = influenceOn(e.state, e.derived, realestate).total;
    expect(after).toBeLessThan(before);
  });

  it('影響は ±30% を超えない', async () => {
    const { influenceOn } = await import('../systems/influence');
    const e = makeEngine();
    const mining = COMPANIES.find((c) => c.sector === 'mining')!;
    e.derived.production.iron_ore = 100000;
    e.derived.production.coal = 100000;
    e.derived.production.stone = 100000;
    expect(influenceOn(e.state, e.derived, mining).total).toBeGreaterThanOrEqual(-0.3);
  });
});
