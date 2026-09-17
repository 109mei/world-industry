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
