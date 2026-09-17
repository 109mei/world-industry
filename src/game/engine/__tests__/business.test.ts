import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { BUSINESSES, BUSINESS_MAP } from '@/game/data/business';
import { PROJECTS, projectsOf, type ProjectDef } from '@/game/data/projects';
import { RESOURCE_MAP } from '@/game/data/resources';
import { RESEARCH_MAP } from '@/game/data/research';
import { customersPerSec, divisionWage, getDivision, shopCapacity, shopModel, variety } from '../systems/business';
import { LOTTERY } from '@/game/data/gambling';
import { expectedReturn, GAMES } from '@/game/data/gambling';
import { myRank, ranking } from '../systems/richList';
import type { OsmFeature } from '@/game/services/osm/overpass';

let clock = 1_000_000;

function makeEngine(cash = 0) {
  clock = 1_000_000;
  const e = new GameEngine({ rng: () => 0.42, now: () => clock });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  return e;
}

/** 地図の建物を1つ買って、その土地 ID を返す */
function buyPlace(e: GameEngine, over: Partial<OsmFeature> = {}): string {
  const f: OsmFeature = {
    id: over.id ?? 'w900',
    kind: over.kind ?? 'retail',
    label: '店舗',
    name: 'テスト商会',
    named: false,
    lat: 35.42,
    lon: 139.35,
    areaSqm: over.areaSqm ?? 600,
    levels: over.levels ?? 2,
    polygon: [],
    ...over,
  };
  e.debugAddCash(500_000_000_000);
  const ok = e.buyCustomProperty(f);
  if (!ok) throw new Error('買えませんでした');
  return `osm:${f.id}`;
}

describe('事業のデータ', () => {
  it('すべての業種に研究の前提があり、その研究は実在する', () => {
    for (const b of BUSINESSES) {
      expect(RESEARCH_MAP[b.research as keyof typeof RESEARCH_MAP], b.id).toBeTruthy();
    }
  });

  it('案件の前提研究と材料は実在する', () => {
    for (const p of PROJECTS as readonly ProjectDef[]) {
      if (p.research) expect(RESEARCH_MAP[p.research as keyof typeof RESEARCH_MAP], p.id).toBeTruthy();
      for (const id of Object.keys(p.inputs ?? {})) expect(RESOURCE_MAP[id as keyof typeof RESOURCE_MAP], `${p.id}: ${id}`).toBeTruthy();
      expect(BUSINESS_MAP[p.business], p.id).toBeTruthy();
    }
  });

  it('案件をこなす業種には必ず案件がある', () => {
    for (const b of BUSINESSES) {
      if (b.style !== 'studio') continue;
      expect(projectsOf(b.id).length, b.id).toBeGreaterThan(0);
    }
  });

  it('お店の商売のしかたは業種ごとに違う', () => {
    const shop = shopModel('shop');
    const restaurant = shopModel('restaurant');
    const jewelry = shopModel('jewelry');
    expect(restaurant.spoilPerHour).toBeGreaterThan(0); // 食材は傷む
    expect(restaurant.capacityPerSqm).toBeGreaterThan(0); // 席数がある
    expect(jewelry.browseRate).toBeGreaterThan(shop.browseRate); // 宝石店は見るだけの客が多い
    expect(shopModel('convenience').varietyWeight).toBeGreaterThan(shop.varietyWeight); // コンビニは品ぞろえが命
  });
});

describe('事業を始める', () => {
  it('研究していないと始められない', () => {
    const e = makeEngine(100_000_000);
    const landId = buyPlace(e);
    const r = e.openDivision('shop', landId);
    expect(r.ok).toBe(false);
  });

  it('研究を終えると始められ、開業の費用がかかる', () => {
    const e = makeEngine(100_000_000);
    const landId = buyPlace(e);
    e.state.research.completed.retail = true;
    const before = e.state.company.cash;
    const r = e.openDivision('shop', landId, 'テスト商店');
    expect(r.ok).toBe(true);
    expect(e.state.company.cash).toBeLessThan(before);
    const div = getDivision(e.state, r.id!)!;
    expect(div.name).toBe('テスト商店');
    expect(div.staff).toBe(BUSINESS_MAP.shop.initialStaff);
  });

  it('同じ場所に2つは構えられない', () => {
    const e = makeEngine(100_000_000);
    const landId = buyPlace(e);
    e.state.research.completed.retail = true;
    expect(e.openDivision('shop', landId).ok).toBe(true);
    expect(e.openDivision('shop', landId).ok).toBe(false);
  });
});

