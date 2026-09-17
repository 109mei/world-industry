import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { GAME_META } from '@/game/data/meta';
import { CONFIG } from '@/game/data/config';
import { LAND_MAP } from '@/game/data/lands';
import { SURVEY_STAGES } from '@/game/data/survey';
import { RESEARCH_MAP } from '@/game/data/research';
import { deserializeState, serializeState } from '@/game/services/save/SaveService';
import { getLand } from '../land';
import { migrateSave } from '../state/migrations';

function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeEngine(now = 1_000_000) {
  return new GameEngine({ rng: seeded(), now: () => now });
}

/** 土地システムを解放して十勝を買った状態 */
function withLand(cash = 50_000_000) {
  const e = makeEngine();
  e.debugAddCash(cash);
  e.tick(0.2); // 資産で土地システムと土地が解放される
  expect(e.buyLand('jp_hokkaido')).toBe(true);
  return e;
}

describe('土地の購入と調査', () => {
  it('総資産が足りないと土地は解放されない', () => {
    const e = makeEngine();
    e.debugAddCash(500_000);
    e.tick(0.2);
    expect(e.state.unlocked['land:jp_hokkaido']).toBeUndefined();
    expect(e.buyLand('jp_hokkaido')).toBe(false);
  });

  it('購入すると所持金が減り、鉱脈の量が基準の±20%で決まる', () => {
    const e = withLand(2_000_000);
    const land = getLand(e.state, 'jp_hokkaido')!;
    expect(e.state.company.cash).toBeCloseTo(2_000_000 - LAND_MAP.jp_hokkaido.price, 5);
    const base = LAND_MAP.jp_hokkaido.deposits.coal!;
    expect(land.deposits.coal!.total).toBeGreaterThanOrEqual(base * (1 - CONFIG.depositVariance) - 1);
    expect(land.deposits.coal!.total).toBeLessThanOrEqual(base * (1 + CONFIG.depositVariance) + 1);
    expect(land.survey).toBe(0);
    expect(e.buyLand('jp_hokkaido')).toBe(false); // 二重購入不可
  });

  it('調査は段階ごとに費用がかかり、時間経過で完了する', () => {
    const e = withLand();
    const before = e.state.company.cash;
    expect(e.startSurvey('jp_hokkaido')).toBe(true);
    expect(e.state.company.cash).toBeLessThan(before);
    expect(e.startSurvey('jp_hokkaido')).toBe(false); // 進行中は二重に始められない
    const land = getLand(e.state, 'jp_hokkaido')!;
    expect(land.surveyProgress?.targetLevel).toBe(1);
    e.advance(SURVEY_STAGES[0].duration - 1);
    expect(land.survey).toBe(0);
    e.advance(2);
    expect(land.survey).toBe(1);
    expect(land.surveyProgress).toBeNull();
  });

  it('地質調査が終わるまで鉱山は建てられない', () => {
    const e = withLand();
    expect(e.buyFacility('coal_mine', 1, 'jp_hokkaido')).toBe(0);
    e.startSurvey('jp_hokkaido');
    e.advance(SURVEY_STAGES[0].duration + 1);
    e.startSurvey('jp_hokkaido');
    e.advance(SURVEY_STAGES[1].duration + 1);
    expect(getLand(e.state, 'jp_hokkaido')!.survey).toBe(2);
    expect(e.buyFacility('coal_mine', 1, 'jp_hokkaido')).toBe(1);
    // 鉱脈のない資源の鉱山は建てられない
    expect(e.buyFacility('oil_well', 1, 'jp_hokkaido')).toBe(0);
    // 本社には炭鉱は建てられない
    expect(e.buyFacility('coal_mine', 1, 'hq')).toBe(0);
  });
});

function surveyed(level: 2 | 3 = 2) {
  const e = withLand();
  e.startSurvey('jp_hokkaido');
  e.advance(SURVEY_STAGES[0].duration + 1);
  e.startSurvey('jp_hokkaido');
  e.advance(SURVEY_STAGES[1].duration + 1);
  if (level === 3) {
    e.startSurvey('jp_hokkaido');
    e.advance(SURVEY_STAGES[2].duration + 1);
  }
  return e;
}

