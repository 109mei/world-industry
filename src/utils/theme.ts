import { useEffect, useState } from 'react';
import type { ThemeMode } from '@/types/state';
import { useGame } from '@/stores/gameStore';

export type ResolvedTheme = 'dark' | 'light';

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? systemTheme() : mode;
}

/** html 要素にテーマを付ける（CSS の変数が切り替わる） */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F3F5F8' : '#0E1116');
}

/** 設定（dark / light / system）を実際の配色に解決して返す。system のときは端末の設定に追従する */
export function useResolvedTheme(): ResolvedTheme {
  const { state } = useGame();
  const mode = state.settings.theme ?? 'dark';
  const [system, setSystem] = useState<ResolvedTheme>(() => systemTheme());
  useEffect(() => {
    if (mode !== 'system' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystem(mq.matches ? 'light' : 'dark');
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);
  return mode === 'system' ? system : mode;
}
