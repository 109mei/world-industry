/**
 * 前の版のセーブからの引き継ぎ。
 *
 * ここが狂うと、遊んできた会社が一瞬で別物になる。
 * 実際に一度やらかしている: 古い持ち物を**いまの値段**で数え直したせいで、
 * 総資産150万円のセーブが150億円になって公開された。
 * 円そのものの値打ちは変えていないのだから、**そのとき実際に払った額**で数える。
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/game/data/config';
import { carryOverValue } from '@/game/services/save/SaveService';

/** v2 のころのセーブに近い形を作る */
function oldSave(over: Record<string, unknown> = {}) {
  return {
    saveVersion: 14,
    app: 'WORLD INDUSTRY',
    savedAt: 1,
    state: {
      company: { cash: 1_000_000, totalEarned: 5_000_000, facilityInvestment: 0, landInvestment: 0 },
      inventory: {},
      facilities: [],
      lands: [{ id: 'hq' }],
      ...over,
    },
  };
}

describe('引き継ぎ額の数え方', () => {
  it('現金はそのまま持ち越す', () => {
    expect(carryOverValue(oldSave())).toBe(1_000_000);
  });

  it('施設と土地は「払った額」で数える（いまの建設費で数え直さない）', () => {
    const v = carryOverValue(
      oldSave({
        company: { cash: 500_000, facilityInvestment: 400_000, landInvestment: 600_000 },
      }),
    );
    expect(v).toBe(500_000 + 400_000 * CONFIG.facilityValueRatio + 600_000 * CONFIG.landValueRatio);
  });

  it('在庫の数が多くても、桁が跳ね上がらない（150万が150億になった原因）', () => {
    // 古い物差しでは1タップ60、施設は毎秒1,440だったので、在庫の数はとても大きかった。
    // それをいまの1kgあたりの値段で掛けると、現金の何千倍にもなってしまう。
    const before = carryOverValue(oldSave());
    const after = carryOverValue(
      oldSave({
        inventory: { scrap_metal: 500_000, iron: 200_000, stone: 1_000_000, coal: 300_000 },
      }),
    );
    expect(after).toBe(before);
  });

  it('古い施設をたくさん持っていても、桁が跳ね上がらない', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `hq:large_warehouse${i}`, typeId: 'large_warehouse', landId: 'hq', count: 20 }));
    const v = carryOverValue(oldSave({ facilities: many }));
    // 払った額（facilityInvestment）は 0 なので、現金ぶんだけ
    expect(v).toBe(1_000_000);
  });

  it('物件は買値をそのまま足す', () => {
    const v = carryOverValue(
      oldSave({
        estate: { owned: { iz_shop: { boughtAt: 1, boughtPrice: 12_360_000 } }, custom: { w1: { boughtPrice: 3_000_000 } } },
      }),
    );
    expect(v).toBe(1_000_000 + 12_360_000 + 3_000_000);
  });

  it('桁違いの数が入っていても、そのまま所持金にはしない', () => {
    const v = carryOverValue(oldSave({ company: { cash: 1e300 } }));
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeLessThanOrEqual(1e11);
  });

  it('壊れた中身でも例外を投げず、0 以上の整数を返す', () => {
    for (const bad of [null, undefined, 7, 'x', true, [], {}, { state: null }, { state: { company: null } }, oldSave({ company: { cash: -5_000 } }), oldSave({ estate: { owned: { a: null } } })]) {
      const v = carryOverValue(bad);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('形が {state:…} でも素の状態でも、同じ額になる', () => {
    const file = oldSave({ company: { cash: 250_000, facilityInvestment: 100_000 } });
    expect(carryOverValue(file)).toBe(carryOverValue(file.state));
  });
});
