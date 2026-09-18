/**
 * 地図のどこでも買える「区画」。
 *
 * これまで地図で買えたのは、OpenStreetMap にタグの付いた建物と敷地だけだった。
 * だから田畑でも空き地でも山林でも、タグが無ければ指をどこに置いても何も出ない。
 * 「買える場所がなさすぎる」のは、そのせい。
 *
 * ここでは地球すべてを格子に切って、どのマスも更地として売り出す。
 * 値段はその場所の実勢地価（data/landValue.ts）から出すので、
 * 銀座のマスは何百億にもなるし、山あいのマスは数十万で買える。
 *
 * ## 大きさは3つ
 *
 * 街なかで鉱山ぶんの広さは要らないし、山林を2,500㎡ずつ買うのは手間でしかない。
 * そこで 小 → 中 → 大 を 4倍ずつの入れ子にしてある。
 * 入れ子になっているので「大を買ったのに、その中の小がまだ売られている」
 * といったことが起きず、重なりの判定も四角の重なりだけで済む。
 */
import { polygonAreaSqm, type LatLon } from '@/utils/geo';

export type PlotSizeId = 'small' | 'medium' | 'large';

export interface PlotSizeDef {
  id: PlotSizeId;
  name: string;
  /** 格子1マスの大きさ（度）。緯度方向の一辺 */
  deg: number;
  /** 一覧に出す短い説明 */
  hint: string;
  /** このズーム以上で選べる（小さいマスは寄らないと押せない） */
  minZoom: number;
}

/**
 * 緯度35度あたりでの目安:
 *   小 0.0005° … 55.6m × 45.5m ≒ 2,500㎡（約765坪）
 *   中 0.002°  … 222m × 182m  ≒ 4.0ha
 *   大 0.008°  … 890m × 728m  ≒ 64.8ha
 * 高緯度ほど東西が縮むので、実際の面積は多角形から出す。
 */
export const PLOT_SIZES = [
  { id: 'small', name: '小さな区画', deg: 0.0005, hint: 'およそ2,500㎡。街なかでも手が届く広さ。', minZoom: 15 },
  { id: 'medium', name: 'まとまった土地', deg: 0.002, hint: 'およそ4ha。工場や農園を並べられる。', minZoom: 13 },
  { id: 'large', name: '広い土地', deg: 0.008, hint: 'およそ65ha。鉱山や大農園に。', minZoom: 11 },
] as const satisfies readonly PlotSizeDef[];

export const PLOT_SIZE_MAP: Record<PlotSizeId, PlotSizeDef> = Object.fromEntries(
  PLOT_SIZES.map((s) => [s.id, s]),
) as Record<PlotSizeId, PlotSizeDef>;

export const PLOT_SIZE_IDS = PLOT_SIZES.map((s) => s.id) as PlotSizeId[];

export function isPlotSizeId(id: string): id is PlotSizeId {
  return id in PLOT_SIZE_MAP;
}

/** ID の先頭。OSM は n/w/r で始まるので、ぶつからない文字を使う */
const PREFIX = 'p';
const SIZE_CODE: Record<PlotSizeId, string> = { small: 's', medium: 'm', large: 'l' };
const CODE_SIZE: Record<string, PlotSizeId> = { s: 'small', m: 'medium', l: 'large' };

export interface PlotCell {
  size: PlotSizeId;
  row: number;
  col: number;
}

/** その地点が入るマス */
export function cellAt(at: LatLon, size: PlotSizeId): PlotCell {
  const { deg } = PLOT_SIZE_MAP[size];
  return { size, row: Math.floor(at.lat / deg), col: Math.floor(at.lon / deg) };
}

/** マスの ID（セーブに残るので、書式を変えると持ち物が迷子になる） */
export function plotId(cell: PlotCell): string {
  return `${PREFIX}${SIZE_CODE[cell.size]}:${cell.row}:${cell.col}`;
}

/** ID からマスに戻す。区画でなければ null */
export function parsePlotId(id: string): PlotCell | null {
  if (typeof id !== 'string' || id[0] !== PREFIX) return null;
  const size = CODE_SIZE[id[1]];
  if (!size) return null;
  const parts = id.slice(3).split(':');
  if (parts.length !== 2) return null;
  const row = Number(parts[0]);
  const col = Number(parts[1]);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return { size, row, col };
}

export function isPlotId(id: string): boolean {
  return parsePlotId(id) !== null;
}

export interface PlotBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function cellBounds(cell: PlotCell): PlotBounds {
  const { deg } = PLOT_SIZE_MAP[cell.size];
  return { south: cell.row * deg, west: cell.col * deg, north: (cell.row + 1) * deg, east: (cell.col + 1) * deg };
}

/** マスの四隅（閉じた多角形）。地図に描くのと面積を出すのに使う */
export function cellPolygon(cell: PlotCell): LatLon[] {
  const b = cellBounds(cell);
  return [
    { lat: b.south, lon: b.west },
    { lat: b.north, lon: b.west },
    { lat: b.north, lon: b.east },
    { lat: b.south, lon: b.east },
    { lat: b.south, lon: b.west },
  ];
}

export function cellCenter(cell: PlotCell): LatLon {
  const b = cellBounds(cell);
  return { lat: (b.south + b.north) / 2, lon: (b.west + b.east) / 2 };
}

/** マスの実際の面積（㎡）。高緯度ほど東西が縮むので多角形から出す */
export function cellAreaSqm(cell: PlotCell): number {
  return Math.max(1, Math.round(polygonAreaSqm(cellPolygon(cell))));
}

/**
 * 2つのマスが重なるか。
 * 大きさが違っても入れ子になっているので、四角の重なりを見れば足りる。
 * 辺を共有しているだけ（隣どうし）は重なりにしない。
 */
export function cellsOverlap(a: PlotCell, b: PlotCell): boolean {
  const x = cellBounds(a);
  const y = cellBounds(b);
  const EPS = 1e-9;
  return x.west < y.east - EPS && y.west < x.east - EPS && x.south < y.north - EPS && y.south < x.north - EPS;
}

/** 表示用の名前。同じマスならいつも同じ名前になる */
export function plotName(cell: PlotCell, near: string): string {
  const c = cellCenter(cell);
  const ns = c.lat >= 0 ? 'N' : 'S';
  const ew = c.lon >= 0 ? 'E' : 'W';
  const tag = `${ns}${Math.abs(c.lat).toFixed(3)}/${ew}${Math.abs(c.lon).toFixed(3)}`;
  return `${near} ${tag}`;
}
