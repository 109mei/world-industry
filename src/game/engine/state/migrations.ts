import { GAME_META } from '@/game/data/meta';
import { addCustomLand } from '../systems/customEstate';
import { createInitialSales } from '../systems/sales';
import { addPropertyLand } from '../systems/estate';
import type { GameState, LandState } from '@/types/state';
import { createHqLand, createInitialAutomation, createInitialBusiness, createInitialCompanyStock, createInitialContracts, createInitialEstate, createInitialPrestige, createInitialState, createInitialStocks } from './createInitialState';

/**
 * 古いセーブデータを現在の形式へ変換する。
 * 形式を変えたら GAME_META.saveVersion を上げ、ここに「そのバージョンから次へ」の変換を足す。
 */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: 土地（地形・調査・鉱脈・現地在庫）、研究ポイント、統計の追加
  1: (data) => {
    const d = data as Partial<GameState> & Record<string, unknown>;
    const lands = Array.isArray(d.lands) ? (d.lands as Partial<LandState>[]) : [];
    const migratedLands = lands.map((l) => (l.id === 'hq' ? { ...createHqLand(), ...l, terrain: 'industrial' as const, survey: 4 as const, surveyProgress: null, deposits: {}, stock: {} } : l));
    const research = (d.research ?? {}) as Partial<GameState['research']>;
    const company = (d.company ?? {}) as Partial<GameState['company']>;
    const stats = (d.stats ?? {}) as Partial<GameState['stats']>;
    return {
      ...data,
      saveVersion: 2,
      lands: migratedLands.length > 0 ? migratedLands : [createHqLand()],
      research: { completed: research.completed ?? {}, points: research.points ?? 0, totalPoints: research.totalPoints ?? 0 },
      company: { ...company, landInvestment: company.landInvestment ?? 0 },
      stats: { ...stats, totalTransported: stats.totalTransported ?? 0, totalGeneratedMWh: stats.totalGeneratedMWh ?? 0, totalCommercialIncome: stats.totalCommercialIncome ?? 0, totalTransportCost: stats.totalTransportCost ?? 0 },
    };
  },
  // v2 → v3: ランダムイベント、市場の需要（飽和量）、効果音などの設定を追加
  2: (data) => {
    const d = data as Partial<GameState> & Record<string, unknown>;
    const base = createInitialState();
    const prices: Record<string, unknown> = {};
    for (const [id, m] of Object.entries(d.market?.prices ?? {})) {
      if (m && typeof m === 'object') prices[id] = { saturation: 0, ...(m as object) };
    }
    return {
      ...data,
      saveVersion: 3,
      market: { ...(d.market ?? base.market), prices },
      events: d.events ?? base.events,
      stats: { ...(d.stats ?? {}), eventsOccurred: d.stats?.eventsOccurred ?? 0, disasters: d.stats?.disasters ?? 0 },
      settings: { ...base.settings, ...(d.settings ?? {}) },
    };
  },
  // v3 → v4: 不動産（実在の土地・物件）、株式、テーマ設定、統計の追加
  3: (data) => {
    const d = data as Partial<GameState> & Record<string, unknown>;
    const base = createInitialState();
    return {
      ...data,
      saveVersion: 4,
      estate: d.estate ?? createInitialEstate(),
      stocks: d.stocks ?? createInitialStocks(),
      stats: { ...base.stats, ...(d.stats ?? {}) },
      settings: { ...base.settings, ...(d.settings ?? {}) },
    };
  },
  // v4 → v5: 自動化（マネージャー・在庫ルール・自動投資・テンプレート）、注文と信用、再出発、増資、統計の追加
  4: (data) => {
    const d = data as Partial<GameState> & Record<string, unknown>;
    const base = createInitialState();
    return {
      ...data,
      saveVersion: 5,
      contracts: d.contracts ?? createInitialContracts(),
      prestige: d.prestige ?? createInitialPrestige(),
      stats: { ...base.stats, ...(d.stats ?? {}) },
    };
  },
  // v5 → v6: 自動化（マネージャー）を廃止。関連データを捨てる
  5: (data) => {
    const d = { ...data } as Record<string, unknown>;
    delete d.automation;
    const stats = { ...((d.stats ?? {}) as Record<string, unknown>) };
    delete stats.salariesPaid;
    delete stats.autoGathered;
    delete stats.autoCrafted;
    return { ...d, saveVersion: 6, stats };
  },
  // v6 → v7: 地図から買う「実在の場所」（OSM の建物・区画）を追加
  6: (data) => {
    const d = data as Partial<GameState> & Record<string, unknown>;
    const estate = { ...((d.estate ?? {}) as Record<string, unknown>) };
    if (!estate.custom) estate.custom = {};
    return { ...data, saveVersion: 7, estate };
  },
  // v7 → v8: 「注文」を「営業・契約・納品」に置き換え
  7: (data) => {
    const d = data as Partial<GameState> & Record<string, unknown>;
    const contracts = { ...((d.contracts ?? {}) as Record<string, unknown>) };
    contracts.active = [];
    return { ...data, saveVersion: 8, contracts, sales: { clients: {}, offers: [], deals: [], nextId: 1 } };
  },
  // v8 → v9: 自動化（永続アップグレードで買う）の設定を追加
  8: (data) => ({ ...data, saveVersion: 9, automation: (data as Partial<GameState>).automation ?? { on: {}, recipes: [], gathers: [], timers: {} } }),
  // v9 → v10: 人件費と倒産、通貨と単位の設定、ランダムイベントの常時発生
  9: (data) => {
    const d = data as Partial<GameState> & Record<string, unknown>;
    const company = { ...((d.company ?? {}) as Record<string, unknown>), debtSeconds: 0 };
    const settings = { ...((d.settings ?? {}) as Record<string, unknown>) };
    // イベントは止められない仕様になったので、切っていた人も戻す
    settings.events = true;
    if (!settings.currency) settings.currency = 'jpy';
    if (!settings.unitStyle) settings.unitStyle = 'ja';
    return { ...data, saveVersion: 10, company, settings };
  },
  // v10 → v11: 自分で始める事業（お店・IT会社など）を追加
  10: (data) => ({ ...data, saveVersion: 11, business: (data as Partial<GameState>).business ?? { divisions: [], nextId: 1 } }),
  // v11 → v12: 宝くじ
  11: (data) => ({ ...data, saveVersion: 12 }),
  // v12 → v13: グラフ用の記録
  12: (data) => ({ ...data, saveVersion: 13, history: (data as Partial<GameState>).history ?? { assets: [], income: [], employees: [], nextIn: 0 } }),
};

