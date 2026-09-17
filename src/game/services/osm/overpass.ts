/**
 * OpenStreetMap（Overpass API）から、地図に写っている実在の建物・区画を取ってくる。
 *
 * - データは ODbL。表示には出典を明記する
 * - 建物の名前はそのまま使わず、もじった架空名にする（fakeName）
 * - 取得できなくてもゲームは動く（買った物件はセーブに入っているため）
 */
import { classifyOsm, levelsFromTags, type OsmTags } from '@/game/data/osmKinds';
import type { PropertyKind } from '@/game/data/properties';
import { displayName } from '@/utils/fakeName';
import { polygonAreaSqm, polygonCenter, type LatLon } from '@/utils/geo';

export interface OsmFeature {
  /** 'w123456' のような ID（OSM の種類 + 番号） */
  id: string;
  kind: PropertyKind;
  /** 用途のラベル（コンビニ・住宅・工場など） */
  label: string;
  /** 表示名（もじった架空名。名前がなければラベル） */
  name: string;
  /** 元の名前があったか（架空名の注意書きを出すかの判断に使う） */
  named: boolean;
  lat: number;
  lon: number;
  /** 敷地・建物の面積（㎡） */
  areaSqm: number;
  levels: number;
  polygon: LatLon[];
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface FetchResult {
  features: OsmFeature[];
  error?: string;
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

/** 1回のリクエストで取る最大数 */
const MAX_ELEMENTS = 400;
/** 続けてリクエストしない間隔（ミリ秒）。Overpass は公共サーバーなので控えめに */
const MIN_INTERVAL_MS = 2500;
/** 取得範囲を丸める大きさ（度）。約400m。少し動かしただけでは取り直さない */
const GRID = 0.004;
/** 覚えておくタイルの数 */
const CACHE_LIMIT = 40;

function bboxKey(b: BBox): string {
  return [b.south, b.west, b.north, b.east].map((v) => v.toFixed(4)).join(',');
}

/** 表示範囲をグリッドに合わせて広げる（同じ辺りを何度も取りに行かないため） */
export function snapBBox(b: BBox): BBox {
  return {
    south: Math.floor(b.south / GRID) * GRID,
    west: Math.floor(b.west / GRID) * GRID,
    north: Math.ceil(b.north / GRID) * GRID,
    east: Math.ceil(b.east / GRID) * GRID,
  };
}

export function buildQuery(b: BBox): string {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  return `[out:json][timeout:25];(way["building"](${bbox});way["landuse"~"^(farmland|farmyard|orchard|meadow|vineyard|industrial|commercial|retail|brownfield|greenfield|quarry|allotments)$"](${bbox}););out geom ${MAX_ELEMENTS};`;
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: OsmTags;
  geometry?: { lat: number; lon: number }[];
}

/** Overpass の応答をゲームで使う形に変える */
export function parseElements(elements: OverpassElement[]): OsmFeature[] {
  const out: OsmFeature[] = [];
  for (const el of elements) {
    const geom = el.geometry;
    if (!geom || geom.length < 3) continue;
    const tags = el.tags ?? {};
    const polygon = geom.map((g) => ({ lat: g.lat, lon: g.lon }));
    const areaSqm = Math.round(polygonAreaSqm(polygon));
    if (areaSqm < 8) continue; // 小屋より小さいものは出さない
    const info = classifyOsm(tags);
    // 住宅は個人の名前が入っていることがあるので、名前を使わない
    const useName = info.kind !== 'house' && info.kind !== 'farm';
    const real = tags['name:ja'] ?? tags.name;
    const center = polygonCenter(polygon);
    out.push({
      id: `${el.type[0]}${el.id}`,
      kind: info.kind,
      label: info.label,
      name: displayName(real, info.fallbackName, useName),
      named: useName && !!real,
      lat: center.lat,
      lon: center.lon,
      areaSqm,
      levels: levelsFromTags(tags, info.kind),
      polygon,
    });
  }
  return out;
}

export class OverpassService {
  private cache = new Map<string, OsmFeature[]>();
  private inflight: Promise<FetchResult> | null = null;
  private lastAt = 0;
  private endpoint = 0;

  constructor(
    private fetchImpl: typeof fetch = typeof fetch === 'function' ? fetch.bind(globalThis) : (() => Promise.reject(new Error('fetch がありません'))) as unknown as typeof fetch,
    private now: () => number = () => Date.now(),
  ) {}

  /** すでに取ってあるか */
  cached(b: BBox): OsmFeature[] | null {
    return this.cache.get(bboxKey(snapBBox(b))) ?? null;
  }

  /** 次のリクエストまで待つ必要があるか */
  get busy(): boolean {
    return this.inflight !== null;
  }

  /** 範囲の建物を取る。取得済みならキャッシュを返す */
  async load(raw: BBox): Promise<FetchResult> {
    const b = snapBBox(raw);
    const key = bboxKey(b);
    const hit = this.cache.get(key);
    if (hit) return { features: hit };
    if (this.inflight) return this.inflight;
    const wait = Math.max(0, MIN_INTERVAL_MS - (this.now() - this.lastAt));
    this.inflight = (async () => {
      try {
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        const url = ENDPOINTS[this.endpoint % ENDPOINTS.length];
        const res = await this.fetchImpl(url, {
          method: 'POST',
          body: new URLSearchParams({ data: buildQuery(b) }),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        if (!res.ok) {
          this.endpoint += 1; // 次は別のサーバーを試す
          throw new Error(`地図データの取得に失敗しました (${res.status})`);
        }
        const json = (await res.json()) as { elements?: OverpassElement[] };
        const features = parseElements(json.elements ?? []);
        this.cache.set(key, features);
        if (this.cache.size > CACHE_LIMIT) {
          const oldest = this.cache.keys().next().value;
          if (oldest) this.cache.delete(oldest);
        }
        return { features };
      } catch (e) {
        return { features: [], error: e instanceof Error ? e.message : '地図データを取得できませんでした' };
      } finally {
        this.lastAt = this.now();
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const overpass = new OverpassService();
