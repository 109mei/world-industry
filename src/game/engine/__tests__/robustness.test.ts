import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { FACILITY_MAP, facilityBulkCost } from '@/game/data/facilities';
import { RECIPE_MAP } from '@/game/data/recipes';
import { migrateSave } from '../state/migrations';
import { MAX_VALUE, safe } from '@/utils/numbers';
import { GRACE_SECONDS } from '../systems/finance';
import { MAX_CLIENTS } from '../systems/sales';
import { formatMoney } from '@/utils/format';
import { getMarketState } from '../systems/market';

function makeEngine(cash = 0) {
  const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  return e;
}

describe('壊れたセーブでも動く', () => {
  it('数でないものは 0 として扱う', () => {
    expect(safe(undefined as unknown as number)).toBe(0);
    expect(safe(null as unknown as number)).toBe(0);
    expect(safe(NaN)).toBe(0);
    expect(safe(Infinity)).toBe(MAX_VALUE);
    expect(safe(-Infinity)).toBe(-MAX_VALUE);
    expect(formatMoney(undefined as unknown as number)).toBe('0円');
  });

  it('グラフの記録が壊れていても毎tickで落ちない', () => {
    const s = migrateSave({ saveVersion: 13, company: { cash: 500 }, lands: [], history: { assets: null, income: null, employees: null, nextIn: null } });
    expect(Array.isArray(s.history?.assets)).toBe(true);
    const e = new GameEngine({ state: s, now: () => 1_000_000 });
    expect(() => {
      e.tick(1);
      e.tick(1);
    }).not.toThrow();
  });

  it('所持金が null のセーブは 0 に直る', () => {
    const s = migrateSave({ saveVersion: 13, company: { cash: null }, lands: [] });
    expect(s.company.cash).toBe(0);
    const e = new GameEngine({ state: s, now: () => 1_000_000 });
    e.tick(1);
    expect(Number.isFinite(e.state.company.cash)).toBe(true);
  });

  it('施設に id や enabled が無くても補われる', () => {
    const s = migrateSave({ saveVersion: 13, company: { cash: 100 }, lands: [], facilities: [{ typeId: 'worker_stone', count: 2 }] });
    const f = s.facilities[0];
    expect(f.id).toBe('hq:worker_stone');
    expect(f.enabled).toBe(true);
    expect(f.landId).toBe('hq');
  });

  it('移行でいまのデータを消さない', () => {
    const s = migrateSave({
      saveVersion: 8,
      company: { cash: 1 },
      lands: [],
      automation: { on: { gather: true }, recipes: ['craft_shovel'], gathers: [], timers: {} },
      business: { divisions: [], nextId: 7 },
    });
    expect(s.automation.on.gather).toBe(true);
    expect(s.automation.recipes).toEqual(['craft_shovel']);
    expect(s.business.nextId).toBe(7);
  });
});

describe('総資産は tick の外でも正しい', () => {
  it('読み込んだ直後から不動産のぶんが入っている', () => {
    const e = makeEngine();
    e.debugAddCash(100_000_000);
    e.state.estate.custom = {
      w1: { id: 'w1', name: 'x', label: 'y', kind: 'office', lat: 35.4, lon: 139.3, areaSqm: 1000, levels: 3, unitPrice: 400_000, basePrice: 14_000_000_000, cityId: 'tokyo', regionLabel: 'r', country: '日本', boughtAt: 0, boughtPrice: 1 },
    };
    const loaded = new GameEngine({ state: JSON.parse(JSON.stringify(e.state)), now: () => 1_000_000 });
    expect(loaded.derived.estateValue).toBeGreaterThan(0);
    expect(loaded.derived.assets).toBeGreaterThan(14_000_000_000);
  });
});

describe('クラフトの出来高', () => {
  it('倉庫が満杯でも材料だけ消えない', () => {
    const e = makeEngine(10_000);
    e.debugUnlockAll();
    e.state.prestige.upgrades = { craft: 5 }; // 出来高 +50%
    e.refreshDerived();
    // 倉庫は資源1種につき100t（＝100,000kg）ある。材料を数千積んだだけでは満杯にならないので、
    // 材料を容量いっぱいまで積み、出来上がりの鉄の置き場だけを 1,000kg 残して「あと少しで満杯」にする。
    const cap = e.derived.capacity;
    e.debugAddResource('scrap_metal', cap);
    e.debugAddResource('wood', cap);
    e.debugAddResource('iron', cap - 1_000);
    const scrapBefore = e.state.inventory.scrap_metal ?? 0;
    const ironBefore = e.state.inventory.iron ?? 0;
    const made = e.craft('smelt_scrap', 'max');
    const ironAfter = e.state.inventory.iron ?? 0;
    const used = scrapBefore - (e.state.inventory.scrap_metal ?? 0);
    // 使った材料に見合う出来高が、ちゃんと倉庫に入っている（消えていない）。
    // 何kgの鉄くずから鉄が何kgできるかはレシピから引く（いまは 1.2kg → 1kg）
    const recipe = RECIPE_MAP['smelt_scrap'];
    const ironPerScrap = (recipe.outputs?.iron ?? 0) / (recipe.inputs.scrap_metal ?? 1);
    expect(made).toBeGreaterThan(0);
    // 置き場が足りないぶんは作らない（材料も減らない）
    expect(used).toBeLessThan(scrapBefore);
    expect(ironAfter - ironBefore).toBeGreaterThan(used * ironPerScrap - 1);
  });
});

