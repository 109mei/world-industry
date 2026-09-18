import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { PlayResult } from '@/game/engine/systems/gambling';
import { sfx } from '@/utils/sfx';
import { artUrl } from '@/utils/assets';

/**
 * 盤の大きさ（SVG の座標）。台の絵にぴったり重なるように決めてある。
 * 絵の中の遊技面は 横 6.8%〜93.4%、縦 9.9%〜74.3% の位置にある。
 */
const W = 100;
const H = 140;
/** 遊技面（絵の中のガラスの内側） */
const FIELD = { top: 16, bottom: 104 };
/** 真ん中の入賞口 */
const POCKET = { x0: 44, x1: 56, y: 100 };
const WALL0 = 7;
const WALL1 = 93;
/** デジタル表示の窓（絵の中の黒い四角） */
const DIGITS = { x0: 34.8, x1: 65.5, y0: 24.6, y1: 38.2 };

/** 釘の位置。デジタルの窓より下に置く */
const PINS: { x: number; y: number }[] = [];
for (let row = 0; row < 6; row++) {
  const y = 44 + row * 9;
  const offset = row % 2 === 0 ? 0 : 5;
  for (let x = 13 + offset; x <= 87; x += 10) PINS.push({ x, y });
}
// 入賞口の両脇（ここで弾かれると外れる）
PINS.push({ x: 38, y: 94 }, { x: 62, y: 94 });

/** 同じ種を入れれば同じ動きになる乱数 */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Step {
  x: number;
  y: number;
}

/** 1球ぶんの落ち方を計算する。入賞したかどうかも返す */
function simulate(startX: number, seed: number): { path: Step[]; scored: boolean } {
  const rnd = seeded(seed);
  let x = startX;
  let y = FIELD.top;
  let vx = (rnd() - 0.5) * 0.6;
  let vy = 0.6;
  const path: Step[] = [{ x, y }];
  for (let i = 0; i < 900; i++) {
    vy += 0.055;
    if (vy > 2.6) vy = 2.6;
    x += vx;
    y += vy;
    // 壁
    if (x < WALL0) {
      x = WALL0;
      vx = Math.abs(vx) * 0.7 + 0.2;
    }
    if (x > WALL1) {
      x = WALL1;
      vx = -Math.abs(vx) * 0.7 - 0.2;
    }
    // 釘に当たる
    for (const p of PINS) {
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy < 9) {
        const dir = dx === 0 ? (rnd() < 0.5 ? -1 : 1) : Math.sign(dx);
        vx = dir * (0.6 + rnd() * 1.1);
        vy = Math.max(0.35, vy * 0.45);
        y = p.y + 3.1;
        break;
      }
    }
    path.push({ x, y });
    if (y >= POCKET.y) {
      return { path, scored: x >= POCKET.x0 && x <= POCKET.x1 };
    }
  }
  return { path, scored: false };
}

/** 決まった結果（入賞するかどうか）に合う落ち方を探す */
function findPath(startX: number, scored: boolean): Step[] {
  for (let s = 1; s <= 600; s++) {
    const seed = (Date.now() + s * 7919) % 2147483647;
    const r = simulate(startX, seed);
    if (r.scored === scored) return r.path;
  }
  // 見つからなければ、入賞口の真上から落とす
  return simulate(scored ? 50 : 14, 12345).path;
}

/** 当たりの段階に合わせたデジタルの数字 */
function digitsFor(label: string): [number, number, number] {
  if (label === '大当たり') return [7, 7, 7];
  if (label === '確変') return [3, 3, 3];
  if (label === '小当たり') return [1, 1, 1];
  return [1, 2, 4];
}

interface Props {
  bet: number;
  canPlay: boolean;
  onPlay: () => PlayResult;
  onResult: (r: PlayResult) => void;
}

/**
 * パチンコ。
 * ハンドルの強さで玉の飛ぶ場所が変わり、釘に当たりながら落ちていく。
 * 真ん中の穴に入るとデジタルが回る。当たりは打った時点の抽選で決まっている（本物と同じ）。
 */
