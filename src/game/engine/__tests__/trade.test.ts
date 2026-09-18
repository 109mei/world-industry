import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { BUYABLE_RESOURCES, RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { FACILITY_MAP } from '@/game/data/facilities';
import { RECIPE_MAP } from '@/game/data/recipes';
import { EVENTS, type EventDef } from '@/game/data/events';
import { BUY_SPREAD, buyPrice, currentPrice, getMarketState, referencePrice } from '../systems/market';

let clock = 1_000_000;

function makeEngine(cash = 0, rng: () => number = () => 0.42) {
  clock = 1_000_000;
  const e = new GameEngine({ rng, now: () => clock });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  e.refreshDerived();
  return e;
}

function lcg(seed = 24680) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('転売できるもののデータ', () => {
  it('GPUと暗号資産が市場から買える', () => {
    expect(BUYABLE_RESOURCES).toContain('gpu');
    expect(BUYABLE_RESOURCES).toContain('crypto');
    for (const id of BUYABLE_RESOURCES) expect(RESOURCE_MAP[id].sellable, id).toBe(true);
  });

  it('転売できるものは相場が荒い', () => {
    for (const id of BUYABLE_RESOURCES) {
      expect(RESOURCE_MAP[id].volatility ?? 1, id).toBeGreaterThan(1);
    }
  });

  it('GPUを作る道（レシピと工場）と、掘る道（マイニング装置）がある', () => {
    expect(RECIPE_MAP.make_gpu).toBeTruthy();
    expect(RECIPE_MAP.make_gpu.outputs?.gpu).toBeGreaterThan(0);
    expect(FACILITY_MAP.gpu_factory.production?.outputs?.gpu).toBeGreaterThan(0);
    const rig = FACILITY_MAP.mining_rig;
    expect(rig.production?.outputs?.crypto).toBeGreaterThan(0);
    expect(rig.production?.inputs?.gpu).toBeGreaterThan(0); // GPUは焼けて減る
    expect(rig.powerUse).toBeGreaterThan(0); // 電気を食う
  });

  it('GPUと暗号資産の相場イベントがある', () => {
    const defs = EVENTS as readonly EventDef[];
    const ids = defs.filter((e) => e.targets).flatMap((e) => e.targets as string[]);
    expect(ids).toContain('gpu');
    expect(ids).toContain('crypto');
    for (const e of defs) {
      for (const t of e.targets ?? []) expect(RESOURCE_MAP[t as ResourceId], t).toBeTruthy();
    }
  });
});

describe('市場から買う', () => {
  it('買えないものは買えない', () => {
    const e = makeEngine(1_000_000_000);
    const r = e.buyResource('stone', 10);
    expect(r.amount).toBe(0);
    expect(r.reason).toBeTruthy();
  });

  it('買うと在庫が増えてお金が減る', () => {
    const e = makeEngine(1_000_000_000);
    e.debugAddResource?.('gpu', 0);
    const before = e.state.company.cash;
    const r = e.buyResource('gpu', 5);
    expect(r.amount).toBe(5);
    expect(e.state.inventory.gpu).toBe(5);
    expect(e.state.company.cash).toBeLessThan(before);
    expect(r.cost).toBeGreaterThan(0);
  });

  it('買値は売値より高い', () => {
    const e = makeEngine(1_000_000_000);
    expect(buyPrice(e.state, 'gpu')).toBeCloseTo(referencePrice(e.state, 'gpu') * BUY_SPREAD, 6);
    expect(buyPrice(e.state, 'gpu')).toBeGreaterThan(currentPrice(e.state, 'gpu'));
  });

  it('買ってすぐ売り返すと損をする', () => {
    const e = makeEngine(10_000_000_000);
    const before = e.state.company.cash;
    e.buyResource('gpu', 20);
    e.sell('gpu', 'all');
    expect(e.state.company.cash).toBeLessThan(before);
  });

  it('買い占めると相場が上がり、売ると下がる', () => {
    const e = makeEngine(100_000_000_000);
    const m = getMarketState(e.state, 'gpu');
    const start = m.modifier;
    e.buyResource('gpu', 200);
    expect(m.modifier).toBeGreaterThan(start);
    const high = m.modifier;
    e.sell('gpu', 'all');
    expect(m.modifier).toBeLessThan(high);
  });

  it('所持金より多くは買えない', () => {
    const e = makeEngine(1);
    const r = e.buyResource('gpu', 100);
    expect(r.amount).toBe(0);
    expect(e.state.company.cash).toBeGreaterThanOrEqual(0);
  });

  it('倉庫に入りきらない量は買わない', () => {
    const e = makeEngine(100_000_000_000);
    const cap = e.derived.capacity;
    const r = e.buyResource('gpu', cap * 10);
    expect(r.amount).toBeLessThanOrEqual(cap);
  });
});

describe('荒い相場', () => {
  it('荒いものほど大きく動くが、決まった幅は超えない', () => {
    const e = makeEngine(1_000_000, lcg(3));
    e.debugAddResource?.('gpu', 1);
    for (let i = 0; i < 4000; i++) e.tick(1);
    const gpu = getMarketState(e.state, 'gpu');
    const stone = getMarketState(e.state, 'stone');
    const spread = (h: number[]) => (Math.max(...h) - Math.min(...h)) / Math.max(1e-9, h[0]);
    expect(gpu.modifier).toBeGreaterThan(0);
    expect(Number.isFinite(gpu.modifier)).toBe(true);
    expect(spread(gpu.history)).toBeGreaterThan(spread(stone.history));
  });
});
