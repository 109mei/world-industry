/**
 * 画面の見やすさ（色の差）を数字で見張る。
 *
 * 切替タブの「いま選んでいるもの」が、暗い配色では溝との差が 1.10:1 しかなく
 * ほとんど見えなかった。目で見て決めると同じことがまた起きるので、
 * tokens.css に書いてある実際の値から比を計算して確かめる。
 *
 * 目安は WCAG の基準:
 *   文字            4.5:1 以上
 *   部品の輪郭・状態 3.0:1 以上
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(resolve(__dirname, '../../../styles/tokens.css'), 'utf8');

/** :root（暗い配色）と data-theme='light'（明るい配色）の変数を読み出す */
function palette(light: boolean): Record<string, string> {
  const start = light ? CSS.indexOf("[data-theme='light']") : 0;
  const end = light ? CSS.length : CSS.indexOf("[data-theme='light']");
  const block = CSS.slice(start, end);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{3,8})\s*;/g)) out[m[1]] = m[2];
  return out;
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** 2色の明るさの比（1〜21） */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** OKLab に変換する（色の隔たりを測るため） */
function oklab(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  const cbrt = (x: number) => (x > 0 ? Math.cbrt(x) : -Math.cbrt(-x));
  const l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** 2色の色の隔たり（OKLab の距離 ×100）。8 未満は見分けにくい */
export function deltaE(a: string, b: string): number {
  const A = oklab(a);
  const B = oklab(b);
  return 100 * Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

describe('色の差（コントラスト）', () => {
  it('比の計算が正しい（白と黒は21倍、同じ色は1倍）', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#5EA7FF', '#5EA7FF')).toBeCloseTo(1, 5);
  });

  for (const [name, light] of [['暗い配色', false], ['明るい配色', true]] as const) {
    describe(name, () => {
      const p = palette(light);

      it('切替タブの色が3つとも定義されている', () => {
        for (const k of ['seg-track', 'seg-on', 'seg-mark']) expect(p[k], k).toBeTruthy();
      });

      it('選んでいるタブの印が、溝からも面からもはっきり見える', () => {
        expect(contrast(p['seg-mark'], p['seg-track'])).toBeGreaterThanOrEqual(3);
        expect(contrast(p['seg-mark'], p['seg-on'])).toBeGreaterThanOrEqual(3);
      });

      it('タブの文字が読める', () => {
        // 選んでいるタブの文字
        expect(contrast(p['text'], p['seg-on'])).toBeGreaterThanOrEqual(4.5);
        // 選んでいないタブの文字
        expect(contrast(p['text-sub'], p['seg-track'])).toBeGreaterThanOrEqual(4.5);
      });

      it('本文と説明の文字が、カードの上で読める', () => {
        expect(contrast(p['text'], p['card'])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p['text-sub'], p['card'])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p['text'], p['bg'])).toBeGreaterThanOrEqual(4.5);
      });

      it('損益や警告の色が、カードの上で読める', () => {
        for (const k of ['profit', 'loss', 'warn', 'accent', 'research']) {
          expect(contrast(p[k], p['card']), k).toBeGreaterThanOrEqual(3);
        }
      });

      it('カードのレア度8段の文字が、カードの上で読める', () => {
        for (const k of ['rar-n', 'rar-r', 'rar-sr', 'rar-ssr', 'rar-ar', 'rar-sar', 'rar-ur', 'rar-lr']) {
          expect(contrast(p[k], p['card-2']), k).toBeGreaterThanOrEqual(3);
        }
      });

      /**
       * 色どうしの見分けは、明るさの比ではなく「色の隔たり」で見る。
       * 青と金のように明るさが近くても色味が違えば見分けられるので、
       * 明るさの比だけで判定すると正しい配色まで弾いてしまう。
       * ものさしは OKLab の距離（×100）。8 が下限、15 あれば十分。
       */
      it('図表の内訳の色が、たがいに見分けられる', () => {
        const series = ['series-1', 'series-2', 'series-3', 'series-other'].map((k) => p[k]);
        for (let i = 0; i < series.length; i++) {
          for (let j = i + 1; j < series.length; j++) {
            expect(deltaE(series[i], series[j]), `${i}-${j}`).toBeGreaterThanOrEqual(8);
          }
        }
      });

      /**
       * レア度は色だけでなく必ず N・SR などの文字も出しているので、
       * 下限は 8 でよい（色だけが手がかりなら 15 ほしい）。
       */
      it('レア度8段の色が、たがいに見分けられる', () => {
        const keys = ['rar-n', 'rar-r', 'rar-sr', 'rar-ssr', 'rar-ar', 'rar-sar', 'rar-ur', 'rar-lr'];
        for (let i = 0; i < keys.length; i++) {
          for (let j = i + 1; j < keys.length; j++) {
            expect(deltaE(p[keys[i]], p[keys[j]]), `${keys[i]}-${keys[j]}`).toBeGreaterThanOrEqual(8);
          }
        }
      });
    });
  }
});
