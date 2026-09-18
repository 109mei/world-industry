import { useCallback, useEffect, useRef } from 'react';

/**
 * 長押しで連打するためのハンドラ。
 * 押してから delay ms 後に interval ms ごとに fn を呼ぶ。通常のクリックは onClick で別に処理する。
 */
export function useRepeat(fn: () => void, options: { delay?: number; interval?: number } = {}) {
  const { delay = 400, interval = 90 } = options;
  const timer = useRef<number | null>(null);
  const ticker = useRef<number | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (ticker.current !== null) window.clearInterval(ticker.current);
    timer.current = null;
    ticker.current = null;
  }, []);

  const start = useCallback(() => {
    stop();
    // 指を離したことは window で受ける。
    // 押している途中でボタンが使えなくなる（お金や材料が尽きる）と、
    // ボタン自身の onPointerUp が来なくなり、連打が止まらなくなるため。
    const release = () => {
      stop();
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    timer.current = window.setTimeout(() => {
      ticker.current = window.setInterval(() => fnRef.current(), interval);
    }, delay);
  }, [delay, interval, stop]);

  useEffect(() => stop, [stop]);

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}
