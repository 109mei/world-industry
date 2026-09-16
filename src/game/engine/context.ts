import type { DerivedState, GameEvent, GameEventType, GameState } from '@/types/state';

export type Rng = () => number;

export interface EventSink {
  (type: GameEventType, message: string, options?: { toast?: boolean }): GameEvent;
}

/** システム／アクションに渡す実行コンテキスト */
export interface EngineContext {
  state: GameState;
  derived: DerivedState;
  rng: Rng;
  now: () => number;
  emit: EventSink;
}
