# WORLD INDUSTRY

石を1個拾うところから始めて、世界規模の産業企業を築く、テキスト中心の産業・採集・クラフト・自動化・経営シミュレーションゲームです。スマートフォン（縦画面）とPCの両方で遊べます。

- 遊ぶ：https://109mei.github.io/world-industry/
- リポジトリ：https://github.com/109mei/world-industry

現在は **v0.3（Phase 5 まで実装）** です。手作業の採集 → 道具のクラフト（耐久あり） → 市場で売却 → 作業員・製鉄所・倉庫で自動化 → 土地の購入と地下資源調査 → 鉱山・農園と物流 → 電力 → 研究・海外展開・原子力、まで遊べます。

## 中盤以降の流れ（Phase 2〜5）

1. 総資産が 100万円に達すると **LAND** 画面で土地を買える（最初は北海道・十勝、九州・筑豊）
2. 土地を買ったら **地下資源調査**（簡易調査 → 地質調査 → 試掘）。地質調査で鉱山を建てられ、試掘で採掘 +20%。実際に掘ると「確定」
3. **FACTORY** 画面で土地を選び、鉱山・農園・伐採場を建てる。鉱脈は有限で、掘り尽くすと止まる
4. 土地に **トラック・貨物列車・貨物船・パイプライン** を配備すると、生産物が自動で本社へ運ばれ、現地の工場が使う材料は本社から届く（重さ × 円/t の輸送費）
5. **発電所**（石炭・石油・太陽光・風力・水力・原子力）を建てる。電力を使う施設は、供給率ぶんしか動かない。火力は需要ぶんだけ燃料を燃やす
6. **研究所** で研究ポイントを貯め、COMPANY 画面の「研究」で研究する（海外進出・鉄道・パイプライン・再生可能エネルギー・先端素材・原子力工学など）
7. 商業施設（駐車場・店舗・オフィス・データセンター）は土地の人口係数に応じて毎秒の収入になる

## 遊び方（MVP）

1. HOME の「石を拾う」「木を集める」をタップして資源を集める
2. CRAFT で「石のハンマー」を作る。道具は使うたびに耐久が減り、0 になると消える
3. ハンマーで「鉄くずを回収」→ RESOURCES で売って最初のお金を得る
4. FACTORY で作業員を雇うと、タップしなくても毎秒資源が増える
5. 鉄を作って工具を売り、製鉄所・工房・倉庫を増やして規模を大きくしていく

チュートリアル（7ステップ）が HOME に表示されます。ゲームは 10 秒ごとに自動保存され、閉じている間も最大 8 時間ぶん進行します（倉庫の満杯・材料不足も考慮されます）。

## 技術

- TypeScript / React 19 / Vite 8 / Zustand / Vitest
- 状態はゲームエンジン（`src/game/engine`）が持ち、React は表示だけを担当
- シミュレーション更新（200ms）と画面更新（500ms）は分離。施設ごとのタイマーは作らず中央ループで一括処理
- 保存は LocalStorage（`SaveRepository` を差し替えれば Supabase / Firebase / API へ移行可能）
- PWA 対応（`public/manifest.webmanifest` と `public/sw.js`）。ホーム画面に追加してアプリのように起動できます

## 手元で動かす

Node.js 22.12 以上（LTS 推奨）が必要です。

```bash
npm install        # 初回だけ
npm run dev        # 開発サーバー（http://localhost:5173/）。開発中は右下に DBG（デバッグパネル）が出ます
npm run typecheck  # 型チェック
npm test           # エンジンのテスト（Vitest）
npm run build      # 型チェック → 公開用ファイルを dist/ に作る
npm run preview    # dist/ をブラウザで確認
```

デバッグパネルは開発ビルドだけで表示されます。本番ビルドで出したいときは `VITE_ENABLE_DEBUG=1 npm run build`。

## 公開のしくみ

- `main` に push すると GitHub Actions（`.github/workflows/deploy.yml`）がビルドして GitHub Pages に公開します（1〜2分）
- `vite.config.ts` の `base: './'` により相対パスで出力されるので、他の場所に置いても動きます

