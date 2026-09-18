import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '@/utils/sfx';
import { useTimeouts } from './useFrameLoop';

/**
 * 「岩を割る」。ひびが光った所を、光っているあいだに叩く。
 *
 * ひびは前に光った所の近くに出やすくしてある（岩は一度入った割れ目に沿って裂ける）。
 * つまり、手を大きく動かさずに済む場所を読めるかどうかの遊びになる。
 */

const COLS = 3;
const ROWS = 3;
const CELLS = COLS * ROWS;
const SWINGS = 10;
/** 光っている時間（ミリ秒）。回を追うごとに短くなる */
const WINDOW_START = 950;
const WINDOW_END = 480;

interface Props {
  onDone: (score: number) => void;
}

/** 前に光った所の近くを選びやすくする（同じ所は選ばない） */
function nextCell(prev: number): number {
  const px = prev % COLS;
  const py = Math.floor(prev / COLS);
  const weights: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (i === prev) {
      weights.push(0);
      continue;
    }
    const d = Math.abs((i % COLS) - px) + Math.abs(Math.floor(i / COLS) - py);
    weights.push(d <= 1 ? 4 : d === 2 ? 2 : 1);
  }
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < CELLS; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return (prev + 1) % CELLS;
}

export function DigGame({ onDone }: Props) {
  const [lit, setLit] = useState(4);
  const [swing, setSwing] = useState(0);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState<'hit' | 'miss' | ''>('');
  const timer = useRef<number | null>(null);
  const later = useTimeouts();
  const answered = useRef(false);
  const doneRef = useRef(false);

  const advance = useCallback(
    (didHit: boolean) => {
      if (answered.current || doneRef.current) return;
      answered.current = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
      const nextHits = hits + (didHit ? 1 : 0);
      setHits(nextHits);
      setFlash(didHit ? 'hit' : 'miss');
      sfx(didHit ? 'craft' : 'warn');
      later(() => {
        setFlash('');
        if (swing + 1 >= SWINGS) {
          doneRef.current = true;
          onDone(nextHits / SWINGS);
          return;
        }
        setSwing(swing + 1);
        setLit((p) => nextCell(p));
        answered.current = false;
      }, 220);
    },
    [hits, swing, onDone, later],
  );

  // 光っている時間が切れたら空振り
  useEffect(() => {
    if (doneRef.current) return;
    const ms = WINDOW_START - ((WINDOW_START - WINDOW_END) * swing) / (SWINGS - 1);
    timer.current = window.setTimeout(() => advance(false), ms);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [swing, advance]);

  return (
    <div className="mg">
      <div className="mg__head">
        <span className="mg__round">{swing + 1} / {SWINGS} 振り目</span>
        <span className="mg__note">割れた {hits}</span>
      </div>

      <div className={`mg__rock${flash ? ` mg__rock--${flash}` : ''}`}>
        {Array.from({ length: CELLS }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`mg__crack${i === lit ? ' mg__crack--lit' : ''}`}
            aria-label={i === lit ? 'ひびが光っている' : 'ひび'}
            onClick={() => advance(i === lit)}
          />
        ))}
      </div>

      <div className="text-dim mg__foot">光っているあいだしか割れない。次のひびは近くに出やすい。</div>
    </div>
  );
}
