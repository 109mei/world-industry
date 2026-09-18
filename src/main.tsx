import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
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
        <ErrorBoundary
          fallback={(retry, error) => (
            <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
              <h1>画面を表示できませんでした</h1>
              <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                {error.message}
                <br />
                セーブデータは残っています。もう一度ためすか、ページを読み込み直してください。
              </p>
              <button type="button" className="btn btn--primary" onClick={retry} style={{ marginRight: 8 }}>
                もう一度ためす
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => window.location.reload()}>
                読み込み直す
              </button>
            </div>
          )}
        >
          <App />
        </ErrorBoundary>
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
      void registerServiceWorker();
    });
  }
}

void boot();

/**
 * 新しい版が出たことを知らせる。
 *
 * 一度開いたページは、裏で新しいファイルが用意されても古いまま動き続ける。
 * 黙って待っていると「直したはずのものが直っていない」ように見えるので、
 * 用意ができた時点で知らせて、読み込み直すかどうかを本人に決めてもらう。
 */
async function registerServiceWorker(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.register(new URL('sw.js', window.location.href).toString());
    const notify = () => {
      // 初回の導入（まだ何も動いていない）は「更新」ではないので黙っている
      if (!navigator.serviceWorker.controller) return;
      window.dispatchEvent(new CustomEvent('wi:update-ready'));
    };
    if (reg.waiting) notify();
    reg.addEventListener('updatefound', () => {
      const next = reg.installing;
      if (!next) return;
      next.addEventListener('statechange', () => {
        if (next.state === 'installed') notify();
      });
    });
    // 開きっぱなしのままでも気づけるように、ときどきと、画面に戻ったときに確かめる
    const check = () => {
      if (document.visibilityState === 'visible') void reg.update().catch(() => {});
    };
    window.setInterval(check, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', check);
  } catch {
    /* 登録できなくても、ゲームはそのまま遊べる */
  }
}