describe('お店', () => {
  function shop() {
    const e = makeEngine(100_000_000);
    const landId = buyPlace(e, { id: 'w901', areaSqm: 2_000 });
    e.state.research.completed.retail = true;
    const id = e.openDivision('shop', landId).id!;
    const div = getDivision(e.state, id)!;
    div.awareness = 60;
    e.debugAddResource('food', 100_000);
    return { e, id, div };
  }

  it('在庫がないと売れず、知名度が下がる', () => {
    const { e, div } = shop();
    const before = div.awareness;
    e.tick(10);
    expect(div.awareness).toBeLessThan(before);
    expect(div.totalEarned).toBe(0);
  });

  it('入荷すると売れて、お金が入る', () => {
    const { e, id, div } = shop();
    expect(e.restockShop(id, 'food', 5_000)).toBeGreaterThan(0);
    const cash = e.state.company.cash;
    e.tick(30);
    expect(e.state.company.cash).toBeGreaterThan(cash - 1000);
    expect(div.totalEarned).toBeGreaterThan(0);
    expect(div.sold ?? 0).toBeGreaterThan(0);
  });

  it('自動入荷は目標まで補充する', () => {
    const { e, id, div } = shop();
    e.setRestockTarget(id, 'food', 500);
    e.tick(1);
    expect(div.stock.food ?? 0).toBeGreaterThan(0);
  });

  it('店から本社へ戻せる', () => {
    const { e, id, div } = shop();
    e.restockShop(id, 'food', 1_000);
    const atShop = div.stock.food ?? 0;
    expect(atShop).toBeGreaterThan(0);
    e.returnFromShop(id, 'food', atShop);
    expect(div.stock.food ?? 0).toBeLessThan(1);
  });

  it('品ぞろえが増えると客足が伸びる', () => {
    const { e, id, div } = shop();
    e.restockShop(id, 'food', 1_000);
    const one = customersPerSec(e.state, div);
    e.debugAddResource('clothing', 5_000);
    e.debugAddResource('tool', 5_000);
    e.restockShop(id, 'clothing', 1_000);
    e.restockShop(id, 'tool', 1_000);
    expect(variety(e.state, div)).toBeGreaterThan(1 / 9);
    expect(customersPerSec(e.state, div)).toBeGreaterThan(one);
  });
});

describe('飲食店は席と人手で決まる', () => {
  it('席数は広さで決まり、人手が足りないと客を捌けない', () => {
    const e = makeEngine(100_000_000);
    const landId = buyPlace(e, { id: 'w902', kind: 'retail', areaSqm: 800, levels: 1 });
    e.state.research.completed.retail = true;
    e.state.research.completed.food_service = true;
    const id = e.openDivision('restaurant', landId).id!;
    const div = getDivision(e.state, id)!;
    div.awareness = 80;
    e.debugAddResource('food', 100_000);
    e.restockShop(id, 'food', 10_000);
    const cap = shopCapacity(e.state, div);
    expect(cap).toBeGreaterThan(0);
    const few = customersPerSec(e.state, div);
    e.setDivisionStaff(id, 40);
    expect(customersPerSec(e.state, div)).toBeGreaterThan(few);
  });

  it('食材は時間で傷む', () => {
    const e = makeEngine(100_000_000);
    const landId = buyPlace(e, { id: 'w903', areaSqm: 400 });
    e.state.research.completed.retail = true;
    e.state.research.completed.food_service = true;
    const id = e.openDivision('restaurant', landId).id!;
    const div = getDivision(e.state, id)!;
    e.debugAddResource('food', 100_000);
    e.restockShop(id, 'food', 10_000);
    div.staff = 0; // 売れないようにして、傷むぶんだけを見る
    const before = div.stock.food ?? 0;
    e.tick(600);
    expect(div.stock.food ?? 0).toBeLessThan(before);
    expect(div.wasted ?? 0).toBeGreaterThan(0);
  });
});

