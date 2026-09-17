import { CONFIG } from '@/game/data/config';
import { GameEngine } from '@/game/engine/GameEngine';
import { playSfx, type SfxName } from '@/game/services/audio/sfx';
import { GameLoop } from '@/game/services/GameLoop';
import { LocalStorageSaveRepository, MemorySaveRepository, type SaveRepository } from '@/game/services/save/SaveRepository';
import { SAVE_KEY, SaveService, hasProgress, savedHasProgress, serializeState } from '@/game/services/save/SaveService';
import { bumpGame, setChangeHook, useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import type { GameState, OfflineReport } from '@/types/state';

/** ゲーム全体の実行環境（エンジン・ループ・保存）をまとめて起動する */
export interface GameRuntime {
  getEngine: () => GameEngine;
  loop: GameLoop;
  saveService: SaveService;
  save: () => Promise<void>;
  /** 操作のたびに呼ぶ。少しまとめてから保存する */
  scheduleSave: () => void;
  reset: () => Promise<void>;
  importState: (text: string) => Promise<void>;
  exportState: () => string;
  /** 自動バックアップから復元する */
  restoreBackup: () => Promise<boolean>;
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

/** エンジンのイベント種別ごとの効果音 */
const EVENT_SFX: Partial<Record<string, SfxName>> = {
  unlock: 'unlock',
  achievement: 'achievement',
  event: 'event',
  warn: 'warn',
  tutorial: 'craft',
};

function wireEngine(engine: GameEngine): void {
  useGameStore.getState().attach(engine);
  engine.addListener((ev, { toast }) => {
    const ui = useUiStore.getState();
    if (ev.type === 'achievement' && ev.achievementId) {
      // 実績はトーストではなく専用の演出で見せる
      ui.pushAchievement(ev.achievementId);
    } else if (toast) {
      ui.pushToast(ev.type, ev.message);
    }
    if (toast || ev.type === 'achievement') {
      const sfxName = EVENT_SFX[ev.type];
      const settings = engine.state.settings;
      if (sfxName && settings.sound) playSfx(sfxName, settings.volume);
    }
  });
}

export async function createRuntime(): Promise<GameRuntime> {
  if (runtime) return runtime;
  const saveService = new SaveService(createRepository());

  let loaded: GameState | null = null;
  let loadError: string | undefined;
  let fromBackup = false;
  try {
    const result = await saveService.loadSafe();
    loaded = result.state;
    loadError = result.error;
    fromBackup = result.fromBackup === true;
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    console.error('セーブデータの読み込みに失敗しました。', e);
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

  let saveFailureNotified = false;
  const doSave = async () => {
    try {
      engine.refreshDerived();
      await saveService.save(engine.state);
      saveFailureNotified = false;
    } catch (e) {
      console.error('保存に失敗しました', e);
      if (!saveFailureNotified) {
        saveFailureNotified = true;
        useUiStore.getState().pushToast('warn', e instanceof Error ? e.message : 'セーブデータを保存できませんでした');
      }
    }
  };

  // 操作のたびに保存する（短い間にまとめて1回にする）
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSave = () => {
    if (saveTimer !== null) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void doSave();
    }, CONFIG.saveDebounceMs);
  };

  /** タブを閉じる・再読み込みするときは、その場で書き込む（待ちを挟まない） */
  const saveNowSync = () => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      engine.refreshDerived();
      // 進行中のセーブを初期状態で上書きしない
      if (!hasProgress(engine.state) && savedHasProgress(localStorage.getItem(SAVE_KEY))) return;
      const now = Date.now();
      engine.state.meta.lastSaveTime = now;
      localStorage.setItem(SAVE_KEY, serializeState(engine.state, now));
    } catch {
      /* 保存できない環境では何もしない */
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
    scheduleSave,
    reset: async () => {
      await saveService.clearAll();
      replaceEngine();
      await doSave();
    },
    importState: async (text) => {
      const state = saveService.import(text);
      await saveService.clearAll();
      replaceEngine(state);
      await doSave();
    },
    exportState: () => {
      engine.refreshDerived();
      return saveService.export(engine.state);
    },
    restoreBackup: async () => {
      const state = await saveService.loadBackup();
      if (!state) return false;
      replaceEngine(state);
      await doSave();
      return true;
    },
  };

  // 操作（bumpGame）のたびに保存を予約する
  setChangeHook(scheduleSave);

  loop.start();

  // タブを閉じる／裏に回る／再読み込みするときは、その場で書き込む
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNowSync();
  });
  window.addEventListener('pagehide', saveNowSync);
  window.addEventListener('beforeunload', saveNowSync);

  // 読み込みでつまずいたことは黙って初期化せずに伝える
  if (loadError && fromBackup) {
    useUiStore.getState().pushToast('warn', 'セーブデータを読めなかったため、自動バックアップから復元しました');
  } else if (loadError) {
    useUiStore.getState().pushToast('warn', `セーブデータを読み込めませんでした（${loadError}）。元のデータは残してあります`);
  }
  // 開いた直後の状態も保存しておく（すぐ閉じても残るように）
  void doSave();

  return runtime;
}

export function getRuntime(): GameRuntime {
  if (!runtime) throw new Error('runtime is not created');
  return runtime;
}
