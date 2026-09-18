/**
 * 地図のどこでも買える「区画」。
 *
 * ここで見張るのは3つ。
 *  1. 同じ場所を押せばいつも同じ区画になる（ID がぶれるとセーブの持ち物が迷子になる）
 *  2. 値段がその土地の実勢から出ていて、田舎は安く街なかは高い
 *  3. 大きい区画を買ったあと、その中の小さい区画をもう一度買えない（鉱脈の二重取り）
 */
import { describe, expect, it } from 'vitest';
import {
  cellAt,
  cellAreaSqm,
  cellBounds,
  cellCenter,
  cellsOverlap,
  isPlotId,
  parsePlotId,
  plotId,
  PLOT_SIZES,
  PLOT_SIZE_MAP,
} from '@/game/data/plots';
import { mineralRightOf, overlappingPlot, plotFeatureAt, quoteAny, quotePlot } from '../systems/customEstate';
import { GameEngine } from '../GameEngine';

const IIZUKA = { lat: 33.6459, lon: 130.6915 };
const HOKKAIDO = { lat: 43.5, lon: 143.0 };

describe('区画の格子', () => {
  it('同じ場所を指せば、いつも同じ区画になる', () => {
    for (const size of PLOT_SIZES) {
      const a = cellAt(IIZUKA, size.id);
      // 同じマスの中を少しずらして指しても、行き着く区画は同じ
      const c = cellCenter(a);
      for (const d of [-0.4, -0.1, 0, 0.1, 0.4]) {
        const b = cellAt({ lat: c.lat + size.deg * d, lon: c.lon + size.deg * d }, size.id);
        expect(plotId(b)).toBe(plotId(a));
      }
    }
  });

  it('ID は往復できて、OSM の ID とはぶつからない', () => {
    for (const size of PLOT_SIZES) {
      const cell = cellAt(IIZUKA, size.id);
      const id = plotId(cell);
      expect(parsePlotId(id)).toEqual(cell);
      expect(isPlotId(id)).toBe(true);
    }
    // OSM は way=w / node=n / relation=r で始まる
    for (const id of ['w123456', 'n42', 'r7', '', 'pz:1:2', 'ps:1', 'ps:a:b']) expect(isPlotId(id)).toBe(false);
  });

  it('南半球・西半球でも、指した場所が区画の中に入る', () => {
    for (const at of [{ lat: -23.6, lon: -70.4 }, { lat: -25, lon: 133 }, { lat: 60.4, lon: 5.3 }]) {
      for (const size of PLOT_SIZES) {
        const b = cellBounds(cellAt(at, size.id));
        expect(at.lat).toBeGreaterThanOrEqual(b.south);
        expect(at.lat).toBeLessThan(b.north);
        expect(at.lon).toBeGreaterThanOrEqual(b.west);
        expect(at.lon).toBeLessThan(b.east);
      }
    }
  });

  it('大きさは 小 < 中 < 大 の順で、およそ16倍ずつ広い', () => {
    const [s, m, l] = PLOT_SIZES.map((x) => cellAreaSqm(cellAt(IIZUKA, x.id)));
    expect(s).toBeLessThan(m);
    expect(m).toBeLessThan(l);
    expect(m / s).toBeCloseTo(16, 0);
    expect(l / m).toBeCloseTo(16, 0);
  });

  it('中心はマスの真ん中で、面積は緯度なりに縮む', () => {
    const cell = cellAt(IIZUKA, 'medium');
    const b = cellBounds(cell);
    const c = cellCenter(cell);
    expect(c.lat).toBeCloseTo((b.south + b.north) / 2, 9);
    expect(c.lon).toBeCloseTo((b.west + b.east) / 2, 9);
    // 高緯度ほど東西が縮むので、同じ度数でも面積は小さい
    const north = cellAreaSqm(cellAt({ lat: 68, lon: 20 }, 'medium'));
    expect(north).toBeLessThan(cellAreaSqm(cell));
  });
});

describe('区画の重なり', () => {
  it('同じ場所なら、大きさが違っても重なりとみなす', () => {
    const small = cellAt(IIZUKA, 'small');
    const large = cellAt(IIZUKA, 'large');
    expect(cellsOverlap(small, large)).toBe(true);
    expect(cellsOverlap(large, small)).toBe(true);
  });

  it('隣どうしは重ならない', () => {
    const a = cellAt(IIZUKA, 'medium');
    const b = { ...a, col: a.col + 1 };
    expect(cellsOverlap(a, b)).toBe(false);
    expect(cellsOverlap(a, { ...a, row: a.row + 1 })).toBe(false);
  });

  it('遠い場所は重ならない', () => {
    expect(cellsOverlap(cellAt(IIZUKA, 'large'), cellAt(HOKKAIDO, 'large'))).toBe(false);
  });
});

