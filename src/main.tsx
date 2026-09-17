import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { GAME_META } from './game/data/meta';
import { createRuntime } from './game/runtime';
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import './styles/components.css';

document.title = GAME_META.title;

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
