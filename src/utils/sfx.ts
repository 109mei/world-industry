import { playSfx, type SfxName } from '@/game/services/audio/sfx';
import { useGameStore } from '@/stores/gameStore';

/** 設定（消音・効果音 ON/OFF・音量）を見て効果音を鳴らす。UI から呼ぶ */
export function sfx(name: SfxName): void {
  const engine = useGameStore.getState().engine;
  if (!engine) return;
  const s = engine.state.settings;
  if (s.mute === true || !s.sound) return;
  playSfx(name, s.volume);
}

/**
 * 押した手ごたえ（端末を軽く震わせる）。
 * 対応していない端末では何も起きない。長く震わせると不快なので短くする。
 */
export function haptic(ms = 10): void {
  const engine = useGameStore.getState().engine;
  if (!engine || engine.state.settings.haptics === false) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 使えない端末では黙って何もしない
  }
}
