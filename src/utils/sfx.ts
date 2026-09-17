import { playSfx, type SfxName } from '@/game/services/audio/sfx';
import { useGameStore } from '@/stores/gameStore';

/** 設定（効果音 ON/OFF・音量）を見て効果音を鳴らす。UI から呼ぶ */
export function sfx(name: SfxName): void {
  const engine = useGameStore.getState().engine;
  if (!engine) return;
  const s = engine.state.settings;
  if (!s.sound) return;
  playSfx(name, s.volume);
}
