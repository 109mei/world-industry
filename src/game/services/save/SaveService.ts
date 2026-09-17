import { GAME_META } from '@/game/data/meta';
import type { GameState } from '@/types/state';
import { migrateSave } from '@/game/engine/state/migrations';
import type { SaveRepository } from './SaveRepository';

export interface SaveFile {
  saveVersion: number;
  app: string;
  savedAt: number;
  state: GameState;
}

export const SAVE_KEY = 'world-industry.save.v1';
/** 直前のセーブ（自動バックアップ） */
export const SAVE_BACKUP_KEY = 'world-industry.save.backup';
/** 読み込めなかったセーブの退避先（上書きしないで残す） */
export const SAVE_BROKEN_KEY = 'world-industry.save.broken';

export function serializeState(state: GameState, savedAt: number): string {
  const file: SaveFile = { saveVersion: GAME_META.saveVersion, app: GAME_META.title, savedAt, state };
  return JSON.stringify(file);
}

export function deserializeState(json: string): GameState {
  const parsed = JSON.parse(json) as Partial<SaveFile>;
  if (parsed && typeof parsed === 'object' && 'state' in parsed && parsed.state && typeof parsed.state === 'object') {
    // ファイル側のバージョンを state 側に引き継ぐ
    const state = parsed.state as unknown as Record<string, unknown>;
    if (typeof state.saveVersion !== 'number' && typeof parsed.saveVersion === 'number') state.saveVersion = parsed.saveVersion;
    return migrateSave(state);
  }
  return migrateSave(parsed);
}

/** セーブの中身が「遊んだ跡のあるもの」か（まっさらな状態で上書きしないための判定） */
export function hasProgress(state: GameState): boolean {
  const obtained = Object.values(state.stats?.totalObtained ?? {}).reduce<number>((a, b) => a + (b ?? 0), 0);
  return (
    obtained > 0 ||
    (state.facilities?.length ?? 0) > 0 ||
    (state.lands?.length ?? 0) > 1 ||
    (state.company?.totalEarned ?? 0) > 0 ||
    Object.keys(state.estate?.owned ?? {}).length > 0 ||
    (state.tutorial?.step ?? 0) > 1 ||
    (state.prestige?.count ?? 0) > 0 ||
    (state.stats?.playtimeSeconds ?? 0) > 30
  );
}

/** 保存済みの文字列に遊んだ跡があるか（壊れていれば「ある」扱いにして守る） */
export function savedHasProgress(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    return hasProgress(deserializeState(json));
  } catch {
    return true;
  }
}

export interface LoadResult {
  state: GameState | null;
  /** 読み込みに失敗して退避したときの理由 */
  error?: string;
  /** バックアップから復元したか */
  fromBackup?: boolean;
}

export class SaveService {
  /** 読み込みに失敗したセーブを退避したか（そのセッションで新規状態の保存を控える判断に使う） */
  lastLoadError: string | null = null;

  constructor(private repo: SaveRepository) {}

  /**
   * セーブを読む。壊れていたら退避してバックアップを試し、それも駄目なら null。
   * どちらの場合も元データは消さずに残す。
   */
  async loadSafe(): Promise<LoadResult> {
    this.lastLoadError = null;
    const json = await this.repo.load();
    if (json) {
      try {
        return { state: deserializeState(json) };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.lastLoadError = message;
        // 壊れたセーブは消さずに退避する
        await this.repo.setItem(SAVE_BROKEN_KEY, json).catch(() => {});
      }
    }
    const backup = await this.repo.getItem(SAVE_BACKUP_KEY);
    if (backup) {
      try {
        const state = deserializeState(backup);
        return { state, fromBackup: true, error: this.lastLoadError ?? undefined };
      } catch {
        /* バックアップも壊れている */
      }
    }
    return { state: null, error: this.lastLoadError ?? undefined };
  }

  /** 互換用 */
  async load(): Promise<GameState | null> {
    return (await this.loadSafe()).state;
  }

  async save(state: GameState, now = Date.now()): Promise<void> {
    const current = await this.repo.load();
    // 遊んだ跡のあるセーブを、まっさらな状態で上書きしない（何かの拍子に初期化されても消えないように）
    if (current && !hasProgress(state) && savedHasProgress(current)) {
      throw new Error('進行中のセーブデータがあるため、初期状態での上書きを中止しました');
    }
    state.meta.lastSaveTime = now;
    const json = serializeState(state, now);
    // 直前のセーブをバックアップへ（遊んだ跡があるものだけ）
    if (current && current !== json && savedHasProgress(current)) {
      await this.repo.setItem(SAVE_BACKUP_KEY, current).catch(() => {});
    }
    await this.repo.save(json);
  }

  /** リセット時など、バックアップも含めて消す */
  async clearAll(): Promise<void> {
    await this.repo.clear();
    await this.repo.setItem(SAVE_BACKUP_KEY, '').catch(() => {});
    await this.repo.setItem(SAVE_BROKEN_KEY, '').catch(() => {});
  }

  async clear(): Promise<void> {
    await this.repo.clear();
  }

  /** バックアップがあるか */
  async hasBackup(): Promise<boolean> {
    const b = await this.repo.getItem(SAVE_BACKUP_KEY);
    return !!b;
  }

  /** バックアップ（なければ退避した壊れたセーブ）を読み込む */
  async loadBackup(): Promise<GameState | null> {
    for (const key of [SAVE_BACKUP_KEY, SAVE_BROKEN_KEY]) {
      const json = await this.repo.getItem(key);
      if (!json) continue;
      try {
        return deserializeState(json);
      } catch {
        /* 次を試す */
      }
    }
    return null;
  }

  /** 書き出し（バックアップ用の文字列） */
  export(state: GameState): string {
    const json = serializeState(state, Date.now());
    return btoa(unescape(encodeURIComponent(json)));
  }

  /** 読み込み（export の文字列か素の JSON） */
  import(text: string): GameState {
    const trimmed = text.trim();
    let json = trimmed;
    if (!trimmed.startsWith('{')) {
      json = decodeURIComponent(escape(atob(trimmed)));
    }
    return deserializeState(json);
  }
}
