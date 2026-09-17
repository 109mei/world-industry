import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { CONFIG } from '@/game/data/config';
import { TOOL_MAP } from '@/game/data/tools';
import { deserializeState, serializeState } from '@/game/services/save/SaveService';
import { previewGather } from '../actions/gather';
import { createInitialState } from '../state/createInitialState';

function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeEngine(now = 1_000_000) {
  return new GameEngine({ rng: seeded(), now: () => now });
}

describe('手動採集とクラフト', () => {
  it('石を拾うと石が1増える', () => {
    const e = makeEngine();
    expect(e.gather('gather_stone')).toBe(1);
    expect(e.state.inventory.stone).toBe(1);
    expect(e.state.stats.totalGathered.stone).toBe(1);
  });

  it('資源が足りないとクラフトできない', () => {
    const e = makeEngine();
    e.gather('gather_stone');
    expect(e.craft('craft_stone_hammer')).toBe(0);
    expect(e.state.tools.stone_hammer).toBeUndefined();
    expect(e.state.inventory.stone).toBe(1);
  });

  it('資源が足りればクラフトでき、材料が減る', () => {
    const e = makeEngine();
    for (let i = 0; i < 3; i++) e.gather('gather_stone');
    for (let i = 0; i < 2; i++) e.gather('gather_wood');
    expect(e.craft('craft_stone_hammer')).toBe(1);
    expect(e.state.tools.stone_hammer).toEqual({ count: 1, durability: TOOL_MAP.stone_hammer.durability });
    expect(e.state.inventory.stone).toBe(0);
    expect(e.state.inventory.wood).toBe(0);
  });

  it('MAX クラフトは作れるだけ作る', () => {
    const e = makeEngine();
    e.debugAddResource('stone', 30);
    e.debugAddResource('wood', 20);
    expect(e.craft('craft_stone_hammer', 'max')).toBe(10);
  });
});

describe('道具の耐久', () => {
  it('道具が必要な採集は道具がないとできない', () => {
    const e = makeEngine();
    expect(previewGather(e.state, 'gather_scrap').available).toBe(false);
    expect(e.gather('gather_scrap')).toBe(0);
  });

  it('使うたびに耐久が減り、0になると消滅する', () => {
    const e = makeEngine();
    e.debugAddResource('stone', 3);
    e.debugAddResource('wood', 2);
    e.craft('craft_stone_hammer');
    const dur = TOOL_MAP.stone_hammer.durability;
    for (let i = 0; i < dur - 1; i++) {
      expect(e.gather('gather_scrap')).toBe(1);
    }
    expect(e.state.tools.stone_hammer?.durability).toBe(1);
    e.gather('gather_scrap');
    expect(e.state.tools.stone_hammer).toBeUndefined();
    expect(e.state.stats.toolsBroken).toBe(1);
    expect(e.gather('gather_scrap')).toBe(0);
  });

  it('複数本あるときは次の1本に切り替わる', () => {
    const e = makeEngine();
    e.debugAddResource('stone', 6);
    e.debugAddResource('wood', 4);
    e.craft('craft_stone_hammer', 2);
    const dur = TOOL_MAP.stone_hammer.durability;
    for (let i = 0; i < dur; i++) e.gather('gather_scrap');
    expect(e.state.tools.stone_hammer).toEqual({ count: 1, durability: dur });
  });

  it('つるはしは石のハンマーを作ると解放され、鉄鉱石を掘れる', () => {
    const e = makeEngine();
    expect(previewGather(e.state, 'gather_iron_ore').unlocked).toBe(false);
    e.debugAddResource('stone', 6);
    e.debugAddResource('wood', 4);
    e.craft('craft_stone_hammer');
    expect(e.state.unlocked['recipe:craft_stone_pickaxe']).toBe(true);
    e.craft('craft_stone_pickaxe');
    expect(previewGather(e.state, 'gather_iron_ore').available).toBe(true);
    expect(e.gather('gather_iron_ore')).toBe(2);
  });
});

