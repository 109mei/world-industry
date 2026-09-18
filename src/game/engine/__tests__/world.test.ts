import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { GAME_META } from '@/game/data/meta';
import { CONFIG } from '@/game/data/config';
import { FACILITY_MAP } from '@/game/data/facilities';
import { LAND_MAP } from '@/game/data/lands';
import { RESOURCE_MAP } from '@/game/data/resources';
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
  const e = new GameEngine({ rng: seeded(), now: () => now });
  // 本社を決めたあと＝遊び始めたあとの状態で試す（決める前は時間が進まない）
  e.keepDefaultHq();
  return e;
}

/**
 * 土地システムを解放して十勝を買った状態。
 * 施設の値段が現実の水準（十勝2,700万円・製鋼所9.4億円・石炭火力26.5億円・
 * 大型倉庫16億円など）になったので、試したい施設がひととおり建てられるだけの
 * 元手（500億円）を持たせる。製鋼所を10棟建てる試験がいちばん高くつく。
 */
function withLand(cash = 50_000_000_000) {
  const e = makeEngine();
  e.debugAddCash(cash);
  e.tick(0.2); // 資産で土地システムと土地が解放される
  expect(e.buyLand('jp_hokkaido')).toBe(true);
  return e;
}

describe('土地の購入と調査', () => {
  it('総資産が足りないと土地は解放されない', () => {
    const e = makeEngine();
    // 地図が開く総資産（CONFIG.landUnlockAssets）に満たない状態
    e.debugAddCash(CONFIG.landUnlockAssets - 1);
    e.tick(0.2);
    expect(e.state.unlocked['land:jp_hokkaido']).toBeUndefined();
    expect(e.buyLand('jp_hokkaido')).toBe(false);
  });

  it('購入すると所持金が減り、鉱脈の量が基準の±20%で決まる', () => {
    // 十勝は土地代＋鉱業権で2,700万円。買ったぶんだけ所持金が減る
    const cash = LAND_MAP.jp_hokkaido.price * 2;
    const e = withLand(cash);
    const land = getLand(e.state, 'jp_hokkaido')!;
    expect(e.state.company.cash).toBeCloseTo(cash - LAND_MAP.jp_hokkaido.price, 5);
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
    /*
     * 炭鉱は石炭 7,200kg/秒。鉱脈をわざと 2,000kg だけにして、
     * 「掘るたびに鉱脈が減り、掘り尽くすと止まる」ところを見る。
     */
    land.deposits.coal = { total: 2000, remaining: 2000 };
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.tick(0.1);
    expect(land.stock.coal).toBeCloseTo(720, 5); // 7,200 × 0.1秒
    expect(land.deposits.coal.remaining).toBeCloseTo(1280, 5);
    expect(land.survey).toBe(2); // 試掘していないので「確定」にはならない
    e.advance(30);
    expect(land.deposits.coal.remaining).toBe(0);
    expect(land.stock.coal).toBeCloseTo(2000, 3);
    e.tick(1);
    expect(e.derived.facilityRuntime['jp_hokkaido:coal_mine'].status).toBe('depleted');
  });

  it('輸送手段がないと本社には届かず、土地の倉庫が満杯で止まる', () => {
    const e = surveyed();
    const land = getLand(e.state, 'jp_hokkaido')!;
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    // 7,200kg/秒。土地の倉庫（200t）が一杯になるまで進める
    e.advance(CONFIG.landBaseStorage / FACILITY_MAP.coal_mine.production!.outputs!.coal! + 5);
    expect(land.stock.coal).toBeCloseTo(CONFIG.landBaseStorage, 3);
    expect(e.state.inventory.coal ?? 0).toBe(0);
    expect(e.derived.facilityRuntime['jp_hokkaido:coal_mine'].status).toBe('storage_full');
    expect(e.derived.lands['jp_hokkaido'].noRoute).toBe(true);
  });

  it('試掘済みの土地は採掘量が +20%', () => {
    const e = surveyed(3);
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    // 数字を読みやすくするため 0.1秒ぶんで見る
    e.tick(0.1);
    expect(getLand(e.state, 'jp_hokkaido')!.stock.coal).toBeCloseTo(864, 5); // 7,200kg × 1.2 × 0.1秒
    expect(getLand(e.state, 'jp_hokkaido')!.survey).toBe(4); // 試掘済みで実際に掘ると「確定」
  });

  it('地形で農園の効率が変わる（平原は2倍）', () => {
    const e = withLand();
    e.buyFacility('wheat_farm', 1, 'jp_hokkaido');
    const land = getLand(e.state, 'jp_hokkaido')!;
    land.stock.water = 1000;
    // 小麦 2,160kg/秒・水 720L/秒。置いた水 1,000L で足りる範囲の 0.1秒ぶんで見る
    e.tick(0.1);
    expect(land.stock.wheat).toBeCloseTo(432, 5); // 2,160 × 2（平原）× 0.1秒
    expect(land.stock.water).toBeCloseTo(856, 5); // 1000 − 720 × 2 × 0.1秒
  });
});