describe('区画の値段', () => {
  it('街なかのほうが田舎よりずっと高い', () => {
    const city = quotePlot(plotFeatureAt(IIZUKA, 'small')).basePrice;
    const rural = quotePlot(plotFeatureAt(HOKKAIDO, 'small')).basePrice;
    expect(city).toBeGreaterThan(rural * 10);
  });

  it('広いほど高く、同じ場所なら面積におよそ比例する', () => {
    const s = quotePlot(plotFeatureAt(HOKKAIDO, 'small'));
    const m = quotePlot(plotFeatureAt(HOKKAIDO, 'medium'));
    expect(m.basePrice).toBeGreaterThan(s.basePrice);
    const ratio = m.basePrice / s.basePrice;
    expect(ratio).toBeGreaterThan(8);
    expect(ratio).toBeLessThan(32);
  });

  it('鉱業権は地下に眠るものの値打ちに応じて乗る（更地の地価とは別）', () => {
    const f = plotFeatureAt({ lat: -25, lon: 133 }, 'large');
    const q = quotePlot(f);
    expect(q.mineralRight).toBe(mineralRightOf(f));
    expect(q.basePrice).toBe(q.landPart + q.buildingPart + (q.mineralRight ?? 0));
    // 建物は建っていないので、建物の分は0
    expect(q.buildingPart).toBe(0);
  });

  it('quoteAny は、建物なら鉱業権を付けない', () => {
    const building = { id: 'w123', kind: 'office' as const, areaSqm: 800, levels: 4, lat: IIZUKA.lat, lon: IIZUKA.lon };
    expect(quoteAny(building).mineralRight).toBeUndefined();
    expect(quoteAny(plotFeatureAt(IIZUKA, 'small')).mineralRight).toBeGreaterThanOrEqual(0);
  });

  it('区画は更地なので、どこでも「土地」として扱われる', () => {
    for (const size of PLOT_SIZES) {
      const f = plotFeatureAt(IIZUKA, size.id);
      expect(f.kind).toBe('land');
      expect(f.levels).toBe(0);
      expect(f.named).toBe(false);
      expect(f.label).toBe(PLOT_SIZE_MAP[size.id].name);
      expect(f.polygon.length).toBe(5); // 閉じた四角
    }
  });
});

describe('区画を買う', () => {
  function engineWithCash(cash: number): GameEngine {
    const e = new GameEngine({ rng: () => 0.42, now: () => 1_000_000 });
    e.keepDefaultHq();
    e.debugAddCash(cash);
    e.refreshDerived();
    return e;
  }

  it('買うと施設を建てられる土地になる', () => {
    const f = plotFeatureAt(HOKKAIDO, 'small');
    const e = engineWithCash(quotePlot(f).basePrice * 4);
    expect(e.buyCustomProperty(f)).toBe(true);
    expect(e.state.lands.some((l) => l.id === `osm:${f.id}`)).toBe(true);
  });

  it('同じ区画は二度買えない', () => {
    const f = plotFeatureAt(HOKKAIDO, 'small');
    const e = engineWithCash(quotePlot(f).basePrice * 4);
    expect(e.buyCustomProperty(f)).toBe(true);
    expect(e.buyCustomProperty(f)).toBe(false);
  });

  it('持っている区画と重なる区画は買えない（鉱脈の二重取りを止める）', () => {
    const small = plotFeatureAt(HOKKAIDO, 'small');
    const large = plotFeatureAt(HOKKAIDO, 'large');
    const e = engineWithCash(quotePlot(large).basePrice * 4);
    expect(e.buyCustomProperty(small)).toBe(true);
    expect(overlappingPlot(e.state, parsePlotId(large.id)!)).not.toBeNull();
    expect(e.buyCustomProperty(large)).toBe(false);
  });

  it('隣の区画なら買える', () => {
    const a = plotFeatureAt(HOKKAIDO, 'medium');
    const deg = PLOT_SIZE_MAP.medium.deg;
    const b = plotFeatureAt({ lat: HOKKAIDO.lat + deg, lon: HOKKAIDO.lon }, 'medium');
    expect(a.id).not.toBe(b.id);
    const e = engineWithCash(quotePlot(a).basePrice * 6);
    expect(e.buyCustomProperty(a)).toBe(true);
    expect(e.buyCustomProperty(b)).toBe(true);
  });

  it('お金が足りなければ買えない', () => {
    const f = plotFeatureAt(IIZUKA, 'large');
    const e = engineWithCash(1000);
    expect(e.buyCustomProperty(f)).toBe(false);
  });
});
