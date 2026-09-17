/** 緯度経度の計算。地球は半径 6,371km の球として扱う（ゲームには十分な精度）。 */

export interface LatLon {
  lat: number;
  lon: number;
}

const R_KM = 6371;
const R_M = R_KM * 1000;

/** 2点間の距離（km） */
export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 多角形の面積（㎡）。建物のような小さな図形が対象なので、
 * 緯度に応じて経度を縮めた平面（正距円筒図法）に置き換えて計算する。
 */
export function polygonAreaSqm(points: readonly LatLon[]): number {
  if (points.length < 3) return 0;
  const pts = points[0].lat === points[points.length - 1].lat && points[0].lon === points[points.length - 1].lon ? points.slice(0, -1) : points;
  if (pts.length < 3) return 0;
  const lat0 = (pts.reduce((a, p) => a + p.lat, 0) / pts.length) * (Math.PI / 180);
  const kx = (Math.PI / 180) * R_M * Math.cos(lat0);
  const ky = (Math.PI / 180) * R_M;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    sum += p.lon * kx * (q.lat * ky) - q.lon * kx * (p.lat * ky);
  }
  return Math.abs(sum) / 2;
}

/** 多角形の中心（単純な重心） */
export function polygonCenter(points: readonly LatLon[]): LatLon {
  if (points.length === 0) return { lat: 0, lon: 0 };
  let lat = 0;
  let lon = 0;
  for (const p of points) {
    lat += p.lat;
    lon += p.lon;
  }
  return { lat: lat / points.length, lon: lon / points.length };
}
