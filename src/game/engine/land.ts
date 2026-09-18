import { CONFIG } from '@/game/data/config';
import { FACILITY_MAP, isFacilityId, type FacilityDef } from '@/game/data/facilities';
import { HQ_LAND_ID, HQ_POPULATION, LAND_MAP, isLandDefId } from '@/game/data/lands';
import { landPropertyId, propertyPopulation } from './systems/estate';
import type { ResourceId } from '@/game/data/resources';
import { SURVEY_EXTRACT_BONUS, SURVEY_LEVEL_TO_BUILD } from '@/game/data/survey';
import type { FacilityInstance, GameState, LandState, Modifiers } from '@/types/state';

export function isHq(landId: string): boolean {
  return landId === HQ_LAND_ID;
}

/**
 * 土地と施設の索引。
 *
 * 土地も施設も数百まで増えるので、毎 tick に何十回も端から探していると重くなる。
 * 配列そのものと長さが変わったときだけ作り直して使いまわす。
 * （土地・施設が増えるのは push、減るのは filter による作り直しなので、この2つで見分けられる）
 */
let landIndex: { src: LandState[]; len: number; map: Map<string, LandState> } | null = null;
let facilityIndex: { src: FacilityInstance[]; len: number; map: Map<string, FacilityInstance[]> } | null = null;

function landMap(state: GameState): Map<string, LandState> {
  if (landIndex && landIndex.src === state.lands && landIndex.len === state.lands.length) return landIndex.map;
  const map = new Map<string, LandState>();
  for (const l of state.lands) map.set(l.id, l);
  landIndex = { src: state.lands, len: state.lands.length, map };
  return map;
}

function facilityMap(state: GameState): Map<string, FacilityInstance[]> {
  if (facilityIndex && facilityIndex.src === state.facilities && facilityIndex.len === state.facilities.length) return facilityIndex.map;
  const map = new Map<string, FacilityInstance[]>();
  for (const f of state.facilities) {
    const list = map.get(f.landId);
    if (list) list.push(f);
    else map.set(f.landId, [f]);
  }
  facilityIndex = { src: state.facilities, len: state.facilities.length, map };
  return map;
}

/** 索引を捨てる（会社を作り直したときなど） */
export function resetLandIndex(): void {
  landIndex = null;
  facilityIndex = null;
}

export function getLand(state: GameState, landId: string): LandState | undefined {
  return landMap(state).get(landId);
}

export function ownedLands(state: GameState): LandState[] {
  return state.lands.filter((l) => l.id !== HQ_LAND_ID);
}

/** 土地の人口係数（商業施設の収益に掛かる） */
export function landPopulation(land: LandState): number {
  if (typeof land.population === 'number') return land.population;
  if (isHq(land.id)) return HQ_POPULATION;
  if (isLandDefId(land.id)) return LAND_MAP[land.id].population;
  const propertyId = landPropertyId(land.id);
  return propertyId ? propertyPopulation(propertyId) : 0.5;
}

/** 資源の在庫置き場。本社は state.inventory、土地はその土地の stock */
export function stockOf(state: GameState, land: LandState): Partial<Record<ResourceId, number>> {
  return isHq(land.id) ? state.inventory : land.stock;
}

const NO_FACILITIES: FacilityInstance[] = [];

export function facilitiesOn(state: GameState, landId: string): FacilityInstance[] {
  return facilityMap(state).get(landId) ?? NO_FACILITIES;
}

/** 土地ごとの倉庫容量 */
export function landCapacity(state: GameState, land: LandState, mods: Modifiers): number {
  let cap = isHq(land.id) ? CONFIG.baseStorage : CONFIG.landBaseStorage;
  for (const f of facilitiesOn(state, land.id)) {
    if (!isFacilityId(f.typeId)) continue;
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
/** 本社には建てられないカテゴリ（地図で買った土地に建てる） */
export const LAND_ONLY_CATEGORIES = ['POWER', 'COMMERCIAL', 'RESEARCH', 'LOGISTICS'] as const;

export function canBuildOn(def: FacilityDef, land: LandState): BuildCheck {
  const hq = isHq(land.id);
  if (def.site === 'hq' && !hq) return { ok: false, reason: '本社にしか建てられません' };
  if (def.site === 'land' && hq) return { ok: false, reason: '購入した土地にしか建てられません' };
  if (hq && (LAND_ONLY_CATEGORIES as readonly string[]).includes(def.category)) {
    return { ok: false, reason: '地図で買った土地に建てられます' };
  }
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
