import { useEffect, useMemo, useRef, useState } from 'react';
import { HQ_LOCATION, LANDS, type LandDef } from '@/game/data/lands';
import { getLand } from '@/game/engine/land';
import { isUnlocked } from '@/game/engine/systems/unlocks';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { LAND_SHAPES, MAP_HEIGHT, MAP_WIDTH, SEA_SHAPES, project, toPath } from './worldMapData';

type MarkerState = 'owned' | 'stopped' | 'buyable' | 'unlocked' | 'locked';

const LEGEND: { state: MarkerState; label: string }[] = [
  { state: 'owned', label: '所有' },
  { state: 'stopped', label: '停止中の施設あり' },
  { state: 'buyable', label: '購入できる' },
  { state: 'unlocked', label: '資金不足' },
  { state: 'locked', label: '未解放' },
];

/** マーカー同士の最小距離（px）。近すぎる土地（日本の3か所など）は少しずらして重ならないようにする */
const MIN_DIST = 30;

type LabelSide = 'above' | 'below' | 'right' | 'left';

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function intersects(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

/** ラベルの位置（上・下・右・左）を、他のマーカーやラベルと重ならないように決める */
function placeLabels(items: Placed[]): Record<string, LabelSide> {
  const sides: Record<string, LabelSide> = {};
  const taken: Box[] = items.map((p) => ({ x1: p.dx - 9, y1: p.dy - 9, x2: p.dx + 9, y2: p.dy + 9 }));
  const sorted = [...items].sort((a, b) => a.dy - b.dy);
  for (const p of sorted) {
    const w = p.def.name.length * 10 + 6;
    const h = 14;
    const candidates: [LabelSide, Box][] = [
      ['above', { x1: p.dx - w / 2, y1: p.dy - 12 - h, x2: p.dx + w / 2, y2: p.dy - 12 }],
      ['below', { x1: p.dx - w / 2, y1: p.dy + 12, x2: p.dx + w / 2, y2: p.dy + 12 + h }],
      ['right', { x1: p.dx + 11, y1: p.dy - h / 2, x2: p.dx + 11 + w, y2: p.dy + h / 2 }],
      ['left', { x1: p.dx - 11 - w, y1: p.dy - h / 2, x2: p.dx - 11, y2: p.dy + h / 2 }],
    ];
    let chosen = candidates[0];
    for (const c of candidates) {
      if (!taken.some((t) => intersects(t, c[1]))) {
        chosen = c;
        break;
      }
    }
    sides[p.def.id] = chosen[0];
    taken.push(chosen[1]);
  }
  return sides;
}

interface Placed {
  def: LandDef;
  /** 実際の位置（px） */
  x: number;
  y: number;
  /** 表示位置（px、重なりを避けてずらした後） */
  dx: number;
  dy: number;
}

/** 近いマーカーを押し広げる（単純な反発計算） */
function spread(items: Placed[], width: number, height: number): Placed[] {
  const out = items.map((p) => ({ ...p }));
  for (let iter = 0; iter < 40; iter++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        let vx = b.dx - a.dx;
        let vy = b.dy - a.dy;
        let d = Math.hypot(vx, vy);
        if (d >= MIN_DIST) continue;
        if (d < 0.01) {
          vx = 1;
          vy = 0.5;
          d = Math.hypot(vx, vy);
        }
        const push = (MIN_DIST - d) / 2;
        const ux = vx / d;
        const uy = vy / d;
        a.dx -= ux * push;
        a.dy -= uy * push;
        b.dx += ux * push;
        b.dy += uy * push;
        moved = true;
      }
    }
    for (const p of out) {
      p.dx = Math.min(width - 16, Math.max(16, p.dx));
      p.dy = Math.min(height - 16, Math.max(16, p.dy));
    }
    if (!moved) break;
  }
  return out;
}

/**
 * 世界地図。陸地は SVG、土地のマーカーは画面サイズに関係なく同じ大きさになるよう HTML で重ねる。
 * 所有・購入可能・未解放を色で示し、タップで詳細を開く。
 */
