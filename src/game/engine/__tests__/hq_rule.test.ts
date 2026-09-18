/**
 * 本社は「手作業と倉庫」だけの場所にしてある。
 *
 * 工場・発電所・店舗・研究所は、地図で買った土地にしか建たない。
 * 鉱山が無いのに鉄鉱石が出る、といった筋の通らない状態を作らないための決まりで、
 * ここが崩れると序盤の手ごたえも設定も一緒に崩れる。
 */
import { describe, expect, it } from 'vitest';
import { FACILITIES, FACILITY_MAP, type FacilityDef, type FacilityId } from '@/game/data/facilities';
import { GameEngine } from '../GameEngine';
import { canBuildOn } from '../land';

/** 本社に建てられる決まりの施設 */
const HQ_ALLOWED: FacilityId[] = [
  'worker_stone',
  'worker_wood',
  'worker_gatherer',
  'worker_scrap',
  'scrap_truck',
  'scrap_baler',
  'small_warehouse',
  'large_warehouse',
  // 取引先へ荷を届ける自社の乗り物。本社にも土地にも置ける
  'fleet_truck',
  'fleet_ship',
  'fleet_plane',
  'simple_smelter',
  'tool_workshop',
  'parts_workshop',
  'cast_parts_workshop',
];

function makeEngine() {
  const e = new GameEngine({ rng: () => 0.42, now: () => 1_000_000 });
  e.keepDefaultHq();
  e.debugAddCash(50_000_000);
  e.debugUnlockAll();
  e.refreshDerived();
  return e;
}

describe('本社に建てられるもの', () => {
  it('決めた14種だけが本社に建てられる', () => {
    // 倉庫は本社にも土地にも建てられる（site: 'any'）ので、判定は canBuildOn で見る
    const e = makeEngine();
    const hqLand = e.state.lands.find((l) => l.id === 'hq')!;
    const hq = (FACILITIES as readonly FacilityDef[]).filter((f) => canBuildOn(f, hqLand).ok).map((f) => f.id);
    expect(hq.sort()).toEqual([...HQ_ALLOWED].sort());
  });

  it('工場・発電所・店舗・研究所は本社に建てられない', () => {
    const e = makeEngine();
    const hqLand = e.state.lands.find((l) => l.id === 'hq')!;
    for (const def of FACILITIES as readonly FacilityDef[]) {
      if ((HQ_ALLOWED as string[]).includes(def.id)) continue;
      const check = canBuildOn(def, hqLand);
      expect(check.ok, `${def.name} が本社に建ってしまう`).toBe(false);
      expect(e.buyFacility(def.id as FacilityId, 1, 'hq'), def.name).toBe(0);
    }
  });

  it('本社では鉄鉱石が1つも出ない（鉱山は土地だけ）', () => {
    for (const id of HQ_ALLOWED) {
      const def = FACILITY_MAP[id];
      const outputs = Object.keys(def.production?.outputs ?? {});
      for (const o of ['iron_ore', 'coal', 'copper_ore', 'crude_oil', 'uranium_ore', 'rough_gem', 'gold_ore']) {
        expect(outputs, `${def.name} が ${o} を出している`).not.toContain(o);
      }
    }
  });

  it('本社の炉は鉄くずを溶かす（鉱石は使わない）', () => {
    const def = FACILITY_MAP.simple_smelter;
    const inputs = Object.keys(def.production?.inputs ?? {});
    expect(inputs).toContain('scrap_metal');
    expect(inputs).not.toContain('iron_ore');
  });

  it('本社だけで「鉄くず → 鉄 → 工具」までは作れる', () => {
    const e = makeEngine();
    expect(e.buyFacility('worker_scrap', 4, 'hq')).toBe(4);
    expect(e.buyFacility('worker_wood', 2, 'hq')).toBe(2);
    expect(e.buyFacility('simple_smelter', 1, 'hq')).toBe(1);
    expect(e.buyFacility('tool_workshop', 1, 'hq')).toBe(1);
    e.buyFacility('small_warehouse', 5, 'hq');
    e.advance(600);
    expect(e.state.stats.totalProduced.iron ?? 0).toBeGreaterThan(0);
    expect(e.state.stats.totalProduced.tool ?? 0).toBeGreaterThan(0);
  });
});
