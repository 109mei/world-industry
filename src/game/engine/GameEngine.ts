import type { CompanyPolicy } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { GATHER_ACTIONS, type GatherActionId } from '@/game/data/gathering';
import { FACILITIES, type FacilityId } from '@/game/data/facilities';
import { LANDS, type LandDefId } from '@/game/data/lands';
import { RECIPES, type RecipeId } from '@/game/data/recipes';
import { RESEARCH, type ResearchId } from '@/game/data/research';
import type { ResourceId } from '@/game/data/resources';
import type { AutomationKey, Bookmark, DerivedState, GameEvent, GameEventType, GameState, OfflineReport, ThemeMode } from '@/types/state';
import { craft } from './actions/craft';
import { buyFacility, setFacilityEnabled } from './actions/facility';
import { gather } from './actions/gather';
import { buyLand, startSurvey } from './actions/land';
import type { EmitOptions, EngineContext, Rng } from './context';
import { calcCapacity, clean } from './inventory';
import { landCapacity, ownedLands, resetLandIndex } from './land';
import { createEmptyDerived, createInitialState } from './state/createInitialState';
import { runCompanyMetrics } from './systems/company';
import { creditRankDef } from './systems/contracts';
import { acceptOffer, cancelDeal, declineOffer, deliverDeal, pitchToClient, pitchToPlace, runSales } from './systems/sales';
import { runInfluence } from './systems/influence';
import { buildBankruptState, runSolvency, runWages } from './systems/finance';
import { runHistory } from './systems/history';
import { cancelProject, closeDivision, openDivision, restockShop, returnFromShop, runBusiness, setStaff, shopStockCapacity, startAd, startProject, toggleParking, getDivision } from './systems/business';
import { buyTickets, play, runLottery, type PlayResult } from './systems/gambling';
import { playMinigame, type MinigameResult } from './systems/minigame';
import type { MinigameId } from '@/game/data/minigames';
import { buyProperty, computeEstate, isEstateUnlocked, runEstate, sellProperty } from './systems/estate';
import { buyCustomProperty, customBuyCost, quoteFeature, sellCustomProperty } from './systems/customEstate';
import { hasStarted, placeLabel } from './hq';
import type { OsmFeature } from '@/game/services/osm/overpass';
import { computeEventMods, runEvents, triggerEvent } from './systems/events';
import { runLogistics } from './systems/logistics';
import { buyResource, runAutoSell, runMarket, sellResource } from './systems/market';
import { AUTOMATION_KEYS, AUTOMATION_UPGRADE_ID, runAutomation, setAutomation, toggleAutoGather, toggleAutoRecipe } from './systems/automation';
import { computeModifiers } from './systems/modifiers';
import { runCalendar } from './systems/calendar';
import { runPower } from './systems/power';
import { runProduction } from './systems/production';
import { buildPrestigeState, buyPrestigeUpgrade } from './systems/prestige';
import { BULK_BUY_LIMIT, levelOf } from '@/game/data/prestigeTree';
import { runAchievements, runTutorial } from './systems/progress';
import { completeResearch, runResearchPoints } from './systems/research';
import { runRivals } from './systems/rivals';
import { acquireCompany, buyShares, computeStocks, dissolveCompany, expandCompany, runStocks, sellShares, setCompanyPolicy } from './systems/stocks';
import { runSurveys } from './systems/survey';
import { runUnlocks } from './systems/unlocks';
import type { ProjectPace } from '@/game/data/projectPhases';
import { buyCard, claimSeries, openPack, runCards, sellCard } from './systems/cards';
import type { CountryCode } from '@/game/data/lands';
import type { ShipMode } from '@/game/data/trade';
import { acceptOffer as acceptTradeOffer, declineOffer as declineTradeOffer, exportOrder, importOrder, pitch as pitchTrade, runTrade } from './systems/trade';

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
  /** 稼働中は false。まとめて進めているあいだ、途中のトーストを抑える */
  private silent = false;
  /**
   * 本当に「離れていたぶん」を計算しているか。
   * 少し処理が遅れただけの tick と、何時間ぶんかのオフライン計算を区別する。
   * ここを silent と同じにすると、わずかな遅れのたびにイベントが消えてしまう。
   */
  private offlineMode = false;
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
      offline: () => this.offlineMode,
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
    if (opts.scope) ev.scope = opts.scope;
    this.state.eventLog.push(ev);
    if (this.state.eventLog.length > CONFIG.eventLogLength) {
      this.state.eventLog.splice(0, this.state.eventLog.length - CONFIG.eventLogLength);
    }
    if (!this.silent || opts.force) {
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
    // NaN <= 0 は false なので、ここで弾かないと状態がまるごと NaN に汚れる
    if (!Number.isFinite(dt) || dt <= 0) return;
    const { state } = this;
    this.refreshCapacities();
    this.derived.consumption = {};
    runEvents(this.ctx, dt);
    runSurveys(this.ctx, dt);
    runPower(this.ctx, dt);
    const { commercialIncome } = runProduction(this.ctx, dt);
    const { cost } = runLogistics(this.ctx, dt);
    const wages = runWages(this.ctx, dt);
    runMarket(this.ctx, dt);
    runSales(this.ctx, dt);
    const business = runBusiness(this.ctx, dt);
    runLottery(this.ctx, dt);
    runCards(this.ctx, dt);
    runTrade(this.ctx, dt);
    runAutomation(this.ctx, dt);
    runInfluence(this.ctx, dt);
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
    this.recordIncome(sold + earned + rent + dividends + extra + business.income - business.costs - cost - wages, dt);
    // 遊び始めるまでは、遊んだ時間にも数えない
    if (hasStarted(state)) state.stats.playtimeSeconds += dt;
    runCalendar(this.ctx, dt);
    runCompanyMetrics(this.ctx);
    // 収入がすべて入ってから、赤字かどうかを判定する
    const { bankrupt } = runSolvency(this.ctx, dt);
    runHistory(this.ctx, dt);
    this.derived.creditRank = creditRankDef(state).rank;
    runUnlocks(this.ctx);
    runTutorial(this.ctx);
    runAchievements(this.ctx);
    if (bankrupt) this.goBankrupt();
  }

  /** 倒産。永続ポイント・アップグレード・実績は残して、会社だけ最初からにする */
  private goBankrupt(): void {
    const next = buildBankruptState(this.state, this.nowFn(), createInitialState);
    resetLandIndex();
    this.state = next;
    this.ctx.state = next;
    this.derived = createEmptyDerived();
    this.ctx.derived = this.derived;
    this.refreshDerived();
    runUnlocks(this.ctx);
    // 倒産は、まとめて進めているあいだでも必ず知らせる（気づかないうちに会社が消えるのを防ぐ）
    this.emit('warn', `資金が尽きて倒産しました。会社を畳んで、もう一度やり直します（永続ポイント ${next.prestige.points}pt と実績は残っています）`, { toast: true, force: true });
  }

  /**
   * 収入を1秒ごとのバケツに記録し、直近10秒の平均を incomePerSec にする。
   *
   * 追いつき計算では dt が 10秒まとめて来るので、
   * 先にバケツを送ってから入れないと、入れた直後に全部押し出されて 0 になってしまう。
   * dt が長いときは、そのぶんを秒ごとに割り振る。
   */
  private recordIncome(gained: number, dt: number): void {
    const d = this.derived;
    const buckets = d.incomeBuckets;
    const perSec = dt > 0 ? gained / dt : 0;
    let left = dt;
    let guard = 0;
    while (left > 1e-9 && guard++ < 100) {
      const room = 1 - d.incomeBucketElapsed;
      const step = Math.min(left, room);
      buckets[buckets.length - 1] += perSec * step;
      d.incomeBucketElapsed += step;
      left -= step;
      if (d.incomeBucketElapsed >= 1 - 1e-9) {
        d.incomeBucketElapsed = 0;
        buckets.shift();
        buckets.push(0);
      }
    }
    // dt がとても長いときは、最後の1秒ぶんの平均をそのまま使う
    if (left > 1e-9) {
      for (let i = 0; i < buckets.length; i++) buckets[i] = perSec;
      d.incomeBucketElapsed = 0;
    }
    const sum = buckets.reduce((a, b) => a + b, 0);
    d.incomePerSec = Math.abs(sum) < 1e-6 ? 0 : sum / buckets.length;
  }

  /**
   * 実時間で seconds 秒経過したぶんを進める。長い場合は分割して計算する。
   * 倉庫の満杯・資源不足は分割ごとに反映されるので、単純な「生産量×秒」にはならない。
   */
  /** まとめて進めるときに、途中の通知（倉庫が満杯など）を出さないようにする */
  advanceQuiet(seconds: number): void {
    this.silent = true;
    try {
      this.advance(seconds);
    } finally {
      this.silent = false;
    }
  }

  /** 離れていたぶんをまとめて進める（イベントの抽選は止める） */
  private advanceOffline(seconds: number): void {
    this.silent = true;
    this.offlineMode = true;
    try {
      this.advance(seconds);
    } finally {
      this.silent = false;
      this.offlineMode = false;
    }
  }

  advance(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    let remaining = seconds;
    let guard = 0;
    while (remaining > 1e-9 && guard++ < 1_000_000) {
      // 昔のぶんは大きくまとめて、直近ぶんは細かく進める。
      // 何時間ぶんも 10秒きざみで回すと、開いた瞬間に画面が固まってしまうため
      const chunk = remaining > 1800 ? CONFIG.catchUpChunkSeconds * 6 : CONFIG.catchUpChunkSeconds;
      const dt = Math.min(remaining, remaining > CONFIG.maxStepSeconds ? chunk : remaining);
      this.tick(dt);
      remaining -= dt;
    }
  }

  /** オフライン進行を適用して報告を返す。maxSeconds を超える分は切り捨てる */
  applyOffline(elapsedSeconds: number, maxSeconds = this.state.settings.maxOfflineSeconds + (this.derived.modifiers?.offlineBonusSec ?? 0)): OfflineReport {
    const safeMax = Number.isFinite(maxSeconds) ? maxSeconds : 0;
    // まだ遊び始めていない（本社を決めていない）うちは、留守のあいだも何も進めない。
    // 決めるのに迷っているだけで「おかえりなさい」が出てしまうため
    const simulated = !hasStarted(this.state)
      ? 0
      : Number.isFinite(elapsedSeconds)
        ? Math.max(0, Math.min(elapsedSeconds, safeMax))
        : 0;
    const before = { ...this.state.inventory };
    const cashBefore = this.state.company.cash;
    const bankrupciesBeforeRef = this.state.stats.bankruptcies ?? 0;
    this.advanceOffline(simulated);
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
      bankrupted: (this.state.stats.bankruptcies ?? 0) > bankrupciesBeforeRef,
    };
  }

  /** 保存前などに派生情報を最新にする */
  refreshDerived(): void {
    this.refreshCapacities();
    computeStocks(this.ctx);
    // 不動産も入れないと総資産が足りず、再出発のポイントが少なく計算されてしまう
    computeEstate(this.ctx);
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

  /** 永続アップグレードを1段階買う */
  buyPrestigeUpgrade(id: string): boolean {
    const ok = buyPrestigeUpgrade(this.state, id);
    if (ok) {
      // 自動化は買ったらすぐ動きだすほうが分かりやすい
      const key = (AUTOMATION_KEYS as AutomationKey[]).find((k) => AUTOMATION_UPGRADE_ID[k] === id);
      if (key) setAutomation(this.state, key, true);
      this.refreshDerived();
    }
    return ok;
  }

  /**
   * 最初に配色（暗い／明るい／端末に合わせる）を選ぶ。
   * あとから設定でいつでも変えられるので、ここは「最初の1回だけ聞く」ための印だけ立てる。
   */
  /** 最初に会社名を決める。あとから設定でいつでも変えられる */
  chooseCompanyName(name: string): boolean {
    const trimmed = (name ?? '').trim().slice(0, 24);
    if (!trimmed) return false;
    this.state.company.name = trimmed;
    this.state.settings.nameChosen = true;
    return true;
  }

  chooseTheme(mode: ThemeMode): void {
    if (mode !== 'dark' && mode !== 'light' && mode !== 'system') return;
    this.state.settings.theme = mode;
    this.state.settings.themeChosen = true;
  }

  // ---- 貿易 ----
  /** 海外から仕入れる（代金は今、品は届いてから） */
  tradeImport(country: CountryCode, resource: ResourceId, qty: number, mode: ShipMode) {
    const r = importOrder(this.ctx, country, resource, qty, mode);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** 海外へ売り渡す（品は今、代金は届いてから） */
  tradeExport(country: CountryCode, resource: ResourceId, qty: number, mode: ShipMode) {
    const r = exportOrder(this.ctx, country, resource, qty, mode);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** 届いた商談を受ける */
  tradeAccept(offerId: number, mode: ShipMode = 'ship') {
    const r = acceptTradeOffer(this.ctx, offerId, mode);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** 届いた商談を断る */
  tradeDecline(offerId: number): boolean {
    return declineTradeOffer(this.ctx, offerId);
  }

  /** こちらから値段を提示して売り込む */
  tradePitch(country: CountryCode, resource: ResourceId, qty: number, unitPrice: number, mode: ShipMode = 'ship') {
    const r = pitchTrade(this.ctx, country, resource, qty, unitPrice, mode);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** 本社の場所を決める。最初の1回だけ（決めたあとは変えられない） */
  setHqLocation(lat: number, lon: number, label?: string): void {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (this.state.settings.hqChosen) return;
    const name = label && label.trim() ? label.trim() : placeLabel(lat, lon);
    this.state.settings.hqLocation = { lat, lon, label: name };
    this.state.settings.hqChosen = true;
    const hq = this.state.lands.find((l) => l.id === 'hq');
    if (hq) hq.region = name;
    this.emit('success', `本社を${name}に置きました。ここが会社の始まりです`, { toast: true });
  }

  /** 本社を初期値（大阪）のままにする（これも1回だけの決定） */
  keepDefaultHq(): void {
    if (this.state.settings.hqChosen) return;
    this.state.settings.hqChosen = true;
    this.emit('info', '本社は大阪のままにしました', { toast: true });
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
  /** 地図で見つけた建物に営業する */
  pitchToPlace(feature: OsmFeature): { ok: boolean; reason?: string } {
    const r = pitchToPlace(this.ctx, feature);
    this.refreshDerived();
    return { ok: r.ok, reason: r.reason };
  }

  /** 覚えている取引先に営業する */
  pitchToClient(clientId: string): { ok: boolean; reason?: string } {
    const r = pitchToClient(this.ctx, clientId);
    this.refreshDerived();
    return { ok: r.ok, reason: r.reason };
  }

  /** 商談を受けて契約する */
  acceptOffer(offerId: number): boolean {
    const ok = acceptOffer(this.ctx, offerId);
    if (ok) this.refreshDerived();
    return ok;
  }

  /** 商談を断る */
  declineOffer(offerId: number): boolean {
    return declineOffer(this.state, offerId);
  }

  /** 契約の1回ぶんを納品する */
  deliverDeal(dealId: number): boolean {
    const ok = deliverDeal(this.ctx, dealId);
    if (ok) {
      this.refreshDerived();
      runAchievements(this.ctx);
    }
    return ok;
  }

  /** 契約を打ち切る */
  cancelDeal(dealId: number): boolean {
    const ok = cancelDeal(this.ctx, dealId);
    if (ok) this.refreshDerived();
    return ok;
  }


  // ---------- 事業（お店・IT会社など） ----------
  /** 事業を始める */
  openDivision(kind: Parameters<typeof openDivision>[1], landId: string, name?: string): { ok: boolean; reason?: string; id?: number } {
    const r = openDivision(this.ctx, kind, landId, name);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** 事業をたたむ */
  closeDivision(id: number): boolean {
    const ok = closeDivision(this.ctx, id);
    if (ok) this.refreshDerived();
    return ok;
  }

  /** 人を雇う・減らす */
  setDivisionStaff(id: number, staff: number): boolean {
    const ok = setStaff(this.ctx, id, staff);
    if (ok) this.refreshDerived();
    return ok;
  }

  /** 事業の名前を変える */
  renameDivision(id: number, name: string): boolean {
    const div = getDivision(this.state, id);
    if (!div) return false;
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return false;
    div.name = trimmed;
    return true;
  }

  /** 広告を出す */
  startAd(id: number, adId: string): { ok: boolean; reason?: string } {
    const r = startAd(this.ctx, id, adId);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** 駐車場として土地を割り当てる・外す */
  toggleParking(id: number, landId: string): boolean {
    return toggleParking(this.ctx, id, landId);
  }

  /** 案件を始める */
  startProject(id: number, projectId: string, pace: ProjectPace = 'normal'): { ok: boolean; reason?: string } {
    const div = getDivision(this.state, id);
    if (!div) return { ok: false, reason: 'その事業はありません' };
    const r = startProject(this.ctx, div, projectId, pace);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** 案件をやめる */
  cancelProject(id: number, projectId: string): boolean {
    const div = getDivision(this.state, id);
    if (!div) return false;
    return cancelProject(this.ctx, div, projectId);
  }

  /** お店へ品物を送る（入荷） */
  restockShop(id: number, resource: ResourceId, amount: number): number {
    const div = getDivision(this.state, id);
    if (!div) return 0;
    const n = restockShop(this.ctx, div, resource, amount);
    if (n > 0) this.refreshDerived();
    return n;
  }

  /** お店から品物を戻す */
  returnFromShop(id: number, resource: ResourceId, amount: number): number {
    const div = getDivision(this.state, id);
    if (!div) return 0;
    const n = returnFromShop(this.ctx, div, resource, amount);
    if (n > 0) this.refreshDerived();
    return n;
  }

  /** お店の自動入荷の目標を決める */
  setRestockTarget(id: number, resource: ResourceId, target: number): boolean {
    const div = getDivision(this.state, id);
    if (!div) return false;
    // 店に置ける量を超える目標は意味がないので、そこで止める
    const cap = shopStockCapacity(this.state, div);
    const n = Math.max(0, Math.min(cap, Math.floor(target)));
    if (n <= 0) delete div.restock[resource];
    else div.restock[resource] = n;
    return true;
  }

  // ---------- 手仕事のミニゲーム ----------
  /**
   * ミニゲーム1回ぶんの結果を反映する。
   * score は「どれだけうまくやれたか」の 0〜1。中で必ず挟み込む。
   */
  playMinigame(id: MinigameId, score: number): MinigameResult {
    const r = playMinigame(this.ctx, id, score);
    if (r.ok) this.refreshDerived();
    return r;
  }

  // ---------- 賭け事 ----------
  /** スロットなどで遊ぶ */
  playGame(gameId: Parameters<typeof play>[1], betId?: string): PlayResult {
    const r = play(this.ctx, gameId, betId);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** パックを開ける */
  openPack(packId: string, count = 1) {
    const r = openPack(this.ctx, packId, count);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** カードを売る */
  sellCard(cardId: string, count: number) {
    const r = sellCard(this.ctx, cardId, count);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** カードを買う */
  buyCard(cardId: string, count: number) {
    const r = buyCard(this.ctx, cardId, count);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** 図鑑がそろった見返りを受け取る */
  claimCardSeries(seriesId: string) {
    const r = claimSeries(this.ctx, seriesId);
    if (r.ok) this.refreshDerived();
    return r;
  }

  /** 市場から資源を買う（転売の仕入れ） */
  buyResource(resourceId: ResourceId, amount: number) {
    const r = buyResource(this.ctx, resourceId, amount);
    if (r.amount > 0) this.refreshDerived();
    return r;
  }

  /** 宝くじを買う */
  buyLotteryTickets(count: number): { ok: boolean; reason?: string; bought: number } {
    const r = buyTickets(this.ctx, count);
    if (r.ok) this.refreshDerived();
    return r;
  }

  // ---------- 自動化 ----------
  /** 自動化のスイッチを切り替える（買っていなければ何も起きない） */
  setAutomation(key: AutomationKey, on: boolean): void {
    setAutomation(this.state, key, on);
  }

  /** 自動クラフトに登録する・外す。上限に達していたら false */
  toggleAutoRecipe(recipeId: RecipeId): boolean {
    return toggleAutoRecipe(this.state, recipeId);
  }

  /** 自動採集する行動を選ぶ・外す */
  toggleAutoGather(actionId: GatherActionId): void {
    toggleAutoGather(this.state, actionId);
  }

  /** すべての資源の自動売却をまとめて入れる・切る（永続アップグレードで解放） */
  setAllAutoSell(enabled: boolean, keep = 0): number {
    if (levelOf(this.state.prestige?.upgrades, 'auto_sell') <= 0) return 0;
    let n = 0;
    for (const id of Object.keys(this.state.discovered) as ResourceId[]) {
      const cfg = this.state.market.autoSell[id];
      this.state.market.autoSell[id] = { enabled, keep: cfg?.keep ?? keep, minPriceRatio: cfg?.minPriceRatio ?? 0 };
      n += 1;
    }
    return n;
  }

  /** 表示中の物件をまとめて買う（永続アップグレード「一括買収」）。買えた数を返す */
  bulkBuyFeatures(features: OsmFeature[]): { bought: number; spent: number; reason?: string } {
    const level = levelOf(this.state.prestige?.upgrades, 'bulk_buy');
    if (level <= 0) return { bought: 0, spent: 0, reason: '「一括買収」を永続アップグレードで解放すると使えます' };
    const limit = BULK_BUY_LIMIT[Math.min(level, BULK_BUY_LIMIT.length) - 1];
    // 所持金を使い切らないよう、半分までに抑える
    let budget = this.state.company.cash * 0.5;
    const candidates = features
      .filter((f) => !this.state.estate.custom?.[f.id])
      .map((f) => ({ f, cost: customBuyCost(this.state, quoteFeature(f)) }))
      .filter((c) => c.cost <= budget)
      .sort((a, b) => a.cost - b.cost);
    let bought = 0;
    let spent = 0;
    this.silent = true;
    try {
      for (const c of candidates) {
        if (bought >= limit) break;
        if (c.cost > budget) continue;
        if (!buyCustomProperty(this.ctx, c.f)) continue;
        bought += 1;
        spent += c.cost;
        budget -= c.cost;
      }
    } finally {
      this.silent = false;
    }
    if (bought > 0) {
      this.refreshDerived();
      runUnlocks(this.ctx);
      this.emit('success', `表示中の物件を ${bought} 件まとめて買いました (-${Math.round(spent).toLocaleString('ja-JP')}円)`, { toast: true });
      return { bought, spent };
    }
    return { bought: 0, spent: 0, reason: '買える物件が見つかりませんでした（所持金の半分までが目安です）' };
  }

  // ---------- 再出発 ----------
  /** 会社を売却して再出発する。実績・設定・永続ボーナスだけ持ち越す */
  prestige(): boolean {
    const next = buildPrestigeState(this.state, this.derived.assets, this.nowFn());
    if (!next) return false;
    const prevPoints = this.state.prestige?.points ?? 0;
    resetLandIndex();
    this.state = next;
    this.ctx.state = next;
    this.derived = createEmptyDerived();
    this.ctx.derived = this.derived;
    this.refreshDerived();
    runUnlocks(this.ctx);
    const gained = next.prestige.points - prevPoints;
    this.emit('success', `会社を売却して再出発しました。永続ポイント +${gained}（合計 ${next.prestige.points}pt）。「会社」の再出発から、強化を買えます`, { toast: true });
    return true;
  }

  // ---------- 気になる場所の印 ----------
  /** 印が付いているか */
  hasBookmark(kind: Bookmark['kind'], id: string): boolean {
    return (this.state.bookmarks ?? []).some((b) => b.kind === kind && b.id === id);
  }

  /**
   * 印を付ける／外す。付いていれば外し、付いていなければ付ける。
   * 数が増えすぎると一覧が読めなくなるので、古いものから落とす。
   */
  toggleBookmark(entry: Omit<Bookmark, 'at'>): boolean {
    if (!this.state.bookmarks) this.state.bookmarks = [];
    const list = this.state.bookmarks;
    const at = list.findIndex((b) => b.kind === entry.kind && b.id === entry.id);
    if (at >= 0) {
      list.splice(at, 1);
      return false;
    }
    list.push({ ...entry, at: this.nowFn() });
    if (list.length > 200) list.splice(0, list.length - 200);
    return true;
  }

  removeBookmark(kind: Bookmark['kind'], id: string): void {
    if (!this.state.bookmarks) return;
    this.state.bookmarks = this.state.bookmarks.filter((b) => !(b.kind === kind && b.id === id));
  }

  /** 印にメモを書く */
  setBookmarkNote(kind: Bookmark['kind'], id: string, note: string): void {
    const b = (this.state.bookmarks ?? []).find((x) => x.kind === kind && x.id === id);
    if (b) b.note = note.slice(0, 120);
  }

  /**
   * 電力会社と契約する容量を決める（MW）。0 は契約しない。
   * 基本料金は契約した容量ぶん必ずかかるので、使う見込みより大きく契約すると損をする。
   */
  setPowerContract(mw: number): void {
    const v = Number.isFinite(mw) ? Math.max(0, mw) : 0;
    if (!this.state.power) this.state.power = { contractMW: 0 };
    this.state.power.contractMW = v;
    this.refreshDerived();
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
