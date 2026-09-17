import { CONFIG } from '@/game/data/config';
import { HQ_LAND_ID, HQ_TERRAIN } from '@/game/data/lands';
import { GAME_META } from '@/game/data/meta';
import { RESOURCES, type ResourceDef, type ResourceId } from '@/game/data/resources';
import type { DerivedState, GameState, LandState } from '@/types/state';
import { createEmptyEventMods } from '../systems/events';
import { createBaseModifiers } from '../systems/modifiers';
import { createEmptyPower } from '../systems/power';

export function createHqLand(): LandState {
  return { id: HQ_LAND_ID, name: '本社', country: 'JP', region: '本社所在地', terrain: HQ_TERRAIN, purchasedAt: 0, survey: 4, surveyProgress: null, deposits: {}, stock: {} };
}

export function createInitialState(now = Date.now()): GameState {
  const discovered: GameState['discovered'] = {};
  for (const r of RESOURCES as readonly ResourceDef[]) {
    if (r.initialDiscovered) discovered[r.id as ResourceId] = true;
  }
  return {
    saveVersion: GAME_META.saveVersion,
    meta: { createdAt: now, lastSaveTime: now, lastTickTime: now },
    company: { name: 'マイカンパニー', cash: CONFIG.initialCash, totalEarned: 0, totalSpent: 0, facilityInvestment: 0, landInvestment: 0 },
    inventory: {},
    discovered,
    tools: {},
    facilities: [],
    lands: [createHqLand()],
    market: { prices: {}, autoSell: {}, nextUpdateIn: CONFIG.marketUpdateSeconds },
    stats: {
      taps: 0,
      totalObtained: {},
      totalGathered: {},
      totalProduced: {},
      totalSold: {},
      crafted: {},
      toolsCrafted: {},
      toolsBroken: 0,
      playtimeSeconds: 0,
      totalTransported: 0,
      totalGeneratedMWh: 0,
      totalCommercialIncome: 0,
      totalTransportCost: 0,
      eventsOccurred: 0,
      disasters: 0,
    },
    unlocked: {},
    achievements: {},
    tutorial: { step: 0, completed: false },
    research: { completed: {}, points: 0, totalPoints: 0 },
    events: { active: [], nextIn: CONFIG.events.firstDelaySeconds, nextId: 1 },
    eventLog: [],
    nextEventId: 1,
    settings: {
      numberFormat: 'short',
      autosaveSeconds: CONFIG.autosaveSeconds,
      maxOfflineSeconds: CONFIG.defaultMaxOfflineSeconds,
      showTutorial: true,
      sound: true,
      volume: 0.6,
      events: true,
      landView: 'map',
    },
  };
}

export function createEmptyDerived(): DerivedState {
  return {
    eventMods: createEmptyEventMods(),
    production: {},
    consumption: {},
    capacity: CONFIG.baseStorage,
    facilityRuntime: {},
    incomePerSec: 0,
    incomeBuckets: new Array<number>(10).fill(0),
    incomeBucketElapsed: 0,
    assets: 0,
    companyValue: 0,
    employees: 0,
    inventoryValue: 0,
    power: createEmptyPower(),
    lands: {},
    modifiers: createBaseModifiers(),
    commercialIncome: 0,
    transportCost: 0,
    researchRate: 0,
  };
}
