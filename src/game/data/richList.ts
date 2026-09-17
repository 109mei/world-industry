/**
 * 長者番付。世界の富豪をまねた架空の一覧で、自分が何位に入るかを見る。
 *
 * 名前も会社も完全な作りもので、実在の人物・企業とは関係がない。
 * 金額は「そのくらいの規模の人がいる」という目安として置いてある。
 * 上の人ほど資産がゆっくり増えていくので、抜かすには伸ばし続ける必要がある。
 */

export interface RichPerson {
  name: string;
  company: string;
  country: string;
  /** 資産（円） */
  worth: number;
  /** 1時間あたりに増える割合 */
  growthPerHour: number;
}

export const RICH_LIST: readonly RichPerson[] = [
  { name: 'アーロン・ヴェスパー', company: 'ヴェスパー・モーターズ', country: 'アメリカ', worth: 62_000_000_000_000, growthPerHour: 0.004 },
  { name: 'リナ・ソルバーグ', company: 'ノルディス通商', country: 'ノルウェー', worth: 48_000_000_000_000, growthPerHour: 0.0035 },
  { name: 'ホルヘ・カンポス', company: 'カンポス資源', country: 'メキシコ', worth: 41_000_000_000_000, growthPerHour: 0.003 },
  { name: '陳 立群', company: '立群集団', country: '中国', worth: 37_000_000_000_000, growthPerHour: 0.0045 },
  { name: 'エリアス・ブラント', company: 'ブラント精密', country: 'ドイツ', worth: 33_000_000_000_000, growthPerHour: 0.0025 },
  { name: 'ナディア・ハッサン', company: 'ハッサン石油化学', country: 'アラブ首長国連邦', worth: 30_000_000_000_000, growthPerHour: 0.002 },
  { name: '室伏 影虎', company: 'ムロフシ重工', country: '日本', worth: 27_000_000_000_000, growthPerHour: 0.0022 },
  { name: 'ソフィア・デラクルス', company: 'デラクルス海運', country: 'フィリピン', worth: 24_000_000_000_000, growthPerHour: 0.0028 },
  { name: 'ヴィクトル・ラズモフ', company: 'ラズモフ鉱業', country: 'ロシア', worth: 21_500_000_000_000, growthPerHour: 0.0015 },
  { name: 'アミット・デサイ', company: 'デサイ・デジタル', country: 'インド', worth: 19_000_000_000_000, growthPerHour: 0.005 },
  { name: 'クレール・モンフォール', company: 'モンフォール商会', country: 'フランス', worth: 17_000_000_000_000, growthPerHour: 0.0022 },
  { name: 'ジェイド・オコンネル', company: 'オコンネル航空', country: 'アイルランド', worth: 15_000_000_000_000, growthPerHour: 0.0026 },
  { name: '朴 志勲', company: 'ハンビット電子', country: '韓国', worth: 13_500_000_000_000, growthPerHour: 0.0038 },
  { name: 'マリア・フェルナンデス', company: 'フェルナンデス農産', country: 'ブラジル', worth: 12_000_000_000_000, growthPerHour: 0.0018 },
  { name: 'トーマス・ウェイクフィールド', company: 'ウェイクフィールド銀行', country: 'イギリス', worth: 10_800_000_000_000, growthPerHour: 0.0016 },
  { name: '白石 澪', company: 'シライシ製薬', country: '日本', worth: 9_600_000_000_000, growthPerHour: 0.0024 },
  { name: 'カリム・ベンサイド', company: 'サハラ建設', country: 'モロッコ', worth: 8_400_000_000_000, growthPerHour: 0.0021 },
  { name: 'イングリッド・ラーション', company: 'ラーション林業', country: 'スウェーデン', worth: 7_500_000_000_000, growthPerHour: 0.0014 },
  { name: 'ダニエル・アオキ', company: 'アオキ・ロジスティクス', country: 'カナダ', worth: 6_700_000_000_000, growthPerHour: 0.0023 },
  { name: 'ゾーイ・マーティン', company: 'マーティン・スタジオ', country: 'オーストラリア', worth: 5_900_000_000_000, growthPerHour: 0.003 },
  { name: 'ラファエル・コスタ', company: 'コスタ食品', country: 'ポルトガル', worth: 5_200_000_000_000, growthPerHour: 0.0017 },
  { name: '黄 詩涵', company: '詩涵半導体', country: '台湾', worth: 4_600_000_000_000, growthPerHour: 0.0042 },
  { name: 'オマル・ディアロ', company: 'ディアロ通信', country: 'セネガル', worth: 4_100_000_000_000, growthPerHour: 0.0033 },
  { name: 'ハンナ・フォークト', company: 'フォークト保険', country: 'オーストリア', worth: 3_600_000_000_000, growthPerHour: 0.0012 },
  { name: '南雲 蓮', company: 'ナグモ・ゲームス', country: '日本', worth: 3_200_000_000_000, growthPerHour: 0.0036 },
  { name: 'サミュエル・キプロノ', company: 'キプロノ農園', country: 'ケニア', worth: 2_800_000_000_000, growthPerHour: 0.0019 },
  { name: 'エレナ・ロッシ', company: 'ロッシ・モーダ', country: 'イタリア', worth: 2_450_000_000_000, growthPerHour: 0.0015 },
  { name: 'ルーカス・ヤンセン', company: 'ヤンセン港湾', country: 'オランダ', worth: 2_100_000_000_000, growthPerHour: 0.0016 },
  { name: 'アイシャ・ラーマン', company: 'ラーマン繊維', country: 'バングラデシュ', worth: 1_850_000_000_000, growthPerHour: 0.0027 },
  { name: '崔 恩宙', company: 'ウンジュ・メディア', country: '韓国', worth: 1_600_000_000_000, growthPerHour: 0.0031 },
  { name: 'パブロ・ヒメネス', company: 'ヒメネス電力', country: 'スペイン', worth: 1_400_000_000_000, growthPerHour: 0.0013 },
  { name: '五十嵐 澄江', company: 'イガラシ不動産', country: '日本', worth: 1_200_000_000_000, growthPerHour: 0.0011 },
  { name: 'ニコラ・ペトロヴィッチ', company: 'ペトロ工機', country: 'セルビア', worth: 1_000_000_000_000, growthPerHour: 0.0014 },
  { name: 'サラ・ゴールドスタイン', company: 'ゴールドスタイン投資', country: 'イスラエル', worth: 860_000_000_000, growthPerHour: 0.0029 },
  { name: 'トゥアン・グエン', company: 'グエン水産', country: 'ベトナム', worth: 720_000_000_000, growthPerHour: 0.0024 },
  { name: 'メイ・タナカ', company: 'タナカ教育', country: 'アメリカ', worth: 610_000_000_000, growthPerHour: 0.0018 },
  { name: 'アダム・ノヴァク', company: 'ノヴァク運輸', country: 'ポーランド', worth: 520_000_000_000, growthPerHour: 0.0015 },
  { name: 'レイラ・カリミ', company: 'カリミ宝飾', country: 'イラン', worth: 440_000_000_000, growthPerHour: 0.0012 },
  { name: 'ジョセフ・アデバヨ', company: 'アデバヨ建材', country: 'ナイジェリア', worth: 370_000_000_000, growthPerHour: 0.0026 },
  { name: '大久保 洋一', company: 'オオクボ工業', country: '日本', worth: 310_000_000_000, growthPerHour: 0.0013 },
  { name: 'カミラ・アンデルセン', company: 'アンデルセン醸造', country: 'デンマーク', worth: 260_000_000_000, growthPerHour: 0.001 },
  { name: 'ラジブ・メノン', company: 'メノン物流', country: 'インド', worth: 215_000_000_000, growthPerHour: 0.0022 },
  { name: 'エミリー・ハワード', company: 'ハワード薬品', country: 'ニュージーランド', worth: 175_000_000_000, growthPerHour: 0.0017 },
  { name: 'フアン・オルテガ', company: 'オルテガ鉱山', country: 'チリ', worth: 140_000_000_000, growthPerHour: 0.0011 },
  { name: '林 天佑', company: '天佑機械', country: 'シンガポール', worth: 110_000_000_000, growthPerHour: 0.0025 },
  { name: 'アンナ・コヴァーチ', company: 'コヴァーチ設計', country: 'ハンガリー', worth: 88_000_000_000, growthPerHour: 0.0014 },
  { name: '三沢 都', company: 'ミサワ商店', country: '日本', worth: 68_000_000_000, growthPerHour: 0.0016 },
  { name: 'デイヴィッド・オルソン', company: 'オルソン精肉', country: 'アメリカ', worth: 52_000_000_000, growthPerHour: 0.0012 },
  { name: 'ファトマ・ユルマズ', company: 'ユルマズ織物', country: 'トルコ', worth: 39_000_000_000, growthPerHour: 0.0018 },
  { name: 'ピーター・マクラウド', company: 'マクラウド酒造', country: 'スコットランド', worth: 28_000_000_000, growthPerHour: 0.0009 },
  { name: 'サンティアゴ・リベラ', company: 'リベラ運送', country: 'アルゼンチン', worth: 19_000_000_000, growthPerHour: 0.0015 },
  { name: '春日 千尋', company: 'カスガ設計事務所', country: '日本', worth: 12_000_000_000, growthPerHour: 0.0013 },
  { name: 'クララ・ビショップ', company: 'ビショップ書店', country: 'イギリス', worth: 7_500_000_000, growthPerHour: 0.001 },
  { name: 'イヴァン・ミハイロフ', company: 'ミハイロフ整備', country: 'ブルガリア', worth: 4_200_000_000, growthPerHour: 0.0011 },
  { name: 'ノア・キム', company: 'キム・コーヒー', country: 'アメリカ', worth: 2_300_000_000, growthPerHour: 0.0014 },
  { name: '有川 遥', company: 'アリカワ花店', country: '日本', worth: 1_100_000_000, growthPerHour: 0.0012 },
  { name: 'ミゲル・サントス', company: 'サントス八百屋', country: 'ペルー', worth: 480_000_000, growthPerHour: 0.001 },
  { name: 'ジェマ・ライト', company: 'ライト自転車店', country: 'アイルランド', worth: 210_000_000, growthPerHour: 0.0009 },
  { name: 'ジェイコブ・ミラー', company: 'ミラー修理店', country: 'アメリカ', worth: 95_000_000, growthPerHour: 0.0008 },
  { name: '小川 果林', company: 'オガワ食堂', country: '日本', worth: 42_000_000, growthPerHour: 0.0008 },
];