describe('案件と製品', () => {
  function studio() {
    const e = makeEngine(100_000_000);
    const landId = buyPlace(e, { id: 'w904', kind: 'office' });
    e.state.research.completed.computing = true;
    e.state.research.completed.software = true;
    const id = e.openDivision('it', landId).id!;
    return { e, id, div: getDivision(e.state, id)! };
  }

  it('案件は人手で進み、終わると報酬が入る', () => {
    const { e, id, div } = studio();
    e.setDivisionStaff(id, 50);
    expect(e.startProject(id, 'it_homepage').ok).toBe(true);
    const cash = e.state.company.cash;
    for (let i = 0; i < 40; i++) e.tick(1);
    expect(div.completed).toBeGreaterThanOrEqual(1);
    expect(e.state.company.cash).toBeGreaterThan(cash);
    expect(div.brand).toBeGreaterThan(0);
  });

  it('研究していない案件は受けられない', () => {
    const { e, id } = studio();
    const r = e.startProject(id, 'it_security');
    expect(r.ok).toBe(false);
  });

  it('同時に進められるのは3件まで', () => {
    const { e, id } = studio();
    e.state.research.completed.cybersecurity = true;
    e.state.research.completed.networking = true;
    e.state.research.completed.datacenter = true;
    expect(e.startProject(id, 'it_homepage').ok).toBe(true);
    expect(e.startProject(id, 'it_inhouse').ok).toBe(true);
    expect(e.startProject(id, 'it_security').ok).toBe(true);
    expect(e.startProject(id, 'it_datacenter').ok).toBe(false);
  });

  it('製品になる案件は、完成後も毎秒お金が入る', () => {
    const { e, id, div } = studio();
    e.state.research.completed.cybersecurity = true;
    e.setDivisionStaff(id, 200);
    div.awareness = 80;
    e.startProject(id, 'it_security');
    for (let i = 0; i < 120; i++) e.tick(1);
    expect(div.products.length).toBeGreaterThanOrEqual(1);
    const cash = e.state.company.cash;
    e.tick(10);
    expect(e.state.company.cash).toBeGreaterThan(cash - 1);
  });
});

describe('人件費は事業のぶんも含む', () => {
  it('人を雇うと会社全体の人件費が増える', () => {
    const e = makeEngine(100_000_000);
    const landId = buyPlace(e, { id: 'w905' });
    e.state.research.completed.retail = true;
    const id = e.openDivision('shop', landId).id!;
    const div = getDivision(e.state, id)!;
    const before = divisionWage(e.state, div);
    e.setDivisionStaff(id, 20);
    expect(divisionWage(e.state, div)).toBeGreaterThan(before);
    e.tick(1);
    expect(e.derived.wageCost).toBeGreaterThan(0);
  });
});

describe('賭け事', () => {
  it('どの遊びも胴元が有利（期待値が1未満）', () => {
    for (const g of GAMES) expect(expectedReturn(g), g.id).toBeLessThan(1);
  });

  it('研究していないと遊べない', () => {
    const e = makeEngine(10_000_000);
    expect(e.playGame('slot').ok).toBe(false);
  });

  it('遊ぶと賭け金が引かれる', () => {
    const e = makeEngine(10_000_000);
    e.state.research.completed.gaming_license = true;
    const before = e.state.company.cash;
    const r = e.playGame('slot');
    expect(r.ok).toBe(true);
    expect(e.state.company.cash).not.toBe(before);
    expect(e.state.stats.gambleBet).toBeGreaterThan(0);
  });

  it('宝くじは買うほど当たりやすく、賞金も積み上がる', () => {
    const e = makeEngine(10_000_000_000);
    e.state.research.completed.gaming_license = true;
    const before = e.state.lottery?.jackpot ?? 0;
    const r = e.buyLotteryTickets(1_000_000);
    expect(r.bought).toBe(1_000_000);
    expect(e.state.lottery!.tickets).toBe(1_000_000);
    expect(e.state.lottery!.jackpot).toBeGreaterThan(before);
  });

  it('抽選が来ると枚数は0に戻る', () => {
    const e = makeEngine(10_000_000_000);
    e.state.research.completed.gaming_license = true;
    e.buyLotteryTickets(1000);
    for (let i = 0; i < LOTTERY.intervalSec + 2; i++) e.tick(1);
    expect(e.state.lottery!.tickets).toBe(0);
    expect(e.state.lottery!.draws).toBeGreaterThanOrEqual(1);
  });
});

