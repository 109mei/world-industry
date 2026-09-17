import { CONFIG } from '@/game/data/config';
import type { GameState, PrestigeState } from '@/types/state';
import { createInitialPrestige, createInitialState } from '../state/createInitialState';
import { prestigeBonus } from './modifiers';

function prestigeOf(state: GameState): PrestigeState {
  if (!state.prestige) state.prestige = createInitialPrestige();
  return state.prestige;
}

/** 総資産から得られるポイント */
export function prestigePoints(assets: number): number {
  if (assets < CONFIG.prestige.minAssets) return 0;
  return Math.floor(Math.sqrt(assets / CONFIG.prestige.assetsPerPoint));
}

export function canPrestige(assets: number): boolean {
  return assets >= CONFIG.prestige.minAssets;
}

/** 永続ボーナスの内容（表示用） */
export function prestigeSummary(points: number): { production: number; research: number; startingCash: number } {
  const b = prestigeBonus(points);
  return { production: b.production, research: b.research, startingCash: CONFIG.prestige.startingCashPerPoint * points };
}

/**
 * 会社を売却して再出発する。実績・設定・会社名・再出発の記録だけを持ち越し、
 * 資源・道具・施設・土地・研究・市場・イベント・不動産・株・自動化・注文はすべて初期化する。
 * 新しい状態を返す（エンジン側で差し替える）
 */
export function buildPrestigeState(state: GameState, assets: number, now: number): GameState | null {
  if (!canPrestige(assets)) return null;
  const gained = prestigePoints(assets);
  const prev = prestigeOf(state);
  const prestige: PrestigeState = {
    count: prev.count + 1,
    points: prev.points + gained,
    history: [...prev.history, { at: now, assets, points: gained }].slice(-20),
  };
  const next = createInitialState(now);
  next.prestige = prestige;
  next.achievements = { ...state.achievements };
  next.settings = { ...state.settings };
  next.company.name = state.company.name;
  next.company.cash = CONFIG.prestige.startingCashPerPoint * prestige.points;
  // チュートリアルは2周目以降は省略
  next.tutorial = { step: 0, completed: true };
  // 通算の統計は引き継ぐ（プレイ時間・タップ数・注文の達成数など）
  next.stats.playtimeSeconds = state.stats.playtimeSeconds;
  next.stats.taps = state.stats.taps;
  next.stats.contractsCompleted = state.stats.contractsCompleted;
  next.stats.contractsFailed = state.stats.contractsFailed;
  next.stats.companiesAcquired = state.stats.companiesAcquired;
  next.stats.companiesDissolved = state.stats.companiesDissolved;
  next.stats.disasters = state.stats.disasters;
  next.stats.eventsOccurred = state.stats.eventsOccurred;
  next.eventLog = [];
  next.nextEventId = 1;
  return next;
}
