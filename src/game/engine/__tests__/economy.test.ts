import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { CONFIG } from '@/game/data/config';
import { EVENT_MAP } from '@/game/data/events';
import { GAME_META } from '@/game/data/meta';
import { LANDS } from '@/game/data/lands';
import { RESOURCE_MAP } from '@/game/data/resources';
import { getLand } from '../land';
import { currentPrice, demandFactor, getMarketState, referencePrice, sellRevenue } from '../systems/market';
import { migrateSave } from '../state/migrations';

function seeded(seed = 11): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeEngine(now = 1_000_000) {
  const e = new GameEngine({ rng: seeded(), now: () => now });
  e.updateSettings({ events: false });
  return e;
}

/** 土地を買って地質調査まで終え、必要なら施設を建てられる状態 */
function withSurveyedLand(landId: 'jp_hokkaido' | 'us_texas' | 'br_carajas' = 'jp_hokkaido', cash = 200_000_000) {
  const e = makeEngine();
  e.debugAddCash(cash);
  e.debugUnlockAll();
  e.buyFacility('small_warehouse', 5);
  e.buyFacility('large_warehouse', 3);
  expect(e.buyLand(landId)).toBe(true);
  const land = getLand(e.state, landId)!;
  land.survey = 2;
  return { e, land };
}

describe('市場の需要曲線', () => {
  it('大量に売ると需要が飽和して価格が下がり、時間で回復する', () => {
    const e = makeEngine();
    e.state.unlocked['facility:large_warehouse'] = true;
    e.debugAddCash(1_000_000);
    e.buyFacility('large_warehouse', 1);
    const cap = RESOURCE_MAP.tool.liquidity * CONFIG.market.demandCapacityMult;
    e.debugAddResource('tool', cap);
    const ref = referencePrice(e.state, 'tool');
    expect(demandFactor(e.state, 'tool')).toBeCloseTo(1, 6);
    // 需要容量ぶんを一気に売ると、1個あたりの平均価格は ln2 ≈ 69% になる
    const revenue = e.sell('tool', cap);
    expect(revenue / cap).toBeCloseTo(ref * Math.log(2), 0);
    expect(demandFactor(e.state, 'tool')).toBeCloseTo(0.5, 3);
    expect(currentPrice(e.state, 'tool')).toBeLessThan(ref * 0.6);
    // 回復: 時定数の3倍でほぼ戻る
    e.advance(CONFIG.market.demandRecoverySeconds * 3);
    expect(demandFactor(e.state, 'tool')).toBeGreaterThan(0.9);
  });

  it('小口の売却は需要をほとんど飽和させない', () => {
    const e = makeEngine();
    e.debugAddResource('stone', 50);
    const before = currentPrice(e.state, 'stone');
    e.sell('stone', 50);
    expect(demandFactor(e.state, 'stone')).toBeGreaterThan(0.99);
    expect(currentPrice(e.state, 'stone')).toBeGreaterThan(before * 0.95);
  });

  it('売上の積分は 価格×個数 を超えない', () => {
    const e = makeEngine();
    const q = 5000;
    expect(sellRevenue(e.state, 'stone', q)).toBeLessThanOrEqual(referencePrice(e.state, 'stone') * q);
    expect(sellRevenue(e.state, 'stone', 0)).toBe(0);
  });

  it('マーケティングの研究で需要の回復が速くなる', () => {
    const e = makeEngine();
    e.state.unlocked['facility:large_warehouse'] = true;
    e.debugAddCash(1_000_000);
    e.buyFacility('large_warehouse', 1);
    const run = (withResearch: boolean) => {
      const en = makeEngine();
      en.state.unlocked['facility:large_warehouse'] = true;
      en.debugAddCash(1_000_000);
      en.buyFacility('large_warehouse', 1);
      if (withResearch) en.state.research.completed.marketing = true;
      en.debugAddResource('tool', 2000);
      en.sell('tool', 2000);
      en.advance(60);
      return getMarketState(en.state, 'tool').saturation;
    };
    expect(run(true)).toBeLessThan(run(false));
  });
});