export function WorldMap() {
  const { state, derived } = useGame();
  const openLand = useUiStore((s) => s.openLand);
  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 360);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = (width * MAP_HEIGHT) / MAP_WIDTH;
  const scale = width / MAP_WIDTH;

  const { placed, labelSides } = useMemo(() => {
    const items: Placed[] = (LANDS as readonly LandDef[]).map((def) => {
      const p = project(def.lon, def.lat);
      return { def, x: p.x * scale, y: p.y * scale, dx: p.x * scale, dy: p.y * scale };
    });
    const spreadItems = spread(items, width, height);
    return { placed: spreadItems, labelSides: placeLabels(spreadItems) };
  }, [scale, width, height]);

  const markerState = (def: LandDef): MarkerState => {
    const land = getLand(state, def.id);
    if (land) {
      const stopped = state.facilities.some((f) => f.landId === land.id && ['no_input', 'storage_full', 'no_power', 'depleted'].includes(derived.facilityRuntime[f.id]?.status ?? ''));
      const noRoute = derived.lands[land.id]?.noRoute;
      return stopped || noRoute ? 'stopped' : 'owned';
    }
    if (!isUnlocked(state, 'land', def.id)) return 'locked';
    return state.company.cash >= def.price ? 'buyable' : 'unlocked';
  };

  const hq = project(HQ_LOCATION.lon, HQ_LOCATION.lat);
  return (
    <div className="map">
      <div className="map__stage" ref={stageRef}>
        <svg className="map__svg" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="世界地図" preserveAspectRatio="none">
          <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} className="map__sea" />
          {LAND_SHAPES.map((pts, i) => (
            <path key={`l${i}`} d={toPath(pts)} className="map__land" />
          ))}
          {SEA_SHAPES.map((pts, i) => (
            <path key={`s${i}`} d={toPath(pts)} className="map__sea-fill" />
          ))}
          {/* 本社と所有地を結ぶ航路 */}
          {placed
            .filter((p) => getLand(state, p.def.id))
            .map((p) => (
              <line key={`r${p.def.id}`} x1={hq.x} y1={hq.y} x2={p.dx / scale} y2={p.dy / scale} className="map__route" vectorEffect="non-scaling-stroke" />
            ))}
          {/* ずらしたマーカーと実際の位置を結ぶ線 */}
          {placed
            .filter((p) => Math.hypot(p.dx - p.x, p.dy - p.y) > 2)
            .map((p) => (
              <line key={`g${p.def.id}`} x1={p.x / scale} y1={p.y / scale} x2={p.dx / scale} y2={p.dy / scale} className="map__leader" vectorEffect="non-scaling-stroke" />
            ))}
        </svg>
        <div className="map__hq" style={{ left: `${(hq.x / MAP_WIDTH) * 100}%`, top: `${(hq.y / MAP_HEIGHT) * 100}%` }} aria-label="本社" title="本社">
          <span className="map__hq-box" />
        </div>
        {placed.map((p) => {
          const ms = markerState(p.def);
          const stateLabel = LEGEND.find((l) => l.state === ms)?.label ?? '';
          return (
            <button
              key={p.def.id}
              type="button"
              className={`map__marker map__marker--${ms}`}
              style={{ left: `${(p.dx / width) * 100}%`, top: `${(p.dy / height) * 100}%` }}
              aria-label={`${p.def.name}（${stateLabel}）`}
              title={`${p.def.name}（${stateLabel}）`}
              onClick={() => openLand(p.def.id)}
            >
              {(ms === 'stopped' || ms === 'buyable') && <span className="map__pulse" aria-hidden="true" />}
              <span className="map__dot" aria-hidden="true" />
              <span className={`map__label map__label--${labelSides[p.def.id] ?? 'above'}`} aria-hidden="true">
                {p.def.name}
              </span>
            </button>
          );
        })}
      </div>
      <div className="map__legend">
        <span className="map__legend-item">
          <span className="map__legend-dot map__legend-dot--hq" />
          本社
        </span>
        {LEGEND.map((l) => (
          <span key={l.state} className="map__legend-item">
            <span className={`map__legend-dot map__legend-dot--${l.state}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