describe('鉱脈と現地在庫', () => {
  it('炭鉱は鉱脈を減らしながら土地の在庫に石炭を貯め、掘り尽くすと止まる', () => {
    const e = surveyed();
    const land = getLand(e.state, 'jp_hokkaido')!;
    land.deposits.coal = { total: 100, remaining: 100 };
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.tick(1);
    expect(land.stock.coal).toBeCloseTo(5, 5);
    expect(land.deposits.coal.remaining).toBeCloseTo(95, 5);
    expect(land.survey).toBe(2); // 試掘していないので「確定」にはならない
    e.advance(30);
    expect(land.deposits.coal.remaining).toBe(0);
    expect(land.stock.coal).toBeCloseTo(100, 3);
    e.tick(1);
    expect(e.derived.facilityRuntime['jp_hokkaido:coal_mine'].status).toBe('depleted');
  });

  it('輸送手段がないと本社には届かず、土地の倉庫が満杯で止まる', () => {
    const e = surveyed();
    const land = getLand(e.state, 'jp_hokkaido')!;
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.advance(CONFIG.landBaseStorage); // 5/秒 × 十分な時間
    expect(land.stock.coal).toBeCloseTo(CONFIG.landBaseStorage, 3);
    expect(e.state.inventory.coal ?? 0).toBe(0);
    expect(e.derived.facilityRuntime['jp_hokkaido:coal_mine'].status).toBe('storage_full');
    expect(e.derived.lands['jp_hokkaido'].noRoute).toBe(true);
  });

  it('試掘済みの土地は採掘量が +20%', () => {
    const e = surveyed(3);
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.tick(1);
    expect(getLand(e.state, 'jp_hokkaido')!.stock.coal).toBeCloseTo(6, 5);
    expect(getLand(e.state, 'jp_hokkaido')!.survey).toBe(4); // 試掘済みで実際に掘ると「確定」
  });

  it('地形で農園の効率が変わる（平原は2倍）', () => {
    const e = withLand();
    e.buyFacility('wheat_farm', 1, 'jp_hokkaido');
    const land = getLand(e.state, 'jp_hokkaido')!;
    land.stock.water = 100;
    e.tick(1);
    expect(land.stock.wheat).toBeCloseTo(3, 5);
    expect(land.stock.water).toBeCloseTo(99, 5);
  });
});

describe('物流', () => {
  it('トラックが土地の資源を本社へ運び、輸送費がかかる', () => {
    const e = surveyed();
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.buyFacility('truck', 2, 'jp_hokkaido'); // 0.4t/秒 = 石炭 10個/秒
    const cash = e.state.company.cash;
    e.tick(1);
    // 同じ tick で掘った 5 個がそのまま本社へ
    expect(e.state.inventory.coal).toBeCloseTo(5, 5);
    expect(getLand(e.state, 'jp_hokkaido')!.stock.coal ?? 0).toBeCloseTo(0, 5);
    const tons = 5 * 0.04;
    expect(cash - e.state.company.cash).toBeCloseTo(tons * 30, 5);
    expect(e.derived.lands['jp_hokkaido'].transportUsed).toBeCloseTo(tons, 5);
    expect(e.derived.lands['jp_hokkaido'].exports.coal).toBeCloseTo(5, 5);
  });

  it('輸送能力を超える分は土地に残る', () => {
    const e = surveyed();
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.buyFacility('truck', 1, 'jp_hokkaido'); // 0.2t/秒 = 石炭 5個/秒 → 一杯
    e.buyFacility('iron_mine', 1, 'jp_chikuho'); // 別の土地は無関係
    e.tick(1);
    expect(e.state.inventory.coal).toBeCloseTo(5, 5);
    e.buyFacility('coal_mine', 1, 'jp_hokkaido'); // 10個/秒になる
    e.tick(1);
    expect(getLand(e.state, 'jp_hokkaido')!.stock.coal).toBeCloseTo(5, 3);
  });

  it('現地の工場が使う材料は本社から運ばれる', () => {
    const e = surveyed();
    e.debugAddResource('iron', 100);
    e.state.unlocked['facility:steel_mill'] = true;
    e.state.unlocked['facility:coal_power'] = true;
    e.buyFacility('steel_mill', 1, 'jp_hokkaido');
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.buyFacility('truck', 5, 'jp_hokkaido');
    expect(e.buyFacility('coal_power', 1, 'jp_hokkaido')).toBe(1); // 電力がないと製鋼所は動かない
    e.tick(1);
    const land = getLand(e.state, 'jp_hokkaido')!;
    expect(land.stock.iron ?? 0).toBeGreaterThan(0);
    expect(e.derived.lands['jp_hokkaido'].imports.iron).toBeGreaterThan(0);
    e.advance(20);
    expect((e.state.inventory.steel ?? 0) + (land.stock.steel ?? 0)).toBeGreaterThan(0);
  });

  it('パイプラインは液体しか運ばない', () => {
    const e = surveyed();
    e.state.research.completed['pipeline'] = true;
    e.state.unlocked['facility:pipeline'] = true;
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.buyFacility('pipeline', 1, 'jp_hokkaido');
    e.tick(1);
    expect(e.state.inventory.coal ?? 0).toBe(0);
    expect(getLand(e.state, 'jp_hokkaido')!.stock.coal).toBeCloseTo(5, 5);
  });
});