## フォルダ構成

```
index.html                     入口
public/
  assets/icons/*.png           ゲーム内アイコン（128px・透過PNG）。一覧は docs/ICONS.md
  icons/                       PWA 用アイコン
  manifest.webmanifest, sw.js  PWA
src/
  main.tsx, App.tsx            起動・画面の切り替え
  game/
    data/                      ★ データ定義（ここを編集して要素を追加する）
      meta.ts                  タイトル・バージョン（タイトル変更はここ）
      config.ts                バランス・動作の定数
      resources.ts             資源・素材・製品
      tools.ts                 道具（耐久・効果）
      gathering.ts             手作業の採集行動
      recipes.ts               クラフトのレシピ
      facilities.ts            作業員・工場・倉庫（毎秒の入出力・価格）
      unlockTypes.ts           解放条件の型
      tutorial.ts, achievements.ts
    engine/
      GameEngine.ts            シミュレーション本体（tick / advance / 操作）
      systems/                 production（生産）, market（市場）, unlocks, progress, company
      actions/                 gather, craft, tools, facility
      state/                   初期状態・セーブの変換（migrations）
      inventory.ts             在庫・容量の共通処理
      __tests__/               Vitest
    services/
      GameLoop.ts              中央ループ（sim 200ms / UI 500ms / 自動保存）
      save/                    SaveRepository（保存先の抽象化）・SaveService
    runtime.ts                 エンジン・ループ・保存をまとめて起動
  stores/                      Zustand（ゲーム状態の購読・UI状態）
  components/ui, layout/       共通 UI（カード・ボタン・アイコン・シート・ナビ）
  features/                    画面ごとの機能（home, resources, craft, factory, land, company, offline, debug）
  types/                       型定義（GameState など）
  utils/                       数値フォーマットなど
  styles/                      デザイントークン・共通スタイル
docs/                          設計メモ・アイコン一覧
```

## 要素を追加するには

- **資源を追加**: `resources.ts` に1行足す。価格・アイコン・流動性を書く
- **レシピを追加**: `recipes.ts` に `inputs / outputs / unlock` を書く。プログラム変更は不要
- **施設を追加**: `facilities.ts` に `production`（毎秒の入出力）と `baseCost / costGrowth` を書く
- **解放条件**: `unlockTypes.ts` の `UnlockCondition`（累計入手・所持金・クラフト回数・施設数など）を組み合わせる
- **セーブ形式を変えたら**: `meta.ts` の `saveVersion` を上げ、`engine/state/migrations.ts` に変換を書く

## ロードマップ

| 段階 | 内容 | 状態 |
| --- | --- | --- |
| MVP | 採集・道具耐久・クラフト・市場・作業員・製鉄所・倉庫・保存・オフライン進行・チュートリアル・スマホUI | 完了 |
| Phase 2 | 世界地図（10か国14土地）・土地購入・地下調査（5段階）・鉱床（有限、購入時に±20%）・土地ごとの施設・地形補正 | 完了 |
| Phase 3 | 電力（石炭・石油・太陽光・風力・水力）・需要ぶんの燃料消費・供給率による効率低下 | 完了 |
| Phase 4 | 物流（トラック・貨物列車・貨物船・パイプライン）・現地在庫と輸送費・材料の自動補給・商業施設 | 完了 |
| Phase 5 | 研究ツリー（12種）・海外展開・原子力（ウラン鉱山 → 濃縮 → 原子力発電）・電子部品 | 完了 |
| 次 | 航空輸送・市場の高度化（需要曲線）・巨大産業（造船・半導体）・イベント・バランス調整 | 未着手 |

## 素材について

`public/assets/icons/` のアイコンは、ChatGPT で生成したアイコンシート（16枚）を切り出して透過・128px に加工したものです。ファイル名の規則は `icon_<種別>_<名前>.png`（例: `icon_resource_stone.png`）。存在しない名前を指定した場合は、コード側でプレースホルダー（文字の四角）が表示されます。
