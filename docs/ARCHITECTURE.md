# アーキテクチャメモ

## 全体の流れ

```
main.tsx
  └ createRuntime()            … セーブ読み込み → オフライン進行 → GameEngine 生成 → GameLoop 開始
       ├ GameEngine            … 状態（GameState）と派生情報（DerivedState）を持つ。UI に依存しない
       │    ├ tick(dt)         … 生産 → 市場変動 → 自動売却 → 会社指標 → 解放 → チュートリアル → 実績
       │    ├ advance(sec)     … 長い時間を 10 秒ずつに分けて tick（オフライン・タブ復帰）
       │    └ gather / craft / sell / buyFacility / setFacilityEnabled …
       ├ GameLoop              … setInterval 200ms。UI 更新は 500ms ごとに version を進めるだけ
       └ SaveService           … JSON 化・バージョン移行。保存先は SaveRepository（LocalStorage / Memory / 将来のサーバー）
App.tsx
  └ useGame()                  … version を購読し、engine.state / engine.derived を読むだけ
```

## 設計のルール

- **ロジックは engine に、表示は features/components に**。React コンポーネントの中で生産計算をしない
- **データ駆動**。資源・レシピ・施設・解放条件は `game/data` の配列で定義し、エンジンはそれを解釈する
- **タイマーは1つ**。施設や資源ごとに setInterval を作らない
- **浮動小数点**は内部で許容し、表示時に `utils/format.ts` で丸める。`inventory.clean()` で -1e-14 のようなゴミを消す
- **保存はバージョン付き**。`GAME_META.saveVersion`（現在 5）と `migrations.ts` で古いセーブを変換する（v4 → v5 は automation / contracts / prestige / extraShares / 新しい統計を補う）

## 施設の生産（systems/production.ts）

1 tick で、各施設について
1. 入力がどれだけ足りるか（0〜1）
2. 出力先の倉庫にどれだけ空きがあるか（0〜1）
の小さいほうを効率とし、その分だけ消費・生産する。効率 0 のときは「材料不足」または「倉庫満杯」として停止扱いにし、稼働→停止の瞬間だけ通知を出す。

施設はデータ定義順（採集 → 加工 → 製造）に処理するので、同じ tick で採れた鉱石を製鉄所が使える。

## 市場（systems/market.ts）

- 価格 = 基準価格 × 相場係数（0.70〜1.40）× 需要係数 × イベント倍率
- 30 秒ごとに、1.0 へ戻る力＋ランダムで相場係数が変動
- 需要係数 = 1 / (1 + 飽和量 / 需要容量)。売った量が飽和量に加わり、`CONFIG.market.demandRecoverySeconds` の時定数で指数的に減る（研究 `demandRecovery` で速くなる）。需要容量 = `liquidity × demandCapacityMult`（需要急増イベントで倍増）
- `sellRevenue()` は需要曲線を積分した売上（`ref × C × ln((C + s0 + q) / (C + s0))`）。大量売却ほど1個あたりが安くなる
- 売却すると `流動性` に応じて相場係数も少し下がる（短期の値崩れ）
- 履歴は最大 120 点（グラフ用）

## イベント（data/events.ts, systems/events.ts）

- `EVENTS` に種類（boom/crash/demand/quake/storm/heatwave/festival/discovery/subsidy）・継続時間・重み・強さを定義。`runEvents()` が残り時間を減らし、`state.events.nextIn` が 0 になったら重み付きで抽選して `state.events.active` に追加（対象は資源IDか土地ID）
- 継続効果は `computeEventMods()` で `derived.eventMods`（土地ごとの生産倍率・輸送手段ごとの倍率・発電倍率・商業倍率）にまとめ、生産・電力・物流が参照する。価格系は `market.ts` の `eventPriceMultiplier()` / `eventDemandMultiplier()` が `state.events.active` を直接見る
- 即時効果（鉱脈発見・補助金）は `applyInstant()`。オフライン計算中（`ctx.offline()`）は新しいイベントを起こさない。設定 `settings.events` で無効化
- 輸送手段は `TransportSpec.kind`（road/rail/sea/pipe/air）を持ち、地震は road/rail、嵐は sea/air に効く

## 解放（systems/unlocks.ts）

`UnlockCondition` を毎 tick 評価し、満たしたら `state.unlocked["facility:xxx"]` に記録して通知。一度解放されたものは戻らない。

## 土地（engine/land.ts, actions/land.ts, systems/survey.ts）

