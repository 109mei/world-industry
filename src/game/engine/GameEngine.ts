import { CONFIG } from '@/game/data/config';
import { GATHER_ACTIONS, type GatherActionId } from '@/game/data/gathering';
import { FACILITIES, type FacilityId } from '@/game/data/facilities';
import { RECIPES, type RecipeId } from '@/game/data/recipes';
import type { ResourceId } from '@/game/data/resources';
import type { DerivedState, GameEvent, GameEventType, GameState, OfflineReport } from '@/types/state';
import { craft } from './actions/craft';
import { buyFacility, setFacilityEnabled } from './actions/facility';
import { gather } from './actions/gather';
import type { EngineContext, Rng } from './context';
import { calcCapacity, clean } from './inventory';
import { createEmptyDerived, createInitialState } from './state/createInitialState';
import { runCompanyMetrics } from './systems/company';
import { runAutoSell, runMarket, sellResource } from './systems/market';
import { runProduction } from './systems/production';
import { runAchievements, runTutorial } from './systems/progress';
import { runUnlocks } from './systems/unlocks';

export type EngineListener = (event: GameEvent, options: { toast: boolean }) => void;

export interface GameEngineOptions {
  state?: GameState;
  rng?: Rng;
  now?: () => number;
}

/**
 * ゲームのシミュレーション本体。UI から独立しており、Node 上のテストでもそのまま動く。
 * - tick(dt): dt 秒ぶん進める
 * - advance(seconds): 長い時間（オフラインなど）を分割して進める
 * - 各種アクション（採集・クラフト・売却・施設購入）
 */
export class GameEngine {
  state: GameState;
  derived: DerivedState;
  private rng: Rng;
  private nowFn: () => number;
  private listeners = new Set<EngineListener>();
  /** 稼働中は false。オフライン計算中などにトーストを抑える */
  private silent = false;
  private ctx: EngineContext;

  constructor(options: GameEngineOptions = {}) {
    this.state = options.state ?? createInitialState(options.now ? options.now() : Date.now());
    this.derived = createEmptyDerived();
    this.rng = options.rng ?? Math.random;
    this.nowFn = options.now ?? (() => Date.now());
    this.ctx = {
      state: this.state,
      derived: this.derived,
      rng: this.rng,
      now: this.nowFn,
      emit: (type, message, opts) => this.emit(type, message, opts?.toast ?? false),
    };
    this.refreshDerived();
    // 初期解放（always 条件）を反映
    runUnlocks(this.ctx);
  }

  now(): number {
    return this.nowFn();
  }