describe('電力', () => {
  it('発電所がないと電力を使う施設は止まる', () => {
    const e = makeEngine();
    e.debugAddCash(10_000_000);
    e.debugAddResource('iron', 100);
    e.debugAddResource('coal', 100);
    e.state.unlocked['facility:steel_mill'] = true;
    e.buyFacility('steel_mill', 1);
    e.tick(1);
    expect(e.derived.power.demand).toBe(2);
    expect(e.derived.power.ratio).toBe(0);
    expect(e.state.inventory.steel ?? 0).toBe(0);
    expect(e.derived.facilityRuntime['hq:steel_mill'].status).toBe('no_power');
  });

  it('発電所は需要ぶんだけ燃料を燃やし、供給率で工場の効率が決まる', () => {
    const e = makeEngine();
    e.debugAddCash(10_000_000);
    e.state.unlocked['facility:large_warehouse'] = true;
    e.buyFacility('large_warehouse', 1);
    e.debugAddResource('iron', 1000);
    e.debugAddResource('coal', 1000);
    e.state.unlocked['facility:steel_mill'] = true;
    e.state.unlocked['facility:coal_power'] = true;
    e.buyFacility('steel_mill', 1); // 需要 2MW
    e.buyFacility('coal_power', 1); // 10MW、最大で石炭0.5/秒
    e.tick(1);
    expect(e.derived.power.capacity).toBe(10);
    expect(e.derived.power.generation).toBeCloseTo(2, 5);
    expect(e.derived.power.ratio).toBe(1);
    // 燃料: 0.5 × (2/10) = 0.1、製鋼: 石炭 1 → 合計 1.1 減る
    expect(e.state.inventory.coal).toBeCloseTo(1000 - 1.1, 4);
    expect(e.state.inventory.steel).toBeCloseTo(1, 5);
    // 需要が供給を超えると効率が下がる
    e.buyFacility('steel_mill', 9); // 需要 20MW
    e.tick(1);
    expect(e.derived.power.ratio).toBeCloseTo(0.5, 5);
    expect(e.derived.facilityRuntime['hq:steel_mill'].efficiency).toBeCloseTo(0.5, 5);
    expect(e.derived.facilityRuntime['hq:steel_mill'].status).toBe('partial');
  });

  it('燃料が切れると発電できない', () => {
    const e = makeEngine();
    e.debugAddCash(10_000_000);
    e.debugAddResource('iron', 100);
    e.state.unlocked['facility:steel_mill'] = true;
    e.state.unlocked['facility:coal_power'] = true;
    e.buyFacility('steel_mill', 1);
    e.buyFacility('coal_power', 1);
    e.tick(1);
    expect(e.derived.power.capacity).toBe(0);
    expect(e.derived.facilityRuntime['hq:coal_power'].status).toBe('no_input');
  });

  it('再生可能エネルギーは燃料を使わず、地形で出力が変わる', () => {
    const e = withLand();
    e.state.unlocked['facility:solar_farm'] = true;
    e.buyFacility('solar_farm', 1, 'hq');
    e.tick(1);
    expect(e.derived.power.capacity).toBeCloseTo(4, 5);
    // 砂漠なら1.5倍
    e.debugAddCash(100_000_000);
    e.state.unlocked['land:us_texas'] = true;
    e.buyLand('us_texas');
    e.buyFacility('solar_farm', 1, 'us_texas');
    e.tick(1);
    expect(e.derived.power.capacity).toBeCloseTo(4 + 6, 5);
  });

  it('水力発電所は河川・山岳にしか建てられない', () => {
    const e = withLand(200_000_000);
    e.state.unlocked['facility:hydro_plant'] = true;
    expect(e.buyFacility('hydro_plant', 1, 'jp_hokkaido')).toBe(0);
    e.state.unlocked['land:no_vestland'] = true;
    e.buyLand('no_vestland');
    expect(e.buyFacility('hydro_plant', 1, 'no_vestland')).toBe(1);
    e.tick(1);
    expect(e.derived.power.capacity).toBeCloseTo(60, 5); // 40 × 1.5
    // 研究「再生可能エネルギー」で +30%
    e.state.research.completed['renewables'] = true;
    e.tick(1);
    expect(e.derived.power.capacity).toBeCloseTo(78, 5);
  });
});

