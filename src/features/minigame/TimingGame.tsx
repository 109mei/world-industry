import { useCallback, useRef, useState } from 'react';
import { sfx } from '@/utils/sfx';
import { pingPong, useFrameLoop, useTimeouts } from './useFrameLoop';

/**
 * 「手を合わせる」。動いている印を、狙いの帯の中で止める。
 *
 * 印の位置は1本の requestAnimationFrame で持ち、React の描き直しは起こさない
 * （毎フレーム描き直すと重いため）。押された瞬間の位置だけを読んで判定する。
 */

const ROUNDS = 5;
/** 回ごとの帯の半幅（狭くなるほど難しい）と、印が1往復する秒数 */
const ROUND: { half: number; sec: number }[] = [
  { half: 0.13, sec: 1.6 },
  { half: 0.11, sec: 1.4 },
  { half: 0.09, sec: 1.2 },
  { half: 0.07, sec: 1.05 },
  { half: 0.05, sec: 0.9 },
];

interface Props {
  onDone: (score: number) => void;
}

export function TimingGame({ onDone }: Props) {
  const markerRef = useRef<HTMLDivElement>(null);
  /** いまの印の位置（0〜1）。画面の描き直しを起こさずに持ちたいので ref */
  const posRef = useRef(0);
  const [round, setRound] = useState(0);
  const [center, setCenter] = useState(() => 0.25 + Math.random() * 0.5);
  const [hits, setHits] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);
  const [note, setNote] = useState('');
  const later = useTimeouts();
  // 二重押しは ref で同期的に弾く。state だと、反映が挟まらないまま2回通り得る
  const busy = useRef(false);

  const conf = ROUND[Math.min(round, ROUND.length - 1)];

  useFrameLoop(
    (elapsed) => {
      const p = pingPong(elapsed, conf.sec * 2);
      posRef.current = p;
      const el = markerRef.current;
      // 端で切れないよう、動く幅を 2%〜98% に収める
      if (el) el.style.left = `${(2 + p * 96).toFixed(2)}%`;
    },
    !paused,
  );

  const stop = useCallback(() => {
    if (paused || busy.current) return;
    busy.current = true;
    const pos = posRef.current;
    const dist = Math.abs(pos - center);
    // 帯の中なら真ん中に近いほど高い。外れたら0
    const got = dist <= conf.half ? 1 - dist / conf.half : 0;
    setPaused(true);
    sfx(got > 0.6 ? 'craft' : got > 0 ? 'tap' : 'warn');
    setNote(got >= 0.95 ? 'ど真ん中' : got > 0.6 ? '良い' : got > 0 ? 'かすった' : '外れ');
    const next = [...hits, got];
    setHits(next);
    later(() => {
      if (next.length >= ROUNDS) {
        onDone(next.reduce((a, b) => a + b, 0) / ROUNDS);
        return;
      }
      setRound(next.length);
      setCenter(0.2 + Math.random() * 0.6);
      setNote('');
      setPaused(false);
      busy.current = false;
    }, 650);
  }, [paused, center, conf.half, hits, onDone, later]);

  return (
    <div className="mg">
      <div className="mg__head">
        <span className="mg__round">
          {Math.min(hits.length + 1, ROUNDS)} / {ROUNDS} 回目
        </span>
        <span className="mg__note">{note}</span>
      </div>

      <div className="mg__track">
        <div className="mg__zone" style={{ left: `${(2 + (center - conf.half) * 96).toFixed(2)}%`, width: `${(conf.half * 2 * 96).toFixed(2)}%` }} />
        <div className="mg__zone-core" style={{ left: `${(2 + center * 96).toFixed(2)}%` }} />
        <div className="mg__marker" ref={markerRef} style={{ left: '2%' }} />
      </div>

      <div className="mg__dots" aria-label="これまでの出来">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <span
            key={i}
            className={`mg__dot${i < hits.length ? (hits[i] > 0.6 ? ' mg__dot--good' : hits[i] > 0 ? ' mg__dot--ok' : ' mg__dot--miss') : ''}`}
          />
        ))}
      </div>

      <button type="button" className="btn btn--primary btn--block mg__action" onClick={stop} disabled={paused}>
        止める
      </button>
    </div>
  );
}