export function migrateSave(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new Error('セーブデータの形式が不正です');
  let data = raw as Record<string, unknown>;
  let version = typeof data.saveVersion === 'number' ? data.saveVersion : 0;
  if (version > GAME_META.saveVersion) {
    throw new Error(`このセーブデータは新しいバージョン(${version})のものです`);
  }
  while (version < GAME_META.saveVersion) {
    const m = MIGRATIONS[version];
    if (!m) throw new Error(`バージョン ${version} からの変換処理がありません`);
    data = m(data);
    version = typeof data.saveVersion === 'number' ? data.saveVersion : version + 1;
  }
  return fillDefaults(data);
}

function fixEstate(e: Partial<GameState['estate']> | undefined): GameState['estate'] {
  const base = createInitialEstate();
  if (!e) return base;
  const owned = { ...(e.owned ?? {}) };
  // 会社所有の物件: 保存されていればそれを使い、なければ初期値。プレイヤーが持っている物件は会社所有から外す
  const companyOwned = { ...(e.companyOwned ?? base.companyOwned) };
  for (const id of Object.keys(owned)) delete companyOwned[id];
  return { ...base, ...e, owned, custom: { ...(e.custom ?? {}) }, cityMult: { ...base.cityMult, ...(e.cityMult ?? {}) }, companyOwned, nextUpdateIn: typeof e.nextUpdateIn === 'number' ? e.nextUpdateIn : base.nextUpdateIn };
}

