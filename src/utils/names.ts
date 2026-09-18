import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { RECIPE_MAP, isRecipeId } from '@/game/data/recipes';
import { RESOURCE_MAP, isResourceId } from '@/game/data/resources';
import { TOOL_MAP, isToolId } from '@/game/data/tools';
import type { ConditionNames } from '@/game/engine/systems/unlocks';
import { formatAmount, formatMoney } from './format';

/** 解放条件の表示に使う名前解決 */
export const NAMES: ConditionNames = {
  resource: (id) => (isResourceId(id) ? RESOURCE_MAP[id].name : id),
  tool: (id) => (isToolId(id) ? TOOL_MAP[id].name : id),
  recipe: (id) => (isRecipeId(id) ? RECIPE_MAP[id].name : id),
  facility: (id) => (isFacilityId(id) ? FACILITY_MAP[id].name : id),
  quantity: (id, n) => formatQty(id, n, 'full'),
};

export function formatMW(mw: number): string {
  if (mw >= 1000) return `${(mw / 1000).toFixed(mw >= 10000 ? 0 : 2)}GW`;
  return `${mw.toFixed(mw >= 100 ? 0 : 1)}MW`;
}

/**
 * 資源の単位（kg / g / L / 個）。
 * 「1個ぶん」が現実の何にあたるかを画面に出すためのもの。
 * 「木を1」では何なのか分からないが、「木を1kg」なら手に持った重さが分かる。
 */
export function unitOf(id: string): 'kg' | 'g' | 'L' | '個' {
  return (isResourceId(id) ? RESOURCE_MAP[id].unit : undefined) ?? '個';
}

/**
 * 数量を単位つきで表示する。
 * kg は 1,000 を超えたら t に、L は 1,000 を超えたら kL に繰り上げる。
 * g は 1,000 を超えたら kg に繰り上げる。
 */
export function formatQty(id: string, value: number, mode: 'short' | 'full' = 'short'): string {
  const unit = unitOf(id);
  if (!Number.isFinite(value)) return `—${unit === '個' ? '個' : unit}`;
  const abs = Math.abs(value);
  // 1に満たない量は切り捨てると「0kg」になってしまう。実際には入っているので小数で出す
  if (abs > 0 && abs < 1) return `${trim(value.toFixed(1))}${unit}`;
  if (unit === 'kg' && abs >= 1_000) return `${bigger(value / 1000, mode)}t`;
  if (unit === 'L' && abs >= 1_000) return `${bigger(value / 1000, mode)}kL`;
  if (unit === 'g' && abs >= 1_000) return `${bigger(value / 1000, mode)}kg`;
  return `${formatAmount(value, mode)}${unit}`;
}

/** 末尾の「.0」を落とす */
function trim(s: string): string {
  return s.replace(/\.0$/, '');
}

/**
 * 繰り上げたあとの数。
 * ここで切り捨てると 2,500kg が「2t」になって2割ずれる。
 * 100 未満のあいだは小数第1位まで出す。
 */
function bigger(value: number, mode: 'short' | 'full'): string {
  if (Math.abs(value) < 100) return trim(value.toFixed(1));
  return formatAmount(value, mode);
}

/** 毎秒の量。+60kg/秒 のように単位つきで出す */
export function formatQtyRate(id: string, perSec: number, mode: 'short' | 'full' = 'short'): string {
  const sign = perSec > 0 ? '+' : perSec < 0 ? '-' : '';
  return `${sign}${formatQty(id, Math.abs(perSec), mode)}`;
}

/** 単価の表示。「95円/kg」「18,000円/g」「2,500円/個」 */
export function formatUnitPrice(id: string, price: number, mode: 'short' | 'full' = 'short'): string {
  return `${formatMoney(price, mode)}/${unitOf(id)}`;
}

/**
 * 倉庫の容量。資源1種につき何入るかを表す共通の数で、資源ごとの単位を持たない。
 * 中身のほとんどは重さで数えるものなので t で見せ、
 * 個で数えるものもあることは添え書き（capacityNote）で断る。
 */
export function formatCapacity(value: number, mode: 'short' | 'full' = 'short'): string {
  if (Math.abs(value) >= 1_000) return `${formatAmount(value / 1000, mode)}t`;
  return `${formatAmount(value, mode)}kg`;
}

/** 倉庫容量の添え書き。t で見せている数が、個で数えるものでは何個にあたるかを断る */
export function capacityNote(value: number, mode: 'short' | 'full' = 'short'): string {
  return `資源1種あたり（個で数えるものは ${formatAmount(value, mode)}個）`;
}
