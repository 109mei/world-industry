import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SLOT_BY_LABEL, SLOT_FALLBACK_ICON, SLOT_SYMBOLS, type SlotSymbolId } from '@/game/data/gambling';
import type { PlayResult } from '@/game/engine/systems/gambling';
import { sfx } from '@/utils/sfx';
import { artUrl } from '@/utils/assets';

const SYMS = SLOT_SYMBOLS;
const N = SYMS.length;
/**
 * 台の絵の中で、3つのリールの窓がある位置（横の割合）。
 * 絵から測った値で、ここがずれるとリールが枠からはみ出す。
 */
const REEL_X: [number, number][] = [
  [0.176, 0.375],
  [0.394, 0.599],
  [0.619, 0.819],
];
/** 回っている速さ（コマ/秒） */
const SPEED = 15;

/** 結果から、3つのリールに止める絵柄を決める */
function targetsFor(label: string): SlotSymbolId[] {
  const hit = SLOT_BY_LABEL[label];
  if (label === '7が2つ') {
    // 7が2つ。3つ目は7以外なら何でもよい
    const rest = SYMS.filter((x) => x.id !== 'seven');
    return ['seven', 'seven', rest[Math.floor(Math.random() * rest.length)].id];
  }
  // はずれの回は、どの絵柄も揃わない並びにする
  if (!hit) return losingLine();
  return [hit, hit, hit];
}

/**
 * はずれの並びを毎回ちがう組み合わせで作る。
 * 決まりごとは2つだけ:
 *  - 3つが揃わない（揃うと当たりに見えてしまう）
 *  - 左2つも揃えない（2つ揃った時点で当たり確定と分かってしまうため）
 * これで、3つ目を止めるまで結果が読めなくなる。
 */
function losingLine(): SlotSymbolId[] {
  const pick = () => SYMS[Math.floor(Math.random() * SYMS.length)].id;
  const a = pick();
  let b = pick();
  let guard = 0;
  while (b === a && guard++ < 20) b = pick();
  let c = pick();
  guard = 0;
  // a と b は違うので、c は「a と同じ」でも「b と同じ」でもよい（3つ揃いにはならない）
  while (c === a && c === b && guard++ < 20) c = pick();
  return [a, b, c];
}

interface Props {
  /** 1回ぶんの賭け金 */
  bet: number;
  canPlay: boolean;
  /** 実際に賭ける。結果が返る */
  onPlay: () => PlayResult;
  onResult: (r: PlayResult) => void;
}

/**
 * スロット。
 * 回すと当たりはその場で決まり、リールは決まった絵柄のところへ少し滑って止まる
 * （本物のパチスロと同じ仕組み）。止めるのは自分。
 */
