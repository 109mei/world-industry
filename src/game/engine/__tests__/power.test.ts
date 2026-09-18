/**
 * 発電まわりの見張り。
 *
 * 「どこに建てても同じ」だと土地を選ぶ意味がなくなり、
 * 「電気を買うほうが安い」と発電所を建てる意味がなくなる。その2つを機械的に守る。
 */
import { describe, expect, it } from 'vitest';
import { FACILITIES, FACILITY_MAP, facilityBulkCost, type FacilityDef } from '@/game/data/facilities';
import { LAND_MAP } from '@/game/data/lands';
import { TERRAIN_IDS, TERRAINS, type TerrainId } from '@/game/data/terrain';
import { GRID, gridPricePerMWh, gridTotalPerMWh, basicChargePerSec, usageChargePerSec, sellPricePerMWh, CONTRACT_STEPS } from '@/game/data/power';
import { REAL_SECOND_TO_GAME, SECONDS_PER_GAME_DAY } from '@/game/data/scale';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { GameEngine } from '../GameEngine';

const PLANTS = (FACILITIES as readonly FacilityDef[]).filter((f) => f.category === 'POWER');

/** その地形での出力（MW）。建てられない地形は null */
function outputOn(def: FacilityDef, terrain: TerrainId): number | null {
  if (def.allowedTerrain && !def.allowedTerrain.includes(terrain)) return null;
  return (def.powerGen ?? 0) * (def.terrainBonus?.[terrain] ?? 1);
}

/** 1MWh を自前で作るのにかかる燃料代（円）。燃料の要らない発電は0 */
function fuelCostPerMWh(def: FacilityDef): number {
  if (!def.fuel || !def.powerGen) return 0;
  let perSec = 0;
  for (const [rid, rate] of Object.entries(def.fuel) as [ResourceId, number][]) {
    perSec += (RESOURCE_MAP[rid]?.basePrice ?? 0) * (rate ?? 0);
  }
  /*
   * powerGen MW を「ゲームの1秒」出すのに perSec 円かかる。
   * 電気を買うときの計算（MW × 円/MWh ÷ 3600 × 物差し）と同じ土俵に載せて、
   * 自前の燃料が1MWhあたり何円になるかに直す。
   */
  return (perSec * 3600) / (def.powerGen * REAL_SECOND_TO_GAME);
}

