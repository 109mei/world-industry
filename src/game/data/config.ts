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
