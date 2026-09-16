import { CONFIG } from '@/game/data/config';
import { GAME_META } from '@/game/data/meta';
import { RESOURCES, type ResourceDef, type ResourceId } from '@/game/data/resources';
import type { DerivedState, GameState } from '@/types/state';

export function createInitialState(now = Date.now()): GameState {
  const discovered: GameState['discovered'] = {};
  for (const r of RESOURCES as readonly ResourceDef[]) {
    if (r.initialDiscovered) discovered[r.id as ResourceId] = true;
  }
  return {
    saveVersion: GAME_META.saveVersion,
    meta: { createdAt: now, lastSaveTime: now, lastTickTime: now },
    company: { name: 'マイカンパニー', cash: CONFIG.initialCash, totalEarned: 0, totalSpent: 0, facilityInvestment: 0 },
    inventory: {},
    discovered,
    tools: {},
    facilities: [],
    lands: [{ id: 'hq', name: '本社', country: 'JP', region: '未設定' }],
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
    },
    unlocked: {},
    achievements: {},
    tutorial: { step: 0, completed: false },
    research: { completed: {} },
    eventLog: [],
    nextEventId: 1,
    settings: {
      numberFormat: 'short',
      autosaveSeconds: CONFIG.autosaveSeconds,
      maxOfflineSeconds: CONFIG.defaultMaxOfflineSeconds,
      showTutorial: true,
    },
  };
}

export function createEmptyDerived(): DerivedState {
  return {
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
  };
}
