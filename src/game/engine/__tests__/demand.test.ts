/**
 * 地元の需要。
 *
 * これまで市場はいくら出しても値崩れしない場所で、押し続けるのが最適解になっていた。
 * いまは「町の市場が受け止められる量」があり、それを超えると値が崩れる。
 * 売り先（物件・取引先・自分の店・よその国）を広げると、受け止められる量が増える。
 *
 * ここで見張るのは、
 *  1. どの品目も「同じ施設 25棟ぶん」で半減する（品目ごとに極端な差が出ない）
 *  2. 売り先を広げると、実際に売れる量が増える
 *  3. 画面に出す内訳と、実際に効く倍率がずれない
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/game/data/config';
import { FACILITIES, type FacilityDef, type FacilityId } from '@/game/data/facilities';
import { RESOURCES, type ResourceDef, type ResourceId } from '@/game/data/resources';
import { DEMAND_SOURCES, LOCAL_DEMAND_UNITS, demandGrowthFrom, demandPartOf, localDemandBase } from '@/game/data/demand';
import { demandCapacity, demandCounts, demandFactor, demandGrowth, sellRevenue } from '../systems/market';
import { GameEngine } from '../GameEngine';

const TAU = CONFIG.market.demandRecoverySeconds;

/** その資源を作るいちばん小さい施設の毎秒出力 */
function smallestRate(id: ResourceId): number {
  let best = 0;
  for (const f of FACILITIES as readonly FacilityDef[]) {
    const r = f.production?.outputs?.[id];
    if (r && r > 0 && (best === 0 || r < best)) best = r;
  }
  return best;
}

function makeEngine(): GameEngine {
  const e = new GameEngine({ rng: () => 0.42, now: () => 1_000_000 });
  e.keepDefaultHq();
  e.updateSettings({ events: false });
  e.refreshDerived();
  return e;
}

describe('地元の需要の大きさ', () => {
  it('施設で作れるものは、どれも「およそ25棟ぶん」で値段が半分になる', () => {
    const checked: string[] = [];
    for (const r of RESOURCES as readonly ResourceDef[]) {
      if (!r.sellable || r.buyable) continue;
      const rate = smallestRate(r.id as ResourceId);
      if (rate <= 0) continue;
      // 毎秒 R だけ出し続けたときの落ち着き先は R×τ。それが容量と釣り合う点で半減する
      const units = localDemandBase(r.id as ResourceId) / TAU / rate;
      expect(units, `${r.name} が ${units.toFixed(1)}棟で半減`).toBeCloseTo(LOCAL_DEMAND_UNITS, 6);
      checked.push(r.name);
    }
    expect(checked.length).toBeGreaterThan(30);
  });

  it('施設で作れないもの（手作りだけの品）にも容量がある', () => {
    for (const id of ['gem', 'gold', 'rough_gem'] as const) {
      expect(localDemandBase(id)).toBeGreaterThan(0);
      expect(Number.isFinite(localDemandBase(id))).toBe(true);
    }
  });

  it('転売するもの（GPU・暗号資産）は締めない', () => {
    // 市場で買って売るのが本分なので、ふつうの品より容量をずっと広く取ってある
    const gpuUnits = localDemandBase('gpu') / TAU / smallestRate('gpu');
    expect(gpuUnits).toBeGreaterThan(LOCAL_DEMAND_UNITS * 5);
  });

  it('どの資源でも容量が正の有限値になる', () => {
    for (const r of RESOURCES) {
      const cap = localDemandBase(r.id as ResourceId);
      expect(Number.isFinite(cap), r.name).toBe(true);
      expect(cap, r.name).toBeGreaterThan(0);
    }
  });
});

