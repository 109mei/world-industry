# WORLD INDUSTRY

ブラウザで遊べるゲーム「WORLD INDUSTRY」のリポジトリです。

- 遊ぶ：https://109mei.github.io/world-industry/
- リポジトリ：https://github.com/109mei/world-industry

## 公開のしくみ

- 公開先は GitHub Pages（無料の静的サイト配信）です
- `main` ブランチに push すると、GitHub Actions が自動でビルドして公開します（設定は `.github/workflows/deploy.yml`）
- 進み具合はリポジトリの「Actions」タブで確認できます。反映まで1〜2分ほどかかります
- GitHub Pages はファイルを配信するだけなので、オンライン対戦やランキングなどのサーバー処理はありません。必要になったら別のサービスを追加します

## 手元で動かす

Node.js 22.12 以上（LTS 推奨）が必要です。

```bash
npm install      # 初回だけ
npm run dev      # 開発用サーバーを起動（表示された http://localhost:5173/ を開く）
npm run build    # 公開用ファイルを dist/ に作る
npm run preview  # 作った dist/ をブラウザで確認する
```

## フォルダ構成

```
index.html            入口の HTML
public/               そのまま公開されるファイル（favicon など）
src/
  main.js             起動処理（シーンの登録）
  game.js             ゲームループ・画面の拡大縮小・シーン切り替え
  input.js            キーボード／マウス／タッチの入力
  config.js           画面サイズ・色・書体の設定
  draw.js             描画の共通関数
  style.css           ページ全体のスタイル
  scenes/
    title.js          タイトル画面
    play.js           ゲーム画面（いまは動作確認用の仮画面）
.github/workflows/
  deploy.yml          GitHub Pages への自動公開
```

## 作り始めるときのメモ

- 画面は 1280×720 の座標で描き、ウィンドウの大きさに合わせて縦横比を保ったまま拡大縮小します
- シーンを増やすときは `src/scenes/` にファイルを作り、`src/main.js` の `scenes` に登録して `game.goTo('名前')` で切り替えます
- 入力は `game.input` から取れます（`isDown('ArrowLeft')`・`wasPressed('Enter')`・`clicked`・`pointer.x` / `pointer.y`）
- 画像や音は `src/assets/` に置いて `import` するのがおすすめです。`public/` に置いた場合は `import.meta.env.BASE_URL + 'ファイル名'` で読み込みます
- ビルド結果は相対パスで出力する設定（`vite.config.js` の `base: './'`）なので、GitHub Pages 以外の場所に置いても動きます
- URL の末尾に `?debug` を付けると FPS を表示します