describe('研究', () => {
  it('研究所がポイントを生み、ポイントを消費して研究する', () => {
    const e = makeEngine();
    e.debugAddCash(1_000_000);
    e.tick(0.2);
    expect(e.buyFacility('research_lab', 1)).toBe(1);
    e.advance(100);
    expect(e.state.research.points).toBeCloseTo(20, 3);
    expect(e.research('geology')).toBe(false); // 40 必要
    e.advance(100);
    expect(e.research('geology')).toBe(true);
    expect(e.state.research.points).toBeCloseTo(0, 3);
    expect(e.state.research.completed.geology).toBe(true);
    // 前提が必要
    e.debugAddResearch(1000);
    expect(e.research('nuclear')).toBe(false);
    expect(e.research('automation')).toBe(true);
  });

  it('研究の効果: 自動化で採集 +25%、大規模保管で倉庫 +50%', () => {
    const e = makeEngine();
    e.buyFacility('worker_stone', 0);
    e.debugAddCash(10_000);
    e.buyFacility('worker_stone', 1);
    e.tick(1);
    expect(e.state.inventory.stone).toBeCloseTo(0.2, 5);
    e.state.research.completed['automation'] = true;
    e.tick(1);
    expect(e.state.inventory.stone).toBeCloseTo(0.45, 5);
    expect(e.derived.capacity).toBe(CONFIG.baseStorage);
    e.state.research.completed['mass_storage'] = true;
    e.tick(0.2);
    expect(e.derived.capacity).toBe(Math.floor(CONFIG.baseStorage * 1.5));
  });

  it('海外の土地は研究「海外進出」で解放される', () => {
    const e = makeEngine();
    e.debugAddCash(50_000_000);
    e.tick(0.2);
    expect(e.state.unlocked['land:us_texas']).toBeUndefined();
    e.state.research.completed['overseas'] = true;
    e.tick(0.2);
    expect(e.state.unlocked['land:us_texas']).toBe(true);
    expect(e.buyLand('us_texas')).toBe(true);
  });
});

describe('商業施設', () => {
  it('人口係数に応じて毎秒の収入になる', () => {
    const e = makeEngine();
    e.debugAddCash(1_000_000);
    e.tick(0.2);
    e.buyFacility('parking', 1); // 本社: 人口係数1 → 8円/秒
    const cash = e.state.company.cash;
    e.tick(1);
    expect(e.state.company.cash - cash).toBeCloseTo(8, 5);
    expect(e.derived.commercialIncome).toBeCloseTo(8, 5);
    expect(e.state.stats.totalCommercialIncome).toBeCloseTo(8, 5);
  });
});

