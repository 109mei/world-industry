/**
 * 貿易。安いところで仕入れ、運び、高いところで売る。
 *
 * ここで見張るのは「ただで儲かる抜け道がないか」と「荷が確実に届くか」。
 * 運賃と関税を無視できると、同じ品を往復させるだけでお金が増えてしまう。
 */
import { describe, expect, it } from 'vitest';
import { FACILITY_MAP, facilityBulkCost, facilityCost, type FacilityId } from '@/game/data/facilities';
import { RESOURCE_MAP } from '@/game/data/resources';
import { COUNTRIES, COUNTRY_MAP, SHIP_MODES, SHIP_MODE_MAP, canUseMode, shipCost, shipSeconds } from '@/game/data/trade';
import { GameEngine } from '../GameEngine';
import { bestMarkets, fleetCount, fleetIdle, countryUnitPrice, isTradeUnlocked, pitchChance, quote, tradeState } from '../systems/trade';

let clock = 1_000_000;

/** 試験用に建てておく設備。貿易には置き場と自社の乗り物が要る */
const SETUP: [FacilityId, number][] = [
  ['small_warehouse', 30],
  ['fleet_ship', 20],
  ['fleet_plane', 3],
  ['fleet_truck', 3],
];
/**
 * 上の一式を建てるのに要るお金。
 * 施設の値段を現実の額に直したので、貿易船は1隻50億円、20隻だと値上がりぶんを入れて5,000億円を超える。
 * 額を直書きすると値段を変えるたびに壊れるので、データから積み上げて出す。
 */
const SETUP_COST = SETUP.reduce((sum, [id, n]) => sum + facilityBulkCost(FACILITY_MAP[id], 0, n), 0);
/** 貿易船1隻の値段。あとから買い足すテストで使う */
const SHIP_COST = facilityCost(FACILITY_MAP['fleet_ship'], 0);

function makeEngine(cash = 0, rng: () => number = () => 0.42) {
  clock = 1_000_000;
  const e = new GameEngine({ rng, now: () => clock });
  e.keepDefaultHq();
  e.updateSettings({ events: false });
  (e.state.research.completed as Record<string, boolean>).overseas = true;
  e.debugAddCash(SETUP_COST);
  // 貿易には自社の乗り物がいる（買わないと運べない）
  e.state.unlocked['facility:fleet_ship'] = true;
  e.state.unlocked['facility:fleet_plane'] = true;
  e.state.unlocked['facility:fleet_truck'] = true;
  for (const [id, n] of SETUP) expect(e.buyFacility(id, n, 'hq'), `${id}×${n}`).toBe(n);
  e.refreshDerived();
  e.debugAddResource('iron', 10_000);
  e.state.company.cash = cash;
  // 商談は「地図で見つけた実在の会社」からしか来ないので、取引先を用意しておく
  e.state.sales = e.state.sales ?? { clients: {}, offers: [], deals: [], nextId: 1 };
  for (let i = 0; i < 4; i++) {
    const id = `osm:test${i}`;
    e.state.sales.clients[id] = {
      id, name: `テスト商会${i}`, label: '工場', kind: 'industrial',
      lat: 34.7 + i * 0.05, lon: 135.5 + i * 0.05, areaSqm: 800, levels: 2,
      regionLabel: '大阪', relation: 0, deliveries: 0, lastPitchAt: 0, missed: 0,
    } as never;
  }
  e.refreshDerived();
  return e;
}

describe('貿易のデータ', () => {
  it('国は重複せず、日本が含まれる', () => {
    const ids = COUNTRIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('JP');
  });

  it('得意な品と足りない品が、同じ国で重なっていない', () => {
    for (const c of COUNTRIES) {
      const both = c.strong.filter((r) => c.short.includes(r));
      expect(both, `${c.name}: ${both.join('・')}`).toEqual([]);
    }
  });

  it('遠いほど時間も運賃もかかる', () => {
    for (const m of SHIP_MODES) {
      expect(shipSeconds(m.id, 20_000)).toBeGreaterThan(shipSeconds(m.id, 1_000));
      expect(shipCost(m.id, 20_000, 1)).toBeGreaterThan(shipCost(m.id, 1_000, 1));
    }
  });

  it('飛行機は速くて高い、船は遅くて安い', () => {
    expect(shipSeconds('air', 10_000)).toBeLessThan(shipSeconds('ship', 10_000));
    expect(shipCost('air', 10_000, 10)).toBeGreaterThan(shipCost('ship', 10_000, 10));
  });

  it('トラックは遠くへは使えない', () => {
    expect(canUseMode('truck', 500, 1).ok).toBe(true);
    expect(canUseMode('truck', 10_000, 1).ok).toBe(false);
  });
});