- `state.lands[]`: 本社 `hq` ＋購入した土地。各土地は `terrain`（地形）・`survey`（0〜4）・`deposits`（鉱脈の total/remaining）・`stock`（現地の在庫）を持つ
- 在庫の置き場は `stockOf(state, land)`: 本社は `state.inventory`、土地は `land.stock`。倉庫容量は `landCapacity()`（本社 100＋倉庫、土地 2,000＋現地倉庫、研究で倍率）
- 購入時に `LandDef.deposits` × (1±20%) で鉱脈の量が決まる。調査（`SURVEY_STAGES`）は費用＝土地価格×比率、所要時間は tick で進む。地質調査（2）で鉱山を建てられ、試掘（3）で採掘 +20%、実際に掘ると確定（4）
- `canBuildOn(def, land)`: `site`（hq/land/any）、`allowedTerrain`、鉱脈の有無、調査段階、人口で判定
- 地形補正 `terrainBonus` は生産・発電の倍率に掛かる

## 電力（systems/power.ts）

- 全土地で1つの送電網。需要＝ON の施設の `powerUse` 合計、供給＝発電所の `powerGen`×地形×研究（燃料が足りないぶんは下がる）
- 再生可能エネルギーを先に使い、残りを火力で賄う。火力は実際の負荷ぶんだけ燃料（その土地の在庫）を消費する
- `derived.power.ratio` を電力を使う施設の効率に掛ける（`no_power` / `partial`）

## 物流（systems/logistics.ts）

- 輸送手段は `transport` を持つ施設（トラック等）で、土地に配備した合計が輸送能力（t/秒）。安い手段から使い、パイプラインは液体のみ
- 輸出: 土地の在庫のうち現地で使わない分を本社へ（本社の容量まで）。輸入: 現地の施設が使う資源（入力・燃料）で現地生産が足りない分を本社から、`supplyBufferSeconds` ぶんを目標に
- 費用＝重さ（`ResourceDef.weight`）× 円/t。所持金が足りないと運べない。`derived.lands[id]` に能力・使用量・費用・流量を入れる

## 研究（systems/research.ts, systems/modifiers.ts）

- 研究所が `researchRate` で研究ポイントを貯め、`RESEARCH` のコストを払って即時完了。効果は `computeModifiers()` で係数にまとめ、毎 tick の最初に `derived.modifiers` へ
- 解放条件 `research` / `landOwned` / `powerCapacity` を追加。土地の解放キーは `land:<id>`（土地システム自体は総資産 100万円）

## 不動産（data/cities.ts, data/properties.ts, systems/estate.ts）

- 物件は実在の場所（緯度経度）に置いた架空の資産。価格 = 基準価格 × 都市の地価倍率 `estate.cityMult[city]`。倍率は 20 秒ごとに都市ごとの幾何ブラウン運動（`trend`, `volatility`）で動き、`land_boom` / `land_slump` イベントで即時に動く
- 賃料 = 価格 × 種類ごとの利回り（1時間あたり）÷ 3600 を毎 tick 所持金に加える。売買の手数料は `CONFIG.estate`
- 所有者は 3 通り: プレイヤー（`estate.owned`）・会社（`estate.companyOwned`: 物件ID → 会社ID）・市場。会社の物件は買収で受け取り、解体で市場に戻る
- 解放は総資産 `CONFIG.estate.unlockAssets`（`system:estate`）

## 株式（data/companies.ts, systems/stocks.ts）

- 理論株価 = (baseCap × growth ＋ cash ＋ 所有物件の評価額) ÷ 発行株数。表示株価 = 理論株価 × 需給係数 `sentiment` × イベント倍率 `eventMods.stock`
- 利益/時 = baseCap × growth × earningsYield ＋ 所有物件の賃料。方針の配当率ぶんをプレイヤーの持株比率で配当し、残りを再投資（`growth` は事業が大きいほど伸びにくい直線的な増え方、余りは `cash`）
- 売買は発行株数に対する割合 × `impact` だけ需給係数を動かす（買うと上がる）。需給係数は `sentimentReversion` で 1 へ戻る
- 経営権は持株比率 ≥ 2/3（`CONTROL_RATIO`）。方針変更・増設（事業価値 × 10% を払って growth ×1.1）・完全買収（残りの株を株価 × 1.25 で買い、会社の物件をプレイヤーへ移す）・解体（内部留保 ＋ 物件 × 0.85 ＋ 事業 × 0.25 の持株比率ぶんを受け取り、`dissolved`）
- 総資産に入れる株の評価額は理論株価ベース（自分の買いで膨らんだ時価は使わない）

