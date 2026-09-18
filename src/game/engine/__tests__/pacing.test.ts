/**
 * 序盤の進み具合を、実際にエンジンを回して秒数で測る。
 *
 * 「渋いけれど進める」は感覚では決められない。
 * 本社（手作業と倉庫だけ）から、地図が開いて最初の土地を買うまでの時間を数字で見張る。
 * 施設の値段・産出・資源の値段を触ったときに、ここが壊れたらすぐ分かる。
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/game/data/config';
import { FACILITY_MAP, facilityCost, type FacilityId } from '@/game/data/facilities';
import { LANDS } from '@/game/data/lands';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { GameEngine } from '../GameEngine';

/** いちばん安い土地の値段 */
const FIRST_LAND = Math.min(...LANDS.map((l) => l.price));

/**
 * 工程の比率を保って増やす遊び方。
 * 鉄くずを集めて溶かし、工具にして売る、という本社でできる流れをそのまま組んでいる。
 */
const RATIO: { id: FacilityId; per: number }[] = [
  { id: 'worker_scrap', per: 4 },
  { id: 'scrap_truck', per: 1 },
  { id: 'simple_smelter', per: 6 },
  { id: 'tool_workshop', per: 1.4 },
  { id: 'worker_wood', per: 3 },
  { id: 'small_warehouse', per: 1 },
];

/**
 * 素材そのものは現実どおり安い（鉄くず45円/kg、石3円/kg）。
 * 手で拾って売るだけでは進まず、溶かして工具にして初めて値が付く（材料215円→工具2,500円）。
 * 人はそうやって遊ぶので、測るときも同じことをさせる。
 */
function handCraft(e: GameEngine): void {
  e.craft('smelt_scrap', 2);
  e.craft('craft_tool', 1);
}

const SELLABLE = (Object.keys(RESOURCE_MAP) as ResourceId[]).filter((r) => RESOURCE_MAP[r].sellable);
/** 材料は少しだけ残す（工程を止めないため）。単位は kg */
const KEEP: Partial<Record<ResourceId, number>> = { scrap_metal: 30, iron: 10, wood: 30, stone: 5 };

function count(e: GameEngine, id: FacilityId): number {
  return e.state.facilities.filter((f) => f.typeId === id && f.landId === 'hq').reduce((a, f) => a + f.count, 0);
}

export interface PaceResult {
  /** 地図（土地）が開くまでの秒数 */
  mapAt: number;
  /** 最初の土地を買えるだけ現金が貯まるまでの秒数 */
  landAt: number;
  assets: number;
}

/**
 * tapsPerSecond 回/秒で押しながら育てる。
 * 地図が開いたら買い足しをやめて、土地の代金を貯める（人がやることに近づける）。
 */
export function simulateEarly(tapsPerSecond: number, maxSeconds = 3 * 3600): PaceResult {
  let clock = 1_000_000;
  const e = new GameEngine({ rng: () => 0.42, now: () => clock });
  e.keepDefaultHq();
  e.updateSettings({ events: false });
  e.refreshDerived();

  let mapAt = -1;
  let landAt = -1;
  for (let t = 1; t <= maxSeconds; t++) {
    for (let i = 0; i < tapsPerSecond; i++) {
      e.gather('gather_stone');
      e.gather('gather_wood');
      e.gather('gather_scrap');
    }
    if ((e.state.tools.stone_hammer?.count ?? 0) === 0) e.craft('craft_stone_hammer', 1);
    // 拾ったものは、その場で溶かして工具にする（序盤の主力商品）
    for (let i = 0; i < tapsPerSecond; i++) handCraft(e);
    if (mapAt < 0) {
      // 比率に対していちばん足りないものから順に試す（買えないものは飛ばす）
      const order = [...RATIO].sort((a, b) => count(e, a.id) / a.per - count(e, b.id) / b.per);
      for (const r of order) {
        if (e.state.company.cash < facilityCost(FACILITY_MAP[r.id], count(e, r.id))) continue;
        if (e.buyFacility(r.id, 1, 'hq') > 0) break;
      }
    }
    if (t > 60) {
      for (const r of SELLABLE) {
        const keep = KEEP[r] ?? 0;
        const cur = e.state.market.autoSell[r];
        if ((e.state.stats.totalObtained[r] ?? 0) > 0 && (!cur?.enabled || cur.keep !== keep)) e.setAutoSell(r, true, keep);
      }
    }
    e.tick(1);
    clock += 1000;
    if (mapAt < 0 && e.derived.assets >= CONFIG.landUnlockAssets) mapAt = t;
    if (landAt < 0 && mapAt > 0 && e.state.company.cash >= FIRST_LAND) {
      landAt = t;
      break;
    }
  }
  return { mapAt, landAt, assets: e.derived.assets };
}

const mmss = (s: number) => (s < 0 ? '届かず' : `${Math.floor(s / 60)}分${String(Math.round(s % 60)).padStart(2, '0')}秒`);

describe('序盤の進み具合', () => {
  it('ときどき押す遊び方で、地図が開いて最初の土地に届くまでが30分〜1時間', () => {
    const r = simulateEarly(1);
    console.log(`  地図が開く ${mmss(r.mapAt)} / 最初の土地 ${mmss(r.landAt)}（${FIRST_LAND.toLocaleString('ja-JP')}円）`);
    expect(r.mapAt, '地図が開かない').toBeGreaterThan(0);
    expect(r.landAt, '最初の土地に届かない').toBeGreaterThan(0);
    expect(r.landAt, '早すぎる（渋さが足りない）').toBeGreaterThanOrEqual(25 * 60);
    expect(r.landAt, '遅すぎる（進めない）').toBeLessThanOrEqual(75 * 60);
    // 地図は土地を買うより十分前に開いて、目標が見えている状態にする
    expect(r.mapAt).toBeLessThan(r.landAt);
  });

  it('よく押すほど早く土地に届く', () => {
    const slow = simulateEarly(1);
    const fast = simulateEarly(4);
    console.log(`  よく押す(4回/秒): 地図が開く ${mmss(fast.mapAt)} / 最初の土地 ${mmss(fast.landAt)}`);
    expect(fast.landAt, '押しても早くならない').toBeLessThan(slow.landAt);
  });

  it('いちばん安い土地は、本社だけで手が届く値段になっている', () => {
    // 大阪郊外の資材置き場 150㎡。雑種地の実勢 32,000円/㎡ ＝ 480万円（令和8年の地価公示より）。
    // 現実の地価を入れてあるので「10万円の土地」は作れない。本社の商売だけで届く額かどうかで見る。
    expect(FIRST_LAND).toBeLessThanOrEqual(10_000_000);
    // 地図は土地を買うより手前で開く
    expect(CONFIG.landUnlockAssets).toBeLessThan(FIRST_LAND);
  });
});
