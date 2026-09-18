/** ゲームのタイトルやバージョンなど。タイトルを変えるときはここだけ変更する（index.html / manifest も参照）。 */
export const GAME_META = {
  title: 'WORLD INDUSTRY',
  shortTitle: 'WI',
  description: '石を拾うところから始めて、世界規模の産業企業を築く経営シミュレーション',
  themeColor: '#0E1116',
  /** アプリのバージョン（表示用） */
  version: '1.5.1',
  /** 公開先。SNS に貼ったときのサムネイルの場所を絶対URLで書くのに使う */
  siteUrl: 'https://109mei.github.io/world-industry/',
  /** SNS に貼ったときの見出しと説明 */
  tagline: 'つながる産業。ひろがる未来。',
  /** セーブデータの形式バージョン。保存先そのものを作り直すときは SaveService の SAVE_KEY を上げる */
  saveVersion: 15,
} as const;
