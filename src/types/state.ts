import type { ResourceId } from '@/game/data/resources';
import type { TerrainId } from '@/game/data/terrain';
import type { ToolId } from '@/game/data/tools';

export type NumberFormatMode = 'short' | 'full';

export interface CompanyState {
  name: string;
  cash: number;
  /** 累計の売上（円） */
  totalEarned: number;
  /** 累計の支出（円） */
  totalSpent: number;
  /** 施設購入に使った累計（会社価値の計算用） */
  facilityInvestment: number;
  /** 土地購入に使った累計 */
  landInvestment: number;
}

/** 道具は同じ種類をまとめて持つ。durability は「いま使っている1本」の残り回数 */
export interface ToolStack {
  count: number;
  durability: number;
}

export interface FacilityInstance {
  /** インスタンスID（"<landId>:<typeId>"） */
  id: string;
  typeId: string;
  landId: string;
  count: number;
  enabled: boolean;
}

export interface MarketResourceState {
  /** basePrice に掛かる係数 */
  modifier: number;
  /** 価格の履歴（更新ごとの価格） */
  history: number[];
  /** 市場に流した量（需要の飽和）。多いほど価格が下がり、時間で減る */
  saturation: number;
}

export interface AutoSellConfig {
  enabled: boolean;
  /** この量を超えた分を自動で売る */
  keep: number;
}

export interface MarketState {
  prices: Partial<Record<ResourceId, MarketResourceState>>;
  autoSell: Partial<Record<ResourceId, AutoSellConfig>>;
  /** 次の価格変動までの秒数 */
  nextUpdateIn: number;
}

export interface StatsState {
  taps: number;
  /** 累計入手量（採集＋生産＋クラフト） */
  totalObtained: Partial<Record<string, number>>;
  totalGathered: Partial<Record<string, number>>;
  totalProduced: Partial<Record<string, number>>;
  totalSold: Partial<Record<string, number>>;
  /** レシピIDごとのクラフト回数 */
  crafted: Partial<Record<string, number>>;
  /** 道具IDごとの作成数 */
  toolsCrafted: Partial<Record<string, number>>;
  toolsBroken: number;
  playtimeSeconds: number;
  /** 累計の輸送量（t） */
  totalTransported: number;
  /** 累計の発電量（MWh） */
  totalGeneratedMWh: number;
  /** 累計の商業収入（円） */
  totalCommercialIncome: number;
  /** 累計の輸送費（円） */
  totalTransportCost: number;
  /** 起きたイベントの回数 */
  eventsOccurred: number;
  /** 乗り切った災害の回数 */
  disasters: number;
}

export type GameEventType = 'info' | 'success' | 'warn' | 'unlock' | 'achievement' | 'tutorial' | 'event';

export interface GameEvent {
  id: number;
  time: number;
  type: GameEventType;
  message: string;
  /** 実績解除のとき、その実績ID */
  achievementId?: string;
  /** ランダムイベントのとき、その定義ID */
  eventId?: string;
}

/** 進行中のランダムイベント */
export interface ActiveEvent {
  /** 発生ごとの通し番号 */
  id: number;
  /** data/events.ts の定義ID */
  defId: string;
  /** 対象（資源ID か 土地ID）。全体に効くイベントは null */
  target: string | null;
  /** 残り秒数 */
  remaining: number;
  total: number;
  magnitude: number;
}

export interface EventsState {
  active: ActiveEvent[];
  /** 次のイベントまでの秒数 */
  nextIn: number;
  nextId: number;
}

/**
 * 調査段階。0=未調査 1=簡易調査 2=地質調査 3=試掘 4=確定（実際に採掘して確定）
 */
export type SurveyLevel = 0 | 1 | 2 | 3 | 4;

export interface SurveyProgress {
  /** 完了したときの段階 */
  targetLevel: SurveyLevel;
  /** 残り秒数 */
  remaining: number;
  total: number;
}

/** 土地にある鉱床。total は最初の量、remaining は残量 */
export interface DepositState {
  total: number;
  remaining: number;
}

/** 土地。本社（hq）は最初から所有している */
export interface LandState {
  id: string;
  name: string;
  country: string;
  region: string;
  terrain: TerrainId;
  purchasedAt: number;
  survey: SurveyLevel;
  surveyProgress: SurveyProgress | null;
  /** 鉱床（購入時に決まる）。本社にはない */
  deposits: Partial<Record<ResourceId, DepositState>>;
  /** その土地の倉庫（本社は state.inventory を使うので空） */
  stock: Partial<Record<ResourceId, number>>;
}

export interface ResearchState {
  completed: Record<string, true>;
  /** 研究ポイント */
  points: number;
  /** 累計で得た研究ポイント */
  totalPoints: number;
}

