/** 距離の計算。地図の絞り込みと運賃の両方がこれに乗っているので、実際の距離と合っているかを見る。 */
import { describe, expect, it } from 'vitest';
import { distanceKm, formatDistance, polygonAreaSqm } from '@/utils/geo';

const TOKYO = { lat: 35.6812, lon: 139.7671 };
const OSAKA = { lat: 34.7025, lon: 135.4959 };
const LONDON = { lat: 51.5074, lon: -0.1278 };

describe('距離の計算', () => {
  it('東京〜大阪は約400km', () => {
    expect(distanceKm(TOKYO, OSAKA)).toBeGreaterThan(390);
    expect(distanceKm(TOKYO, OSAKA)).toBeLessThan(410);
  });

  it('東京〜ロンドンは約9,560km', () => {
    const d = distanceKm(TOKYO, LONDON);
    expect(d).toBeGreaterThan(9_400);
    expect(d).toBeLessThan(9_700);
  });

  it('同じ場所は0', () => {
    expect(distanceKm(TOKYO, TOKYO)).toBeCloseTo(0, 6);
  });

  it('日付変更線をまたいでも近いほうを測る（地球の裏側を回らない）', () => {
    const west = { lat: 0, lon: 179.5 };
    const east = { lat: 0, lon: -179.5 };
    // 経度1度ぶん＝約111km。反対回りだと約4万km になる
    expect(distanceKm(west, east)).toBeLessThan(120);
  });

  it('向きを変えても同じ', () => {
    expect(distanceKm(TOKYO, OSAKA)).toBeCloseTo(distanceKm(OSAKA, TOKYO), 6);
  });

  it('半径での絞り込みが、実際の近さの順と合う', () => {
    const near = { lat: 35.69, lon: 139.77 };
    const far = { lat: 35.9, lon: 139.77 };
    expect(distanceKm(TOKYO, near)).toBeLessThan(5);
    expect(distanceKm(TOKYO, far)).toBeGreaterThan(20);
    const within = (p: { lat: number; lon: number }, km: number) => distanceKm(TOKYO, p) <= km;
    expect(within(near, 5)).toBe(true);
    expect(within(far, 5)).toBe(false);
    expect(within(far, 50)).toBe(true);
  });
});

describe('距離の表示', () => {
  it('1km 未満は m、100km 以上は整数', () => {
    expect(formatDistance(0.42)).toBe('420m');
    expect(formatDistance(3.25)).toBe('3.3km');
    expect(formatDistance(1234)).toBe('1,234km');
    expect(formatDistance(Number.NaN)).toBe('—');
  });
});

describe('面積の計算', () => {
  it('赤道付近の 100m 四方は約1万㎡', () => {
    const d = 100 / 111_320;
    const sq = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: d },
      { lat: d, lon: d },
      { lat: d, lon: 0 },
    ];
    const a = polygonAreaSqm(sq);
    expect(a).toBeGreaterThan(9_500);
    expect(a).toBeLessThan(10_500);
  });
});