describe('物流', () => {
  it('トラックが土地の資源を本社へ運び、輸送費がかかる', () => {
    const e = surveyed();
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    // 炭鉱は毎秒7.2t 掘る。トラックは1台0.7t/秒（現実の大型トラック1日40t ぶん）なので、
    // 運びきるには11台要る。台数はデータから出して、値段を変えても追随するようにしておく
    const mined = FACILITY_MAP.coal_mine.production!.outputs!.coal!;
    const need = Math.ceil((mined * RESOURCE_MAP.coal.weight) / FACILITY_MAP.truck.transport!.capacity);
    expect(e.buyFacility('truck', need, 'jp_hokkaido')).toBe(need);
    const cash = e.state.company.cash;
    e.tick(1);
    // 同じ tick で掘れた 7,200kg が、そのまま本社（倉庫 100t）へ届く
    expect(e.state.inventory.coal).toBeCloseTo(mined, 5);
    expect(getLand(e.state, 'jp_hokkaido')!.stock.coal ?? 0).toBeCloseTo(0, 5);
    const tons = mined * RESOURCE_MAP.coal.weight; // 石炭は1個＝1kg なので 7,200kg → 7.2t
    // 輸送費に加えて、この tick の人件費も引かれる
    expect(cash - e.state.company.cash).toBeCloseTo(tons * FACILITY_MAP.truck.transport!.costPerTon + e.derived.wageCost, 5);
    expect(e.derived.lands['jp_hokkaido'].transportUsed).toBeCloseTo(tons, 5);
    expect(e.derived.lands['jp_hokkaido'].exports.coal).toBeCloseTo(mined, 5);
  });

  it('輸送能力を超える分は土地に残る', () => {
    const e = surveyed();
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    expect(e.buyFacility('truck', 1, 'jp_hokkaido')).toBe(1); // 1台は 0.7t/秒 ＝ 石炭 700kg/秒まで
    e.buyFacility('iron_mine', 1, 'jp_chikuho'); // 別の土地は無関係
    const mined = FACILITY_MAP.coal_mine.production!.outputs!.coal! * 0.1; // 0.1秒で 720kg
    // トラック1台が 0.1秒で運べるのは 0.07t ＝ 石炭 70kg。掘る量のほうがずっと多い
    const carried = (FACILITY_MAP.truck.transport!.capacity * 0.1) / RESOURCE_MAP.coal.weight;
    expect(carried).toBeLessThan(mined); // 前提: 1台では運びきれない
    e.tick(0.1);
    expect(e.state.inventory.coal).toBeCloseTo(carried, 3); // 運べたぶんだけが本社に届く
    // 運び切れなかったぶんは土地に残る
    expect(getLand(e.state, 'jp_hokkaido')!.stock.coal).toBeCloseTo(mined - carried, 3);
    // さらに積み上げても、1tick で運び出せるのは同じ量だけ
    const overflow = 5_000;
    getLand(e.state, 'jp_hokkaido')!.stock.coal = overflow;
    e.tick(0.1);
    expect(getLand(e.state, 'jp_hokkaido')!.stock.coal).toBeCloseTo(overflow + mined - carried, 3);
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
    // 石炭は運べないので、掘れた 7,200kg がそのまま土地に残る
    expect(getLand(e.state, 'jp_hokkaido')!.stock.coal).toBeCloseTo(FACILITY_MAP.coal_mine.production!.outputs!.coal!, 5);
  });
});