## 自動化（data/managers.ts, systems/automation.ts）

- マネージャーは `state.automation.managers[id]`（雇った時刻と累計給料）。給料は `managerSalary(def, assets) = salaryBase + assets × CONFIG.automation.salaryAssetRate` を毎秒引く。所持金が 0 なら `unpaid` にして仕事をしない
- 仕事は `runAutomation(ctx, dt)` が `CONFIG.automation.interval`（1 秒）ごとに実行。長い tick（オフライン進行など）では経過秒ぶん（最大 10 回）まわす。採集係・クラフト係・販売係は毎回、物流係・投資係は tick に 1 回
  - 採集係 `workGather`: 解放済みの採集行動を 1 回ずつ（`actions/gather.ts` を使うので道具の消費も同じ）
  - クラフト係 `workCraft`: `automation.craftTargets[resource]`（資源の詳細で設定）を下回った資源をレシピで補充。道具は各 1 本
  - 販売係 `workSales`: 注文の自動納品と「おまかせ販売」（`automation.smartSell`：どの施設の入力でもない資源の余剰を需要係数を見て売る）。自動売却の下限価格 `AutoSellConfig.minPriceRatio` は販売係がいるときだけ効く
  - 物流係 `workLogistics`: 輸送手段がない・使用率 90% 超の土地に一番安い輸送手段、倉庫満杯の土地に現地倉庫。1 回の費用は所持金の 20% まで
  - 投資係 `workInvest`: `automation.invest`（残す現金・施設・配当・物件・回収時間の上限）。`analysis/roi.ts` の `rankInvestments` で回収の早い順に建て、`dividendPool` を利回りの高い会社の株に、利回りの良い物件を購入
- 建設テンプレートは `automation.templates[]`（施設種類ごとの数）。`applyTemplate` は建てられる範囲で足りないぶんだけ建てる（`templateCost` で見積り）

## 注文と信用（data/contracts.ts, systems/contracts.ts）

- 累計売上 5,000 円で解放。`contracts.nextIn` が 0 になると `createContract`：直近の生産量 × 300 秒（最低 20、高額資源は ÷10）の数量を、相場 × 1.6〜2.4 × ランク係数の報酬で。同時に 2 件まで
- 納品 `deliverContract` は在庫から引いて報酬と信用（`25 × max(1, log10(報酬) − 2)`）を加算。期限切れは信用 −10。`runAutoSell` は注文ぶんを取り置く（`contractReserve`）
- 信用ランク `CREDIT_RANKS`（E/D/C/B/A/S、0/100/300/700/1500/3000）は `creditRankDef(state)` で引き、不動産の手数料 `estateFee`・株のスプレッド `spreadOf`・輸送費 `rankCost`・注文の報酬に効く。`derived.creditRank` に置く

## ライバル会社（systems/rivals.ts）

- ESTATE 解放後だけ動く。`stocks.rivalIn`（60 秒）ごとに各社（現金あり・プレイヤーの完全所有でない・初期＋3 件まで）が 1.5% の確率で市場の物件を買う（本社と同じ国を優先、価格は現金の 80% まで、市場には 4 割以上残す）。買った物件は会社の資産に入り株価に反映
- `stocks.issueIn`（600 秒）ごとに成長重視の会社が 25% の確率で増資（`extraShares` に発行株の 5% を足す）。プレイヤーが 2/3 以上持つ会社は増資しない。発行株数は必ず `sharesOf(state, id)` で引く

## 再出発（systems/prestige.ts）

- `canPrestige(assets)`：総資産 ≥ `CONFIG.prestige.minAssets`（10 億円）。ポイント `prestigePoints = floor(√(総資産 ÷ 1 億円))`
- `GameEngine.prestige()` は `buildPrestigeState` で新しい初期状態を作る：実績・設定・会社名・`prestige`（回数・ポイント・履歴）・一部の累計統計だけ持ち越し、開始資金 = 10 万円 × ポイント。チュートリアルは完了扱い
- 永続ボーナスは `systems/modifiers.ts` の `prestigeBonus(points)`：全カテゴリの生産 ×(1 + 0.03 × pt)、研究ポイント ×(1 + 0.02 × pt)（`Modifiers.researchRate`）

## 診断とおすすめ（engine/analysis/）