describe('長者番付', () => {
  it('資産が増えると順位が上がる', () => {
    const e = makeEngine();
    const poor = myRank(e.state, 1_000_000);
    const rich = myRank(e.state, 50_000_000_000_000);
    expect(rich).toBeLessThan(poor);
    expect(rich).toBeLessThanOrEqual(2);
  });

  it('自分が一覧に混ざる', () => {
    const e = makeEngine();
    const list = ranking(e.state, 1_000_000_000, 'マイカンパニー');
    const me = list.find((p) => p.isPlayer);
    expect(me).toBeTruthy();
    expect(me!.rank).toBeGreaterThan(1);
  });
});

describe('実績は倒産しても再出発しても消えない', () => {
  it('倒産しても残る', () => {
    const e = makeEngine(1_000_000);
    e.state.achievements = { first_stone: 1, millionaire: 2 };
    e.buyFacility('worker_stone', 3);
    e.state.company.cash = -5_000_000_000;
    e.tick(1);
    expect(e.state.stats.bankruptcies).toBe(1);
    expect(e.state.achievements.first_stone).toBe(1);
    expect(e.state.achievements.millionaire).toBe(2);
  });

  it('再出発しても残る', () => {
    const e = makeEngine();
    e.debugAddCash(200_000_000_000);
    e.state.achievements = { first_stone: 1 };
    expect(e.prestige()).toBe(true);
    expect(e.state.achievements.first_stone).toBe(1);
  });
});

describe('場所ごとの需要と供給', () => {
  it('地形によって売れるものが変わる', async () => {
    const { localDemand } = await import('../systems/business');
    const e = makeEngine(100_000_000);
    const cityLand = buyPlace(e, { id: 'w910', kind: 'retail', areaSqm: 500 });
    const city = e.state.lands.find((l) => l.id === cityLand)!;
    city.terrain = 'city';
    const desertId = buyPlace(e, { id: 'w911', kind: 'land', areaSqm: 500 });
    const desert = e.state.lands.find((l) => l.id === desertId)!;
    desert.terrain = 'desert';
    // 砂漠では水が、街では衣類がよく売れる
    expect(localDemand(e.state, desert.id, 'water')).toBeGreaterThan(localDemand(e.state, city.id, 'water'));
    expect(localDemand(e.state, city.id, 'clothing')).toBeGreaterThan(localDemand(e.state, desert.id, 'clothing'));
  });

  it('求められている品のほうが高く売れる', async () => {
    const { localDemand, retailPrice } = await import('../systems/business');
    const e = makeEngine(100_000_000);
    const landId = buyPlace(e, { id: 'w912', areaSqm: 800 });
    e.state.lands.find((l) => l.id === landId)!.terrain = 'snow';
    e.state.research.completed.retail = true;
    const id = e.openDivision('shop', landId).id!;
    const div = getDivision(e.state, id)!;
    // 雪国では衣類の人気が高い
    expect(localDemand(e.state, landId, 'clothing')).toBeGreaterThan(1);
    expect(retailPrice(e.state, div, 'clothing') / RESOURCE_MAP.clothing.basePrice).toBeGreaterThan(retailPrice(e.state, div, 'glass') / RESOURCE_MAP.glass.basePrice);
  });
});
