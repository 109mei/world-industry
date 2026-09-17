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
