import { create } from 'zustand';
import type { GameEngine } from '@/game/engine/GameEngine';
import type { DerivedState, GameState } from '@/types/state';

/**
 * エンジンの状態を React に渡すためのストア。
 * 状態オブジェクトそのものはエンジンが持ち、version を進めることで再描画を起こす。
 */
interface GameStore {
  engine: GameEngine | null;
  version: number;
  bump: () => void;
  attach: (engine: GameEngine) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  engine: null,
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
  attach: (engine) => set({ engine, version: 0 }),
}));

export interface GameView {
  state: GameState;
  derived: DerivedState;
  engine: GameEngine;
  version: number;
}

/** 画面用フック。version が変わるたびに再描画される */
export function useGame(): GameView {
  const engine = useGameStore((s) => s.engine);
  const version = useGameStore((s) => s.version);
  if (!engine) throw new Error('GameEngine is not attached');
  return { state: engine.state, derived: engine.derived, engine, version };
}

export function bumpGame(): void {
  useGameStore.getState().bump();
}
