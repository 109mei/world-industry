import { describe, expect, it, vi } from 'vitest';
import { OverpassService, buildQuery, parseElements } from '../overpass';

/** だいたい 20m × 20m の四角い建物 */
function square(lat: number, lon: number, tags: Record<string, string>, id = 1) {
  const d = 0.00009; // 約10m
  return {
    type: 'way',
    id,
    tags,
    geometry: [
      { lat: lat - d, lon: lon - d },
      { lat: lat - d, lon: lon + d },
      { lat: lat + d, lon: lon + d },
      { lat: lat + d, lon: lon - d },
      { lat: lat - d, lon: lon - d },
    ],
  };
}

describe('overpass', () => {
  it('クエリに範囲が入る', () => {
    const q = buildQuery({ south: 33.6, west: 130.6, north: 33.7, east: 130.8 });
    expect(q).toContain('33.6,130.6,33.7,130.8');
    expect(q).toContain('building');
  });

  it('建物を面積つきで読み取る', () => {
    const fs = parseElements([square(33.6459, 130.6915, { building: 'yes', shop: 'convenience', name: 'セブンイレブン飯塚店' })]);
    expect(fs).toHaveLength(1);
    expect(fs[0].kind).toBe('retail');
    expect(fs[0].label).toBe('コンビニ');
    expect(fs[0].areaSqm).toBeGreaterThan(300);
    expect(fs[0].areaSqm).toBeLessThan(500);
    expect(fs[0].name).not.toContain('セブンイレブン飯塚店');
    expect(fs[0].named).toBe(true);
  });

  it('住宅は名前を使わない', () => {
    const fs = parseElements([square(33.6, 130.6, { building: 'house', name: '山田邸' })]);
    expect(fs[0].kind).toBe('house');
    expect(fs[0].name).toBe('住宅');
    expect(fs[0].named).toBe(false);
  });

  it('小さすぎるものと形のないものは捨てる', () => {
    const tiny = { type: 'way', id: 2, tags: { building: 'shed' }, geometry: [
      { lat: 33.6, lon: 130.6 },
      { lat: 33.6, lon: 130.60001 },
      { lat: 33.60001, lon: 130.60001 },
      { lat: 33.6, lon: 130.6 },
    ] };
    expect(parseElements([tiny])).toHaveLength(0);
    expect(parseElements([{ type: 'way', id: 3, tags: { building: 'yes' } }])).toHaveLength(0);
  });

  it('2回目はキャッシュから返す（通信しない）', async () => {
    const body = { elements: [square(33.6459, 130.6915, { building: 'retail', name: 'ゆめタウン' })] };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body }) as unknown as Response);
    const svc = new OverpassService(fetchMock as unknown as typeof fetch, () => 10_000_000);
    const box = { south: 33.64, west: 130.68, north: 33.65, east: 130.7 };
    const a = await svc.load(box);
    const b = await svc.load(box);
    expect(a.features).toHaveLength(1);
    expect(b.features).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(svc.cached(box)).not.toBeNull();
  });

  it('失敗してもゲームは止まらない（空の結果とメッセージ）', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline');
    });
    const svc = new OverpassService(fetchMock as unknown as typeof fetch, () => 10_000_000);
    const r = await svc.load({ south: 1, west: 2, north: 3, east: 4 });
    expect(r.features).toEqual([]);
    expect(r.error).toBeTruthy();
  });
});

describe('取りに行く回数を抑える', () => {
  it('少し動かしただけなら同じ範囲として扱う', async () => {
    const body = { elements: [] as unknown[] };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body }) as unknown as Response);
    const svc = new OverpassService(fetchMock as unknown as typeof fetch, () => 10_000_000);
    await svc.load({ south: 33.6401, west: 130.6901, north: 33.6421, east: 130.6931 });
    await svc.load({ south: 33.6403, west: 130.6903, north: 33.6423, east: 130.6933 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('建物以外の区画も買える', () => {
  function ring(lat: number, lon: number, tags: Record<string, string>, id = 1, size = 0.0004) {
    return {
      type: 'way',
      id,
      tags,
      geometry: [
        { lat: lat - size, lon: lon - size },
        { lat: lat - size, lon: lon + size },
        { lat: lat + size, lon: lon + size },
        { lat: lat + size, lon: lon - size },
        { lat: lat - size, lon: lon - size },
      ],
    };
  }

  it('駐車場・役場・公園・ゴルフ場を種類つきで読み取る', () => {
    const fs = parseElements([
      ring(33.6, 130.6, { amenity: 'parking' }, 1),
      ring(33.6, 130.6, { amenity: 'townhall', name: '飯塚市役所' }, 2),
      ring(33.6, 130.6, { leisure: 'park', name: '中央公園' }, 3),
      ring(33.6, 130.6, { leisure: 'golf_course', name: '嘉穂カントリークラブ' }, 4),
      ring(33.6, 130.6, { man_made: 'water_works' }, 5),
    ]);
    expect(fs.map((f) => f.label)).toEqual(['駐車場', '役所', '公園', 'ゴルフ場', '浄水場']);
    expect(fs[1].name).not.toContain('飯塚市役所');
    expect(fs[3].kind).toBe('resort');
  });

  it('線（道路など）は面として扱わない', () => {
    const line = {
      type: 'way',
      id: 9,
      tags: { highway: 'residential' },
      geometry: [
        { lat: 33.6, lon: 130.6 },
        { lat: 33.601, lon: 130.601 },
        { lat: 33.602, lon: 130.603 },
        { lat: 33.603, lon: 130.606 },
      ],
    };
    expect(parseElements([line])).toHaveLength(0);
  });

  it('クエリに駐車場や公園が含まれる', () => {
    const q = buildQuery({ south: 1, west: 2, north: 3, east: 4 });
    expect(q).toContain('amenity');
    expect(q).toContain('leisure');
    expect(q).toContain('3000');
  });
});
