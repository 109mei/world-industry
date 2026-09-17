import { businessStaffTotal } from './business';
import { CONFIG } from '@/game/data/config';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { TOOL_MAP, type ToolId } from '@/game/data/tools';
import type { EngineContext } from '../context';
import { currentPrice } from './market';

/** 総資産・会社価値・従業員数などを計算する */
export function runCompanyMetrics(ctx: EngineContext): void {
  const { state, derived } = ctx;
  let inventoryValue = 0;
  for (const [id, amount] of Object.entries(state.inventory) as [ResourceId, number][]) {
    if (!amount || !RESOURCE_MAP[id]) continue;
    inventoryValue += amount * currentPrice(state, id);
  }
  // 土地の在庫も評価に含める
  for (const land of state.lands) {
    for (const [id, amount] of Object.entries(land.stock ?? {}) as [ResourceId, number][]) {
      if (!amount || !RESOURCE_MAP[id]) continue;
      inventoryValue += amount * currentPrice(state, id);
    }
  }
  let toolsValue = 0;
  for (const [id, stack] of Object.entries(state.tools) as [ToolId, { count: number; durability: number }][]) {
    if (!stack || !TOOL_MAP[id]) continue;
    toolsValue += stack.count * TOOL_MAP[id].durability * 2;
  }
  let employees = 0;
  for (const f of state.facilities) {
    if (!isFacilityId(f.typeId)) continue;
    employees += FACILITY_MAP[f.typeId].employees * f.count;
  }
  derived.inventoryValue = inventoryValue;
  derived.employees = employees + businessStaffTotal(state);
  derived.assets =
    state.company.cash +
    inventoryValue +
    toolsValue +
    state.company.facilityInvestment * CONFIG.facilityValueRatio +
    state.company.landInvestment * CONFIG.landValueRatio +
    derived.estateValue +
    derived.stockValue;
  // 会社価値 = 総資産 + 収益力（1時間分の自動収入）
  derived.companyValue = derived.assets + Math.max(0, derived.incomePerSec) * 3600;
}
