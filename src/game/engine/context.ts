import type { DerivedState, GameEvent, GameEventType, GameState } from '@/types/state';

export type Rng = () => number;

export interface EmitOptions {
  toast?: boolean;
  achievementId?: string;
  eventId?: string;
  /**
   * まとめて進めているあいだでも必ず知らせる。
   * 倒産のように「見逃すと何が起きたのか分からなくなる」ものだけに使う。
   */
  force?: boolean;
}

export interface EventSink {
  (type: GameEventType, message: string, options?: EmitOptions): GameEvent;
}

/** システム／アクションに渡す実行コンテキスト */
export interface EngineContext {
  state: GameState;
  derived: DerivedState;
  rng: Rng;
  now: () => number;
  emit: EventSink;
  /** オフライン計算中（ランダムイベントを起こさない） */
  offline: () => boolean;
}