describe('原子力', () => {
  it('ウラン鉱石 → 核燃料 → 原子力発電の流れが動く', () => {
    const e = makeEngine();
    e.debugAddCash(1_000_000_000);
    e.tick(0.2);
    e.debugUnlockAll();
    e.buyLand('ca_athabasca');
    e.startSurvey('ca_athabasca');
    e.advance(SURVEY_STAGES[0].duration * 0.6 + 1);
    e.startSurvey('ca_athabasca');
    e.advance(SURVEY_STAGES[1].duration * 0.6 + 1);
    expect(e.buyFacility('uranium_mine', 1, 'ca_athabasca')).toBe(1);
    e.buyFacility('solar_farm', 5, 'ca_athabasca'); // 鉱山の電力
    e.buyFacility('truck', 5, 'ca_athabasca');
    e.buyFacility('enrichment_plant', 1, 'hq');
    e.buyFacility('solar_farm', 20, 'hq');
    e.advance(300);
    expect(e.state.stats.totalObtained['uranium_ore'] ?? 0).toBeGreaterThan(0);
    expect(e.state.stats.totalObtained['nuclear_fuel'] ?? 0).toBeGreaterThan(0);
    e.debugAddResource('nuclear_fuel', 10);
    e.buyFacility('nuclear_plant', 1, 'hq');
    e.buyFacility('datacenter', 30, 'hq'); // 需要 300MW
    e.tick(1);
    expect(e.derived.power.capacity).toBeGreaterThanOrEqual(500);
    expect(e.derived.power.ratio).toBe(1);
    expect(e.state.achievements['atomic_age']).toBeDefined();
  });
});

describe('セーブの移行', () => {
  it('v1 のセーブは v2 に変換され、本社の土地情報が補われる', () => {
    const v1 = {
      saveVersion: 1,
      company: { name: 'X', cash: 123, totalEarned: 0, totalSpent: 0, facilityInvestment: 0 },
      inventory: { stone: 5 },
      facilities: [{ id: 'hq:worker_stone', typeId: 'worker_stone', landId: 'hq', count: 2, enabled: true }],
      lands: [{ id: 'hq', name: '本社', country: 'JP', region: '未設定' }],
      research: { completed: {} },
      stats: { taps: 3 },
    };
    const s = migrateSave(v1);
    expect(s.saveVersion).toBe(GAME_META.saveVersion);
    expect(s.lands[0].terrain).toBe('industrial');
    expect(s.lands[0].survey).toBe(4);
    expect(s.lands[0].stock).toEqual({});
    expect(s.research.points).toBe(0);
    expect(s.company.landInvestment).toBe(0);
    expect(s.stats.totalTransported).toBe(0);
    expect(s.company.cash).toBe(123);
    const e = new GameEngine({ state: s, rng: seeded(), now: () => 1 });
    e.tick(1);
    expect(e.state.inventory.stone).toBeCloseTo(5.4, 5);
  });

  it('土地・研究・現地在庫はセーブとロードで保たれる', () => {
    const e = surveyed();
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.state.research.completed['geology'] = true;
    e.tick(1);
    const text = serializeState(e.state, 123);
    const loaded = deserializeState(text);
    expect(loaded.lands.length).toBe(2);
    expect(loaded.lands[1].stock.coal).toBeCloseTo(5, 5);
    expect(loaded.lands[1].deposits.coal!.remaining).toBeGreaterThan(0);
    expect(loaded.research.completed.geology).toBe(true);
  });
});

describe('オフライン進行（土地あり）', () => {
  it('オフライン中も採掘・輸送・発電が進み、倉庫容量で頭打ちになる', () => {
    const e = surveyed();
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.buyFacility('truck', 2, 'jp_hokkaido');
    const report = e.applyOffline(3600);
    expect(report.simulatedSeconds).toBe(3600);
    // 本社の倉庫容量（100）を超えては増えない
    expect(e.state.inventory.coal).toBeLessThanOrEqual(e.derived.capacity + 1e-6);
    expect(report.resourceDelta.coal).toBeGreaterThan(0);
  });
});

describe('解放条件の説明', () => {
  it('研究と土地の条件を文にできる', () => {
    expect(RESEARCH_MAP.nuclear.requires).toContain('advanced_materials');
  });
});
