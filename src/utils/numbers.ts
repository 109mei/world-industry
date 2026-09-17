/**
 * 数字があふれないようにするための道具。
 *
 * このゲームは放っておくと桁がどんどん増えるので、
 * どこか一か所でも NaN や Infinity になると、そこから先が全部壊れてしまう。
 * 増える値はすべてここを通して、上限で止めるようにしている。
 */

/**
 * 扱える最大値（1那由他＝1e60）。
 * JavaScript の数値は 1e308 くらいまで持つが、
 * 足し算を繰り返すと精度が落ちるので、表示できる範囲で手前に壁を作る。
 */
export const MAX_VALUE = 1e60;

/** NaN・Infinity を取り除き、上限・下限で止める */
export function safe(n: number, min = -MAX_VALUE, max = MAX_VALUE): number {
  if (!Number.isFinite(n)) {
    // NaN は 0、+Infinity は上限、-Infinity は下限として扱う
    if (Number.isNaN(n)) return 0;
    return n > 0 ? max : min;
  }
  if (n > max) return max;
  if (n < min) return min;
  return n;
}

/** 0 以上に丸めた安全な値（所持数・在庫など） */
export function safePositive(n: number, max = MAX_VALUE): number {
  return safe(n, 0, max);
}

/** 上限に張り付いているか（表示で「これ以上増えません」と出すため） */
export function isAtLimit(n: number): boolean {
  return Math.abs(n) >= MAX_VALUE * 0.999;
}