- `roi.ts` `rankInvestments`：建てられる施設ごとに「追加 1 基の限界価値（円/秒）」と回収時間を出す。入力が足りるかで `feasible`
- `diagnose.ts` `diagnoseFacility`：停止中の施設の理由（材料不足・倉庫満杯・電力不足・輸送なし・停止中）と `FixAction`（施設を建てる・資源の詳細を開く・レシピをクラフト・画面を移動）の一覧。UI は `features/factory/FixPanel.tsx`、実行は `features/common/runAction.ts`
- `recommend.ts` `recommend`：電力不足 → 倉庫満杯 → 輸送なし → 回収の早い投資（動く見込みのあるもの）→ 研究 → 最初の土地 → 研究所 の順に 3 件。HOME の `RecommendCard`
- `flows.ts` `resourceFlows`：資源ごとに作っている施設・使っている施設・レシピ・輸送を集め、満杯／枯渇までの時間を出す。資源の詳細の「収支表」

## tick の順序（GameEngine.tick）

modifiers・容量・イベント係数 → イベント進行 → 調査 → 電力 → 生産（商業収入・研究ポイントもここ。施設ごとの `inputRates / outputRates` も記録）→ 物流（輸送費 × 信用ランク係数）→ 市場（需要の回復・相場変動）→ 注文（新着・期限）→ 自動売却（注文ぶんは取り置き。販売係がいれば下限価格）→ 研究ポイント加算 → 不動産（賃料・地価）→ 株式（配当・再投資・株価）→ 配当のプール（投資係の再投資用）→ ライバル会社 → 自動化（マネージャーの給料と仕事）→ 収入記録 → 会社指標 → 信用ランク → 解放 → チュートリアル → 実績

## UI まわり（v0.4）

- 実績解除はエンジンのイベントに `achievementId` が付き、`runtime.ts` のリスナーが `uiStore.achievementQueue` に積む → `AchievementPopup` が順に表示
- 効果音は `services/audio/sfx.ts`（Web Audio で合成、音声ファイルなし）。UI の操作は `utils/sfx.ts` の `sfx()`、エンジンのイベント（解放・実績・警告・イベント）は `runtime.ts` で鳴らす。設定 `sound` / `volume`
- 世界地図は `features/land/worldMapData.ts` の簡略化した輪郭（経度・緯度）を SVG に描き、土地のマーカーは HTML で重ねる（近い土地は `spread()` で押し広げ、ラベルは `placeLabels()` で重ならない側に置く）

## UI まわり（v0.5）

- テーマは `settings.theme`（dark / light / system）。`utils/theme.ts` の `useResolvedTheme()` が端末設定も含めて解決し、`App` が `<html data-theme>` に付ける。色は `styles/tokens.css` の CSS 変数だけで切り替わる（部品側に色の直書きをしない）
- 実在の地図は `features/estate/RealMap.tsx`（Leaflet、`React.lazy` で遅延読み込み）。タイルは OpenStreetMap の標準タイル（API キー不要）。ダークテーマでは CSS フィルタ（`html[data-theme='dark'] .rm__map .leaflet-tile-pane`）で暗くする（CARTO の無料タイルは寄ると透かしが入るため不採用）。ズーム 11 未満は都市ごとにまとめ（画面上で近い都市は1つに）、寄ると物件ピン・会社の本社・産業用地を出す。マーカーは `L.divIcon` で HTML/CSS 描画（画像なし）。`.rm__stage` は `isolation: isolate` で Leaflet の z-index をシートの下に閉じ込める
- 物件・会社の詳細は `PropertySheet` / `CompanySheet`（`uiStore.selectedProperty` / `selectedCompany`）。「地図で見る」は `uiStore.flyTo()` で地図に位置を渡す

## UI まわり（v0.6）

- 長押しの連打は `utils/useRepeat.ts`（pointerdown から 400ms 後に 90ms ごと）。採集・建設・クラフトのボタンに `{...hold}` で付ける
- 採集の数字の飛び出しは `GatherPanel` の `.pops/.pop`（CSS アニメーション、0.7 秒で消す）。稼働中の施設のゲージは `.gauge--live`
- COMPANY のサブタブに `automation`（`AutomationPanel`）と `prestige`（`PrestigePanel`）。HOME に `RecommendCard`・`ContractsCard`・`HighlightsCard`
- 施設・レシピの一覧は検索（`aria-label="施設の検索"` / `"レシピの検索"`）と「今建てられるものだけ」「作れるものだけ」の絞り込み。LAND の土地の詳細にテンプレートの保存／適用と「全部 +1」

## 今後の拡張ポイント

- 土地間の直接輸送（現在は本社とのハブ＆スポーク）
- イベントの種類追加（季節・為替・ストライキなど）、実績の報酬
- BGM（現在は効果音のみ）
