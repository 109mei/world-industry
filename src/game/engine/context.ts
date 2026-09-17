import type { DerivedState, GameEvent, GameEventType, GameState } from '@/types/state';

export type Rng = () => number;

export interface EmitOptions {
  toast?: boolean;
  achievementId?: string;
  eventId?: string;
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