  // ---------- イベント ----------
  addListener(fn: EngineListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(type: GameEventType, message: string, toast: boolean): GameEvent {
    const ev: GameEvent = { id: this.state.nextEventId++, time: this.nowFn(), type, message };
    this.state.eventLog.push(ev);
    if (this.state.eventLog.length > CONFIG.eventLogLength) {
      this.state.eventLog.splice(0, this.state.eventLog.length - CONFIG.eventLogLength);
    }
    if (!this.silent) {
      for (const l of this.listeners) l(ev, { toast });
    }
    return ev;
  }

  // ---------- 時間を進める ----------
  /** dt 秒ぶんシミュレーションを進める（dt は maxStepSeconds 以下を想定） */
  tick(dt: number): void {
    if (dt <= 0) return;
    const { state, derived } = this;
    derived.capacity = calcCapacity(state);
    runProduction(this.ctx, dt);
    runMarket(this.ctx, dt);
    const gained = runAutoSell(this.ctx);
    this.recordIncome(gained, dt);
    state.stats.playtimeSeconds += dt;
    runCompanyMetrics(this.ctx);
    runUnlocks(this.ctx);
    runTutorial(this.ctx);
    runAchievements(this.ctx);
  }

  /** 収入を1秒ごとのバケツに記録し、直近10秒の平均を incomePerSec にする */
  private recordIncome(gained: number, dt: number): void {
    const d = this.derived;
    const buckets = d.incomeBuckets;
    buckets[buckets.length - 1] += gained;
    d.incomeBucketElapsed += dt;
    while (d.incomeBucketElapsed >= 1) {
      d.incomeBucketElapsed -= 1;
      buckets.shift();
      buckets.push(0);
    }
    const sum = buckets.reduce((a, b) => a + b, 0);
    d.incomePerSec = sum < 1e-6 ? 0 : sum / buckets.length;
  }

  /**
   * 実時間で seconds 秒経過したぶんを進める。長い場合は分割して計算する。
   * 倉庫の満杯・資源不足は分割ごとに反映されるので、単純な「生産量×秒」にはならない。
   */
  advance(seconds: number): void {
    let remaining = seconds;
    const chunk = CONFIG.catchUpChunkSeconds;
    let guard = 0;
    while (remaining > 1e-9 && guard++ < 1_000_000) {
      const dt = Math.min(remaining, remaining > CONFIG.maxStepSeconds ? chunk : remaining);
      this.tick(dt);
      remaining -= dt;
    }
  }

  /** オフライン進行を適用して報告を返す。maxSeconds を超える分は切り捨てる */
  applyOffline(elapsedSeconds: number, maxSeconds = this.state.settings.maxOfflineSeconds): OfflineReport {
    const simulated = Math.max(0, Math.min(elapsedSeconds, maxSeconds));
    const before = { ...this.state.inventory };
    const cashBefore = this.state.company.cash;
    this.silent = true;
    try {
      this.advance(simulated);
    } finally {
      this.silent = false;
    }
    const resourceDelta: Partial<Record<ResourceId, number>> = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(this.state.inventory)]) as Set<ResourceId>;
    for (const k of keys) {
      const d = clean((this.state.inventory[k] ?? 0) - (before[k] ?? 0));
      if (Math.abs(d) >= 0.01) resourceDelta[k] = d;
    }
    return {
      elapsedSeconds,
      simulatedSeconds: simulated,
      capped: elapsedSeconds > maxSeconds,
      resourceDelta,
      cashDelta: clean(this.state.company.cash - cashBefore),
    };
  }

  /** 保存前などに派生情報を最新にする */
  refreshDerived(): void {
    this.derived.capacity = calcCapacity(this.state);
    runCompanyMetrics(this.ctx);
  }

  // ---------- プレイヤーの操作 ----------
  gather(actionId: GatherActionId): number {
    const got = gather(this.ctx, actionId);
    if (got > 0) runUnlocks(this.ctx);
    return got;
  }

  craft(recipeId: RecipeId, times: number | 'max' = 1): number {
    const n = times === 'max' ? 100000 : times;
    const made = craft(this.ctx, recipeId, n);
    if (made > 0) runUnlocks(this.ctx);
    return made;
  }

  sell(resourceId: ResourceId, amount: number | 'all'): number {
    const qty = amount === 'all' ? Math.floor(this.state.inventory[resourceId] ?? 0) : amount;
    const result = sellResource(this.ctx, resourceId, qty);
    if (result.amount > 0) {
      runCompanyMetrics(this.ctx);
      runUnlocks(this.ctx);
    }
    return result.revenue;
  }

  setAutoSell(resourceId: ResourceId, enabled: boolean, keep: number): void {
    this.state.market.autoSell[resourceId] = { enabled, keep: Math.max(0, Math.floor(keep)) };
  }

  buyFacility(typeId: FacilityId, count: number | 'max' = 1): number {
    const n = buyFacility(this.ctx, typeId, count);
    if (n > 0) {
      this.refreshDerived();
      runUnlocks(this.ctx);
    }
    return n;
  }

  setFacilityEnabled(instanceId: string, enabled: boolean): void {
    setFacilityEnabled(this.ctx, instanceId, enabled);
  }

  renameCompany(name: string): void {
    const trimmed = name.trim().slice(0, 24);
    if (trimmed) this.state.company.name = trimmed;
  }

  updateSettings(patch: Partial<GameState['settings']>): void {
    Object.assign(this.state.settings, patch);
  }

  // ---------- デバッグ ----------
  debugAddCash(amount: number): void {
    this.state.company.cash += amount;
    this.refreshDerived();
    runUnlocks(this.ctx);
  }

  debugAddResource(id: ResourceId, amount: number): void {
    const cap = calcCapacity(this.state);
    this.state.inventory[id] = Math.min(cap, (this.state.inventory[id] ?? 0) + amount);
    this.state.discovered[id] = true;
    this.state.stats.totalObtained[id] = (this.state.stats.totalObtained[id] ?? 0) + amount;
    runUnlocks(this.ctx);
  }

  debugUnlockAll(): void {
    const s = this.state;
    for (const f of FACILITIES) s.unlocked[`facility:${f.id}`] = true;
    for (const r of RECIPES) s.unlocked[`recipe:${r.id}`] = true;
    for (const g of GATHER_ACTIONS) s.unlocked[`gather:${g.id}`] = true;
    this.emit('info', 'デバッグ: すべて解放しました', true);
  }
}
