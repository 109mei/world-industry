import { useEffect } from 'react';
import { useGame } from '@/stores/gameStore';

const FONT_SCALE: Record<string, string> = { small: '0.92', normal: '1', large: '1.12' };

/**
 * 設定を画面全体に効かせる（文字の大きさ・動きを減らす・画面を消さない）。
 *
 * どれも html 要素に印を付けるだけにして、CSS 側で受ける。
 * JavaScript で1つずつ止めて回ると、足し忘れたところだけ動いてしまうため。
 */
export function useAppChrome(): void {
  const { state } = useGame();
  const scale = state.settings.fontScale ?? 'normal';
  const reduce = state.settings.reduceMotion === true;
  const keepAwake = state.settings.keepAwake === true;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-scale', FONT_SCALE[scale] ?? '1');
    root.dataset.scale = scale;
  }, [scale]);

  useEffect(() => {
    document.documentElement.dataset.motion = reduce ? 'reduce' : 'full';
  }, [reduce]);

  useEffect(() => {
    if (!keepAwake) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (!wl) return;
        const got = await wl.request('screen');
        if (cancelled) {
          void got.release();
          return;
        }
        lock = got;
      } catch {
        // 端末が対応していない・タブが裏にある、などは無視してよい
      }
    };
    void request();
    // 裏に回ると自動で外れるので、戻ってきたら取り直す
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [keepAwake]);
}