describe('国ごとの値段', () => {
  it('産地では安く、足りない国では高い', () => {
    const e = makeEngine();
    // オーストラリアは鉄鉱石の産地、ドイツは足りない側
    expect(countryUnitPrice(e.state, 'AU', 'iron_ore')).toBeLessThan(countryUnitPrice(e.state, 'DE', 'iron_ore'));
    // サウジは原油が安い
    const best = bestMarkets(e.state, 'crude_oil');
    expect(best.low).toBeLessThan(best.high);
  });

  it('値段が0以下になることはない', () => {
    const e = makeEngine();
    const ts = tradeState(e.state);
    for (const c of COUNTRIES) ts.fx[c.id] = 0;
    for (const c of COUNTRIES) expect(countryUnitPrice(e.state, c.id, 'iron')).toBeGreaterThan(0);
  });
});

describe('仕入れと売却', () => {
  it('研究していないと取引できない', () => {
    const e = makeEngine(10_000_000);
    (e.state.research.completed as Record<string, boolean>).overseas = false;
    e.state.lands = e.state.lands.slice(0, 1);
    expect(isTradeUnlocked(e.state)).toBe(false);
    expect(e.tradeImport('AU', 'iron_ore', 100, 'ship').ok).toBe(false);
  });

  it('仕入れると現金が減り、届いてから在庫が増える', () => {
    const e = makeEngine(100_000_000);
    const before = e.state.company.cash;
    const q = quote(e.state, 'AU', 'iron_ore', 500, 'ship', 'import');
    const r = e.tradeImport('AU', 'iron_ore', 500, 'ship');
    expect(r.ok).toBe(true);
    expect(e.state.company.cash).toBeCloseTo(before - q.total, 0);
    // 出した直後はまだ届いていない
    expect(e.state.inventory.iron_ore ?? 0).toBe(0);
    e.advance(q.seconds + 2);
    expect(e.state.inventory.iron_ore ?? 0).toBeGreaterThan(0);
    // 荷は降ろしたが、船はまだ帰り道にいる
    expect(tradeState(e.state).shipments[0]?.leg).toBe('back');
    e.advance(q.seconds + 2);
    expect(tradeState(e.state).shipments.length).toBe(0);
  });

  it('売ると在庫が先に減り、届いてから現金が入る', () => {
    const e = makeEngine(1_000_000);
    // 1個＝1kg になったので、1,000個＝1tでは売上が数万円にしかならない。
    // 航海のあいだ船団の人件費（261人ぶん）が出ていくため、それでは「入った」ことが見えない。
    // 鉄500t（＝500,000kg、95円/kg で約4,750万円）を積んで、届いた分が現金に乗るのを確かめる。
    const qty = 500_000;
    e.debugAddResource('iron', qty);
    const stock = e.state.inventory.iron ?? 0;
    const q = quote(e.state, 'DE', 'iron', qty, 'ship', 'export');
    const cash = e.state.company.cash;
    const r = e.tradeExport('DE', 'iron', qty, 'ship');
    expect(r.ok).toBe(true);
    expect(e.state.inventory.iron).toBe(stock - qty);
    expect(e.state.company.cash).toBe(cash);
    e.advance(q.seconds + 2);
    expect(e.state.company.cash).toBeGreaterThan(cash);
  });

  it('同じ国へ往復させても、運賃と関税でお金は増えない', () => {
    const e = makeEngine(500_000_000);
    const start = e.state.company.cash + (e.state.inventory.iron ?? 0) * RESOURCE_MAP['iron'].basePrice;
    for (let i = 0; i < 12; i++) {
      // 買って、届いたらそのまま同じ国へ売り返す
      const r = e.tradeImport('CN', 'steel', 200, 'ship');
      if (!r.ok) break;
      e.advance((r.shipment?.totalSeconds ?? 60) + 2);
      const back = e.tradeExport('CN', 'steel', 200, 'ship');
      if (!back.ok) break;
      e.advance((back.shipment?.totalSeconds ?? 60) + 2);
    }
    const end = e.state.company.cash + (e.state.inventory.steel ?? 0) * RESOURCE_MAP['steel'].basePrice;
    expect(end).toBeLessThan(start);
  });

  it('持っている船の数までしか、同時に運べない', () => {
    const e = makeEngine(500_000_000);
    const ships = fleetCount(e.state, 'ship');
    expect(ships).toBe(20);
    for (let i = 0; i < ships; i++) expect(e.tradeImport('CN', 'cloth', 10, 'ship').ok, `${i}件目`).toBe(true);
    const over = e.tradeImport('CN', 'cloth', 10, 'ship');
    expect(over.ok).toBe(false);
    expect(over.reason).toContain('出払って');
  });

  it('乗り物を持っていないと運べない', () => {
    const e = makeEngine(500_000_000);
    e.state.facilities = e.state.facilities.filter((f) => !String(f.typeId).startsWith('fleet_'));
    e.refreshDerived();
    const r = e.tradeImport('CN', 'cloth', 10, 'ship');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('持っていません');
  });

  it('1台で運べる重さには上限がある', () => {
    const e = makeEngine(500_000_000_000);
    // 飛行機は100tまで。鋼鉄は1個＝1kg（0.001t）なので、ちょうど 100,000個が上限になる
    const maxUnits = SHIP_MODE_MAP['air'].maxTons / RESOURCE_MAP['steel'].weight;
    expect(maxUnits).toBe(100_000);
    expect(e.tradeImport('CN', 'steel', maxUnits, 'air').ok).toBe(true);
    expect(e.tradeImport('CN', 'steel', maxUnits + 1, 'air').ok).toBe(false);
  });

  it('荷が着いてから帰ってくるまで、その乗り物は使えない', () => {
    // 船を1隻だけ買い直す。1隻50億円なので、その額に仕入れ代を足して持たせる
    const e = makeEngine(SHIP_COST + 500_000_000);
    e.state.facilities = e.state.facilities.filter((f) => f.typeId !== 'fleet_ship');
    expect(e.buyFacility('fleet_ship', 1, 'hq')).toBe(1);
    e.refreshDerived();
    const r = e.tradeImport('CN', 'cloth', 10, 'ship');
    expect(r.ok).toBe(true);
    const half = r.shipment!.totalSeconds;
    e.advance(half + 2);
    // 荷は届いたが、船はまだ帰り道
    expect(e.state.inventory.cloth ?? 0).toBeGreaterThan(0);
    expect(fleetIdle(e.state, 'ship')).toBe(0);
    expect(e.tradeImport('CN', 'cloth', 10, 'ship').ok).toBe(false);
    e.advance(half + 2);
    // 帰ってきたので、また出せる
    expect(fleetIdle(e.state, 'ship')).toBe(1);
    expect(e.tradeImport('CN', 'cloth', 10, 'ship').ok).toBe(true);
  });

  it('持っていない品は売れない', () => {
    const e = makeEngine(1_000_000);
    expect(e.tradeExport('US', 'gold', 10, 'ship').ok).toBe(false);
  });

  it('所持金が足りないと仕入れられない', () => {
    const e = makeEngine(10);
    expect(e.tradeImport('AU', 'iron_ore', 10_000, 'ship').ok).toBe(false);
  });
});

