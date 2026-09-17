import type { CompanyPolicy } from '@/game/data/companies';
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
  /** 下限価格（基準価格に対する比率）。相場がこれを下回るときは売らない（販売係が必要） */
  minPriceRatio?: number;
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
  /** 累計の賃料収入（円） */
  rentEarned: number;
  /** 累計の配当収入（円） */
  dividendsEarned: number;
  /** 買った物件の数 */
  propertiesBought: number;
  /** 売った物件の数 */
  propertiesSold: number;
  /** 株の売買で確定した損益（円） */
  tradingProfit: number;
  /** 買収した会社の数 */
  companiesAcquired: number;
  /** 解体した会社の数 */
  companiesDissolved: number;
  /** 達成した注文の数 */
  contractsCompleted: number;
  /** 期限切れになった注文の数 */
  contractsFailed: number;
  /** 注文で得た報酬（円） */
  contractRewards: number;
  /** マネージャーに払った給料の累計（円） */
  salariesPaid: number;
  /** マネージャーが代わりに採集した回数 */
  autoGathered: number;
  /** マネージャーが代わりにクラフトした回数 */
  autoCrafted: number;
  /** 一度の売却で最も高かった記録 */
  bestSale: { resource: string; qty: number; revenue: number } | null;
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

export type ThemeMode = 'dark' | 'light' | 'system';

export interface SettingsState {
  numberFormat: NumberFormatMode;
  /** 画面の配色 */
  theme: ThemeMode;
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
  /** ESTATE 画面の表示 */
  estateView: 'map' | 'list' | 'stocks';
}

/** 所有している不動産 */
export interface OwnedProperty {
  boughtAt: number;
  /** 買値（手数料込み） */
  boughtPrice: number;
}

export interface EstateState {
  /** 物件ID → 所有情報 */
  owned: Record<string, OwnedProperty>;
  /** 都市ID → 地価の倍率（基準価格に掛かる） */
  cityMult: Record<string, number>;
  /** 会社が持っている物件（物件ID → 会社ID）。買収・解体で外れる */
  companyOwned: Record<string, string>;
  /** 次の地価更新までの秒数 */
  nextUpdateIn: number;
}

/** 会社ごとの株式の状態 */
export interface CompanyStockState {
  /** 需給係数（売買と相場で動き、1に戻ろうとする） */
  sentiment: number;
  /** プレイヤーの保有株数 */
  playerShares: number;
  /** 平均取得単価（円/株） */
  avgCost: number;
  /** 事業価値の倍率（再投資・増設で増える） */
  growth: number;
  /** 内部留保（円） */
  cash: number;
  policy: CompanyPolicy;
  expansions: number;
  dissolved: boolean;
  /** 株価の履歴 */
  history: number[];
  /** 増資で増えた株数（発行株数 = 定義の株数 + これ） */
  extraShares: number;
}

export interface StocksState {
  companies: Record<string, CompanyStockState>;
  nextUpdateIn: number;
  /** ライバル会社が次に動くまでの秒数 */
  rivalIn: number;
  /** 次の増資判定までの秒数 */
  issueIn: number;
}

// ---------- 自動化（マネージャー・在庫ルール・自動投資・テンプレート） ----------
export type ManagerId = 'gather' | 'craft' | 'sales' | 'logistics' | 'invest';

export interface ManagerHire {
  hiredAt: number;
}

/** 利益の自動投資の設定（投資係が使う） */
export interface InvestRule {
  /** 手元に残す現金（これを超えた分だけ投資に回す） */
  reserve: number;
  /** 回収が最も早い施設を建てる */
  facilities: boolean;
  /** 配当を株に再投資する */
  dividends: boolean;
  /** 利回りの良い物件を買う */
  properties: boolean;
  /** 施設に投資するときに許す最長の回収時間（秒） */
  maxPaybackSeconds: number;
}

/** 土地の施設構成のテンプレート */
export interface LandTemplate {
  id: number;
  name: string;
  /** 施設ID → 個数 */
  facilities: Record<string, number>;
  createdAt: number;
}

export interface AutomationState {
  managers: Partial<Record<ManagerId, ManagerHire>>;
  /** 資源ごとに「常にこの量をキープ」（不足分をクラフト係が作る） */
  craftTargets: Partial<Record<ResourceId, number>>;
  /** 販売係の「おまかせ販売」（消費されない資源の余剰を自動で売る） */
  smartSell: boolean;
  invest: InvestRule;
  templates: LandTemplate[];
  /** 次の自動処理までの秒数（負荷を下げるため1秒ごと） */
  timer: number;
  /** 再投資待ちの配当（円） */
  dividendPool: number;
}

// ---------- 注文（コントラクト） ----------
export interface Contract {
  id: number;
  /** 依頼主（架空） */
  client: string;
  resource: ResourceId;
  amount: number;
  delivered: number;
  /** 達成時の報酬（円） */
  reward: number;
  /** 達成時の信用ポイント */
  credit: number;
  /** 残り秒数 */
  remaining: number;
  total: number;
}

export interface ContractsState {
  active: Contract[];
  nextIn: number;
  nextId: number;
  /** 信用ポイント（ランクの元） */
  credit: number;
}

// ---------- 再出発（プレステージ） ----------
export interface PrestigeRecord {
  at: number;
  assets: number;
  points: number;
}

export interface PrestigeState {
  /** 再出発した回数 */
  count: number;
  /** 累計ポイント（永続ボーナスの元） */
  points: number;
  history: PrestigeRecord[];
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
  estate: EstateState;
  stocks: StocksState;
  automation: AutomationState;
  contracts: ContractsState;
  prestige: PrestigeState;
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
  /** 実際に消費している資源（個/秒） */
  inputRates: Partial<Record<ResourceId, number>>;
  /** 実際に作っている資源（個/秒） */
  outputRates: Partial<Record<ResourceId, number>>;
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
  /** 研究ポイントの倍率（再出発ボーナス） */
  researchRate: number;
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
  /** 株価全体に掛かる倍率（株高・株安） */
  stock: number;
}

/** 会社ごとの計算結果（保存しない） */
export interface CompanyRuntime {
  /** 現在の株価（円/株） */
  price: number;
  /** 需給を除いた理論株価 */
  fundamental: number;
  marketCap: number;
  /** 1時間あたりの利益（円） */
  earningsPerHour: number;
  /** 所有物件の評価額（円） */
  propertyValue: number;
  /** プレイヤーの持株比率 0〜1 */
  ownership: number;
  /** プレイヤーへの配当（円/秒） */
  dividendPerSec: number;
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
  /** tick の外（納品など）で得た収入。次の tick で incomePerSec に加算して 0 に戻す */
  extraIncome: number;
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
  /** 所有する不動産の評価額（円） */
  estateValue: number;
  /** 賃料収入（円/秒） */
  rentPerSec: number;
  /** 物件を持っている国の数 */
  estateCountries: number;
  /** 保有株の評価額（円） */
  stockValue: number;
  /** 配当収入（円/秒） */
  dividendPerSec: number;
  companies: Record<string, CompanyRuntime>;
  /** マネージャーの給料（円/秒） */
  salaryPerSec: number;
  /** 信用ランク（E〜S） */
  creditRank: CreditRank;
}

export type CreditRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface OfflineReport {
  elapsedSeconds: number;
  simulatedSeconds: number;
  capped: boolean;
  resourceDelta: Partial<Record<ResourceId, number>>;
  cashDelta: number;
}