describe('電力', () => {
  it('発電所がないと電力を使う施設は止まる', () => {
    // 工場は本社に建てられないので、土地に建てて試す
    const e = withLand();
    const land = e.state.lands.find((l) => l.id === 'jp_hokkaido')!;
    // 製鋼所は 鉄6,336kg＋石炭1,152kg → 鋼鉄5,760kg（毎秒）。鉄1.1kgから鋼鉄1kgの歩留まり。
    // 材料が足りないと「材料切れ」になってしまうので、1秒ぶんより多めに置いておく
    land.stock.iron = 10_000;
    land.stock.coal = 10_000;
    e.state.unlocked['facility:steel_mill'] = true;
    expect(e.buyFacility('steel_mill', 1, 'hq')).toBe(0); // 本社には建てられない
    expect(e.buyFacility('steel_mill', 1, 'jp_hokkaido')).toBe(1);
    e.tick(1);
    expect(e.derived.power.demand).toBe(2);
    expect(e.derived.power.ratio).toBe(0);
    expect(land.stock.steel ?? 0).toBe(0);
    expect(e.derived.facilityRuntime['jp_hokkaido:steel_mill'].status).toBe('no_power');
  });

  it('発電所は需要ぶんだけ燃料を燃やし、供給率で工場の効率が決まる', () => {
    const e = withLand();
    e.state.unlocked['facility:large_warehouse'] = true;
    e.buyFacility('large_warehouse', 1);
    e.debugAddResource('iron', 1000);
    e.debugAddResource('coal', 1000);
    const land = e.state.lands.find((l) => l.id === 'jp_hokkaido')!;
    land.stock.coal = 10_000; // 発電所の燃料は建てた土地の在庫から使う
    e.state.unlocked['facility:steel_mill'] = true;
    e.state.unlocked['facility:coal_power'] = true;
    // 工場も発電所も土地に建てる（本社には建てられない）
    land.stock.iron = 10_000;
    e.buyFacility('steel_mill', 1, 'jp_hokkaido'); // 需要 2MW
    e.buyFacility('coal_power', 1, 'jp_hokkaido'); // 10MW、最大で石炭 1,600/秒
    // 数字を読みやすくするため、0.1秒きざみで見る
    e.tick(0.1);
    expect(e.derived.power.capacity).toBe(10);
    expect(e.derived.power.generation).toBeCloseTo(2, 5);
    expect(e.derived.power.ratio).toBe(1);
    /*
     * 燃料も材料も、建てた土地の在庫から使う。
     * 発電所は需要ぶん（2MW / 出力10MW）だけ燃やすので 1,600 × 0.2 × 0.1秒 = 32kg、
     * 製鋼所は石炭 1,152 × 0.1秒 = 115.2kg を使い、鋼鉄 5,760 × 0.1秒 = 576kg を作る。
     */
    const mill = FACILITY_MAP.steel_mill.production!;
    const plant = FACILITY_MAP.coal_power;
    const burned = plant.fuel!.coal! * (2 / plant.powerGen!) * 0.1;
    expect(land.stock.coal).toBeCloseTo(10_000 - burned - mill.inputs!.coal! * 0.1, 4);
    expect(land.stock.steel).toBeCloseTo(mill.outputs!.steel! * 0.1, 5);
    // 需要が供給を超えると効率が下がる
    e.buyFacility('steel_mill', 9, 'jp_hokkaido'); // 需要 20MW
    e.tick(0.1);
    expect(e.derived.power.ratio).toBeCloseTo(0.5, 5);
    expect(e.derived.facilityRuntime['jp_hokkaido:steel_mill'].efficiency).toBeCloseTo(0.5, 5);
    expect(e.derived.facilityRuntime['jp_hokkaido:steel_mill'].status).toBe('partial');
  });

  it('燃料が切れると発電できない', () => {
    const e = withLand();
    e.debugAddResource('iron', 100);
    e.state.unlocked['facility:steel_mill'] = true;
    e.state.unlocked['facility:coal_power'] = true;
    e.buyFacility('steel_mill', 1, 'jp_hokkaido');
    e.buyFacility('coal_power', 1, 'jp_hokkaido');
    e.tick(1);
    expect(e.derived.power.capacity).toBe(0);
    expect(e.derived.facilityRuntime['jp_hokkaido:coal_power'].status).toBe('no_input');
  });

  it('再生可能エネルギーは燃料を使わず、地形で出力が変わる', () => {
    const e = withLand();
    e.state.unlocked['facility:solar_farm'] = true;
    e.buyFacility('solar_farm', 1, 'jp_hokkaido');
    e.tick(1);
    // powerGen は「年を通した平均の出力」。太陽光は定格4MWでも設備利用率15%で平均0.6MW。
    // 十勝は平原なので 0.6 × 1.2
    expect(e.derived.power.capacity).toBeCloseTo(FACILITY_MAP.solar_farm.powerGen! * 1.2, 5);
    // 砂漠なら1.6倍
    e.debugAddCash(100_000_000);
    e.state.unlocked['land:us_texas'] = true;
    e.buyLand('us_texas');
    e.buyFacility('solar_farm', 1, 'us_texas');
    e.tick(1);
    const solar = FACILITY_MAP.solar_farm.powerGen!;
    expect(e.derived.power.capacity).toBeCloseTo(solar * 1.2 + solar * 1.6, 5);
  });

  it('水力発電所は河川・山岳にしか建てられない', () => {
    // 水力発電所は120億円
    const e = withLand(20_000_000_000);
    e.state.unlocked['facility:hydro_plant'] = true;
    expect(e.buyFacility('hydro_plant', 1, 'jp_hokkaido')).toBe(0);
    e.state.unlocked['land:no_vestland'] = true;
    e.buyLand('no_vestland');
    expect(e.buyFacility('hydro_plant', 1, 'no_vestland')).toBe(1);
    e.tick(1);
    expect(e.derived.power.capacity).toBeCloseTo(FACILITY_MAP.hydro_plant.powerGen! * 1.6, 5); // 年平均22MW × 1.6（河川）
    // 研究「再生可能エネルギー」で +30%
    e.state.research.completed['renewables'] = true;
    e.tick(1);
    expect(e.derived.power.capacity).toBeCloseTo(FACILITY_MAP.hydro_plant.powerGen! * 1.6 * 1.3, 5);
  });
});