describe('倉庫容量', () => {
  it('容量を超える採集はできない', () => {
    const e = makeEngine();
    e.debugAddResource('stone', CONFIG.baseStorage);
    expect(e.gather('gather_stone')).toBe(0);
    expect(e.state.inventory.stone).toBe(CONFIG.baseStorage);
  });

  it('小型倉庫を買うと容量が増える', () => {
    const e = makeEngine();
    e.debugAddCash(10_000);
    expect(e.buyFacility('small_warehouse', 1)).toBe(1);
    expect(e.derived.capacity).toBe(CONFIG.baseStorage + 1000);
  });

  it('倉庫が満杯になると施設が止まる', () => {
    const e = makeEngine();
    e.debugAddCash(10_000);
    e.buyFacility('worker_stone', 1);
    e.debugAddResource('stone', CONFIG.baseStorage);
    e.tick(1);
    const inst = e.state.facilities.find((f) => f.typeId === 'worker_stone')!;
    expect(e.derived.facilityRuntime[inst.id].status).toBe('storage_full');
    expect(e.state.inventory.stone).toBe(CONFIG.baseStorage);
  });
});

describe('自動生産と施設', () => {
  it('作業員は毎秒資源を生産する', () => {
    const e = makeEngine();
    e.debugAddCash(1000);
    e.buyFacility('worker_stone', 1);
    e.tick(1);
    expect(e.state.inventory.stone).toBeCloseTo(0.2, 6);
    expect(e.derived.production.stone).toBeCloseTo(0.2, 6);
    expect(e.state.stats.totalProduced.stone).toBeCloseTo(0.2, 6);
  });

  it('入力資源が不足すると加工施設は停止する', () => {
    const e = makeEngine();
    e.debugAddCash(100_000);
    e.state.unlocked['facility:simple_smelter'] = true;
    e.buyFacility('simple_smelter', 1);
    e.tick(1);
    const inst = e.state.facilities.find((f) => f.typeId === 'simple_smelter')!;
    expect(e.derived.facilityRuntime[inst.id].status).toBe('no_input');
    expect(e.state.inventory.iron ?? 0).toBe(0);
    e.debugAddResource('iron_ore', 10);
    e.debugAddResource('wood', 10);
    e.tick(1);
    expect(e.derived.facilityRuntime[inst.id].status).toBe('running');
    expect(e.state.inventory.iron).toBeCloseTo(0.2, 6);
    expect(e.state.inventory.iron_ore).toBeCloseTo(9.6, 6);
  });

  it('資金が足りないと施設は買えない', () => {
    const e = makeEngine();
    expect(e.buyFacility('worker_stone', 1)).toBe(0);
    expect(e.state.facilities.length).toBe(0);
  });

  it('OFF にした施設は生産しない', () => {
    const e = makeEngine();
    e.debugAddCash(1000);
    e.buyFacility('worker_stone', 1);
    const inst = e.state.facilities[0];
    e.setFacilityEnabled(inst.id, false);
    e.tick(1);
    expect(e.state.inventory.stone ?? 0).toBe(0);
    expect(e.derived.facilityRuntime[inst.id].status).toBe('disabled');
  });
});

describe('市場', () => {
  it('売却すると所持金が増え在庫が減る', () => {
    const e = makeEngine();
    e.debugAddResource('scrap_metal', 10);
    const revenue = e.sell('scrap_metal', 5);
    // 需要曲線の積分なので 40 円よりわずかに少ない
    expect(revenue).toBeCloseTo(40, 1);
    expect(e.state.company.cash).toBeCloseTo(40, 1);
    expect(e.state.inventory.scrap_metal).toBe(5);
    expect(e.state.stats.totalSold.scrap_metal).toBe(5);
  });

  it('在庫より多くは売れない', () => {
    const e = makeEngine();
    e.debugAddResource('stone', 3);
    e.sell('stone', 100);
    expect(e.state.inventory.stone).toBe(0);
    expect(e.state.company.cash).toBeCloseTo(6, 1);
  });

  it('価格は 0.7〜1.4 倍の範囲で変動する', () => {
    const e = makeEngine();
    e.advance(CONFIG.marketUpdateSeconds * 200);
    for (const m of Object.values(e.state.market.prices)) {
      expect(m!.modifier).toBeGreaterThanOrEqual(CONFIG.market.minModifier);
      expect(m!.modifier).toBeLessThanOrEqual(CONFIG.market.maxModifier);
      expect(m!.history.length).toBeLessThanOrEqual(CONFIG.market.historyLength);
    }
  });

  it('自動売却は指定量を超えた分を売る', () => {
    const e = makeEngine();
    e.debugAddResource('stone', 50);
    e.setAutoSell('stone', true, 20);
    e.tick(0.2);
    expect(e.state.inventory.stone).toBe(20);
    expect(e.state.company.cash).toBeGreaterThan(0);
  });
});

