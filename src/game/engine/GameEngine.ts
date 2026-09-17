import type { CompanyPolicy } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { GATHER_ACTIONS, type GatherActionId } from '@/game/data/gathering';
import { FACILITIES, type FacilityId } from '@/game/data/facilities';
import { LANDS, type LandDefId } from '@/game/data/lands';
import { RECIPES, type RecipeId } from '@/game/data/recipes';
import { RESEARCH, type ResearchId } from '@/game/data/research';
import type { ResourceId } from '@/game/data/resources';
import type { DerivedState, GameEvent, GameEventType, GameState, OfflineReport } from '@/types/state';
import { craft } from './actions/craft';
import { buyFacility, setFacilityEnabled } from './actions/facility';
import { gather } from './actions/gather';
import { buyLand, startSurvey } from './actions/land';
import type { EmitOptions, EngineContext, Rng } from './context';
import { calcCapacity, clean } from './inventory';
import { landCapacity, ownedLands } from './land';
import { createEmptyDerived, createInitialState } from './state/createInitialState';
import { runCompanyMetrics } from './systems/company';
import { creditRankDef, declineContract, deliverContract, runContracts } from './systems/contracts';
import { buyProperty, isEstateUnlocked, runEstate, sellProperty } from './systems/estate';
import { buyCustomProperty, sellCustomProperty } from './systems/customEstate';
import type { OsmFeature } from '@/game/services/osm/overpass';
import { computeEventMods, runEvents, triggerEvent } from './systems/events';
import { runLogistics } from './systems/logistics';
import { runAutoSell, runMarket, sellResource } from './systems/market';
import { computeModifiers } from './systems/modifiers';
import { runPower } from './systems/power';
import { runProduction } from './systems/production';
import { buildPrestigeState } from './systems/prestige';
import { runAchievements, runTutorial } from './systems/progress';
import { completeResearch, runResearchPoints } from './systems/research';
import { runRivals } from './systems/rivals';
import { acquireCompany, buyShares, computeStocks, dissolveCompany, expandCompany, runStocks, sellShares, setCompanyPolicy } from './systems/stocks';
import { runSurveys } from './systems/survey';
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
 * - 各種アクション（採集・クラフト・売却・施設購入・土地・調査・研究）
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
      emit: (type, message, opts) => this.emit(type, message, opts),
      offline: () => this.silent,
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

  private emit(type: GameEventType, message: string, opts: EmitOptions = {}): GameEvent {
    const toast = opts.toast ?? false;
    const ev: GameEvent = { id: this.state.nextEventId++, time: this.nowFn(), type, message };
    if (opts.achievementId) ev.achievementId = opts.achievementId;
    if (opts.eventId) ev.eventId = opts.eventId;
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
  /** 研究係数・倉庫容量など、tick の最初に揃える値 */
  private refreshCapacities(): void {
    const { state, derived } = this;
    derived.modifiers = computeModifiers(state);
    derived.eventMods = computeEventMods(state);
    derived.capacity = calcCapacity(state, derived.modifiers.storage);
    for (const land of ownedLands(state)) {
      const rt = derived.lands[land.id];
      const capacity = landCapacity(state, land, derived.modifiers);
      if (rt) rt.capacity = capacity;
      else derived.lands[land.id] = { capacity, transportCapacity: 0, transportUsed: 0, transportCost: 0, exports: {}, imports: {}, noRoute: false };
    }
    for (const id of Object.keys(derived.lands)) {
      if (!state.lands.some((l) => l.id === id)) delete derived.lands[id];
    }
  }

  /** dt 秒ぶんシミュレーションを進める（dt は maxStepSeconds 以下を想定） */
  tick(dt: number): void {
    if (dt <= 0) return;
    const { state } = this;
    this.refreshCapacities();
    this.derived.consumption = {};
    runEvents(this.ctx, dt);
    runSurveys(this.ctx, dt);
    runPower(this.ctx, dt);
    const { commercialIncome } = runProduction(this.ctx, dt);
    const { cost } = runLogistics(this.ctx, dt);
    runMarket(this.ctx, dt);
    runContracts(this.ctx, dt);
    const sold = runAutoSell(this.ctx);
    runResearchPoints(this.ctx, dt);
    const { rent } = runEstate(this.ctx, dt);
    const { dividends } = runStocks(this.ctx, dt);
    runRivals(this.ctx, dt);
    // 商業収入
    const earned = commercialIncome * dt;
    if (earned > 0) {
      state.company.cash += earned;
      state.company.totalEarned += earned;
      state.stats.totalCommercialIncome += earned;
    }
    const extra = this.derived.extraIncome;
    this.derived.extraIncome = 0;
    this.recordIncome(sold + earned + rent + dividends + extra - cost, dt);
    state.stats.playtimeSeconds += dt;
    runCompanyMetrics(this.ctx);
    this.derived.creditRank = creditRankDef(state).rank;
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
    d.incomePerSec = Math.abs(sum) < 1e-6 ? 0 : sum / buckets.length;
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
    this.refreshCapacities();
    computeStocks(this.ctx);
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

  buyFacility(typeId: FacilityId, count: number | 'max' = 1, landId = 'hq'): number {
    const n = buyFacility(this.ctx, typeId, count, landId);
    if (n > 0) {
      this.refreshDerived();
      runUnlocks(this.ctx);
    }
    return n;
  }

  setFacilityEnabled(instanceId: string, enabled: boolean): void {
    setFacilityEnabled(this.ctx, instanceId, enabled);
  }

  buyLand(id: LandDefId): boolean {
    const ok = buyLand(this.ctx, id);
    if (ok) {
      this.refreshDerived();
      runUnlocks(this.ctx);
      runAchievements(this.ctx);
    }
    return ok;
  }

  startSurvey(landId: string): boolean {
    const ok = startSurvey(this.ctx, landId);
    if (ok) this.refreshDerived();
    return ok;
  }

  research(id: ResearchId): boolean {
    const ok = completeResearch(this.ctx, id);
    if (ok) {
      this.refreshDerived();
      runUnlocks(this.ctx);
      runAchievements(this.ctx);
    }
    return ok;
  }

  // ---------- 不動産・株式 ----------
  isEstateUnlocked(): boolean {
    return isEstateUnlocked(this.state, this.derived.assets);
  }

  buyProperty(id: string): boolean {
    const ok = buyProperty(this.ctx, id);
    if (ok) {
      this.refreshDerived();
      runAchievements(this.ctx);
    }
    return ok;
  }

  sellProperty(id: string): number {
    const got = sellProperty(this.ctx, id);
    if (got > 0) this.refreshDerived();
    return got;
  }

  /** 地図で見つけた実在の場所を買う */
  buyCustomProperty(feature: OsmFeature): boolean {
    const ok = buyCustomProperty(this.ctx, feature);
    if (ok) {
      this.refreshDerived();
      runAchievements(this.ctx);
    }
    return ok;
  }

  /** 地図で買った場所を売る */
  sellCustomProperty(id: string): number {
    const got = sellCustomProperty(this.ctx, id);
    if (got > 0) this.refreshDerived();
    return got;
  }

  buyShares(companyId: string, qty: number): number {
    const n = buyShares(this.ctx, companyId, qty);
    if (n > 0) {
      this.refreshDerived();
      runAchievements(this.ctx);
    }
    return n;
  }

  sellShares(companyId: string, qty: number): number {
    const got = sellShares(this.ctx, companyId, qty);
    if (got > 0) this.refreshDerived();
    return got;
  }

  setCompanyPolicy(companyId: string, policy: CompanyPolicy): boolean {
    return setCompanyPolicy(this.ctx, companyId, policy);
  }

  expandCompany(companyId: string): boolean {
    const ok = expandCompany(this.ctx, companyId);
    if (ok) this.refreshDerived();
    return ok;
  }

  acquireCompany(companyId: string): boolean {
    const ok = acquireCompany(this.ctx, companyId);
    if (ok) {
      this.refreshDerived();
      runAchievements(this.ctx);
    }
    return ok;
  }

  dissolveCompany(companyId: string): boolean {
    const ok = dissolveCompany(this.ctx, companyId);
    if (ok) {
      this.refreshDerived();
      runAchievements(this.ctx);
    }
    return ok;
  }

  renameCompany(name: string): void {
    const trimmed = name.trim().slice(0, 24);
    if (trimmed) this.state.company.name = trimmed;
  }

  // ---------- 自動売却の下限価格 ----------
  setAutoSellMinPrice(resourceId: ResourceId, ratio: number | null): void {
    const cfg = this.state.market.autoSell[resourceId] ?? { enabled: false, keep: 0 };
    if (ratio && ratio > 0) cfg.minPriceRatio = ratio;
    else delete cfg.minPriceRatio;
    this.state.market.autoSell[resourceId] = cfg;
  }

  /** この土地の施設をすべて1個ずつ増やす。買えた個数を返す */
  buyAllOnLand(landId: string): number {
    let n = 0;
    for (const inst of [...this.state.facilities]) {
      if (inst.landId !== landId || inst.count <= 0) continue;
      n += buyFacility(this.ctx, inst.typeId as FacilityId, 1, landId);
    }
    if (n > 0) {
      this.refreshDerived();
      runUnlocks(this.ctx);
    }
    return n;
  }

  // ---------- 注文 ----------
  deliverContract(contractId: number, amount?: number): number {
    const n = deliverContract(this.ctx, contractId, amount);
    if (n > 0) {
      this.refreshDerived();
      runAchievements(this.ctx);
    }
    return n;
  }

  declineContract(contractId: number): boolean {
    return declineContract(this.ctx, contractId);
  }

  // ---------- 再出発 ----------
  /** 会社を売却して再出発する。実績・設定・永続ボーナスだけ持ち越す */
  prestige(): boolean {
    const next = buildPrestigeState(this.state, this.derived.assets, this.nowFn());
    if (!next) return false;
    const prevPoints = this.state.prestige?.points ?? 0;
    this.state = next;
    this.ctx.state = next;
    this.derived = createEmptyDerived();
    this.ctx.derived = this.derived;
    this.refreshDerived();
    runUnlocks(this.ctx);
    this.emit('success', `会社を売却して再出発しました。永続ボーナス ${prevPoints} → ${next.prestige.points} ポイント（生産 ×${(1 + CONFIG.prestige.productionPerPoint * next.prestige.points).toFixed(2)}）`, { toast: true });
    return true;
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
    const cap = calcCapacity(this.state, this.derived.modifiers.storage);
    this.state.inventory[id] = Math.min(cap, (this.state.inventory[id] ?? 0) + amount);
    this.state.discovered[id] = true;
    this.state.stats.totalObtained[id] = (this.state.stats.totalObtained[id] ?? 0) + amount;
    runUnlocks(this.ctx);
  }

  debugAddResearch(points: number): void {
    this.state.research.points += points;
    this.state.research.totalPoints += points;
  }

  debugUnlockAll(): void {
    const s = this.state;
    for (const f of FACILITIES) s.unlocked[`facility:${f.id}`] = true;
    for (const r of RECIPES) s.unlocked[`recipe:${r.id}`] = true;
    for (const g of GATHER_ACTIONS) s.unlocked[`gather:${g.id}`] = true;
    for (const l of LANDS) s.unlocked[`land:${l.id}`] = true;
    for (const r of RESEARCH) s.research.completed[r.id] = true;
    s.unlocked['system:land'] = true;
    s.unlocked['system:estate'] = true;
    this.refreshDerived();
    this.emit('info', 'デバッグ: すべて解放しました', { toast: true });
  }

  /** イベントを今すぐ起こす（デバッグ用。defId 省略で抽選） */
  debugTriggerEvent(defId?: string): boolean {
    const ok = triggerEvent(this.ctx, defId);
    if (ok) this.refreshDerived();
    return ok;
  }
}
