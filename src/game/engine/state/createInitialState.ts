import { CITIES } from '@/game/data/cities';
import { COMPANIES } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { createInitialSales } from '../systems/sales';
import { HQ_LAND_ID, HQ_TERRAIN } from '@/game/data/lands';
import { GAME_META } from '@/game/data/meta';
import { RESOURCES, type ResourceDef, type ResourceId } from '@/game/data/resources';
import type { AutomationState, BusinessState, CompanyStockState, ContractsState, DerivedState, EstateState, GameState, LandState, PrestigeState, StocksState } from '@/types/state';
import { createEmptyEventMods } from '../systems/events';
import { createBaseModifiers } from '../systems/modifiers';
import { createEmptyPower } from '../systems/power';

export function createHqLand(): LandState {
  return { id: HQ_LAND_ID, name: '本社', country: 'JP', region: '本社所在地', terrain: HQ_TERRAIN, purchasedAt: 0, survey: 4, surveyProgress: null, deposits: {}, stock: {} };
}

export function createInitialEstate(): EstateState {
  const cityMult: Record<string, number> = {};
  for (const c of CITIES) cityMult[c.id] = 1;
  const companyOwned: Record<string, string> = {};
  for (const c of COMPANIES) for (const p of c.properties) companyOwned[p] = c.id;
  return { owned: {}, custom: {}, cityMult, companyOwned, nextUpdateIn: CONFIG.estate.updateSeconds };
}

export function createInitialCompanyStock(): CompanyStockState {
  return { sentiment: 1, playerShares: 0, avgCost: 0, growth: 1, cash: 0, policy: 'balanced', expansions: 0, dissolved: false, history: [], extraShares: 0 };
}

export function createInitialStocks(): StocksState {
  const companies: Record<string, CompanyStockState> = {};
  for (const c of COMPANIES) companies[c.id] = createInitialCompanyStock();
  return { companies, nextUpdateIn: CONFIG.stocks.updateSeconds, rivalIn: CONFIG.rivals.buyIntervalSeconds, issueIn: CONFIG.rivals.issueIntervalSeconds };
}


export function createInitialContracts(): ContractsState {
  return { active: [], nextIn: CONFIG.contracts.firstDelaySeconds, nextId: 1, credit: 0 };
}

export function createInitialPrestige(): PrestigeState {
  return { count: 0, points: 0, history: [] };
}

export function createInitialBusiness(): BusinessState {
  return { divisions: [], nextId: 1 };
}

export function createInitialAutomation(): AutomationState {
  return { on: {}, recipes: [], gathers: [], timers: {} };
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
      rentEarned: 0,
      dividendsEarned: 0,
      propertiesBought: 0,
      propertiesSold: 0,
      tradingProfit: 0,
      companiesAcquired: 0,
      companiesDissolved: 0,
      contractsCompleted: 0,
      contractsFailed: 0,
      contractRewards: 0,
      bestSale: null,
    },
    unlocked: {},
    achievements: {},
    tutorial: { step: 0, completed: false },
    research: { completed: {}, points: 0, totalPoints: 0 },
    events: { active: [], nextIn: CONFIG.events.firstDelaySeconds, nextId: 1 },
    estate: createInitialEstate(),
    stocks: createInitialStocks(),
    contracts: createInitialContracts(),
    sales: createInitialSales(),
    prestige: createInitialPrestige(),
    automation: createInitialAutomation(),
    business: createInitialBusiness(),
    power: { contractMW: 0 },
    bookmarks: [],
    skills: {},
    calendar: { elapsedDays: 0, lastMonth: 4, lastSeason: 'spring' },
    history: { assets: [], income: [], employees: [], nextIn: 0 },
    eventLog: [],
    nextEventId: 1,
    settings: {
      numberFormat: 'short',
      theme: 'dark',
      autosaveSeconds: CONFIG.autosaveSeconds,
      maxOfflineSeconds: CONFIG.defaultMaxOfflineSeconds,
      showTutorial: true,
      sound: true,
      volume: 0.6,
      // BGM は既定では鳴らさない（設定から「曲を流す」で入れられる）
      music: false,
      musicVolume: 0.45,
      events: true,
      landView: 'map',
      factoryOnlyBuildable: false,
      craftOnlyMakeable: false,
      estateView: 'map',
      currency: 'jpy',
      unitStyle: 'ja',
      hqLocation: null,
      hqChosen: false,
      themeChosen: false,
      nameChosen: false,
      map3D: false,
      guidesSeen: [],
      guidesOff: false,
      mute: false,
      reduceMotion: false,
      fontScale: 'normal',
      keepAwake: false,
      haptics: true,
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
    extraIncome: 0,
    assets: 0,
    companyValue: 0,
    employees: 0,
    inventoryValue: 0,
    powerCost: 0,
    power: createEmptyPower(),
    lands: {},
    modifiers: createBaseModifiers(),
    commercialIncome: 0,
    transportCost: 0,
    wageCost: 0,
    businessIncome: 0,
    adCost: 0,
    researchRate: 0,
    estateValue: 0,
    rentPerSec: 0,
    estateCountries: 0,
    stockValue: 0,
    dividendPerSec: 0,
    companies: {},
    creditRank: 'E',
  };
}
