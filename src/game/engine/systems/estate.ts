import { CITIES, CITY_MAP, isCityId, type CityId } from '@/game/data/cities';
import { COMPANY_MAP, isCompanyId } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { PROPERTIES, PROPERTY_MAP, isPropertyId, propertyYield, type PropertyDef } from '@/game/data/properties';
import type { GameState } from '@/types/state';
import type { EngineContext, Rng } from '../context';
import { createInitialEstate } from '../state/createInitialState';
import { creditRankDef } from './contracts';

/** 標準正規乱数（Box–Muller） */
export function randn(rng: Rng): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function isEstateUnlocked(state: GameState, assets: number): boolean {
  return state.unlocked['system:estate'] === true || assets >= CONFIG.estate.unlockAssets || Object.keys(state.estate?.owned ?? {}).length > 0;
}

/** 都市の地価倍率 */
export function cityMultiplier(state: GameState, cityId: string): number {
  return state.estate.cityMult[cityId] ?? 1;
}

/** 物件の現在価格（円） */
export function propertyPrice(state: GameState, id: string): number {
  if (!isPropertyId(id)) return 0;
  const def = PROPERTY_MAP[id];
  return def.price * cityMultiplier(state, def.city);
}

/** 物件の賃料（円/秒） */
export function propertyRentPerSec(state: GameState, id: string): number {
  if (!isPropertyId(id)) return 0;
  return (propertyPrice(state, id) * propertyYield(PROPERTY_MAP[id])) / 3600;
}

export type PropertyOwner = { type: 'player' } | { type: 'company'; companyId: string } | { type: 'market' };

export function propertyOwner(state: GameState, id: string): PropertyOwner {
  if (state.estate.owned[id]) return { type: 'player' };
  const c = state.estate.companyOwned[id];
  if (c) return { type: 'company', companyId: c };
  return { type: 'market' };
}

/** 会社が持っている物件のID */
export function companyProperties(state: GameState, companyId: string): string[] {
  return Object.entries(state.estate.companyOwned)
    .filter(([, c]) => c === companyId)
    .map(([p]) => p);
}

/** プレイヤーの不動産の評価額（円） */
export function estateValue(state: GameState): number {
  let v = 0;
  for (const id of Object.keys(state.estate.owned)) v += propertyPrice(state, id);
  return v;
}

/** プレイヤーの賃料収入（円/秒） */
export function rentPerSec(state: GameState): number {
  let r = 0;
  for (const id of Object.keys(state.estate.owned)) r += propertyRentPerSec(state, id);
  return r;
}

/** 不動産の売買手数料（信用ランクで下がる） */
export function estateFee(state: GameState): number {
  return creditRankDef(state).estateFee;
}

/** 購入の合計額（手数料込み） */
export function propertyBuyCost(state: GameState, id: string): number {
  return Math.ceil(propertyPrice(state, id) * (1 + estateFee(state)));
}

/** 売却で受け取る額（手数料引き） */
export function propertySellProceeds(state: GameState, id: string): number {
  return Math.floor(propertyPrice(state, id) * (1 - estateFee(state)));
}

/** 地価を1回動かす（都市ごとのランダムウォーク） */
function stepCityPrices(ctx: EngineContext, seconds: number): void {
  const { state, rng } = ctx;
  const dtH = seconds / 3600;
  const sq = Math.sqrt(dtH);
  for (const c of CITIES) {
    const cur = state.estate.cityMult[c.id] ?? 1;
    const drift = (c.trend - (c.volatility * c.volatility) / 2) * dtH;
    const noise = c.volatility * sq * randn(rng);
    const next = cur * Math.exp(drift + noise);
    state.estate.cityMult[c.id] = Math.min(CONFIG.estate.maxMult, Math.max(CONFIG.estate.minMult, next));
  }
}