describe('売り先を広げる', () => {
  it('何も持っていなければ、町の市場だけ（1倍）', () => {
    const e = makeEngine();
    expect(demandGrowth(e.state)).toBeCloseTo(1, 6);
  });

  it('手立てごとに上限があり、それ以上は増えない', () => {
    for (const s of DEMAND_SOURCES) {
      expect(demandPartOf(s.id, 0)).toBe(0);
      expect(demandPartOf(s.id, 1)).toBeCloseTo(s.per, 9);
      // 上限を超える数を入れても、上限で止まる
      expect(demandPartOf(s.id, 10_000)).toBeCloseTo(s.cap, 9);
    }
  });

  it('全部そろえても、伸びは上限の合計までにとどまる', () => {
    const maxCounts = Object.fromEntries(DEMAND_SOURCES.map((s) => [s.id, 10_000])) as Record<DEMAND_ID, number>;
    const max = 1 + DEMAND_SOURCES.reduce((a, s) => a + s.cap, 0);
    expect(demandGrowthFrom(maxCounts)).toBeCloseTo(max, 9);
  });

  it('物件を買うと、売れる量が実際に増える', () => {
    const e = makeEngine();
    const before = demandCapacity(e.state, 'tool');
    e.debugAddCash(50_000_000_000);
    // 北海道の原野に区画を1つ買う
    const bought = e.buyCustomProperty({
      id: 'w80001',
      kind: 'land',
      label: '空き地',
      name: '空き地',
      named: false,
      lat: 43.5,
      lon: 143.0,
      areaSqm: 20_000,
      levels: 1,
      polygon: [],
    });
    expect(bought).toBe(true);
    const counts = demandCounts(e.state);
    expect(counts.property).toBe(1);
    expect(demandCapacity(e.state, 'tool')).toBeGreaterThan(before);
  });

  it('商業施設を建てると「自分の店」に数えられる', () => {
    const e = makeEngine();
    e.debugAddCash(500_000_000_000);
    // 地図から土地を買って、そこに店を建てる
    e.buyCustomProperty({
      id: 'w80003', kind: 'retail', label: '店舗', name: '駅前の店', named: false,
      lat: 33.59, lon: 130.40, areaSqm: 3_000, levels: 3, polygon: [],
    });
    const landId = 'osm:w80003';
    const shop = (FACILITIES as readonly FacilityDef[]).find((f) => f.category === 'COMMERCIAL' && f.site !== 'hq');
    expect(shop, '商業施設が1つも無い').toBeTruthy();
    e.state.unlocked[`facility:${shop!.id}`] = true;
    const before = demandCounts(e.state).shop;
    const n = e.buyFacility(shop!.id as FacilityId, 2, landId);
    expect(n, `${shop!.name} を建てられない`).toBe(2);
    expect(demandCounts(e.state).shop).toBe(before + 2);
  });

  it('画面に出す内訳の合計が、実際に効く倍率と一致する', () => {
    const e = makeEngine();
    e.debugAddCash(50_000_000_000);
    e.buyCustomProperty({
      id: 'w80002', kind: 'land', label: '空き地', name: '空き地', named: false,
      lat: 43.5, lon: 143.0, areaSqm: 20_000, levels: 1, polygon: [],
    });
    const counts = demandCounts(e.state);
    expect(demandGrowth(e.state)).toBeCloseTo(demandGrowthFrom(counts), 9);
  });
});

describe('飽和の効き方', () => {
  it('25棟ぶんを出すと、売値がおよそ半分になる', () => {
    const e = makeEngine();
    const cap = demandCapacity(e.state, 'tool');
    e.debugAddResource('tool', cap * 2);
    expect(demandFactor(e.state, 'tool')).toBeCloseTo(1, 6);
    // 容量ぶん市場に出すと、需要係数は 0.5 になる
    e.sell('tool', cap);
    expect(demandFactor(e.state, 'tool')).toBeCloseTo(0.5, 3);
  });

  it('小口の売却では、ほとんど飽和しない', () => {
    const e = makeEngine();
    e.debugAddResource('tool', 20);
    e.sell('tool', 20);
    expect(demandFactor(e.state, 'tool')).toBeGreaterThan(0.99);
  });

  it('まとめて売るより、分けて売るほうが手取りが多い', () => {
    const e = makeEngine();
    const cap = demandCapacity(e.state, 'tool');
    const once = sellRevenue(e.state, 'tool', cap);
    const half = sellRevenue(e.state, 'tool', cap / 2);
    expect(half * 2).toBeGreaterThan(once);
  });
});

type DEMAND_ID = (typeof DEMAND_SOURCES)[number]['id'];
