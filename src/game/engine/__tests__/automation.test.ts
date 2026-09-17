import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { BULK_BUY_LIMIT } from '@/game/data/prestigeTree';
import { autoCraftSlots, automationState, isAutomationOn, isAutomationOwned } from '../systems/automation';
import { salesState } from '../systems/sales';
import { getCustom } from '../systems/customEstate';
import type { OsmFeature } from '@/game/services/osm/overpass';

let clock = 1_000_000;

function seeded(seed = 5): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeEngine(cash = 0, points = 0) {
  clock = 1_000_000;
  const e = new GameEngine({ rng: seeded(), now: () => clock });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  if (points > 0) e.state.prestige.points = points;
  return e;
}

function feature(over: Partial<OsmFeature> = {}): OsmFeature {
  return {
    id: 'w1',
    kind: 'house',
    label: '住宅',
    name: '住宅',
    named: false,
    lat: 33.6459,
    lon: 130.6915,
    areaSqm: 120,
    levels: 1,
    polygon: [],
    ...over,
  };
}

describe('自動化は買うまで使えない', () => {
  it('買っていなければスイッチも入らない', () => {
    const e = makeEngine();
    expect(isAutomationOwned(e.state, 'gather')).toBe(false);
    e.setAutomation('gather', true);
    expect(isAutomationOn(e.state, 'gather')).toBe(false);
  });

  it('買うと自動で ON になる', () => {
    const e = makeEngine(0, 50);
    expect(e.buyPrestigeUpgrade('auto_gather')).toBe(true);
    expect(isAutomationOn(e.state, 'gather')).toBe(true);
  });
});

describe('自動採集', () => {
  it('放っておいても資源が増える', () => {
    const e = makeEngine(0, 50);
    e.buyPrestigeUpgrade('auto_gather');
    const before = e.state.inventory.stone ?? 0;
    e.tick(10);
    expect((e.state.inventory.stone ?? 0) + (e.state.inventory.wood ?? 0)).toBeGreaterThan(before);
  });

  it('スイッチを切ると止まる', () => {
    const e = makeEngine(0, 50);
    e.buyPrestigeUpgrade('auto_gather');
    e.setAutomation('gather', false);
    e.tick(10);
    expect(e.state.inventory.stone ?? 0).toBe(0);
  });
});

describe('自動クラフト', () => {
  it('登録したレシピを作り続ける', () => {
    const e = makeEngine(0, 50);
    e.debugUnlockAll();
    e.buyPrestigeUpgrade('auto_craft');
    e.debugAddResource('stone', 500);
    e.debugAddResource('wood', 500);
    expect(e.toggleAutoRecipe('craft_stone_axe')).toBe(true);
    e.tick(5);
    expect((e.state.stats.crafted.craft_stone_axe ?? 0)).toBeGreaterThan(0);
  });

  it('登録できる数には上限がある', () => {
    const e = makeEngine(0, 50);
    e.debugUnlockAll();
    e.buyPrestigeUpgrade('auto_craft');
    const slots = autoCraftSlots(e.state);
    expect(slots).toBe(2);
    const a = automationState(e.state);
    a.recipes = ['craft_stone_axe', 'craft_shovel'];
    expect(e.toggleAutoRecipe('craft_bucket')).toBe(false);
  });
});

describe('自動納品', () => {
  it('期限が近い契約を勝手に納めてくれる', () => {
    const e = makeEngine(5_000_000, 50);
    e.buyPrestigeUpgrade('auto_deliver');
    e.state.company.totalEarned = 100_000;
    e.state.stats.totalObtained.steel = 10_000;
    e.state.inventory.steel = 10_000;
    const f = feature({ id: 'w20', kind: 'factory', label: '工場', name: 'テスト工業', areaSqm: 4000, levels: 2 });
    for (let i = 0; i < 12 && salesState(e.state).offers.length === 0; i++) {
      e.pitchToPlace(f);
      clock += 200_000;
    }
    const offer = salesState(e.state).offers[0];
    expect(offer).toBeTruthy();
    e.acceptOffer(offer.id);
    const deal = salesState(e.state).deals[0];
    e.state.inventory[deal.resource] = deal.amountPer * 20;
    const left = deal.deliveriesLeft;
    e.tick(deal.intervalSec * 0.7);
    expect(salesState(e.state).deals[0].deliveriesLeft).toBeLessThan(left);
    expect(salesState(e.state).deals[0].missed).toBe(0);
  });
});

