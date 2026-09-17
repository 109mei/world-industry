import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { GAME_META } from '@/game/data/meta';
import { estimateLandValue } from '@/game/data/landValue';
import { migrateSave } from '../state/migrations';
import { canBuildOn, getLand, landPopulation } from '../land';
import { FACILITY_MAP } from '@/game/data/facilities';
import { customLandId, customPrice, customRentPerSec, getCustom, quoteFeature } from '../systems/customEstate';
import { hqLocation } from '../hq';
import type { OsmFeature } from '@/game/services/osm/overpass';

function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeEngine(cash = 0) {
  const e = new GameEngine({ rng: seeded(), now: () => 1_000_000 });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  return e;
}

function feature(over: Partial<OsmFeature> = {}): OsmFeature {
  return {
    id: 'w1',
    kind: 'retail',
    label: 'コンビニ',
    name: 'セブンエレブン',
    named: true,
    lat: 33.6459,
    lon: 130.6915,
    areaSqm: 400,
    levels: 1,
    polygon: [],
    ...over,
  };
}

describe('土地の単価の見積もり', () => {
  it('都心ほど高く、郊外・地方ほど安い', () => {
    const ginza = estimateLandValue({ lat: 35.6717, lon: 139.7649 }).unitPrice;
    const setagaya = estimateLandValue({ lat: 35.642, lon: 139.599 }).unitPrice;
    const iizuka = estimateLandValue({ lat: 33.6459, lon: 130.6915 }).unitPrice;
    const hokkaido = estimateLandValue({ lat: 43.3, lon: 143.5 }).unitPrice;
    expect(ginza).toBeGreaterThan(setagaya);
    expect(setagaya).toBeGreaterThan(iizuka);
    expect(iizuka).toBeGreaterThan(hokkaido);
    expect(hokkaido).toBeGreaterThan(0);
  });

  it('海のど真ん中でも下限より下がらない', () => {
    expect(estimateLandValue({ lat: -20, lon: -140 }).unitPrice).toBeGreaterThanOrEqual(300);
  });
});

describe('実在の場所の値段', () => {
  it('面積・階数・用途で変わる', () => {
    const small = quoteFeature(feature({ areaSqm: 100 })).basePrice;
    const big = quoteFeature(feature({ areaSqm: 400 })).basePrice;
    expect(big).toBeGreaterThan(small * 3);
    const tall = quoteFeature(feature({ levels: 5 })).basePrice;
    expect(tall).toBeGreaterThan(quoteFeature(feature({ levels: 1 })).basePrice);
    const farm = quoteFeature(feature({ kind: 'farm', label: '農地', levels: 1 })).basePrice;
    expect(farm).toBeLessThan(quoteFeature(feature()).basePrice);
  });

  it('同じ建物なら銀座のほうが飯塚より高い', () => {
    const ginza = quoteFeature(feature({ lat: 35.6717, lon: 139.7649 })).basePrice;
    const iizuka = quoteFeature(feature()).basePrice;
    expect(ginza).toBeGreaterThan(iizuka * 10);
  });
});

describe('実在の場所の売買', () => {
  it('買うと土地になり、施設を建てられる', () => {
    const e = makeEngine(500_000_000);
    const f = feature();
    expect(e.buyCustomProperty(f)).toBe(true);
    const cp = getCustom(e.state, 'w1');
    expect(cp).not.toBeNull();
    expect(cp!.name).toBe('セブンエレブン');
    const land = getLand(e.state, customLandId('w1'));
    expect(land).not.toBeNull();
    expect(landPopulation(land!)).toBeGreaterThan(1);
    // 商業施設（駐車場）はこの土地に建てられる
    expect(canBuildOn(FACILITY_MAP.parking, land!).ok).toBe(true);
  });

  it('お金が足りなければ買えない', () => {
    const e = makeEngine(1000);
    expect(e.buyCustomProperty(feature())).toBe(false);
    expect(getCustom(e.state, 'w1')).toBeNull();
  });

  it('同じ場所は二重に買えない', () => {
    const e = makeEngine(500_000_000);
    expect(e.buyCustomProperty(feature())).toBe(true);
    expect(e.buyCustomProperty(feature())).toBe(false);
  });

  it('賃料が入り、資産と収入に反映される', () => {
    const e = makeEngine(500_000_000);
    e.buyCustomProperty(feature());
    const cp = getCustom(e.state, 'w1')!;
    expect(customRentPerSec(e.state, cp)).toBeGreaterThan(0);
    const before = e.state.company.cash;
    e.tick(10);
    expect(e.state.company.cash).toBeGreaterThan(before);
    expect(e.derived.rentPerSec).toBeGreaterThan(0);
    expect(e.derived.estateValue).toBeGreaterThanOrEqual(customPrice(e.state, cp));
  });

  it('売ると土地とそこに建てた施設も消える', () => {
    const e = makeEngine(500_000_000);
    e.buyCustomProperty(feature());
    const landId = customLandId('w1');
    e.debugUnlockAll();
    e.buyFacility('parking', 1, landId);
    expect(e.state.facilities.some((f) => f.landId === landId)).toBe(true);
    const got = e.sellCustomProperty('w1');
    expect(got).toBeGreaterThan(0);
    expect(getCustom(e.state, 'w1')).toBeNull();
    expect(getLand(e.state, landId) ?? null).toBeNull();
    expect(e.state.facilities.some((f) => f.landId === landId)).toBe(false);
  });
});

