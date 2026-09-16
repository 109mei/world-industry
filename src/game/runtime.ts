import { CONFIG } from '@/game/data/config';
import { GameEngine } from '@/game/engine/GameEngine';
import { GameLoop } from '@/game/services/GameLoop';
import { LocalStorageSaveRepository, MemorySaveRepository, type SaveRepository } from '@/game/services/save/SaveRepository';
import { SAVE_KEY, SaveService } from '@/game/services/save/SaveService';
import { bumpGame, useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import type { GameState, OfflineReport } from '@/types/state';

/** ゲーム全体の実行環境（エンジン・ループ・保存）をまとめて起動する */
export interface GameRuntime {
  getEngine: () => GameEngine;
  loop: GameLoop;
  saveService: SaveService;
  save: () => Promise<void>;
  reset: () => Promise<void>;
  importState: (text: string) => Promise<void>;
  exportState: () => string;
}

let runtime: GameRuntime | null = null;

function createRepository(): SaveRepository {
  try {
    const k = '__wi_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return new LocalStorageSaveRepository(SAVE_KEY);
  } catch {
    return new MemorySaveRepository();
  }
}

function wireEngine(engine: GameEngine): void {
  useGameStore.getState().attach(engine);
  engine.addListener((ev, { toast }) => {
    if (toast) useUiStore.getState().pushToast(ev.type, ev.message);
  });
}

export async function createRuntime(): Promise<GameRuntime> {
  if (runtime) return runtime;
  const saveService = new SaveService(createRepository());

  let loaded: GameState | null = null;
  try {
    loaded = await saveService.load();
  } catch (e) {
    console.error('セーブデータの読み込みに失敗しました。新規開始します。', e);
  }
  let engine = new GameEngine(loaded ? { state: loaded } : {});
  wireEngine(engine);

  // オフライン進行
  if (loaded) {
    const elapsed = (Date.now() - loaded.meta.lastSaveTime) / 1000;
    if (elapsed >= CONFIG.offlineThresholdSeconds) {
      const report: OfflineReport = engine.applyOffline(elapsed);
      if (report.simulatedSeconds > 0) useUiStore.getState().setOfflineReport(report);
    }
  }

  const doSave = async () => {
    try {
      engine.refreshDerived();
      await saveService.save(engine.state);
    } catch (e) {
      console.error('保存に失敗しました', e);
    }
  };

  const loop = new GameLoop(engine, {
    onUiRefresh: () => bumpGame(),
    onAutosave: () => void doSave(),
    onCatchUp: (seconds) => {
      if (seconds >= 300) useUiStore.getState().pushToast('info', `離席中の${Math.floor(seconds / 60)}分ぶんを計算しました`);
    },
  });

  const replaceEngine = (state?: GameState) => {
    engine = new GameEngine(state ? { state } : {});
    wireEngine(engine);
    loop.setEngine(engine);
    bumpGame();
  };

  runtime = {
    getEngine: () => engine,
    loop,
    saveService,
    save: doSave,
    reset: async () => {
      await saveService.clear();
      replaceEngine();
    },
    importState: async (text) => {
      const state = saveService.import(text);
      replaceEngine(state);
      await doSave();
    },
    exportState: () => {
      engine.refreshDerived();
      return saveService.export(engine.state);
    },
  };

  loop.start();

  // タブを閉じる／裏に回るときに保存
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void doSave();
  });
  window.addEventListener('pagehide', () => void doSave());

  return runtime;
}

export function getRuntime(): GameRuntime {
  if (!runtime) throw new Error('runtime is not created');
  return runtime;
}
