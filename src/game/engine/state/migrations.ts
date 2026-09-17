import { GAME_META } from '@/game/data/meta';
import type { GameState, LandState } from '@/types/state';
import { createHqLand, createInitialState } from './createInitialState';

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
  return {
    ...base,
    ...d,
    saveVersion: GAME_META.saveVersion,
    meta: { ...base.meta, ...(d.meta ?? {}) },
    company: { ...base.company, ...(d.company ?? {}) },
    inventory: { ...(d.inventory ?? {}) },
    discovered: { ...base.discovered, ...(d.discovered ?? {}) },
    tools: { ...(d.tools ?? {}) },
    facilities: Array.isArray(d.facilities) ? d.facilities.map((f) => ({ ...f, landId: f.landId ?? 'hq' })) : [],
    lands: fixedLands,
    market: { ...base.market, ...(d.market ?? {}), prices: { ...(d.market?.prices ?? {}) }, autoSell: { ...(d.market?.autoSell ?? {}) } },
    stats: { ...base.stats, ...(d.stats ?? {}) },
    unlocked: { ...(d.unlocked ?? {}) },
    achievements: { ...(d.achievements ?? {}) },
    tutorial: { ...base.tutorial, ...(d.tutorial ?? {}) },
    research: { ...base.research, ...(d.research ?? {}) },
    eventLog: Array.isArray(d.eventLog) ? d.eventLog : [],
    nextEventId: typeof d.nextEventId === 'number' ? d.nextEventId : 1,
    settings: { ...base.settings, ...(d.settings ?? {}) },
  };
}
