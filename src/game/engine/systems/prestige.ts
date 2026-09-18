import { CONFIG } from '@/game/data/config';
import type { GameState, PrestigeState } from '@/types/state';
import { createInitialPrestige, createInitialState } from '../state/createInitialState';
import { PRESTIGE_UPGRADE_MAP, upgradeCost } from '@/game/data/prestigeTree';

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

/** 使ったポイントの合計 */
export function spentPoints(state: GameState): number {
  const up = state.prestige?.upgrades ?? {};
  let sum = 0;
  for (const [id, level] of Object.entries(up)) {
    for (let i = 0; i < (level ?? 0); i++) sum += upgradeCost(id, i);
  }
  return sum;
}

/** まだ使っていないポイント */
export function availablePoints(state: GameState): number {
  return Math.max(0, (state.prestige?.points ?? 0) - spentPoints(state));
}

/** 永続アップグレードを1段階買う */
export function buyPrestigeUpgrade(state: GameState, id: string): boolean {
  const def = PRESTIGE_UPGRADE_MAP[id];
  if (!def) return false;
  const p = prestigeOf(state);
  if (!p.upgrades) p.upgrades = {};
  const level = p.upgrades[id] ?? 0;
  if (level >= def.maxLevel) return false;
  const cost = upgradeCost(id, level);
  if (availablePoints(state) < cost) return false;
  p.upgrades[id] = level + 1;
  return true;
}

/** 開始時の所持金（開業資金のアップグレードで増える） */
export function startingCash(state: GameState): number {
  const lv = state.prestige?.upgrades?.start_cash ?? 0;
  return 500_000 * lv;
}

/**
 * 会社を売却して転生する。実績・設定・永続ポイントと強化・通算の記録だけを持ち越し、
 * 資源・道具・施設・土地・研究・市場・イベント・不動産・株・自動化・注文はすべて初期化する。
 * 会社名と本社の場所は選び直してもらう（次の会社を建てるところから始まる）。
 * 新しい状態を返す（エンジン側で差し替える）
 */
export function buildPrestigeState(state: GameState, assets: number, now: number): GameState | null {
  if (!canPrestige(assets)) return null;
  const gained = prestigePoints(assets);
  const prev = prestigeOf(state);
  const prestige: PrestigeState = {
    count: prev.count + 1,
    points: prev.points + gained,
    upgrades: { ...(prev.upgrades ?? {}) },
    history: [...prev.history, { at: now, assets, points: gained }].slice(-20),
  };
  const next = createInitialState(now);
  next.prestige = prestige;
  next.achievements = { ...state.achievements };
  next.settings = { ...state.settings };
  // 転生は「会社を畳んで、次の会社を建てる」こと。
  // 名前と本社の場所は選び直してもらう（配色と読んだガイドはそのまま）。
  next.settings.nameChosen = false;
  next.settings.hqChosen = false;
  next.settings.hqLocation = null;
  next.company.cash = 500_000 * (prestige.upgrades?.start_cash ?? 0);
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
