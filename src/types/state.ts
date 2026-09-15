import type { ResourceId } from '@/game/data/resources';
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
}

/** 道具は同じ種類をまとめて持つ。durability は「いま使っている1本」の残り回数 */
export interface ToolStack {
  count: number;
  durability: number;
}

export interface FacilityInstance {
  /** インスタンスID（将来、土地ごとに複数持てるようにするため） */
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
}

export type GameEventType = 'info' | 'success' | 'warn' | 'unlock' | 'achievement' | 'tutorial';

export interface GameEvent {
  id: number;
  time: number;
  type: GameEventType;
  message: string;
}

/** 土地。MVPでは本社（hq）だけ存在する */
export interface LandState {
  id: string;
  name: string;
  country: string;
  region: string;
}

export interface SettingsState {
  numberFormat: NumberFormatMode;
  autosaveSeconds: number;
  maxOfflineSeconds: number;
  showTutorial: boolean;
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
  /** 解放済みのもの。キーは "facility:xxx" "recipe:xxx" "gather:xxx" */
  unlocked: Record<string, true>;
  achievements: Record<string, number>;
  tutorial: { step: number; completed: boolean };
  research: { completed: Record<string, true> };
  eventLog: GameEvent[];
  nextEventId: number;
  settings: SettingsState;
}

export type FacilityStatus = 'running' | 'partial' | 'no_input' | 'storage_full' | 'disabled' | 'idle';

export interface FacilityRuntime {
  status: FacilityStatus;
  efficiency: number;
  /** 不足している入力資源 */
  missingInputs: ResourceId[];
  /** 満杯で止まっている出力資源 */
  blockedOutputs: ResourceId[];
}

/** 毎 tick 計算し直す派生情報（保存しない） */
export interface DerivedState {
  production: Partial<Record<ResourceId, number>>;
  consumption: Partial<Record<ResourceId, number>>;
  capacity: number;
  facilityRuntime: Record<string, FacilityRuntime>;
  /** 自動売却などによる収入（円/秒、直近10秒の平均） */
  incomePerSec: number;
  /** 収入の直近10秒ぶんの記録（1秒ごとのバケツ） */
  incomeBuckets: number[];
  incomeBucketElapsed: number;
  /** 総資産 */
  assets: number;
  companyValue: number;
  employees: number;
  inventoryValue: number;
}

export interface OfflineReport {
  elapsedSeconds: number;
  simulatedSeconds: number;
  capped: boolean;
  resourceDelta: Partial<Record<ResourceId, number>>;
  cashDelta: number;
}
