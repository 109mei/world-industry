import { CONFIG } from '@/game/data/config';
import { FACILITY_MAP, isFacilityId, type FacilityDef } from '@/game/data/facilities';
import { HQ_LAND_ID, HQ_POPULATION, LAND_MAP, isLandDefId } from '@/game/data/lands';
import type { ResourceId } from '@/game/data/resources';
import { SURVEY_EXTRACT_BONUS, SURVEY_LEVEL_TO_BUILD } from '@/game/data/survey';
import type { FacilityInstance, GameState, LandState, Modifiers } from '@/types/state';

export function isHq(landId: string): boolean {
  return landId === HQ_LAND_ID;
}

export function getLand(state: GameState, landId: string): LandState | undefined {
  return state.lands.find((l) => l.id === landId);
}

export function ownedLands(state: GameState): LandState[] {
  return state.lands.filter((l) => l.id !== HQ_LAND_ID);
}

/** 土地の人口係数（商業施設の収益に掛かる） */
export function landPopulation(land: LandState): number {
  if (isHq(land.id)) return HQ_POPULATION;
  return isLandDefId(land.id) ? LAND_MAP[land.id].population : 0.5;
}

/** 資源の在庫置き場。本社は state.inventory、土地はその土地の stock */
export function stockOf(state: GameState, land: LandState): Partial<Record<ResourceId, number>> {
  return isHq(land.id) ? state.inventory : land.stock;
}

export function facilitiesOn(state: GameState, landId: string): FacilityInstance[] {
  return state.facilities.filter((f) => f.landId === landId);
}

/** 土地ごとの倉庫容量 */
export function landCapacity(state: GameState, land: LandState, mods: Modifiers): number {
  let cap = isHq(land.id) ? CONFIG.baseStorage : CONFIG.landBaseStorage;
  for (const f of state.facilities) {
    if (f.landId !== land.id || !isFacilityId(f.typeId)) continue;
    const def = FACILITY_MAP[f.typeId];
    if (def.storageBonus) cap += def.storageBonus * f.count;
  }
  return Math.floor(cap * mods.storage);
}

/** 地形による効率倍率 */
export function terrainMultiplier(def: FacilityDef, land: LandState): number {
  return def.terrainBonus?.[land.terrain] ?? 1;
}

/** 試掘済み以上の土地の採掘ボーナス */
export function surveyMultiplier(def: FacilityDef, land: LandState): number {
  if (def.extractsDeposit && land.survey >= 3) return 1 + SURVEY_EXTRACT_BONUS;
  return 1;
}

export type BuildCheck = { ok: true } | { ok: false; reason: string };

/** その土地に建てられるか（解放条件は別で判定する） */
export function canBuildOn(def: FacilityDef, land: LandState): BuildCheck {
  const hq = isHq(land.id);
  if (def.site === 'hq' && !hq) return { ok: false, reason: '本社にしか建てられません' };
  if (def.site === 'land' && hq) return { ok: false, reason: '購入した土地にしか建てられません' };
  if (def.allowedTerrain && !def.allowedTerrain.includes(land.terrain)) {
    return { ok: false, reason: `建てられる地形: ${def.allowedTerrain.join('・')}` };
  }
  if (def.extractsDeposit) {
    const outputs = Object.keys(def.production?.outputs ?? {}) as ResourceId[];
    const has = outputs.some((r) => (land.deposits[r]?.total ?? 0) > 0);
    if (land.survey < SURVEY_LEVEL_TO_BUILD) return { ok: false, reason: '地質調査が必要です' };
    if (!has) return { ok: false, reason: 'この土地に鉱脈がありません' };
  }
  if (def.income !== undefined && landPopulation(land) <= 0) return { ok: false, reason: '人口がありません' };
  return { ok: true };
}

export function isLiquid(id: ResourceId): boolean {
  return (CONFIG.liquidResources as readonly string[]).includes(id);
}