function fixSales(v: Partial<GameState['sales']> | undefined): GameState['sales'] {
  const base = createInitialSales();
  if (!v) return base;
  return {
    clients: { ...(v.clients ?? {}) },
    offers: Array.isArray(v.offers) ? v.offers : [],
    deals: Array.isArray(v.deals) ? v.deals : [],
    nextId: typeof v.nextId === 'number' ? v.nextId : 1,
  };
}

/** グラフ用の記録。配列でなければ作り直す（壊れていると毎 tick で例外になる） */
function fixHistory(v: Partial<GameState['history']> | undefined): GameState['history'] {
  const nums = (a: unknown): number[] => (Array.isArray(a) ? a.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : []);
  return {
    assets: nums(v?.assets),
    income: nums(v?.income),
    employees: nums(v?.employees),
    nextIn: typeof v?.nextIn === 'number' && Number.isFinite(v.nextIn) ? v.nextIn : 0,
  };
}

function fixBusiness(v: Partial<GameState['business']> | undefined): GameState['business'] {
  const base = createInitialBusiness();
  if (!v) return base;
  return {
    divisions: Array.isArray(v.divisions)
      ? v.divisions.map((d) => ({
          ...d,
          ads: Array.isArray(d.ads) ? d.ads : [],
          parkingLands: Array.isArray(d.parkingLands) ? d.parkingLands : [],
          stock: { ...(d.stock ?? {}) },
          restock: { ...(d.restock ?? {}) },
          projects: Array.isArray(d.projects) ? d.projects : [],
          products: Array.isArray(d.products) ? d.products : [],
          totalEarned: d.totalEarned ?? 0,
          completed: d.completed ?? 0,
        }))
      : [],
    nextId: typeof v.nextId === 'number' ? v.nextId : 1,
  };
}

function fixAutomation(v: Partial<GameState['automation']> | undefined): GameState['automation'] {
  const base = createInitialAutomation();
  if (!v) return base;
  return {
    on: { ...(v.on ?? {}) },
    recipes: Array.isArray(v.recipes) ? v.recipes : [],
    gathers: Array.isArray(v.gathers) ? v.gathers : [],
    timers: { ...(v.timers ?? {}) },
  };
}

function fixStocks(s: Partial<GameState['stocks']> | undefined): GameState['stocks'] {
  const base = createInitialStocks();
  if (!s) return base;
  const companies: GameState['stocks']['companies'] = {};
  for (const id of Object.keys(base.companies)) {
    const c = s.companies?.[id];
    companies[id] = c ? { ...createInitialCompanyStock(), ...c, history: Array.isArray(c.history) ? c.history : [] } : createInitialCompanyStock();
  }
  return {
    companies,
    nextUpdateIn: typeof s.nextUpdateIn === 'number' ? s.nextUpdateIn : base.nextUpdateIn,
    rivalIn: typeof s.rivalIn === 'number' ? s.rivalIn : base.rivalIn,
    issueIn: typeof s.issueIn === 'number' ? s.issueIn : base.issueIn,
  };
}


function fixContracts(c: Partial<GameState['contracts']> | undefined): GameState['contracts'] {
  const base = createInitialContracts();
  if (!c) return base;
  return { ...base, ...c, active: Array.isArray(c.active) ? c.active : [] };
}

function fixPrestige(p: Partial<GameState['prestige']> | undefined): GameState['prestige'] {
  const base = createInitialPrestige();
  if (!p) return base;
  return { ...base, ...p, history: Array.isArray(p.history) ? p.history : [] };
}

