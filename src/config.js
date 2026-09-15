// 画面の論理サイズ（描画はこの座標で行い、ウィンドウに合わせて拡大縮小する）
export const WIDTH = 1280;
export const HEIGHT = 720;

// ゲーム全体で使う書体（1種類に統一する）
export const FONT_FAMILY =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Meiryo", "Noto Sans JP", sans-serif';

// 色は役割ごとに分ける
export const COLORS = {
  background: '#0b1016', // 画面の背景
  gear: '#16202b', // 背景の歯車
  accent: '#f5a524', // タイトル・強調
  text: '#e8edf2', // 本文
  subText: '#8b9aa9', // 補足・操作説明
  button: '#1c2733', // ボタンの地
  buttonHover: '#2a3b50', // カーソルが乗ったボタン
  placed: '#5fb3a1', // 動作確認用に置く歯車
};