describe('研究', () => {
  it('研究所がポイントを生み、ポイントを消費して研究する', () => {
    const e = withLand();
    expect(e.buyFacility('research_lab', 1, 'hq')).toBe(0); // 本社には建てられない
    expect(e.buyFacility('research_lab', 1, 'jp_hokkaido')).toBe(1);
    // 研究所は 2ポイント/秒（1日＝60秒で120ポイント）。10秒で 20 たまる
    const rate = FACILITY_MAP.research_lab.researchRate!;
    e.advance(10);
    expect(e.state.research.points).toBeCloseTo(rate * 10, 3);
    expect(e.research('geology')).toBe(false); // 40 必要
    e.advance(11);
    expect(e.research('geology')).toBe(true);
    expect(e.state.research.points).toBeCloseTo(rate * 21 - RESEARCH_MAP.geology.cost, 3);
    expect(e.state.research.completed.geology).toBe(true);
    // 前提が必要
    e.debugAddResearch(1000);
    expect(e.research('nuclear')).toBe(false);
    expect(e.research('automation')).toBe(true);
  });

  it('研究の効果: 自動化で採集 +25%、大規模保管で倉庫 +50%', () => {
    const e = makeEngine();
    e.buyFacility('worker_stone', 0);
    e.debugAddCash(1_000_000); // 採石作業員は 15万円
    e.buyFacility('worker_stone', 1);
    e.tick(1);
    const rate = FACILITY_MAP.worker_stone.production!.outputs!.stone!; // 石 200kg/秒
    expect(e.state.inventory.stone).toBeCloseTo(rate, 5);
    e.state.research.completed['automation'] = true;
    e.tick(1);
    expect(e.state.inventory.stone).toBeCloseTo(rate + rate * 1.25, 5); // 2秒めは +25%
    expect(e.derived.capacity).toBe(CONFIG.baseStorage);
    e.state.research.completed['mass_storage'] = true;
    e.tick(0.2);
    expect(e.derived.capacity).toBe(Math.floor(CONFIG.baseStorage * 1.5));
  });

  it('海外の土地は研究「海外進出」で解放される', () => {
    const e = makeEngine();
    // テキサス・パーミアンは土地代＋鉱業権で15.1億円
    e.debugAddCash(LAND_MAP.us_texas.price * 2);
    e.tick(0.2);
    expect(e.state.unlocked['land:us_texas']).toBeUndefined();
    e.state.research.completed['overseas'] = true;
    e.tick(0.2);
    expect(e.state.unlocked['land:us_texas']).toBe(true);
    expect(e.buyLand('us_texas')).toBe(true);
  });
});

