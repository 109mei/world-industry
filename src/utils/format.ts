import type { NumberFormatMode } from '@/types/state';
import { currencyOf, type CurrencyDef } from '@/game/data/currencies';
import { MAX_VALUE, safe } from './numbers';

/** 単位の付け方。日本式（万・億）か、英語式（K・M）か、付けないか */
export type UnitStyle = 'ja' | 'western' | 'none';

/** 日本語の単位（1万 = 10^4 ごとに繰り上げ）。無量大数まで用意して桁あふれを防ぐ */
const JA_UNITS = ['', '万', '億', '兆', '京', '垓', '𥝱', '穣', '溝', '澗', '正', '載', '極', '恒河沙', '阿僧祇', '那由他'];
/** 英語式の単位（1,000 ごとに繰り上げ） */
const WESTERN_UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid'];

/** 表示の設定（設定画面から差し替える）。計算はすべて円のままで、ここは見た目だけ */
let display: { currency: CurrencyDef; unitStyle: UnitStyle } = { currency: currencyOf('jpy'), unitStyle: 'ja' };

export function setNumberDisplay(next: { currencyId?: string; unitStyle?: UnitStyle }): void {
  if (next.currencyId !== undefined) display = { ...display, currency: currencyOf(next.currencyId) };
  if (next.unitStyle !== undefined) display = { ...display, unitStyle: next.unitStyle };
}

export function currentCurrency(): CurrencyDef {
  return display.currency;
}

function fix(n: number): number {
  const v = safe(n);
  return Math.abs(v) < 1e-9 ? 0 : v;
}

/** 単位でも表しきれないほど大きい数（10^64 以上）を 1.2e64 のように出す */
function exponential(n: number): string {
  return n.toExponential(2).replace('e+', 'e');
}

function withUnits(abs: number, units: readonly string[], step: number, maxDecimals: number): string | null {
  let unit = 0;
  let v = abs;
  while (v >= step && unit < units.length - 1) {
    v /= step;
    unit++;
  }
  if (v >= step) return null; // 単位を使い切った（桁が大きすぎる）
  const decimals = v >= 100 ? 0 : v >= 10 ? 1 : maxDecimals;
  const body = decimals === 0 ? Math.round(v).toLocaleString('en-US') : v.toFixed(decimals).replace(/\.?0+$/, '');
  return `${body}${units[unit]}`;
}

/** 大きな数を 1.23万 / 2.81億 / 1.23M のように短く表す */
export function formatShort(value: number, maxDecimals = 2): string {
  const n = fix(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const style = display.unitStyle;
  if (style === 'none') return formatFull(n);
  const threshold = style === 'ja' ? 10_000 : 1_000;
  if (abs < threshold) {
    return Number.isInteger(n) ? n.toLocaleString('ja-JP') : n.toFixed(abs < 10 ? 1 : 0);
  }
  const body = style === 'ja' ? withUnits(abs, JA_UNITS, 10_000, maxDecimals) : withUnits(abs, WESTERN_UNITS, 1_000, maxDecimals);
  if (body === null) return `${sign}${exponential(abs)}`;
  return `${sign}${body}`;
}

export function formatFull(value: number): string {
  const n = fix(value);
  // 桁が多すぎると読めないうえにブラウザも重くなるので、途中から指数表記にする
  if (Math.abs(n) >= 1e21) return exponential(n);
  if (Number.isInteger(n)) return n.toLocaleString('ja-JP');
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 1 });
}

/** 所持数など。整数部分だけを表示する */
export function formatAmount(value: number, mode: NumberFormatMode = 'short'): string {
  const v = fix(value);
  const n = Math.abs(v) >= 1e15 ? v : Math.floor(v + 1e-9);
  return mode === 'short' ? formatShort(n) : formatFull(n);
}

export function formatNumber(value: number, mode: NumberFormatMode = 'short'): string {
  return mode === 'short' ? formatShort(value) : formatFull(value);
}

/** 毎秒の変化量。+12.4 のように符号付き */
export function formatRate(value: number, mode: NumberFormatMode = 'short'): string {
  const n = fix(value);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n);
  let body: string;
  if (mode === 'full') body = formatFull(abs);
  else if (abs >= (display.unitStyle === 'ja' ? 10_000 : 1_000)) body = formatShort(abs);
  // 1,000 を超えたら小数点以下は読む意味がないので、桁区切りの整数にする（4618.9 ではなく 4,619）
  else if (abs >= 1_000) body = Math.round(abs).toLocaleString('ja-JP');
  else if (Number.isInteger(abs)) body = abs.toLocaleString('ja-JP');
  else body = abs < 10 ? abs.toFixed(2).replace(/\.?0+$/, '') || '0' : abs.toFixed(1);
  return `${sign}${body}`;
}

/** 金額に通貨の記号を付ける。中身の計算は円のままで、ここで表示だけ換算する */
function money(body: string, negative: boolean): string {
  const c = display.currency;
  return c.prefix ? `${negative ? '-' : ''}${c.symbol}${body}` : `${negative ? '-' : ''}${body}${c.symbol}`;
}

export function formatMoney(value: number, mode: NumberFormatMode = 'short'): string {
  const n = fix(value) * display.currency.rate;
  const abs = Math.abs(n);
  const rounded = abs >= 1e15 ? abs : Math.round(abs);
  const body = mode === 'short' ? formatShort(rounded) : formatFull(rounded);
  return money(body, n < 0);
}

export function formatMoneyRate(value: number, mode: NumberFormatMode = 'short'): string {
  const n = fix(value) * display.currency.rate;
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n);
  // ここでは符号を自分で付けるので、本体は符号なしで整える
  const body = mode === 'full' ? formatFull(abs) : abs >= (display.unitStyle === 'ja' ? 10_000 : 1_000) ? formatShort(abs) : Number.isInteger(abs) ? abs.toLocaleString('ja-JP') : abs < 10 ? abs.toFixed(2).replace(/\.?0+$/, '') || '0' : abs.toFixed(1);
  const c = display.currency;
  const amount = c.prefix ? `${c.symbol}${body}` : `${body}${c.symbol}`;
  return `${sign}${amount}/秒`;
}

export function formatPercent(ratio: number, decimals = 0): string {
  const r = safe(ratio);
  if (Math.abs(r) >= 1e9) return '>10億%';
  return `${(r * 100).toFixed(decimals)}%`;
}

export function formatDuration(seconds: number): string {
  const v = safe(seconds, 0, MAX_VALUE);
  if (v >= 315_360_000) return '100年以上';
  const s = Math.max(0, Math.floor(v));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}日${h}時間`;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${sec}秒`;
  return `${sec}秒`;
}

export function formatClock(time: number): string {
  const d = new Date(time);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