describe('セーブの移行 v6 → v7', () => {
  it('買った場所が土地として復元される', () => {
    const v6 = {
      saveVersion: 6,
      company: { cash: 1000 },
      lands: [],
      estate: {
        owned: {},
        custom: {
          w9: {
            id: 'w9',
            name: 'ゆめタオン',
            label: 'ショッピングモール',
            kind: 'retail',
            lat: 33.6459,
            lon: 130.6915,
            areaSqm: 5000,
            levels: 2,
            unitPrice: 30000,
            basePrice: 500_000_000,
            cityId: 'iizuka',
            regionLabel: '飯塚・嘉穂',
            country: '日本',
            boughtAt: 1,
            boughtPrice: 500_000_000,
          },
        },
      },
    };
    const s = migrateSave(v6);
    expect(s.saveVersion).toBe(GAME_META.saveVersion);
    expect(s.estate.custom?.w9).toBeTruthy();
    expect(s.lands.some((l) => l.id === 'osm:w9')).toBe(true);
  });

  it('custom のない古いセーブでも壊れない', () => {
    const s = migrateSave({ saveVersion: 6, company: { cash: 5 }, lands: [], estate: { owned: {} } });
    expect(s.estate.custom).toEqual({});
  });
});

describe('本社の場所', () => {
  it('初期値は大阪、変えると保存され、戻せる', () => {
    const e = makeEngine();
    expect(hqLocation(e.state).label).toBe('大阪');
    e.setHqLocation(33.6459, 130.6915);
    expect(e.state.settings.hqLocation).toBeTruthy();
    expect(hqLocation(e.state).lat).toBeCloseTo(33.6459, 4);
    expect(hqLocation(e.state).label).toContain('飯塚');
    e.resetHqLocation();
    expect(e.state.settings.hqLocation).toBeNull();
    expect(hqLocation(e.state).label).toBe('大阪');
  });

  it('おかしな座標は受け付けない', () => {
    const e = makeEngine();
    e.setHqLocation(Number.NaN, 130);
    expect(e.state.settings.hqLocation ?? null).toBeNull();
  });
});

describe('買った実在の土地で採掘できる', () => {
  it('地形に応じた埋蔵が入り、調査してから鉱山を建てられる', () => {
    const e = makeEngine(5_000_000_000);
    // 山あいの広い土地（農地・森でない区画）
    const f = feature({ id: 'w500', kind: 'land', label: '空き地', name: '空き地', areaSqm: 40_000, levels: 1, lat: 33.53, lon: 130.72, tags: { landuse: 'quarry' } });
    expect(e.buyCustomProperty(f)).toBe(true);
    const land = getLand(e.state, customLandId('w500'))!;
    expect(land.terrain).toBe('mountain');
    expect(Object.keys(land.deposits).length).toBeGreaterThan(0);
    expect(land.survey).toBe(0);
    // 未調査では鉱山を建てられない（地質調査が要る）
    e.debugUnlockAll();
    const before = canBuildOn(FACILITY_MAP.iron_mine, land);
    expect(before.ok).toBe(false);
    if (!before.ok) expect(before.reason).toContain('地質調査');
    // 調査を2段階進める
    for (let i = 0; i < 2; i++) {
      expect(e.startSurvey(land.id)).toBe(true);
      e.tick(400);
    }
    const after = getLand(e.state, customLandId('w500'))!;
    expect(after.survey).toBeGreaterThanOrEqual(2);
    const check = canBuildOn(FACILITY_MAP.iron_mine, after);
    // 鉄鉱石が埋まっていれば建てられる。なければ「鉱脈がありません」になる
    if ((after.deposits.iron_ore?.total ?? 0) > 0) expect(check.ok).toBe(true);
    else if (!check.ok) expect(check.reason).toContain('鉱脈');
  });

  it('同じ地域・同じ地形なら似た埋蔵になる', () => {
    const e = makeEngine(5_000_000_000);
    const a = feature({ id: 'w601', kind: 'farm', label: '農地', name: '農地', areaSqm: 20_000, lat: 33.50, lon: 130.70, tags: { landuse: 'farmland' } });
    const b = feature({ id: 'w602', kind: 'farm', label: '農地', name: '農地', areaSqm: 20_000, lat: 33.51, lon: 130.71, tags: { landuse: 'farmland' } });
    e.buyCustomProperty(a);
    e.buyCustomProperty(b);
    const la = getLand(e.state, customLandId('w601'))!;
    const lb = getLand(e.state, customLandId('w602'))!;
    expect(Object.keys(la.deposits).sort()).toEqual(Object.keys(lb.deposits).sort());
  });

  it('街なかの店には鉱脈がなく、調査も要らない', () => {
    const e = makeEngine(5_000_000_000);
    const f = feature({ id: 'w700', tags: { building: 'retail', shop: 'convenience' }, lat: 33.6459, lon: 130.6915 });
    e.buyCustomProperty(f);
    const land = getLand(e.state, customLandId('w700'))!;
    expect(land.terrain).toBe('city');
    expect(land.survey).toBe(4);
  });
});
