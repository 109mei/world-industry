import { GAME_META } from '@/game/data/meta';
import type { GameState } from '@/types/state';
import { createInitialState } from './createInitialState';

/**
 * 古いセーブデータを現在の形式へ変換する。
 * 形式を変えたら GAME_META.saveVersion を上げ、ここに「そのバージョンから次へ」の変換を足す。
 */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {
  // 例: 1: (data) => ({ ...data, newField: 0, saveVersion: 2 }),
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
  return {
    ...base,
    ...d,
    saveVersion: GAME_META.saveVersion,
    meta: { ...base.meta, ...(d.meta ?? {}) },
    company: { ...base.company, ...(d.company ?? {}) },
    inventory: { ...(d.inventory ?? {}) },
    discovered: { ...base.discovered, ...(d.discovered ?? {}) },
    tools: { ...(d.tools ?? {}) },
    facilities: Array.isArray(d.facilities) ? d.facilities : [],
    lands: Array.isArray(d.lands) && d.lands.length > 0 ? d.lands : base.lands,
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