/** 都市の地価を即時に動かす（イベント用） */
export function shiftCityPrice(state: GameState, cityId: string, factor: number): void {
  if (!isCityId(cityId)) return;
  const cur = state.estate.cityMult[cityId] ?? 1;
  state.estate.cityMult[cityId] = Math.min(CONFIG.estate.maxMult, Math.max(CONFIG.estate.minMult, cur * factor));
}

/** 賃料の受け取りと地価の変動 */
export function runEstate(ctx: EngineContext, dt: number): { rent: number } {
  const { state, derived } = ctx;
  if (!state.estate) state.estate = createInitialEstate();
  const perSec = rentPerSec(state);
  const rent = perSec * dt;
  if (rent > 0) {
    state.company.cash += rent;
    state.company.totalEarned += rent;
    state.stats.rentEarned += rent;
  }
  state.estate.nextUpdateIn -= dt;
  let guard = 0;
  while (state.estate.nextUpdateIn <= 0 && guard++ < 1000) {
    stepCityPrices(ctx, CONFIG.estate.updateSeconds);
    state.estate.nextUpdateIn += CONFIG.estate.updateSeconds;
  }
  derived.rentPerSec = perSec;
  derived.estateValue = estateValue(state);
  const countries = new Set<string>();
  for (const id of Object.keys(state.estate.owned)) {
    if (isPropertyId(id)) countries.add(CITY_MAP[PROPERTY_MAP[id].city].country);
  }
  derived.estateCountries = countries.size;
  return { rent };
}

/** 物件を買う */
export function buyProperty(ctx: EngineContext, id: string): boolean {
  const { state, derived } = ctx;
  if (!isPropertyId(id)) return false;
  if (!isEstateUnlocked(state, derived.assets)) return false;
  if (propertyOwner(state, id).type !== 'market') return false;
  const cost = propertyBuyCost(state, id);
  if (state.company.cash + 1e-9 < cost) return false;
  state.company.cash -= cost;
  state.company.totalSpent += cost;
  state.estate.owned[id] = { boughtAt: ctx.now(), boughtPrice: cost };
  state.stats.propertiesBought += 1;
  const def = PROPERTY_MAP[id];
  ctx.emit('success', `${def.name}を購入しました (-${cost.toLocaleString('ja-JP')}円)`, { toast: true });
  return true;
}

/** 物件を売る。受け取った額を返す */
export function sellProperty(ctx: EngineContext, id: string): number {
  const { state } = ctx;
  if (!state.estate.owned[id]) return 0;
  const proceeds = propertySellProceeds(state, id);
  const bought = state.estate.owned[id].boughtPrice;
  delete state.estate.owned[id];
  state.company.cash += proceeds;
  state.company.totalEarned += proceeds;
  state.stats.propertiesSold += 1;
  state.stats.tradingProfit += proceeds - bought;
  const def = isPropertyId(id) ? PROPERTY_MAP[id] : null;
  const diff = proceeds - bought;
  ctx.emit('info', `${def?.name ?? id}を売却しました (+${proceeds.toLocaleString('ja-JP')}円、${diff >= 0 ? '利益' : '損失'} ${Math.abs(Math.round(diff)).toLocaleString('ja-JP')}円)`, { toast: true });
  return proceeds;
}

/** 都市ごとの物件（表示用） */
export function propertiesInCity(cityId: CityId): PropertyDef[] {
  return (PROPERTIES as readonly PropertyDef[]).filter((p) => p.city === cityId);
}

/** 所有者の表示名 */
export function ownerLabel(state: GameState, id: string): string {
  const o = propertyOwner(state, id);
  if (o.type === 'player') return '所有中';
  if (o.type === 'company') return isCompanyId(o.companyId) ? `${COMPANY_MAP[o.companyId].name}が所有` : '他社所有';
  return '売り出し中';
}

export function cityName(cityId: string): string {
  return isCityId(cityId) ? CITY_MAP[cityId].name : cityId;
}
