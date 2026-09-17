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
- **保存はバージョン付き**。`GAME_META.saveVersion` と `migrations.ts` で古いセーブを変換する

## 施設の生産（systems/production.ts）

1 tick で、各施設について
1. 入力がどれだけ足りるか（0〜1）
2. 出力先の倉庫にどれだけ空きがあるか（0〜1）
の小さいほうを効率とし、その分だけ消費・生産する。効率 0 のときは「材料不足」または「倉庫満杯」として停止扱いにし、稼働→停止の瞬間だけ通知を出す。

施設はデータ定義順（採集 → 加工 → 製造）に処理するので、同じ tick で採れた鉱石を製鉄所が使える。

## 市場（systems/market.ts）

- 価格 = 基準価格 × 係数（0.70〜1.40）
- 30 秒ごとに、1.0 へ戻る力＋ランダムで変動
- 売却すると `流動性` に応じて係数が下がる（大量売却の抑制）
- 履歴は最大 120 点（グラフ用）

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

## tick の順序（GameEngine.tick）

modifiers・容量 → 調査 → 電力 → 生産（商業収入・研究ポイントもここ）→ 物流 → 市場 → 自動売却 → 研究ポイント加算 → 収入記録 → 会社指標 → 解放 → チュートリアル → 実績

## 今後の拡張ポイント

- 航空輸送・土地間の直接輸送（現在は本社とのハブ＆スポーク）
- 市場の需要曲線（売り過ぎで価格が下がる幅の資源別調整）
- イベント（相場の急変・事故）、巨大産業（造船・半導体）
