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

## 今後の拡張ポイント

- 土地: `state.lands` と `FacilityInstance.landId` は既に土地単位。土地ごとの生産倍率・鉱床（残量）を production に掛ける
- 電力: `FacilityDef.powerUse` を使い、`availablePower / requiredPower` を効率に掛ける
- 物流: 土地間の在庫移動は「輸送ジョブ」として tick で進める
- 研究: `state.research.completed` を条件（UnlockCondition に `research` を追加）に使う
