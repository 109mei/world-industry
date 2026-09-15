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

export class SaveService {
  constructor(private repo: SaveRepository) {}

  async load(): Promise<GameState | null> {
    const json = await this.repo.load();
    if (!json) return null;
    return deserializeState(json);
  }

  async save(state: GameState, now = Date.now()): Promise<void> {
    state.meta.lastSaveTime = now;
    await this.repo.save(serializeState(state, now));
  }

  async clear(): Promise<void> {
    await this.repo.clear();
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
