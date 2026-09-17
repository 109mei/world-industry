/**
 * 効果音。音声ファイルを使わず Web Audio API で合成する（軽量・オフラインでも鳴る）。
 * ブラウザの制限で最初のユーザー操作までは鳴らない（初回タップで AudioContext を起動する）。
 */
export type SfxName = 'tap' | 'craft' | 'buy' | 'sell' | 'unlock' | 'achievement' | 'event' | 'warn' | 'research' | 'land';

interface Note {
  /** 周波数（Hz） */
  f: number;
  /** 開始（秒） */
  t: number;
  /** 長さ（秒） */
  d: number;
  /** 音量 0〜1 */
  v?: number;
  type?: OscillatorType;
}

const PATTERNS: Record<SfxName, Note[]> = {
  tap: [{ f: 880, t: 0, d: 0.05, v: 0.5, type: 'square' }],
  craft: [
    { f: 660, t: 0, d: 0.08, type: 'triangle' },
    { f: 990, t: 0.08, d: 0.12, type: 'triangle' },
  ],
  buy: [
    { f: 784, t: 0, d: 0.07, type: 'sine' },
    { f: 1175, t: 0.07, d: 0.16, type: 'sine' },
  ],
  sell: [
    { f: 1319, t: 0, d: 0.05, v: 0.6, type: 'square' },
    { f: 1760, t: 0.06, d: 0.1, v: 0.5, type: 'square' },
  ],
  unlock: [
    { f: 523, t: 0, d: 0.1, type: 'triangle' },
    { f: 659, t: 0.1, d: 0.1, type: 'triangle' },
    { f: 784, t: 0.2, d: 0.2, type: 'triangle' },
  ],
  achievement: [
    { f: 523, t: 0, d: 0.12, type: 'triangle' },
    { f: 659, t: 0.12, d: 0.12, type: 'triangle' },
    { f: 784, t: 0.24, d: 0.12, type: 'triangle' },
    { f: 1047, t: 0.36, d: 0.4, type: 'triangle' },
    { f: 1319, t: 0.36, d: 0.4, v: 0.5, type: 'sine' },
  ],
  event: [
    { f: 440, t: 0, d: 0.15, type: 'sawtooth', v: 0.5 },
    { f: 440, t: 0.22, d: 0.15, type: 'sawtooth', v: 0.5 },
  ],
  warn: [{ f: 220, t: 0, d: 0.25, type: 'sawtooth', v: 0.45 }],
  research: [
    { f: 988, t: 0, d: 0.06, type: 'sine' },
    { f: 1319, t: 0.06, d: 0.06, type: 'sine' },
    { f: 1568, t: 0.12, d: 0.18, type: 'sine' },
  ],
  land: [
    { f: 392, t: 0, d: 0.15, type: 'triangle' },
    { f: 523, t: 0.15, d: 0.15, type: 'triangle' },
    { f: 659, t: 0.3, d: 0.3, type: 'triangle' },
  ],
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let lastPlayed: Partial<Record<SfxName, number>> = {};

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

/** 最初のユーザー操作で呼び、以後の再生を確実にする */
export function unlockAudio(): void {
  ensureContext();
}

export function playSfx(name: SfxName, volume: number): void {
  if (volume <= 0) return;
  const c = ensureContext();
  if (!c || !master) return;
  const now = performance.now();
  // 同じ音の連打は 40ms に1回まで
  if (name === 'tap' && lastPlayed[name] !== undefined && now - (lastPlayed[name] ?? 0) < 40) return;
  lastPlayed[name] = now;
  master.gain.value = Math.min(1, Math.max(0, volume)) * 0.35;
  const t0 = c.currentTime + 0.005;
  for (const n of PATTERNS[name]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.f;
    const v = n.v ?? 0.8;
    gain.gain.setValueAtTime(0.0001, t0 + n.t);
    gain.gain.exponentialRampToValueAtTime(v, t0 + n.t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.t + n.d);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0 + n.t);
    osc.stop(t0 + n.t + n.d + 0.02);
  }
}

/** テスト用: 内部状態を捨てる */
export function resetSfxForTests(): void {
  ctx = null;
  master = null;
  lastPlayed = {};
}