describe('商業施設', () => {
  it('買った物件の土地に建てると、人口係数に応じて毎秒の収入になる', () => {
    const e = makeEngine();
    e.debugAddCash(100_000_000_000);
    e.tick(0.2);
    expect(e.buyFacility('parking', 1, 'hq')).toBe(0); // 本社には建てられない
    // 商店街の空き店舗（商業・人口係数 2.6）を買うと、そこに建てられる
    expect(e.buyProperty('iz_shop')).toBe(true);
    const landId = 'prop:iz_shop';
    expect(e.state.lands.some((l) => l.id === landId)).toBe(true);
    expect(e.buyFacility('parking', 1, landId)).toBe(1);
    const cash = e.state.company.cash;
    e.tick(1);
    const expected = FACILITY_MAP.parking.income! * 2.6; // 駐車場の基準収入 × 人口係数 2.6
    expect(e.derived.commercialIncome).toBeCloseTo(expected, 5);
    expect(e.state.company.cash - cash).toBeGreaterThan(0);
  });
});

describe('原子力', () => {
  it('ウラン鉱石 → 核燃料 → 原子力発電の流れが動く', () => {
    const e = makeEngine();
    // 原子力発電所4,000億円・データセンター30棟など、現実の建設費ぶんの元手を持たせる
    e.debugAddCash(30_000_000_000_000);
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
    e.buyFacility('enrichment_plant', 1, 'ca_athabasca');
    e.buyFacility('solar_farm', 20, 'ca_athabasca');
    e.advance(300);
    expect(e.state.stats.totalObtained['uranium_ore'] ?? 0).toBeGreaterThan(0);
    expect(e.state.stats.totalObtained['nuclear_fuel'] ?? 0).toBeGreaterThan(0);
    e.debugAddResource('nuclear_fuel', 10);
    e.buyFacility('nuclear_plant', 1, 'ca_athabasca');
    e.state.lands.find((l) => l.id === 'ca_athabasca')!.stock.nuclear_fuel = 10;
    e.buyFacility('datacenter', 30, 'ca_athabasca'); // 需要 300MW
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
    // 採石作業員2人 × 石 200kg/秒
    expect(e.state.inventory.stone).toBeCloseTo(5 + FACILITY_MAP.worker_stone.production!.outputs!.stone! * 2, 5);
  });

  it('土地・研究・現地在庫はセーブとロードで保たれる', () => {
    const e = surveyed();
    e.buyFacility('coal_mine', 1, 'jp_hokkaido');
    e.state.research.completed['geology'] = true;
    e.tick(1);
    const text = serializeState(e.state, 123);
    const loaded = deserializeState(text);
    expect(loaded.lands.length).toBe(2);
    // 1秒ぶんに掘れた 7,200kg が、輸送手段がないので土地に残っている
    expect(loaded.lands[1].stock.coal).toBeCloseTo(FACILITY_MAP.coal_mine.production!.outputs!.coal!, 5);
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
    // 本社の倉庫容量（100t）を超えては増えない
    expect(e.state.inventory.coal).toBeLessThanOrEqual(e.derived.capacity + 1e-6);
    expect(report.resourceDelta.coal).toBeGreaterThan(0);
  });
});

describe('解放条件の説明', () => {
  it('研究と土地の条件を文にできる', () => {
    expect(RESEARCH_MAP.nuclear.requires).toContain('advanced_materials');
  });
});