describe('赤字の判定は収入が入ったあと', () => {
  it('売れば足りるときは倒産しないし、警告も出ない', () => {
    // 作業員1人目が15万円になったので、5人ぶんの建設費をデータから出して渡す。
    // ここで雇えないと人件費が0になり、「売れば足りる」場面そのものが作れない。
    const e = makeEngine(facilityBulkCost(FACILITY_MAP['worker_stone'], 0, 5));
    e.debugUnlockAll();
    expect(e.buyFacility('worker_stone', 5)).toBe(5);
    e.debugAddResource('stone', 100_000);
    e.state.market.autoSell.stone = { enabled: true, keep: 0, minPriceRatio: 0 };
    e.state.company.cash = 0;
    const warns: string[] = [];
    e.addListener((ev) => {
      if (ev.type === 'warn') warns.push(ev.message);
    });
    for (let i = 0; i < 50; i++) e.tick(1);
    expect(e.state.company.cash).toBeGreaterThanOrEqual(0);
    expect(e.state.company.debtSeconds ?? 0).toBe(0);
    expect(warns.filter((w) => w.includes('資金がマイナス'))).toEqual([]);
  });

  it('本当に立て直せないときは倒産する', () => {
    // 同じく5人ぶんの建設費を渡して雇い、そのうえで所持金をマイナスにする（売るものが無い）
    const e = makeEngine(facilityBulkCost(FACILITY_MAP['worker_stone'], 0, 5));
    expect(e.buyFacility('worker_stone', 5)).toBe(5);
    e.state.company.cash = -1000;
    for (let i = 0; i < GRACE_SECONDS + 5; i++) e.tick(1);
    expect(e.state.stats.bankruptcies).toBe(1);
  });
});

describe('収支の表示', () => {
  it('まとめて進めたあとも 0 にならない', () => {
    const e = makeEngine(1_000_000);
    e.debugUnlockAll();
    e.buyFacility('worker_stone', 3);
    e.debugAddResource('stone', 500_000);
    e.state.market.autoSell.stone = { enabled: true, keep: 0, minPriceRatio: 0 };
    for (let i = 0; i < 20; i++) e.tick(1);
    const before = e.derived.incomePerSec;
    expect(before).not.toBe(0);
    e.advance(60);
    expect(e.derived.incomePerSec).not.toBe(0);
  });
});

describe('自動化の時計', () => {
  it('まとめて進めても時計が溜まり続けない', () => {
    const e = makeEngine(0);
    e.state.prestige.points = 100;
    e.buyPrestigeUpgrade('auto_survey');
    e.advance(8 * 3600);
    expect(e.state.automation.timers.survey ?? 0).toBeLessThan(10);
  });
});

describe('取引先の記録', () => {
  it('増えすぎたら関係の薄いものから忘れる', async () => {
    const { rememberClient, salesState } = await import('../systems/sales');
    const e = makeEngine();
    for (let i = 0; i < MAX_CLIENTS + 50; i++) {
      rememberClient(e.state, {
        id: `w${i}`,
        kind: 'factory',
        label: '工場',
        name: `会社${i}`,
        named: false,
        lat: 35,
        lon: 139,
        areaSqm: 100,
        levels: 1,
        polygon: [],
      });
    }
    expect(Object.keys(salesState(e.state).clients).length).toBeLessThanOrEqual(MAX_CLIENTS);
  });
});

describe('総資産は相場では動かない', () => {
  it('売り買いしていないのに相場が動いても総資産は変わらない', () => {
    const e = makeEngine(1_000_000);
    e.debugAddResource('stone', 5_000);
    e.debugAddResource('wood', 5_000);
    e.refreshDerived();
    const before = e.derived.assets;
    expect(before).toBeGreaterThan(1_000_000);
    // 高騰させる
    for (const id of ['stone', 'wood'] as const) {
      const m = getMarketState(e.state, id);
      m.modifier = 3;
      m.saturation = 800;
    }
    e.refreshDerived();
    expect(e.derived.assets).toBeCloseTo(before, 6);
    // 暴落させる
    for (const id of ['stone', 'wood'] as const) {
      const m = getMarketState(e.state, id);
      m.modifier = 0.2;
      m.saturation = 0;
    }
    e.refreshDerived();
    expect(e.derived.assets).toBeCloseTo(before, 6);
  });

  it('実際に売れば総資産は動く', () => {
    const e = makeEngine(1_000_000);
    e.debugAddResource('stone', 5_000);
    e.refreshDerived();
    const before = e.derived.assets;
    e.sell('stone', 5_000);
    e.refreshDerived();
    expect(e.derived.assets).not.toBeCloseTo(before, 2);
  });
});
