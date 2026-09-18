import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { GAME_META } from './game/data/meta';
import { createRuntime } from './game/runtime';
import { initMusic } from './game/services/audio/music';
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import './styles/components.css';

document.title = GAME_META.title;

// BGM は最初の操作があるまで鳴らせない。その待ち受けをここで用意する
initMusic();

/**
 * 長押ししたときに端末の「画像を保存」などのメニューが出ないようにする。
 * 入力欄の上では出したままにして、文字のコピーなどは普通にできるようにする。
 */
document.addEventListener(
  'contextmenu',
  (e) => {
    const el = e.target as HTMLElement | null;
    if (!el || typeof el.closest !== 'function') return;
    if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
  },
  { capture: true },
);

async function boot() {
  const root = createRoot(document.getElementById('root')!);
  try {
    await createRuntime();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (e) {
    console.error(e);
    root.render(
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>起動に失敗しました</h1>
        <p>{(e as Error).message}</p>
      </div>,
    );
  }

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('sw.js', window.location.href).toString()).catch(() => {});
    });
  }
}

void boot();