export function PachinkoBoard({ bet, canPlay, onPlay, onResult }: Props) {
  const [power, setPower] = useState(55);
  const [ball, setBall] = useState<Step | null>(null);
  const [digits, setDigits] = useState<[number, number, number]>([0, 0, 0]);
  const [spinning, setSpinning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'fall' | 'reels' | 'done'>('idle');
  const [result, setResult] = useState<PlayResult | null>(null);
  const [auto, setAuto] = useState(false);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const shoot = useCallback(() => {
    if (phase === 'fall' || phase === 'reels') return;
    const r = onPlay();
    if (!r.ok) {
      onResult(r);
      return;
    }
    const scored = r.payout > 0;
    // ハンドルが強いほど右から、弱いほど左から入る
    const startX = 12 + (power / 100) * 76;
    const path = findPath(startX, scored);
    setResult(null);
    setPhase('fall');
    setSpinning(false);
    sfx('tap');
    let i = 0;
    const step = () => {
      i += 3;
      if (i >= path.length) {
        setBall(path[path.length - 1]);
        if (!scored) {
          setPhase('done');
          setDigits(digitsFor(r.label));
          setResult(r);
          onResult(r);
          return;
        }
        // 入賞。デジタルが回る
        setPhase('reels');
        setSpinning(true);
        sfx('tap');
        timer.current = window.setTimeout(() => {
          setSpinning(false);
          setDigits(digitsFor(r.label));
          setPhase('done');
          setResult(r);
          onResult(r);
          if (r.payout > r.bet) sfx('sell');
        }, 1400);
        return;
      }
      setBall(path[i]);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [onPlay, onResult, phase, power, bet]);

  // 自動で打つ。shoot は毎回作りなおされるので ref 経由で呼ぶ
  // （依存に入れると、間隔が発火する前に張り直されて一度も打たれなくなる）
  const shootRef = useRef(shoot);
  shootRef.current = shoot;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if ((phaseRef.current === 'idle' || phaseRef.current === 'done') && canPlay) shootRef.current();
    }, 2200);
    return () => window.clearInterval(id);
  }, [auto, canPlay]);

  // デジタルが回っている間の見た目
  const [flick, setFlick] = useState(0);
  useEffect(() => {
    if (!spinning) return;
    const id = window.setInterval(() => setFlick((v) => v + 1), 70);
    return () => window.clearInterval(id);
  }, [spinning]);
  const shownDigits = spinning ? [(flick * 3) % 10, (flick * 7 + 1) % 10, (flick * 5 + 3) % 10] : digits;

  const busy = phase === 'fall' || phase === 'reels';

  return (
    <div className="pach">
      <div className="pach__board">
        {/* 台の絵。釘や役物はこの絵のもの */}
        <img className="pach__art" src={artUrl('pachinko_board')} alt="" draggable={false} />
        {/* 実際に当たり判定に使っているもの（玉・釘・入賞口）を、絵の上に重ねる */}
        <svg className="pach__layer" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="パチンコ台">
          {/* デジタル */}
          {shownDigits.map((d, i) => (
            <text
              key={i}
              x={DIGITS.x0 + ((i + 0.5) * (DIGITS.x1 - DIGITS.x0)) / 3}
              y={(DIGITS.y0 + DIGITS.y1) / 2 + 4}
              fontSize="11"
              textAnchor="middle"
              fill={spinning ? '#7d8796' : d === 7 ? '#ff5a4d' : '#63d6ff'}
              className="num"
            >
              {d}
            </text>
          ))}
          {/* 釘（この位置で玉が弾かれる） */}
          {PINS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="0.9" fill="#fff" opacity="0.5" />
          ))}
          {/* 入賞口 */}
          <rect x={POCKET.x0} y={POCKET.y - 3} width={POCKET.x1 - POCKET.x0} height="6" rx="2" fill="var(--profit)" opacity={phase === 'reels' ? 0.95 : 0.6} />
          {/* 玉 */}
          {ball && <circle cx={ball.x} cy={ball.y} r="2.2" fill="#ffe9a8" stroke="#8a6a20" strokeWidth="0.4" />}
        </svg>
      </div>

      <div className="pach__handle">
        <label className="pach__handlelabel" htmlFor="pach-power">
          ハンドルの強さ <span className="num">{power}</span>
        </label>
        <input
          id="pach-power"
          type="range"
          min={0}
          max={100}
          value={power}
          onChange={(e) => setPower(Number(e.target.value))}
          disabled={busy}
          className="pach__range"
        />
        <div className="text-dim" style={{ fontSize: 11 }}>
          強いほど右から、弱いほど左から入ります。当たりは打った時点の抽選で決まっています（本物の台と同じ）。
        </div>
      </div>

      <div className="slot__result">
        {phase === 'fall' ? (
          <span className="text-sub">玉が落ちています…</span>
        ) : phase === 'reels' ? (
          <span className="text-warn">入賞！ デジタルが回っています…</span>
        ) : result ? (
          <span className={result.payout > result.bet ? 'text-profit' : 'text-sub'}>
            {result.label}
            {result.payout > 0 && ` ×${result.payout / result.bet}`}
          </span>
        ) : (
          <span className="text-dim">ハンドルの強さを決めて打ちます</span>
        )}
      </div>

      <div className="btn-row">
        <Button block variant={canPlay && !busy ? 'primary' : 'secondary'} disabled={!canPlay || busy} onClick={shoot}>
          {bet.toLocaleString('ja-JP')}円で打つ
        </Button>
        <Button variant={auto ? 'danger' : 'secondary'} onClick={() => setAuto((v) => !v)}>
          {auto ? '自動を止める' : '自動で打つ'}
        </Button>
      </div>
    </div>
  );
}
