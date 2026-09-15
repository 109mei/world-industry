import type { NumberFormatMode } from '@/types/state';

const SHORT_UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

function fix(n: number): number {
  return Math.abs(n) < 1e-9 ? 0 : n;
}

/** 大きな数を 12.4K / 2.81M のように短く表す */
export function formatShort(value: number, maxDecimals = 2): string {
  const n = fix(value);
  const abs = Math.abs(n);
  if (abs < 1000) {
    return Number.isInteger(n) ? n.toLocaleString('ja-JP') : n.toFixed(abs < 10 ? 1 : 0);
  }
  let unit = 0;
  let v = abs;
  while (v >= 1000 && unit < SHORT_UNITS.length - 1) {
    v /= 1000;
    unit++;
  }
  const decimals = v >= 100 ? 0 : v >= 10 ? 1 : maxDecimals;
  return `${n < 0 ? '-' : ''}${v.toFixed(decimals)}${SHORT_UNITS[unit]}`;
}

export function formatFull(value: number): string {
  const n = fix(value);
  if (Number.isInteger(n)) return n.toLocaleString('ja-JP');
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 1 });
}

/** 所持数など。整数部分だけを表示する */
export function formatAmount(value: number, mode: NumberFormatMode = 'short'): string {
  const n = Math.floor(fix(value) + 1e-9);
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
  if (mode === 'full') body = abs.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
  else if (Number.isInteger(abs)) body = abs.toLocaleString('ja-JP');
  else if (abs < 1000) body = abs < 10 ? abs.toFixed(2).replace(/\.?0+$/, '') || '0' : abs.toFixed(1);
  else body = formatShort(abs);
  return `${sign}${body}`;
}

export function formatMoney(value: number, mode: NumberFormatMode = 'short'): string {
  const n = fix(value);
  const body = mode === 'short' ? formatShort(Math.round(n)) : formatFull(Math.round(n));
  return `${body}円`;
}

export function formatMoneyRate(value: number, mode: NumberFormatMode = 'short'): string {
  return `${formatRate(value, mode)}円/秒`;
}

export function formatPercent(ratio: number, decimals = 0): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
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