export interface SettingsState {
  numberFormat: NumberFormatMode;
  autosaveSeconds: number;
  maxOfflineSeconds: number;
  showTutorial: boolean;
  /** 効果音 */
  sound: boolean;
  /** 効果音の音量 0〜1 */
  volume: number;
  /** ランダムイベントを起こす */
  events: boolean;
  /** LAND 画面の表示（地図 or リスト） */
  landView: 'map' | 'list';
}

export interface GameState {
  saveVersion: number;
  meta: {
    createdAt: number;
    lastSaveTime: number;
    lastTickTime: number;
  };
  company: CompanyState;
  inventory: Partial<Record<ResourceId, number>>;
  /** 一度でも入手した資源（一覧に表示する） */
  discovered: Partial<Record<ResourceId, true>>;
  tools: Partial<Record<ToolId, ToolStack>>;
  facilities: FacilityInstance[];
  lands: LandState[];
  market: MarketState;
  stats: StatsState;
  /** 解放済みのもの。キーは "facility:xxx" "recipe:xxx" "gather:xxx" "land:xxx" */
  unlocked: Record<string, true>;
  achievements: Record<string, number>;
  tutorial: { step: number; completed: boolean };
  research: ResearchState;
  events: EventsState;
  eventLog: GameEvent[];
  nextEventId: number;
  settings: SettingsState;
}

export type FacilityStatus = 'running' | 'partial' | 'no_input' | 'storage_full' | 'no_power' | 'depleted' | 'disabled' | 'idle';

export interface FacilityRuntime {
  status: FacilityStatus;
  efficiency: number;
  /** 不足している入力資源 */
  missingInputs: ResourceId[];
  /** 満杯で止まっている出力資源 */
  blockedOutputs: ResourceId[];
  /** 電力の供給率（電力を使う施設のみ） */
  powerRatio: number;
  /** 枯渇した鉱床の資源 */
  depleted: ResourceId[];
}

export interface PowerRuntime {
  /** 発電能力（MW、燃料があるぶん） */
  capacity: number;
  /** 需要（MW） */
  demand: number;
  /** 実際の発電量（MW） */
  generation: number;
  /** 供給率 0〜1 */
  ratio: number;
  /** 発電施設ごとの出力（MW） */
  byFacility: Record<string, number>;
}

export interface LandRuntime {
  /** その土地の倉庫容量 */
  capacity: number;
  /** 輸送能力（t/秒） */
  transportCapacity: number;
  /** 使用中の輸送量（t/秒） */
  transportUsed: number;
  /** 輸送費（円/秒） */
  transportCost: number;
  /** 本社へ運んでいる資源（個/秒） */
  exports: Partial<Record<ResourceId, number>>;
  /** 本社から運んでいる資源（個/秒） */
  imports: Partial<Record<ResourceId, number>>;
  /** 輸送手段がなく運べない */
  noRoute: boolean;
}

/** 研究で変わる係数 */
export interface Modifiers {
  /** 施設カテゴリごとの生産倍率 */
  production: Record<string, number>;
  powerGeneration: number;
  renewableGeneration: number;
  transportCapacity: number;
  transportCost: number;
  surveyCost: number;
  surveyTime: number;
  storage: number;
  commercialIncome: number;
  demandRecovery: number;
}

/** 進行中のイベントから計算した係数（保存しない） */
export interface EventModifiers {
  /** 土地IDごとの生産倍率 */
  landProduction: Record<string, number>;
  /** 輸送手段の種類ごとの能力倍率 */
  transport: Record<string, number>;
  /** 発電能力の倍率 */
  power: number;
  /** 商業施設の収入倍率 */
  commercial: number;
}

/** 毎 tick 計算し直す派生情報（保存しない） */
export interface DerivedState {
  eventMods: EventModifiers;
  production: Partial<Record<ResourceId, number>>;
  consumption: Partial<Record<ResourceId, number>>;
  capacity: number;
  facilityRuntime: Record<string, FacilityRuntime>;
  /** 自動売却・商業収入・輸送費を合わせた収入（円/秒、直近10秒の平均） */
  incomePerSec: number;
  /** 収入の直近10秒ぶんの記録（1秒ごとのバケツ） */
  incomeBuckets: number[];
  incomeBucketElapsed: number;
  /** 総資産 */
  assets: number;
  companyValue: number;
  employees: number;
  inventoryValue: number;
  power: PowerRuntime;
  lands: Record<string, LandRuntime>;
  modifiers: Modifiers;
  /** 商業施設の収入（円/秒） */
  commercialIncome: number;
  /** 輸送費（円/秒） */
  transportCost: number;
  /** 研究ポイントの増加（/秒） */
  researchRate: number;
}

export interface OfflineReport {
  elapsedSeconds: number;
  simulatedSeconds: number;
  capped: boolean;
  resourceDelta: Partial<Record<ResourceId, number>>;
  cashDelta: number;
}
