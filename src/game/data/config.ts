/** ゲームバランス・動作の定数。数値調整はここに集約する。 */
export const CONFIG = {
  /** 初期の倉庫容量（資源ごと） */
  baseStorage: 100_000, // 本社の置き場。資源1種につき100t
  /** 開始時の所持金 */
  initialCash: 0,
  /** シミュレーションの更新間隔（ms） */
  simTickMs: 200,
  /** 1回の tick で進める時間の上限（秒）。これを超える場合はまとめて分割計算する */
  maxStepSeconds: 1,
  /** まとめて進める（オフライン・タブ復帰）ときの1区切り（秒） */
  catchUpChunkSeconds: 10,
  /** この秒数以上離れていたら「オフライン進行」として扱う */
  offlineThresholdSeconds: 20,
  /** オフライン進行の最大時間（秒）の初期値 = 8時間 */
  defaultMaxOfflineSeconds: 8 * 60 * 60,
  /** 画面の更新間隔（ms） */
  uiRefreshMs: 500,
  /** 自動保存の間隔（秒） */
  autosaveSeconds: 10,
  /** 操作してから保存するまでの待ち時間（ミリ秒） */
  saveDebounceMs: 700,
  /** 市場価格が変動する間隔（ゲーム内秒） */
  marketUpdateSeconds: 30,
  /** 市場変動の幅 */
  market: {
    minModifier: 0.7,
    maxModifier: 1.4,
    /** 1回の変動でのランダム幅 */
    randomStep: 0.08,
    /** 1.0 へ戻ろうとする強さ */
    meanReversion: 0.06,
    /** 売却による価格下落の上限（1回あたり） */
    maxSellImpact: 0.12,
    /** 資源の liquidity 個ぶんを一度に売ったときの価格下落率 */
    impactPerLiquidity: 0.05,
    /** 価格履歴の保持数 */
    historyLength: 120,
    /**
     * 需要曲線: 市場に流した量（飽和量）が需要容量に達すると価格が半分になる。
     * 価格 = 基準 × 変動係数 × 1 / (1 + 飽和量 / 需要容量)
     *
     * 需要容量そのものは data/demand.ts で決める（「その品を作るいちばん小さい
     * 施設 25 棟ぶん」× 売り先の広がり）。ここに倍率は置かない——置くと、
     * 品目ごとの釣り合いと売り先の広がりが、2ヵ所に分かれて合わなくなる。
     */
    /** 飽和量が 1/e（約37%）に減るまでの秒数（需要の回復の速さ） */
    demandRecoverySeconds: 180,
  },
  /** イベント（相場変動・災害など） */
  events: {
    /** 最初のイベントまでの秒数 */
    firstDelaySeconds: 240,
    /** イベントの間隔（秒）の下限・上限 */
    minIntervalSeconds: 180,
    maxIntervalSeconds: 420,
    /** 同時に起きるイベントの上限 */
    maxActive: 3,
  },
  /** 不動産（実在の場所の土地・物件） */
  estate: {
    /** 不動産・株式の解放に必要な総資産（円） */
    unlockAssets: 300_000_000,
    /** 購入時の手数料（価格に対する割合） */
    buyFee: 0.03,
    /** 売却時の手数料 */
    sellFee: 0.03,
    /** 地価が動く間隔（秒） */
    updateSeconds: 20,
    /** 地価倍率の下限・上限 */
    minMult: 0.3,
    maxMult: 30,
  },
  /** 株式 */
  stocks: {
    /** 売買のスプレッド（片道） */
    spread: 0.005,
    /** 発行株数の100%を一度に買ったときの株価上昇率（需給係数に掛かる） */
    impact: 1.5,
    /** 需給係数が1へ戻る速さ（1時間あたり） */
    sentimentReversion: 0.5,
    minSentiment: 0.4,
    maxSentiment: 4,
    /** 株価が動く間隔（秒） */
    updateSeconds: 10,
    /** 再投資した利益のうち事業価値になる割合（残りは内部留保） */
    reinvestEfficiency: 0.6,
    /** 増設の費用（事業価値に対する割合）と、増える事業価値の割合 */
    expandCostRatio: 0.1,
    expandGain: 0.1,
    /** 買収（残りの株をすべて買う）のプレミアム */
    acquirePremium: 0.25,
    /** 解体したときの評価率（物件・事業） */
    liquidationPropertyRatio: 0.85,
    liquidationBusinessRatio: 0.25,
    /** 株価履歴の保持数 */
    historyLength: 120,
  },
  /** 注文 */
  contracts: {
    firstDelaySeconds: 180,
    minIntervalSeconds: 240,
    maxIntervalSeconds: 480,
    maxActive: 2,
    /** 期限（秒） */
    minDuration: 600,
    maxDuration: 1200,
    /** 量 = 生産量 × この秒数（最低 minAmount） */
    amountSeconds: 300,
    minAmount: 20,
    /** 報酬の倍率（基準価格に対する） */
    minRewardMult: 1.4,
    maxRewardMult: 2.0,
    /** 達成で得る信用ポイントの基準（報酬額の対数で増える） */
    creditPerContract: 25,
    /** 期限切れで失う信用ポイント */
    creditPenalty: 10,
    /** 解放に必要な累計売上（円） */
    unlockEarned: 5_000,
  },
  /** ライバル会社（他社の行動） */
  rivals: {
    /** 物件を買う判定の間隔（秒） */
    buyIntervalSeconds: 60,
    /** 1回の判定で各社が物件を買う確率 */
    buyChance: 0.015,
    /** 市場に残す物件の割合（これを下回ったら他社は買わない） */
    marketFloorRatio: 0.4,
    /** 各社が初期の物件に加えて買える上限 */
    maxExtraProperties: 3,
    /** 買う物件の価格の上限（会社の現金に対する割合） */
    buyCashRatio: 0.8,
    /** 増資の判定間隔（秒） */
    issueIntervalSeconds: 600,
    /** 増資の確率（成長重視の会社のみ） */
    issueChance: 0.25,
    /** 1回の増資で増える株の割合 */
    issueRatio: 0.05,
  },
  /** 再出発（プレステージ） */
  prestige: {
    /** 会社を売却できる総資産（円） */
    minAssets: 1_000_000_000,
    /** ポイント = floor(sqrt(総資産 / この額)) */
    assetsPerPoint: 100_000_000,
    /** 1ポイントあたりの永続ボーナス */
  },
  /** イベント履歴の保持数 */
  eventLogLength: 100,
  /** 会社価値の計算に使う、施設の購入額の評価率 */
  facilityValueRatio: 0.7,
  /** 土地システムの解放に必要な資産（円） */
  // 地図（土地）が開く総資産。本社だけの拾い集めで30分ほどで届く値にしてある
  landUnlockAssets: 2_000_000,
  /** 購入した土地の初期倉庫容量（資源ごと、kg）。更地でも野積みできるぶん */
  landBaseStorage: 200_000,
  /** 鉱脈の量のばらつき（±） */
  depositVariance: 0.2,
  /** 総資産に含める土地の評価率 */
  landValueRatio: 1,
  /** 遠隔地の施設に本社から材料を運ぶとき、何秒ぶんの在庫を現地に置くか */
  supplyBufferSeconds: 30,
  /** 液体として扱う資源（パイプラインで運べる） */
  liquidResources: ['crude_oil', 'fuel', 'water'],
} as const;