describe('一括買収', () => {
  it('買っていないと使えない', () => {
    const e = makeEngine(1_000_000_000);
    const r = e.bulkBuyFeatures([feature({ id: 'w30' })]);
    expect(r.bought).toBe(0);
    expect(r.reason).toContain('一括買収');
  });

  it('安い順に、所持金の半分までしか買わない', () => {
    const e = makeEngine(1_000_000_000, 50);
    e.buyPrestigeUpgrade('bulk_buy');
    const cashBefore = e.state.company.cash;
    const list = Array.from({ length: 12 }, (_, i) => feature({ id: `w${100 + i}`, lat: 33.6459 + i * 0.001 }));
    const r = e.bulkBuyFeatures(list);
    expect(r.bought).toBeGreaterThan(0);
    expect(r.bought).toBeLessThanOrEqual(BULK_BUY_LIMIT[0]);
    expect(e.state.company.cash).toBeGreaterThanOrEqual(cashBefore * 0.5 - 1);
    expect(Object.keys(e.state.estate.custom ?? {}).length).toBe(r.bought);
  });

  it('同じ場所を二重に買わない', () => {
    const e = makeEngine(1_000_000_000, 50);
    e.buyPrestigeUpgrade('bulk_buy');
    const list = [feature({ id: 'w200' })];
    expect(e.bulkBuyFeatures(list).bought).toBe(1);
    expect(e.bulkBuyFeatures(list).bought).toBe(0);
  });
});

describe('有名な場所は買収に時間もお金もかかる', () => {
  it('同じ大きさでも、名の通った観光地は無名の建物よりずっと高い', async () => {
    const { quoteFeature } = await import('../systems/customEstate');
    const plain = quoteFeature({ kind: 'office', areaSqm: 5000, levels: 20, lat: 35.68, lon: 139.76, named: false });
    const famous = quoteFeature({ kind: 'office', areaSqm: 5000, levels: 20, lat: 35.68, lon: 139.76, named: true, tags: { tourism: 'attraction' } });
    expect(famous.basePrice).toBeGreaterThan(plain.basePrice * 1.5);
    expect(famous.prominence.score).toBeGreaterThan(plain.prominence.score);
    expect(famous.prominence.premium).toBeGreaterThan(1);
  });

  it('郊外の畑や倉庫は有名にならない', async () => {
    const { quoteFeature } = await import('../systems/customEstate');
    const farm = quoteFeature({ kind: 'farm', areaSqm: 20_000, levels: 1, lat: 33.5, lon: 130.7, named: true });
    expect(farm.prominence.mult).toBeLessThan(1.3);
  });

  it('買っても賃料は知名度ぶんまでは増えない', async () => {
    const { customRentPerSec, quoteFeature } = await import('../systems/customEstate');
    const e = makeEngine(0);
    const f = feature({ id: 'w400', kind: 'office', label: 'オフィス', name: 'テストビル', named: true, areaSqm: 5000, levels: 25, lat: 35.68, lon: 139.76, tags: { tourism: 'attraction' } });
    const q = quoteFeature(f);
    e.debugAddCash(q.basePrice * 3);
    expect(e.buyCustomProperty(f)).toBe(true);
    const cp = getCustom(e.state, 'w400')!;
    expect(cp.prominence).toBeGreaterThan(1);
    // 賃料は知名度を割り戻した額から計算する
    const rent = customRentPerSec(e.state, cp);
    expect(rent).toBeLessThan((q.basePrice * 0.0015) / 3600 * 10);
  });
});

describe('セーブの移行 v8 → v9', () => {
  it('自動化の設定が足される', async () => {
    const { migrateSave } = await import('../state/migrations');
    const { GAME_META } = await import('@/game/data/meta');
    const s = migrateSave({ saveVersion: 8, company: { cash: 100 }, lands: [] });
    expect(s.saveVersion).toBe(GAME_META.saveVersion);
    expect(s.automation).toBeTruthy();
    expect(s.automation.recipes).toEqual([]);
  });
});
