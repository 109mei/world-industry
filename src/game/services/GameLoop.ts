import { CONFIG } from '@/game/data/config';
import type { GameEngine } from '@/game/engine/GameEngine';

export interface GameLoopHooks {
  onUiRefresh: () => void;
  onAutosave: () => void;
  /** タブ復帰などで大きく時間が飛んだとき */
  onCatchUp?: (seconds: number) => void;
}

/**
 * 中央のゲームループ。施設ごとにタイマーは作らず、ここで一括して engine.tick を呼ぶ。
 * シミュレーション更新（simTickMs）と画面更新（uiRefreshMs）は別々に数える。
 */
export class GameLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private uiAccumulator = 0;
  private saveAccumulator = 0;

  constructor(private engine: GameEngine, private hooks: GameLoopHooks) {}

  /** リセットや読み込みでエンジンを差し替える */
  setEngine(engine: GameEngine): void {
    this.engine = engine;
    this.lastTick = performance.now();
    this.uiAccumulator = 0;
    this.saveAccumulator = 0;
  }

  start(): void {
    if (this.timer) return;
    this.lastTick = performance.now();
    this.timer = setInterval(() => this.step(), CONFIG.simTickMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  /** 1回分の更新。経過時間が大きいときは分割して進める */
  step(): void {
    const now = performance.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (dt <= 0) return;

    if (dt > CONFIG.offlineThresholdSeconds) {
      // タブが長く止まっていた: まとめて計算（上限あり）
      const seconds = Math.min(dt, this.engine.state.settings.maxOfflineSeconds + (this.engine.derived.modifiers?.offlineBonusSec ?? 0));
      this.engine.advance(seconds);
      this.hooks.onCatchUp?.(seconds);
    } else if (dt > CONFIG.maxStepSeconds) {
      this.engine.advance(dt);
    } else {
      this.engine.tick(dt);
    }
    this.engine.state.meta.lastTickTime = Date.now();

    this.uiAccumulator += dt * 1000;
    this.saveAccumulator += dt * 1000;
    if (this.uiAccumulator >= CONFIG.uiRefreshMs) {
      this.uiAccumulator = 0;
      this.hooks.onUiRefresh();
    }
    if (this.saveAccumulator >= this.engine.state.settings.autosaveSeconds * 1000) {
      this.saveAccumulator = 0;
      this.hooks.onAutosave();
    }
  }
}