describe('保存とロード', () => {
  it('シリアライズして復元しても同じ状態になる', () => {
    const e = makeEngine();
    e.debugAddCash(500);
    e.buyFacility('worker_stone', 2);
    e.gather('gather_stone');
    e.tick(1);
    const json = serializeState(e.state, 123);
    const restored = deserializeState(json);
    expect(restored.company.cash).toBe(e.state.company.cash);
    expect(restored.facilities).toEqual(e.state.facilities);
    expect(restored.inventory).toEqual(e.state.inventory);
    expect(restored.meta.lastSaveTime).toBe(e.state.meta.lastSaveTime);
  });

  it('壊れた（欠けた）セーブでも初期値で補完される', () => {
    const restored = deserializeState(JSON.stringify({ saveVersion: 1, state: { company: { cash: 42 } } }));
    expect(restored.company.cash).toBe(42);
    expect(restored.inventory).toEqual({});
    expect(restored.settings.numberFormat).toBe('short');
  });

  it('新しいバージョンのセーブは拒否する', () => {
    expect(() => deserializeState(JSON.stringify({ saveVersion: 999, state: {} }))).toThrow();
  });
});

describe('オフライン進行', () => {
  it('経過時間ぶん生産され、上限で打ち切られる', () => {
    const e = makeEngine();
    e.debugAddCash(100_000);
    e.buyFacility('small_warehouse', 5);
    e.buyFacility('worker_stone', 1);
    const report = e.applyOffline(3600, 1800);
    expect(report.capped).toBe(true);
    expect(report.simulatedSeconds).toBe(1800);
    expect(report.resourceDelta.stone).toBeCloseTo(0.2 * 1800, 3);
  });

  it('倉庫が満杯なら単純な 生産量×秒 にはならない', () => {
    const e = makeEngine();
    e.debugAddCash(1000);
    e.buyFacility('worker_stone', 1);
    const report = e.applyOffline(8 * 3600);
    expect(report.resourceDelta.stone).toBeCloseTo(CONFIG.baseStorage, 3);
    expect(e.state.inventory.stone).toBeLessThanOrEqual(CONFIG.baseStorage);
  });

  it('入力資源が尽きたら加工施設はそこで止まる', () => {
    const e = makeEngine();
    e.debugAddCash(100_000);
    e.debugUnlockAll();
    e.buyFacility('small_warehouse', 2);
    e.buyFacility('simple_smelter', 1);
    e.debugAddResource('iron_ore', 4);
    e.debugAddResource('wood', 100);
    e.applyOffline(3600);
    expect(e.state.inventory.iron).toBeCloseTo(2, 3);
    expect(e.state.inventory.iron_ore).toBeCloseTo(0, 6);
  });
});

describe('解放・チュートリアル・実績', () => {
  it('チュートリアルは順に進む', () => {
    const e = makeEngine();
    expect(e.state.tutorial.step).toBe(0);
    for (let i = 0; i < 3; i++) e.gather('gather_stone');
    e.tick(0.1);
    expect(e.state.tutorial.step).toBe(1);
    for (let i = 0; i < 2; i++) e.gather('gather_wood');
    e.tick(0.1);
    expect(e.state.tutorial.step).toBe(2);
    e.craft('craft_stone_hammer');
    e.tick(0.1);
    expect(e.state.tutorial.step).toBe(3);
  });

  it('鉄を入手すると工具レシピが解放される', () => {
    const e = makeEngine();
    expect(e.state.unlocked['recipe:craft_tool']).toBeUndefined();
    e.debugAddResource('iron', 1);
    expect(e.state.unlocked['recipe:craft_tool']).toBe(true);
  });

  it('実績「最初の石」が解除される', () => {
    const e = makeEngine();
    e.gather('gather_stone');
    e.tick(0.1);
    expect(e.state.achievements.first_stone).toBeDefined();
  });
});

describe('初期状態', () => {
  it('初期状態は資源ゼロ・所持金ゼロ', () => {
    const s = createInitialState(0);
    expect(s.company.cash).toBe(CONFIG.initialCash);
    expect(Object.keys(s.inventory)).toHaveLength(0);
    expect(s.discovered.stone).toBe(true);
    expect(s.discovered.iron_ore).toBeUndefined();
  });
});