describe('航空輸送', () => {
  it('貨物機はどの地形にも配備でき、輸送能力に加わる', () => {
    const { e, land } = withSurveyedLand('jp_hokkaido');
    expect(e.buyFacility('cargo_plane', 1, land.id)).toBe(1);
    e.tick(1);
    expect(e.derived.lands[land.id].transportCapacity).toBeCloseTo(3 * e.derived.modifiers.transportCapacity, 6);
  });

  it('嵐の間は貨物機の輸送能力が下がり、地震の影響は受けない', () => {
    const { e, land } = withSurveyedLand('jp_hokkaido');
    e.buyFacility('cargo_plane', 1, land.id);
    e.buyFacility('truck', 5, land.id);
    e.buyFacility('coal_mine', 1, land.id);
    e.tick(1);
    const normal = e.derived.lands[land.id].transportCapacity;
    // 嵐
    e.state.events.active.push({ id: 1, defId: 'storm', target: null, remaining: 60, total: 60, magnitude: EVENT_MAP.storm.magnitude });
    e.tick(1);
    const inStorm = e.derived.lands[land.id].transportCapacity;
    expect(inStorm).toBeLessThan(normal);
    // 貨物機ぶん（3t/s）が 20% になる: 差は 3×0.8×係数
    expect(normal - inStorm).toBeCloseTo(3 * 0.8 * e.derived.modifiers.transportCapacity, 5);
    e.state.events.active = [];
    // 地震: トラックだけ半減
    e.state.events.active.push({ id: 2, defId: 'quake', target: land.id, remaining: 60, total: 60, magnitude: EVENT_MAP.quake.magnitude });
    e.tick(1);
    const inQuake = e.derived.lands[land.id].transportCapacity;
    expect(normal - inQuake).toBeCloseTo(5 * 0.2 * 0.5 * e.derived.modifiers.transportCapacity, 5);
  });
});

describe('巨大産業', () => {
  it('自動車工場は材料が揃うと自動車を作り、売ると高額になる', () => {
    const { e } = withSurveyedLand('jp_hokkaido');
    e.buyFacility('coal_power', 5);
    e.debugAddResource('coal', 5000);
    e.buyFacility('car_factory', 1);
    for (const [id, n] of [['steel', 2000], ['plastic', 1000], ['rubber', 1000], ['glass', 500], ['electronics', 200]] as const) e.debugAddResource(id, n);
    e.advance(40);
    const inst = e.state.facilities.find((f) => f.typeId === 'car_factory')!;
    expect(e.derived.facilityRuntime[inst.id].status).toBe('running');
    expect(e.state.inventory.car ?? 0).toBeGreaterThanOrEqual(2 * 0.9);
    const cashBefore = e.state.company.cash;
    e.sell('car', 1);
    expect(e.state.company.cash - cashBefore).toBeGreaterThan(RESOURCE_MAP.car.basePrice * 0.6);
  });

  it('半導体→ロボットのチェーンが動く', () => {
    const { e } = withSurveyedLand('jp_hokkaido');
    e.buyFacility('coal_power', 10);
    e.debugAddResource('coal', 20000);
    e.buyFacility('silicon_plant', 1);
    e.buyFacility('chip_fab', 1);
    e.buyFacility('robot_factory', 1);
    e.debugAddResource('sand', 20000);
    e.debugAddResource('copper', 5000);
    e.debugAddResource('water', 20000);
    e.debugAddResource('machine_parts', 2000);
    e.debugAddResource('steel', 5000);
    e.debugAddResource('electronics', 2000);
    e.advance(120);
    // シリコンは半導体工場が使い切るので累計で確認する
    expect(e.state.stats.totalProduced.silicon ?? 0).toBeGreaterThan(0);
    expect(e.state.stats.totalProduced.semiconductor ?? 0).toBeGreaterThan(0);
    expect(e.state.stats.totalProduced.robot ?? 0).toBeGreaterThan(0);
  });

  it('新しい研究の前提関係が正しい', () => {
    const e = makeEngine();
    e.debugAddResearch(100_000);
    expect(e.research('robotics')).toBe(false);
    expect(e.research('automation')).toBe(true);
    expect(e.research('advanced_materials')).toBe(true);
    expect(e.research('automotive')).toBe(true);
    expect(e.research('robotics')).toBe(false); // semiconductor が必要
    expect(e.research('geology')).toBe(true);
    expect(e.research('overseas')).toBe(true);
    expect(e.research('commerce')).toBe(true);
    expect(e.research('semiconductor')).toBe(true);
    expect(e.research('robotics')).toBe(true);
    expect(e.derived.modifiers.production.PROCESSING).toBeCloseTo(1.1, 6);
  });
});