export function SlotMachine({ bet, canPlay, onPlay, onResult }: Props) {
  // リールの位置（コマ単位の小数）
  const [pos, setPos] = useState<number[]>([0, 1, 2]);
  const [spinning, setSpinning] = useState<boolean[]>([false, false, false]);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [auto, setAuto] = useState(false);
  const targets = useRef<SlotSymbolId[]>(['grape', 'bell', 'bar']);
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const stopAt = useRef<(number | null)[]>([null, null, null]);
  const posRef = useRef<number[]>([0, 1, 2]);
  const spinRef = useRef<boolean[]>([false, false, false]);

  const loop = useCallback((t: number) => {
    const dt = last.current ? Math.min(0.05, (t - last.current) / 1000) : 0;
    last.current = t;
    let moving = false;
    const next = [...posRef.current];
    const nextSpin = [...spinRef.current];
    for (let i = 0; i < 3; i++) {
      if (!spinRef.current[i]) continue;
      moving = true;
      const goal = stopAt.current[i];
      if (goal === null) {
        next[i] += SPEED * dt;
      } else {
        const left = goal - next[i];
        if (left <= 0.02) {
          next[i] = goal;
          nextSpin[i] = false;
        } else {
          // 近づくほどゆっくり（滑って止まる感じ）
          next[i] += Math.max(2.5, Math.min(SPEED, left * 7)) * dt;
        }
      }
    }
    posRef.current = next;
    spinRef.current = nextSpin;
    setPos(next);
    setSpinning(nextSpin);
    if (moving) raf.current = requestAnimationFrame(loop);
    else {
      raf.current = null;
      last.current = 0;
    }
  }, []);

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
  }, []);

  const start = () => {
    if (spinRef.current.some(Boolean)) return;
    const r = onPlay();
    if (!r.ok) {
      onResult(r);
      return;
    }
    setResult(null);
    targets.current = targetsFor(r.label);
    pending.current = r;
    stopAt.current = [null, null, null];
    spinRef.current = [true, true, true];
    setSpinning([true, true, true]);
    sfx('tap');
    if (raf.current === null) raf.current = requestAnimationFrame(loop);
  };

  const pending = useRef<PlayResult | null>(null);

  const stopReel = useCallback(
    (i: number) => {
      if (!spinRef.current[i] || stopAt.current[i] !== null) return;
      const wantIndex = SYMS.findIndex((s) => s.id === targets.current[i]);
      const cur = posRef.current[i];
      // いまの位置より先で、狙いの絵柄が「真ん中の段」に来る位置。
      // 真ん中に出ているのは floor(pos)+1 番目の絵柄なので、そこを合わせる。
      let goal = Math.ceil(cur) + 1;
      while ((((goal + 1) % N) + N) % N !== wantIndex) goal += 1;
      stopAt.current[i] = goal;
      sfx('tap');
    },
    [],
  );

  // 3つ止まりきったら結果を出す
  useEffect(() => {
    if (spinning.some(Boolean) || !pending.current) return;
    const r = pending.current;
    pending.current = null;
    setResult(r);
    onResult(r);
    if (r.payout > r.bet) sfx('sell');
  }, [spinning, onResult]);

  // 自動で回す
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (spinRef.current.some(Boolean)) {
        // 回っているものから順に止める
        const i = spinRef.current.findIndex((v, k) => v && stopAt.current[k] === null);
        if (i >= 0) stopReel(i);
        return;
      }
      if (canPlay) start();
    }, 420);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, canPlay]);

  const anySpinning = spinning.some(Boolean);

  return (
    <div className="slot">
      <div className="slot__cabinet">
        {/* 台の絵 */}
        <img className="slot__art" src={artUrl('slot_machine')} alt="" draggable={false} />
        {/* 実際に回っているリールを、絵の窓の位置にぴったり重ねる */}
        <div className="slot__window">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              className={`slot__reel${spinning[i] ? ' slot__reel--spin' : ''}`}
              style={{ left: `${REEL_X[i][0] * 100}%`, width: `${(REEL_X[i][1] - REEL_X[i][0]) * 100}%` }}
              onClick={() => stopReel(i)}
              aria-label={`${i + 1}番目のリールを止める`}
              disabled={!spinning[i]}
            >
              <div className="slot__strip" style={{ transform: `translateY(calc(${(pos[i] % 1) - 1} * var(--cell)))` }}>
                {[-1, 0, 1, 2].map((k) => {
                  const idx = ((Math.floor(pos[i]) + k) % N + N) % N;
                  const sym = SYMS[idx];
                  return (
                    <span key={k} className={`slot__cell${k === 1 ? ' slot__cell--line' : ''}`}>
                      <Icon name={sym.icon} fallbackIcon={SLOT_FALLBACK_ICON[sym.id]} size={38} fallback={sym.name.slice(0, 2)} />
                    </span>
                  );
                })}
              </div>
              {spinning[i] && <span className="slot__stop">止める</span>}
            </button>
          ))}
          <div className="slot__line" aria-hidden="true" />
        </div>
      </div>

      <div className="slot__result">
        {anySpinning ? (
          <span className="text-sub">リールを押して止める</span>
        ) : result ? (
          <span className={result.payout > result.bet ? 'text-profit' : 'text-sub'}>
            {result.label}
            {result.payout > 0 && ` ×${(result.payout / result.bet).toFixed(1)}`}
          </span>
        ) : (
          <span className="text-dim">回すと当たりが決まり、そこへリールが滑って止まります</span>
        )}
      </div>

      <div className="btn-row">
        <Button block variant={canPlay && !anySpinning ? 'primary' : 'secondary'} disabled={!canPlay || anySpinning} onClick={start}>
          {bet.toLocaleString('ja-JP')}円で回す
        </Button>
        <Button variant={auto ? 'danger' : 'secondary'} onClick={() => setAuto((v) => !v)}>
          {auto ? '自動を止める' : '自動で回す'}
        </Button>
      </div>
    </div>
  );
}
