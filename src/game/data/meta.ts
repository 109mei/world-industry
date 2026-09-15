/** ゲームのタイトルやバージョンなど。タイトルを変えるときはここだけ変更する（index.html / manifest も参照）。 */
export const GAME_META = {
  title: 'WORLD INDUSTRY',
  shortTitle: 'WI',
  description: '石を拾うところから始めて、世界規模の産業企業を築く経営シミュレーション',
  themeColor: '#0E1116',
  /** アプリのバージョン（表示用） */
  version: '0.2.0',
  /** セーブデータの形式バージョン。形式を変えたら +1 して migrations に変換処理を追加する */
  saveVersion: 1,
} as const;
