import { useEffect, useRef } from 'react';

/**
 * ミニゲームの「動き」を1本の requestAnimationFrame でまわす。
 *
 * CSS のアニメーションに任せると、設定の「動きを減らす」や端末の
 * prefers-reduced-motion で止まってしまい、**遊べなくなる**。
 * 動きが飾りではなく遊びそのものなので、ここだけは自分で回す。
 *
 * React の状態は毎フレーム更新しない（描き直しが 60回/秒 になって重くなる）。
 * 代わりに、渡された要素の style を直接書き換える。
 */
export function useFrameLoop(onFrame: (elapsedSec: number) => void, running = true): void {
  const cb = useRef(onFrame);
  cb.current = onFrame;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let prev = 0;
    let elapsed = 0;
    const step = (t: number) => {
      if (prev === 0) prev = t;
      // 裏に回っているあいだ rAF は呼ばれないが時刻は進むので、
      // 戻ってきた1フレーム目に何秒もまとめて渡さない。
      // そのまま渡すと「見ていないうちに持ち時間が切れていた」が起きる。
      elapsed += Math.min(0.1, (t - prev) / 1000);
      prev = t;
      cb.current(elapsed);
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [running]);
}

/**
 * 0→1→0 を繰り返す動き（往復）。period は1往復にかける秒数。
 * 端で折り返すので、端のほうが狙いにくい、という手触りになる。
 */
export function pingPong(elapsedSec: number, periodSec: number): number {
  const t = (elapsedSec % periodSec) / periodSec;
  return t < 0.5 ? t * 2 : 2 - t * 2;
}

/**
 * 画面が閉じたら必ず止まる setTimeout。
 *
 * ミニゲームは「少し待ってから次の回へ」「少し待ってから結果を出す」を挟むが、
 * 素の setTimeout だと、待っているあいだに閉じても後から走ってしまう。
 * 実際それで「閉じたのに結果が記録される」が起きていた。
 */
export function useTimeouts(): (fn: () => void, ms: number) => void {
  const ids = useRef<number[]>([]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const id of ids.current) window.clearTimeout(id);
      ids.current = [];
    };
  }, []);
  return (fn, ms) => {
    const id = window.setTimeout(() => {
      ids.current = ids.current.filter((x) => x !== id);
      if (alive.current) fn();
    }, ms);
    ids.current.push(id);
  };
}