describe('売り込み（交渉）', () => {
  it('安く出すほど通りやすく、高く出すほど通らない', () => {
    expect(pitchChance(100, 80)).toBeGreaterThan(pitchChance(100, 100));
    expect(pitchChance(100, 100)).toBeGreaterThan(pitchChance(100, 120));
    expect(pitchChance(100, 300)).toBeLessThan(0.05);
    expect(pitchChance(100, 50)).toBeGreaterThan(0.9);
  });

  it('通れば在庫が減り、断られれば減らない', () => {
    const e = makeEngine(1_000_000, () => 0.01); // 必ず通る
    const before = e.state.inventory.iron ?? 0;
    const ok = e.tradePitch('DE', 'iron', 100, countryUnitPrice(e.state, 'DE', 'iron'));
    expect(ok.accepted).toBe(true);
    expect(e.state.inventory.iron).toBe(before - 100);

    const e2 = makeEngine(1_000_000, () => 0.99); // 必ず断られる
    const had = e2.state.inventory.iron ?? 0;
    const ng = e2.tradePitch('DE', 'iron', 100, countryUnitPrice(e2.state, 'DE', 'iron') * 3);
    expect(ng.accepted).toBe(false);
    expect(e2.state.inventory.iron).toBe(had);
  });

  it('どれだけ安く出しても、100%通るわけではない（相手にも都合がある）', () => {
    expect(pitchChance(100, 1)).toBeLessThanOrEqual(0.97);
    expect(pitchChance(100, 1)).toBeGreaterThan(0.9);
  });
});

describe('商談', () => {
  it('時間がたつと商談が届き、期限が来ると消える', () => {
    const e = makeEngine(1_000_000, (() => { let i = 0; return () => ((i = (i * 1103515245 + 12345) % 2147483648), i / 2147483648); })());
    e.advance(400);
    const ts = tradeState(e.state);
    expect(ts.offers.length).toBeGreaterThan(0);
    for (const o of ts.offers) {
      expect(o.qty).toBeGreaterThan(0);
      expect(o.unitPrice).toBeGreaterThan(0);
      expect(COUNTRY_MAP[o.country as 'AU']).toBeTruthy();
    }
    e.advance(600);
    // 期限切れで入れ替わっていく（無限に溜まらない）
    expect(tradeState(e.state).offers.length).toBeLessThanOrEqual(6);
  });

  it('断ると商談は消える', () => {
    const e = makeEngine(1_000_000, (() => { let i = 7; return () => ((i = (i * 1103515245 + 12345) % 2147483648), i / 2147483648); })());
    e.advance(400);
    const ts = tradeState(e.state);
    const n = ts.offers.length;
    expect(n).toBeGreaterThan(0);
    expect(e.tradeDecline(ts.offers[0].id)).toBe(true);
    expect(tradeState(e.state).offers.length).toBe(n - 1);
  });
});
