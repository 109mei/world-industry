import type { PropertyKind } from '@/game/data/properties';
import type { CompanyPolicy } from '@/game/data/companies';
import type { RecipeId } from '@/game/data/recipes';
import type { GatherActionId } from '@/game/data/gathering';
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
  /** 人口・交通量の係数（商業施設の収入に掛かる）。地図で買った建物はここに入る */
  population?: number;
  /** その土地の価値（円）。調査費用の計算などに使う。地図で買った場所に入る */
  value?: number;
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
  /** 地図を立体（3D）で表示する。既定は平面（2D）で、地図のボタンで切り替える */
  map3D?: boolean;
  /** 本社の場所（地図に出す位置）。未設定なら初期値（大阪） */
  hqLocation?: { lat: number; lon: number; label: string } | null;
  /** 本社の場所を決めたか（最初に1回だけ決められる） */
  hqChosen?: boolean;
  /** 施設一覧で「今建てられるものだけ」を表示する */
  factoryOnlyBuildable: boolean;
  /** クラフト一覧で「作れるものだけ」を表示する */
  craftOnlyMakeable: boolean;
  /** ESTATE 画面の表示 */
  estateView: 'map' | 'list' | 'stocks';
}

/** 所有している不動産 */
export interface OwnedProperty {
  boughtAt: number;
  /** 買値（手数料込み） */
  boughtPrice: number;
}

/** 地図から買った実在の場所（建物・区画）。名前はもじった架空名で、実名は持たない */
export interface CustomProperty {
  /** OSM の ID（'w123456'） */
  id: string;
  /** 表示名（架空） */
  name: string;
  /** 用途のラベル（コンビニ・住宅・工場など） */
  label: string;
  kind: PropertyKind;
  lat: number;
  lon: number;
  /** 敷地・建物の面積（㎡） */
  areaSqm: number;
  levels: number;
  /** 買ったときの土地の単価（円/㎡） */
  unitPrice: number;
  /** 地価倍率を掛ける前の評価額（円） */
  basePrice: number;
  /** 知名度の倍率（有名な場所ほど高い。1 なら無名）。古いセーブにはない */
  prominence?: number;
  /** 価格が連動する都市 */
  cityId: string;
  /** 表示用の場所（「福岡・飯塚の近く」など） */
  regionLabel: string;
  /** 地形（買ったときに決まる） */
  terrain?: TerrainId;
  country: string;
  boughtAt: number;
  boughtPrice: number;
}

export interface EstateState {
  /** 物件ID → 所有情報 */
  owned: Record<string, OwnedProperty>;
  /** 地図から買った実在の場所（OSM の ID → 情報） */
  custom?: Record<string, CustomProperty>;
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

// ---------- 営業・契約・納品 ----------

/** 取引先（地図に実在する建物）。名前はもじった架空名 */
export interface SalesClient {
  /** OSM の ID */
  id: string;
  name: string;
  label: string;
  kind: PropertyKind;
  lat: number;
  lon: number;
  areaSqm: number;
  levels: number;
  /** 表示用の場所 */
  regionLabel: string;
  /** 関係（0〜100）。納品で上がり、落とすと下がる */
  relation: number;
  /** 最後に営業した時刻（ミリ秒。クールダウン用） */
  lastPitchAt: number;
  /** 結んだ契約の数 */
  deals: number;
  /** 納品した回数 */
  deliveries: number;
  /** 落とした回数 */
  missed: number;
}

/** 営業で得た商談（受けるか断るか） */
export interface DealOffer {
  id: number;
  /** 取引先（建物）の ID */
  clientId: string;
  resource: ResourceId;
  /** 1回に納める数 */
  amountPer: number;
  /** 単価（円） */
  unitPrice: number;
  /** 納品の回数 */
  deliveries: number;
  /** 1回ぶんの納期（秒） */
  intervalSec: number;
  /** この商談が消えるまでの秒数 */
  expiresIn: number;
}

/** 結んだ契約 */
export interface Deal {
  id: number;
  /** 取引先（建物）の ID */
  clientId: string;
  resource: ResourceId;
  amountPer: number;
  unitPrice: number;
  /** 残りの納品回数 */
  deliveriesLeft: number;
  intervalSec: number;
  /** 次の納期までの残り秒数 */
  remaining: number;
  /** 落とした回数（規定を超えると打ち切り） */
  missed: number;
  startedAt: number;
}

export interface SalesState {
  clients: Record<string, SalesClient>;
  offers: DealOffer[];
  deals: Deal[];
  nextId: number;
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
  /** 累計ポイント（永続アップグレードに使う） */
  points: number;
  /** 永続アップグレードの段階 */
  upgrades?: Record<string, number>;
  history: PrestigeRecord[];
}

/** 永続アップグレードで買った自動化の ON/OFF と、その進み具合 */
export interface AutomationState {
  /** 種類ごとの ON/OFF（買っていないものは出てこない） */
  on: Partial<Record<AutomationKey, boolean>>;
  /** 自動で作りつづけるレシピ */
  recipes: RecipeId[];
  /** 自動で採集する行動（空なら解放しているものを順番に） */
  gathers: GatherActionId[];
  /** 内部の時計（秒）。保存する */
  timers: Partial<Record<AutomationKey, number>>;
}

export type AutomationKey = 'gather' | 'craft' | 'deliver' | 'pitch' | 'survey' | 'build';

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
  contracts: ContractsState;
  /** 営業・契約・納品 */
  sales?: SalesState;
  prestige: PrestigeState;
  /** 自動化の設定（永続アップグレードで買ったもの） */
  automation: AutomationState;
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
  /** 手作業の採集量の倍率 */
  gatherAmount: number;
  /** クラフトの出来高の倍率 */
  craftYield: number;
  /** 売値の倍率 */
  sellPrice: number;
  /** 買った土地の埋蔵量の倍率 */
  depositAmount: number;
  /** 営業が通る確率に足す値 */
  pitchChance: number;
  /** 契約の単価の倍率 */
  dealPrice: number;
  /** 納品で上がる関係の倍率 */
  relationGain: number;
  /** オフライン進行の上限に足す秒数 */
  offlineBonusSec: number;
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
