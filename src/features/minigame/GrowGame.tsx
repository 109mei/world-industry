import { useRef, useState } from 'react';
import { sfx } from '@/utils/sfx';
import { useFrameLoop } from './useFrameLoop';

/**
 * 「苗を育てる」。水やりで土の湿り気を、ちょうどよい帯の中に保つ。
 *
 * 足しすぎれば根腐れ、放っておけば乾く、という現実の加減をそのまま遊びにしてある。
 *
 * 時間は「タイマーが何回来たか」ではなく**実際の経過**で測る。
 * setInterval の回数で数えていたころは、アプリを裏に回すとブラウザが間引くせいで
 * 「土だけ乾いて時計は進まない」状態になり、戻ったときには手遅れになっていた。
 * いまは1フレームぶんの進みに上限を置いてあるので、裏に回しても不利にならない。
 */

/** ちょうどよい湿り気の帯 */
const GOOD_LOW = 45;
const GOOD_HIGH = 72;
/** 乾いていく速さ（1秒あたり）。だんだん速くなる（日が高くなる） */
const DRY_BASE = 5.5;
/** 1回の水やりで増える量 */
const WATER = 13;
const SECONDS = 20;

interface Props {
  onDone: (score: number) => void;
}

export function GrowGame({ onDone }: Props) {
  const [moisture, setMoisture] = useState(58);
  const [left, setLeft] = useState(SECONDS);
  const [rate, setRate] = useState(0);
  /** 描き直しを毎フレーム起こさずに持ちたい値 */
  const ref = useRef({ moisture: 58, goodSec: 0, prev: 0 });
  const doneRef = useRef(false);

  useFrameLoop((elapsed) => {
    if (doneRef.current) return;
    const r = ref.current;
    const dt = Math.max(0, elapsed - r.prev);
    r.prev = elapsed;
    // 日が高くなるほど乾きが速い
    const dry = DRY_BASE * (1 + Math.min(1, elapsed / SECONDS)) * dt;
    const next = Math.max(0, Math.min(100, r.moisture - dry));
    r.moisture = next;
    if (next >= GOOD_LOW && next <= GOOD_HIGH) r.goodSec += dt;
    setMoisture(next);
    setLeft(Math.max(0, SECONDS - elapsed));
    setRate(elapsed > 0 ? Math.min(1, r.goodSec / elapsed) : 0);
    if (elapsed >= SECONDS) {
      doneRef.current = true;
      onDone(Math.min(1, r.goodSec / SECONDS));
    }
  });

  const water = () => {
    if (doneRef.current) return;
    const r = ref.current;
    r.moisture = Math.min(100, r.moisture + WATER);
    setMoisture(r.moisture);
    sfx('tap');
  };

  const state = moisture > GOOD_HIGH ? '水のやりすぎ' : moisture < GOOD_LOW ? '乾いている' : 'ちょうどよい';
  const tone = moisture > GOOD_HIGH ? 'loss' : moisture < GOOD_LOW ? 'warn' : 'profit';
  return (
    <div className="mg">
      <div className="mg__head">
        <span className="mg__round">のこり {left.toFixed(1)} 秒</span>
        <span className={`mg__note text-${tone}`}>{state}</span>
      </div>

      <div className="mg__gauge">
        <div className="mg__gauge-band" style={{ bottom: `${GOOD_LOW}%`, height: `${GOOD_HIGH - GOOD_LOW}%` }} />
        <div className={`mg__gauge-fill mg__gauge-fill--${tone}`} style={{ height: `${moisture}%` }} />
        <div className="mg__gauge-label">土の湿り気</div>
      </div>

      <div className="mg__meter">
        <div className="mg__meter-fill" style={{ width: `${rate * 100}%` }} />
        <span className="mg__meter-text num">ちょうどよく保てた割合 {Math.round(rate * 100)}%</span>
      </div>

      <button type="button" className="btn btn--primary btn--block mg__action" onClick={water}>
        水をやる
      </button>
      <div className="text-dim mg__foot">減り始めで少しずつ足すほうが保ちやすい。やりすぎは根腐れ。</div>
    </div>
  );
}