describe('発電所と土地', () => {
  it('発電所はすべて「地形で変わる」か「建てられる地形が決まっている」', () => {
    const flat = PLANTS.filter((f) => !f.allowedTerrain && Object.keys(f.terrainBonus ?? {}).length === 0);
    expect(flat.map((f) => f.name)).toEqual([]);
  });

  it('どの発電所も、得意な地形と不得意な地形がある', () => {
    const bad: string[] = [];
    for (const def of PLANTS) {
      const outs = TERRAIN_IDS.map((t) => outputOn(def, t)).filter((v): v is number => v != null);
      if (outs.length === 0) {
        bad.push(`${def.name}: どこにも建てられない`);
        continue;
      }
      // 建てられる地形が1つだけのもの（潮力など）は、その1つが取り柄なので差がなくてよい
      if (outs.length === 1) continue;
      const min = Math.min(...outs);
      const max = Math.max(...outs);
      if (max - min < 1e-9) bad.push(`${def.name}: どこに建てても同じ`);
    }
    expect(bad).toEqual([]);
  });

  it('どの地形にも「そこがいちばん向いている発電」がある（死んだ地形がない）', () => {
    const bad: string[] = [];
    for (const t of TERRAIN_IDS) {
      const best = PLANTS.map((def) => ({ def, out: outputOn(def, t) })).filter((x) => x.out != null);
      if (best.length === 0) bad.push(`${TERRAINS[t].name}: 建てられる発電所がない`);
    }
    expect(bad).toEqual([]);
    // 地形ごとに「いちばん相性のよい発電」が全部同じ1種類になっていないこと
    const winners = new Set<string>();
    for (const t of TERRAIN_IDS) {
      let top: { id: string; ratio: number } | null = null;
      for (const def of PLANTS) {
        const out = outputOn(def, t);
        if (out == null || !def.powerGen) continue;
        const ratio = out / def.powerGen; // その地形での「素の出力に対する伸び」
        if (!top || ratio > top.ratio) top = { id: def.id, ratio };
      }
      if (top) winners.add(top.id);
    }
    expect(winners.size).toBeGreaterThanOrEqual(4);
  });

  it('強い発電所ほど高いか、燃料が要るか、建てられる場所が限られている', () => {
    const bad: string[] = [];
    for (const a of PLANTS) {
      for (const b of PLANTS) {
        if (a.id === b.id) continue;
        const cheaper = a.baseCost <= b.baseCost;
        const stronger = (a.powerGen ?? 0) >= (b.powerGen ?? 0) * 1.0001;
        const freer = !a.allowedTerrain && !!b.allowedTerrain;
        const noFuel = !a.fuel && !!b.fuel;
        // 安くて強くて場所も自由で燃料も要らない、が同時に成り立つと b を建てる理由がなくなる
        if (cheaper && stronger && (freer || (!a.allowedTerrain && !b.allowedTerrain)) && (noFuel || (!a.fuel && !b.fuel))) {
          bad.push(`${a.name} が ${b.name} の上位互換`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('電力会社から買う', () => {
  it('買うほうが自前の燃料より高い（発電所を建てる意味が残る）', () => {
    // 比べる相手は従量料金だけではなく、契約容量ぶんの基本料金まで足した「本当にかかる額」。
    // 基本料金は使わなくてもかかるので、これを外すと「電力会社のほうが安い」という
    // 現実には起きない結論になってしまう（ディーゼル発電が実際に割高なのはそのとおりで、
    // それでも自家発電が選ばれるのは基本料金を払わずに済むから）。
    const jp = gridTotalPerMWh('JP');
    for (const def of PLANTS) {
      const c = fuelCostPerMWh(def);
      if (c <= 0) continue;
      expect(c, `${def.name} の燃料代 ${Math.round(c)}円/MWh（電力会社は基本料金こみ ${Math.round(jp)}円/MWh）`).toBeLessThan(jp);
    }
  });

  it('売る値段は買う値段より安い（差でもうけるだけの抜け道を作らない）', () => {
    expect(sellPricePerMWh('JP')).toBeLessThan(gridPricePerMWh('JP'));
    // 再生可能エネルギーの上乗せを入れても、買値は超えない
    expect(sellPricePerMWh('JP', true)).toBeLessThan(gridPricePerMWh('JP'));
  });

  it('国によって電気代が違う', () => {
    expect(gridPricePerMWh('SA')).toBeLessThan(gridPricePerMWh('JP'));
    expect(gridPricePerMWh('DE')).toBeGreaterThan(gridPricePerMWh('JP'));
  });

  it('契約しなければ1円もかからない', () => {
    expect(basicChargePerSec(0, 'JP')).toBe(0);
    expect(usageChargePerSec(0, 'JP')).toBe(0);
  });

  it('契約容量を大きくすると、使わなくても基本料金がかかる', () => {
    const small = basicChargePerSec(1, 'JP');
    const big = basicChargePerSec(100, 'JP');
    expect(small).toBeGreaterThan(0);
    expect(big).toBeCloseTo(small * 100, 6);
    // ゲームのひと月（現実の30分）ぶんに直すと、決めた額になる
    expect(small * 30 * SECONDS_PER_GAME_DAY).toBeCloseTo(GRID.basicChargePerMWPerMonth, 3);
  });

  it('契約した容量までしか買えない', () => {
    const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
    e.updateSettings({ events: false });
    e.keepDefaultHq();
    // 製鋼所は1棟9.4億円（現実の電炉の建設費）。土地代と合わせて買えるだけの元手を持たせる
    e.debugAddCash(LAND_MAP.jp_hokkaido.price + facilityBulkCost(FACILITY_MAP.steel_mill, 0, 2) + 1_000_000_000);
    e.state.unlocked['land:jp_hokkaido'] = true;
    expect(e.buyLand('jp_hokkaido')).toBe(true);
    e.state.unlocked['facility:steel_mill'] = true;
    expect(e.buyFacility('steel_mill', 2, 'jp_hokkaido')).toBe(2);
    e.tick(1);
    const demand = e.derived.power.demand;
    expect(demand).toBeGreaterThan(0);
    // 需要より小さく契約すると、契約ぶんしか届かない
    e.setPowerContract(1);
    e.tick(1);
    expect(e.derived.power.purchased).toBeCloseTo(Math.min(1, demand), 6);
    expect(e.derived.power.ratio).toBeLessThan(1);
    // 需要より大きく契約すれば足りる
    e.setPowerContract(CONTRACT_STEPS[CONTRACT_STEPS.length - 1]);
    e.tick(1);
    expect(e.derived.power.purchased).toBeCloseTo(demand, 6);
    expect(e.derived.power.ratio).toBeCloseTo(1, 6);
  });

  it('電気代が所持金から引かれる', () => {
    const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
    e.updateSettings({ events: false });
    e.keepDefaultHq();
    e.debugAddCash(100_000_000);
    e.setPowerContract(20);
    const before = e.state.company.cash;
    e.tick(10);
    const spent = before - e.state.company.cash;
    // 何も使っていなくても、基本料金ぶんは引かれる
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeCloseTo(basicChargePerSec(20, 'JP') * 10, 0);
  });

  it('契約をやめれば、その場で0円に戻る', () => {
    const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
    e.updateSettings({ events: false });
    e.keepDefaultHq();
    e.debugAddCash(100_000_000);
    e.setPowerContract(100);
    e.tick(1);
    expect(e.derived.power.cost).toBeGreaterThan(0);
    e.setPowerContract(0);
    e.tick(1);
    expect(e.derived.power.cost).toBe(0);
    expect(e.derived.power.contractMW).toBe(0);
  });

  it('壊れた契約（マイナス）は0に直る', () => {
    const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
    e.setPowerContract(-50);
    expect(e.state.power?.contractMW).toBe(0);
  });
});

describe('発電所の説明', () => {
  it('説明に書いてある倍率が、実際の設定と合っている', () => {
    const bad: string[] = [];
    for (const def of PLANTS) {
      for (const m of def.description.matchAll(/([ぁ-んァ-ヶ一-龥]+)([0-9.]+)倍/g)) {
        const [, word, num] = m;
        const terrain = TERRAIN_IDS.find((t) => TERRAINS[t].name.includes(word) || word.includes(TERRAINS[t].name.replace('地帯', '')));
        if (!terrain) continue;
        const actual = def.terrainBonus?.[terrain];
        if (actual === undefined || Math.abs(actual - Number(num)) > 1e-9) {
          bad.push(`${def.name}: 説明は「${word}${num}倍」だが設定は ${actual ?? 1}倍`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('新しく足した発電所が一覧にある', () => {
    for (const id of ['diesel_generator', 'micro_hydro', 'biomass_plant', 'geothermal_plant', 'tidal_plant'] as const) {
      expect(FACILITY_MAP[id]?.category, id).toBe('POWER');
    }
  });
});
