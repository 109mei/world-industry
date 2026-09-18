/**
 * BGM。
 *
 * 効果音（sfx.ts）はその場で音を合成しているが、こちらは音声ファイルを流す。
 * 決めごと:
 *  - 曲は画面ごとに決まる。切り替わるときは 0.8 秒かけて入れ替える（ぷつっと切らない）
 *  - ブラウザは最初の操作があるまで音を鳴らせないので、最初のタップまで待つ
 *  - タブを裏に回したら止める（戻ったら続きから）
 *  - 曲のファイルがまだ無いときは、何も鳴らさずに黙る（エラーにしない）
 */

export type TrackId = 'casino';

interface TrackDef {
  id: TrackId;
  /** public/assets/bgm/ の中のファイル名（拡張子なし。ogg と m4a の両方を置く） */
  file: string;
  /** 曲の名前（設定画面などに出す） */
  name: string;
  /** この曲だけの音量の調整（曲ごとの音量差をならす） */
  gain: number;
}

export const TRACKS: Record<TrackId, TrackDef> = {
  casino: { id: 'casino', file: 'casino', name: 'Luck Makes No Sound', gain: 1 },
};

const FADE_MS = 800;

/** いま鳴らしているもの */
let current: { id: TrackId; el: HTMLAudioElement } | null = null;
/** 鳴らしたいもの（最初の操作を待っているあいだも覚えておく） */
let wanted: TrackId | null = null;
let enabled = false;
let volume = 0.5;
let unlocked = false;
/** 進んだところを覚えておいて、戻ってきたら続きから流す */
const positions = new Map<TrackId, number>();

function assetUrl(file: string, ext: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}assets/bgm/${file}.${ext}`;
}

/** その端末で鳴らせる形式を選ぶ（Safari は ogg/opus を鳴らせないことがある） */
function pickSource(file: string): string {
  const probe = document.createElement('audio');
  if (probe.canPlayType('audio/ogg; codecs=opus')) return assetUrl(file, 'ogg');
  return assetUrl(file, 'm4a');
}

function makeAudio(def: TrackDef): HTMLAudioElement {
  const el = new Audio(pickSource(def.file));
  el.loop = true;
  el.preload = 'auto';
  el.volume = 0;
  // ファイルが無い・鳴らせない環境では黙って諦める
  el.addEventListener('error', () => stopElement(el));
  return el;
}

function fade(el: HTMLAudioElement, to: number, ms: number, onDone?: () => void): void {
  const from = el.volume;
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms);
    try {
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    } catch {
      /* 音量を触れない環境 */
    }
    if (k < 1) requestAnimationFrame(step);
    else onDone?.();
  };
  requestAnimationFrame(step);
}

function stopElement(el: HTMLAudioElement): void {
  try {
    el.pause();
    el.src = '';
  } catch {
    /* すでに止まっている */
  }
}

function targetVolume(id: TrackId): number {
  return Math.max(0, Math.min(1, volume * TRACKS[id].gain));
}

/** いま鳴らしたい曲を、実際の再生に反映する */
function apply(): void {
  if (!unlocked) return;
  const want = enabled ? wanted : null;
  if (current && current.id === want) {
    fade(current.el, targetVolume(current.id), 200);
    return;
  }
  if (current) {
    const old = current;
    positions.set(old.id, old.el.currentTime);
    fade(old.el, 0, FADE_MS, () => stopElement(old.el));
    current = null;
  }
  if (!want) return;
  const def = TRACKS[want];
  const el = makeAudio(def);
  el.currentTime = positions.get(want) ?? 0;
  current = { id: want, el };
  void el
    .play()
    .then(() => fade(el, targetVolume(want), FADE_MS))
    .catch(() => {
      // 自動再生が止められた。次の操作でもう一度試す
      unlocked = false;
      current = null;
      stopElement(el);
    });
}

/** 最初の操作で音を出せるようにする。アプリの起動時に1回だけ呼ぶ */
export function initMusic(): void {
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    apply();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
    window.addEventListener(ev, unlock, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!current) return;
    if (document.visibilityState === 'hidden') {
      positions.set(current.id, current.el.currentTime);
      current.el.pause();
    } else if (enabled) {
      void current.el.play().catch(() => {});
    }
  });
}

/** 設定（ON/OFF と音量）を反映する */
export function setMusicSettings(on: boolean, vol: number): void {
  enabled = on;
  volume = Math.max(0, Math.min(1, vol));
  apply();
}

/** 画面に合わせて曲を変える。null で止める */
export function setTrack(id: TrackId | null): void {
  if (wanted === id) return;
  wanted = id;
  apply();
}

/** いま鳴っている曲（表示用） */
export function currentTrackName(): string | null {
  return current ? TRACKS[current.id].name : null;
}