describe('イベント', () => {
  it('一定時間でイベントが起きて、期限が来ると消える', () => {
    const e = makeEngine();
    e.updateSettings({ events: true });
    e.debugAddCash(1_000_000);
    e.debugAddResource('stone', 50);
    e.sell('stone', 50);
    e.state.stats.playtimeSeconds = 1000;
    e.advance(CONFIG.events.firstDelaySeconds + 1);
    expect(e.state.stats.eventsOccurred).toBeGreaterThanOrEqual(1);
    // 継続イベントは残り時間が減っていく
    e.state.events.active = [];
    expect(e.debugTriggerEvent('boom')).toBe(true);
    const ev = e.state.events.active[0];
    expect(ev.defId).toBe('boom');
    expect(currentPrice(e.state, ev.target as 'stone')).toBeCloseTo(referencePrice(e.state, ev.target as 'stone') * demandFactor(e.state, ev.target as 'stone'), 6);
    expect(referencePrice(e.state, ev.target as 'stone')).toBeCloseTo(RESOURCE_MAP[ev.target as 'stone'].basePrice * getMarketState(e.state, ev.target as 'stone').modifier * 1.8, 6);
    e.advance(EVENT_MAP.boom.duration + 1);
    expect(e.state.events.active.find((a) => a.id === ev.id)).toBeUndefined();
  });

  it('猛暑で発電能力が下がり、祭りで商業収入が増える', () => {
    const { e } = withSurveyedLand('jp_hokkaido');
    e.buyFacility('coal_power', 2);
    e.debugAddResource('coal', 1000);
    e.buyFacility('steel_mill', 1);
    e.buyFacility('parking', 2);
    e.tick(1);
    const cap = e.derived.power.capacity;
    const income = e.derived.commercialIncome;
    e.state.events.active.push({ id: 1, defId: 'heatwave', target: null, remaining: 60, total: 60, magnitude: 0.7 });
    e.state.events.active.push({ id: 2, defId: 'festival', target: null, remaining: 60, total: 60, magnitude: 2 });
    e.tick(1);
    expect(e.derived.power.capacity).toBeCloseTo(cap * 0.7, 5);
    expect(e.derived.commercialIncome).toBeCloseTo(income * 2, 5);
  });

  it('地震で土地の生産が半減する', () => {
    const { e, land } = withSurveyedLand('jp_hokkaido');
    e.buyFacility('coal_mine', 1, land.id);
    e.tick(1);
    const normal = e.derived.production.coal ?? 0;
    e.state.events.active.push({ id: 1, defId: 'quake', target: land.id, remaining: 60, total: 60, magnitude: 0.5 });
    e.tick(1);
    expect(e.derived.production.coal ?? 0).toBeCloseTo(normal * 0.5, 5);
  });

  it('鉱脈発見と補助金は即時に効く', () => {
    const { e, land } = withSurveyedLand('jp_hokkaido');
    const before = land.deposits.coal!.remaining;
    expect(e.debugTriggerEvent('discovery')).toBe(true);
    expect(land.deposits.coal!.remaining).toBeGreaterThan(before);
    const cash = e.state.company.cash;
    e.state.stats.playtimeSeconds = 1000;
    expect(e.debugTriggerEvent('subsidy')).toBe(true);
    expect(e.state.company.cash).toBeGreaterThanOrEqual(cash + 50_000);
    expect(e.state.events.active.length).toBe(0);
  });

  it('設定でイベントを止められ、オフライン計算中は新しく起きない', () => {
    const e = makeEngine();
    e.state.stats.playtimeSeconds = 1000;
    e.advance(2000);
    expect(e.state.stats.eventsOccurred).toBe(0);
    e.updateSettings({ events: true });
    e.applyOffline(3000);
    expect(e.state.stats.eventsOccurred).toBe(0);
  });
});

describe('セーブの移行 v2 → v3', () => {
  it('イベント・需要・設定が補われる', () => {
    const v2 = {
      saveVersion: 2,
      company: { name: 'X', cash: 10, totalEarned: 0, totalSpent: 0, facilityInvestment: 0, landInvestment: 0 },
      market: { prices: { stone: { modifier: 1.1, history: [2] } }, autoSell: {}, nextUpdateIn: 5 },
      stats: { taps: 1 },
      settings: { numberFormat: 'full', autosaveSeconds: 10, maxOfflineSeconds: 100, showTutorial: false },
    };
    const s = migrateSave(v2);
    expect(s.saveVersion).toBe(GAME_META.saveVersion);
    expect(s.market.prices.stone!.saturation).toBe(0);
    expect(s.market.prices.stone!.modifier).toBe(1.1);
    expect(s.events.active).toEqual([]);
    expect(s.events.nextIn).toBe(CONFIG.events.firstDelaySeconds);
    expect(s.settings.numberFormat).toBe('full');
    expect(s.settings.sound).toBe(true);
    expect(s.settings.events).toBe(true);
    expect(s.stats.eventsOccurred).toBe(0);
    // 読み込んだ状態でエンジンが動く
    const e = new GameEngine({ state: s, rng: seeded(), now: () => 5 });
    e.advance(10);
    expect(e.state.stats.playtimeSeconds).toBeCloseTo(10, 6);
  });

  it('すべての土地に地図用の座標がある', () => {
    for (const l of LANDS) {
      expect(l.lat).toBeGreaterThanOrEqual(-90);
      expect(l.lat).toBeLessThanOrEqual(90);
      expect(l.lon).toBeGreaterThanOrEqual(-180);
      expect(l.lon).toBeLessThanOrEqual(180);
    }
  });
});