/** 数として読めないもの（null・undefined・NaN）を既定値にする */
function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** 数字だけの入れ物を掃除する（壊れた値が混ざっていても止まらないように） */
function cleanNumbers<T extends Record<string, unknown>>(rec: T | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** 欠けているフィールドを初期値で補う（部分的に壊れたセーブにも耐える） */
export function fillDefaults(data: Record<string, unknown>): GameState {
  const base = createInitialState();
  const d = data as Partial<GameState>;
  const lands = Array.isArray(d.lands) && d.lands.length > 0 ? d.lands : base.lands;
  const hqBase = createHqLand();
  const fixedLands: LandState[] = lands.map((l) => ({
    ...(l.id === 'hq' ? hqBase : {}),
    ...l,
    terrain: l.terrain ?? (l.id === 'hq' ? hqBase.terrain : 'plains'),
    purchasedAt: l.purchasedAt ?? 0,
    survey: l.survey ?? (l.id === 'hq' ? 4 : 0),
    surveyProgress: l.surveyProgress ?? null,
    deposits: l.deposits ?? {},
    stock: l.stock ?? {},
  }));
  if (!fixedLands.some((l) => l.id === 'hq')) fixedLands.unshift(hqBase);
  const result: GameState = {
    ...base,
    ...d,
    saveVersion: GAME_META.saveVersion,
    meta: { ...base.meta, ...(d.meta ?? {}) },
    // 壊れた数（null や NaN）が紛れ込んでいても、そこから先が全部おかしくならないように直す
    company: {
      ...base.company,
      ...(d.company ?? {}),
      cash: num(d.company?.cash, base.company.cash),
      totalEarned: num(d.company?.totalEarned, 0),
      totalSpent: num(d.company?.totalSpent, 0),
      facilityInvestment: num(d.company?.facilityInvestment, 0),
      landInvestment: num(d.company?.landInvestment, 0),
      debtSeconds: num(d.company?.debtSeconds, 0),
    },
    inventory: cleanNumbers(d.inventory as Record<string, unknown> | undefined),
    discovered: { ...base.discovered, ...(d.discovered ?? {}) },
    tools: { ...(d.tools ?? {}) },
    facilities: Array.isArray(d.facilities)
      ? d.facilities
          .filter((f) => f && typeof f.typeId === 'string')
          .map((f) => {
            const landId = f.landId ?? 'hq';
            return { ...f, landId, id: f.id ?? `${landId}:${f.typeId}`, enabled: f.enabled ?? true, count: num(f.count, 0) };
          })
      : [],
    lands: fixedLands,
    market: { ...base.market, ...(d.market ?? {}), prices: { ...(d.market?.prices ?? {}) }, autoSell: { ...(d.market?.autoSell ?? {}) } },
    stats: { ...base.stats, ...(d.stats ?? {}) },
    unlocked: { ...(d.unlocked ?? {}) },
    achievements: { ...(d.achievements ?? {}) },
    tutorial: { ...base.tutorial, ...(d.tutorial ?? {}) },
    research: {
      ...base.research,
      ...(d.research ?? {}),
      points: num(d.research?.points, 0),
      totalPoints: num(d.research?.totalPoints, 0),
      completed: { ...(d.research?.completed ?? {}) },
    },
    events: { ...base.events, ...(d.events ?? {}), active: Array.isArray(d.events?.active) ? d.events.active : [] },
    estate: fixEstate(d.estate),
    stocks: fixStocks(d.stocks),
    contracts: fixContracts(d.contracts),
    sales: fixSales(d.sales),
    prestige: fixPrestige(d.prestige),
    automation: fixAutomation(d.automation),
    business: fixBusiness(d.business),
    history: fixHistory(d.history),
    eventLog: Array.isArray(d.eventLog) ? d.eventLog : [],
    nextEventId: typeof d.nextEventId === 'number' ? d.nextEventId : 1,
    settings: { ...base.settings, ...(d.settings ?? {}) },
  };
  // 買った物件は「施設を建てられる土地」として扱う（古いセーブにも足す）
  for (const propertyId of Object.keys(result.estate.owned)) {
    addPropertyLand(result, propertyId, result.estate.owned[propertyId].boughtAt ?? 0);
  }
  // 地図から買った実在の場所も同じように土地として扱う
  for (const cp of Object.values(result.estate.custom ?? {})) {
    addCustomLand(result, cp);
  }
  return result;
}
