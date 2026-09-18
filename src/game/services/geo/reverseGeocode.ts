/**
 * 座標から住所を引く（OpenStreetMap の Nominatim）。
 *
 * 本社を決めるときに1回だけ呼ぶ。都市名だけでなく、県・市区町村・町名まで出す。
 * つながらないときや形式が違うときは null を返して、呼び出し側で近くの都市名に切り替える。
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';

interface NominatimAddress {
  country?: string;
  state?: string;
  province?: string;
  county?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  city_district?: string;
  neighbourhood?: string;
  quarter?: string;
  road?: string;
  hamlet?: string;
}

export interface PlaceName {
  /** 画面に出す短い住所（例: 福岡県飯塚市幸袋） */
  label: string;
  /** 国名（日本 など） */
  country: string;
  /** 詳しい住所（取れたところまで） */
  full: string;
}

/** 日本の住所は 県 → 市区町村 → 町名 の順に並べる。海外は細かいほうから並べる */
function compose(a: NominatimAddress, display: string): PlaceName {
  const country = a.country ?? '';
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? '';
  const area = a.suburb ?? a.city_district ?? a.neighbourhood ?? a.quarter ?? a.hamlet ?? '';
  if (country === '日本' || country === 'Japan') {
    const pref = a.state ?? a.province ?? '';
    const label = [pref, city, area].filter(Boolean).join('');
    return { label: label || display.split(',')[0] || '', country: '日本', full: display };
  }
  const label = [area, city, a.state, country].filter(Boolean).join('・');
  return { label: label || display.split(',').slice(0, 2).join('・'), country, full: display };
}

/** 座標から住所を引く。失敗したら null */
export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<PlaceName | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const url = `${ENDPOINT}?format=jsonv2&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&zoom=16&addressdetails=1&accept-language=ja`;
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as { address?: NominatimAddress; display_name?: string };
    if (!json?.address) return null;
    const place = compose(json.address, json.display_name ?? '');
    return place.label ? place : null;
  } catch {
    return null;
  }
}
