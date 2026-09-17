/** ゲームバランス・動作の定数。数値調整はここに集約する。 */
export const CONFIG = {
  /** 初期の倉庫容量（資源ごと） */
  baseStorage: 100,
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
     * 需要曲線: 市場に流した量（飽和量）が liquidity × この倍率 に達すると価格が半分になる。
     * 価格 = 基準 × 変動係数 × 1 / (1 + 飽和量 / 需要容量)
     */
    demandCapacityMult: 25,
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
    unlockAssets: 3_000_000,
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
  /** イベント履歴の保持数 */
  eventLogLength: 100,
  /** 会社価値の計算に使う、施設の購入額の評価率 */
  facilityValueRatio: 0.7,
  /** 土地システムの解放に必要な資産（円） */
  landUnlockAssets: 1_000_000,
  /** 購入した土地の初期倉庫容量（資源ごと） */
  landBaseStorage: 2_000,
  /** 鉱脈の量のばらつき（±） */
  depositVariance: 0.2,
  /** 総資産に含める土地の評価率 */
  landValueRatio: 1,
  /** 遠隔地の施設に本社から材料を運ぶとき、何秒ぶんの在庫を現地に置くか */
  supplyBufferSeconds: 30,
  /** 液体として扱う資源（パイプラインで運べる） */
  liquidResources: ['crude_oil', 'fuel', 'water'],
} as const;
