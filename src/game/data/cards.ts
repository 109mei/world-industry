/**
 * トレーディングカード「モンスターズ・オブ・ワールド」。
 *
 * パックを買って開け、出たカードを集めたり売ったりする。
 * カードには相場があり、出回っている枚数が少ないものほど高い。
 * 売れば相場は下がり、買い占めれば上がる。
 * ひとそろい集めると「図鑑」が埋まって、まとまった見返りがある。
 *
 * 全100種。絵はカードごとに用意してあり（public/assets/cards/mc_NNN.webp）、
 * 絵の中の枠と、下のレア度は同じものを指している。
 * この表は絵の並び順そのままなので、番号＝絵のファイル名になっている。
 */

export type CardRarity = 'n' | 'r' | 'sr' | 'ssr' | 'ar' | 'sar' | 'ur' | 'lr';

export interface RarityDef {
  id: CardRarity;
  name: string;
  short: string;
  /** 画面での色の役割 */
  tone: 'neutral' | 'accent' | 'research' | 'gain' | 'warn' | 'loss';
  /** 値段の目安の倍率 */
  priceMult: number;
}

/** 弱いほうから順に並べてある（この順がそのまま「良さ」の順） */
export const RARITIES: readonly RarityDef[] = [
  { id: 'n', name: 'ノーマル', short: 'N', tone: 'neutral', priceMult: 1 },
  { id: 'r', name: 'レア', short: 'R', tone: 'accent', priceMult: 7 },
  { id: 'sr', name: 'スーパーレア', short: 'SR', tone: 'research', priceMult: 45 },
  { id: 'ssr', name: 'スペシャルレア', short: 'SSR', tone: 'gain', priceMult: 260 },
  { id: 'ar', name: 'アナザーレア', short: 'AR', tone: 'warn', priceMult: 1_200 },
  { id: 'sar', name: 'スペシャルアナザー', short: 'SAR', tone: 'warn', priceMult: 5_000 },
  { id: 'ur', name: 'ウルトラレア', short: 'UR', tone: 'loss', priceMult: 22_000 },
  { id: 'lr', name: 'レジェンドレア', short: 'LR', tone: 'loss', priceMult: 120_000 },
];

export const RARITY_MAP: Record<CardRarity, RarityDef> = Object.fromEntries(RARITIES.map((r) => [r.id, r])) as Record<CardRarity, RarityDef>;

/** 弱い順のならび。どちらが良いカードかを比べるときに使う */
export const RARITY_ORDER: readonly CardRarity[] = RARITIES.map((r) => r.id);

/** a のほうが b より良いレア度か */
export function betterRarity(a: CardRarity, b: CardRarity): boolean {
  return RARITY_ORDER.indexOf(a) > RARITY_ORDER.indexOf(b);
}

export interface CardSeriesDef {
  id: string;
  name: string;
  note: string;
  /** そろえたときの見返り（研究ポイント） */
  reward: number;
}

export const CARD_SERIES: readonly CardSeriesDef[] = [
  { id: 'awaken', name: '第1弾 めざめの章', note: '野を歩けば会えるものたち。N と R', reward: 12_000 },
  { id: 'kingdom', name: '第2弾 王国の章', note: '名前で呼ばれる獣たち。SR と SSR', reward: 90_000 },
  { id: 'myth', name: '第3弾 神話の章', note: '土地や季節そのものの化身。AR と SAR', reward: 600_000 },
  { id: 'end', name: '第4弾 終焉の章', note: '世界の果てに立つもの。UR と LR', reward: 4_000_000 },
  { id: 'genesis', name: '第5弾 創世の章', note: 'すべて LR。ここを埋めたら、もう集めるものはない', reward: 30_000_000 },
];

export const SERIES_MAP: Record<string, CardSeriesDef> = Object.fromEntries(CARD_SERIES.map((s) => [s.id, s]));

export interface CardDef {
  id: string;
  /** 図鑑の通し番号（1〜100）。絵のファイル名もこの番号 */
  no: number;
  name: string;
  series: string;
  rarity: CardRarity;
  /** 基準の値段（円）。ここに相場の倍率が掛かる */
  basePrice: number;
  /** public/assets/cards の中のファイル名（拡張子なし） */
  art: string;
  flavor: string;
}

/** 基準価格はレア度から決める（そろえやすさの目安にもなる） */
function card(no: number, name: string, series: string, rarity: CardRarity, flavor: string): CardDef {
  const id = `mc_${String(no).padStart(3, '0')}`;
  return { id, no, name, series, rarity, basePrice: Math.round(400 * RARITY_MAP[rarity].priceMult), art: id, flavor };
}

export const CARDS: readonly CardDef[] = [
  // ---- 第1弾 めざめの章（001〜026） ----
  card(1, 'スライム', 'awaken', 'n', 'どこにでもいる。だから、みんな最初にこれと戦う。'),
  card(2, 'ウッドスライム', 'awaken', 'n', '木の皮をかぶっている。剥がすと、ただのスライム。'),
  card(3, 'ロックゴーレム', 'awaken', 'n', '動かないので岩だと思われ、よく腰かけられる。'),
  card(4, 'コボルド', 'awaken', 'n', '小さいが道具を使う。そこが厄介。'),
  card(5, 'ウルフ', 'awaken', 'n', '群れで来る。一匹だけ見えたときが、いちばん危ない。'),
  card(6, 'バット', 'awaken', 'n', '暗がりを飛ぶ。ぶつかってくるのは、たいてい向こうの都合。'),
  card(7, 'ゴースト', 'awaken', 'n', '未練のかたち。斬っても、話を聞くまでは消えない。'),
  card(8, 'マンドラゴラ', 'awaken', 'n', '抜くと叫ぶ。抜かなければ、ただの草。'),
  card(9, 'キノコモンスター', 'awaken', 'n', '胞子を吐く。食べられるかどうかは、試した人がいない。'),
  card(10, 'ビー', 'awaken', 'n', '一刺しで終わると思ったら、まだ巣がある。'),
  card(11, 'ラビット', 'awaken', 'n', 'かわいい。かわいいだけだと思っていると、跳ぶ。'),
  card(12, 'カニ', 'awaken', 'n', '横に歩く。追いかける側が、なぜか先に疲れる。'),
  card(13, 'アイススライム', 'awaken', 'r', '触れると手がかじかむ。溶かせば、ただの水。'),
  card(14, 'サンドワーム', 'awaken', 'r', '砂が鳴ったら、もう遅い。'),
  card(15, 'ゴブリン', 'awaken', 'r', '盗んだものを自慢する癖がある。おかげで居場所がわかる。'),
  card(16, 'オーク', 'awaken', 'r', '力任せ。だが力は、たいていの理屈より強い。'),
  card(17, 'スケルトン', 'awaken', 'r', '倒しても骨は残る。そして、また組み上がる。'),
  card(18, 'リザードマン', 'awaken', 'r', '槍の扱いが上手い。話も通じる。だから厄介。'),
  card(19, 'スパイダー', 'awaken', 'r', '巣にかかってから気づく。気づいたときには動けない。'),
  card(20, 'ワイルドボア', 'awaken', 'r', 'まっすぐ突っ込んでくる。避ければいい、と言うのは簡単。'),
  card(21, 'フェアリー', 'awaken', 'r', '悪気はない。ただ、いたずらの加減を知らない。'),
  card(22, 'ウィスプ', 'awaken', 'r', 'ついて行くと、帰り道がなくなる。'),
  card(23, 'ストーンエレメンタル', 'awaken', 'r', '山がひとつ、こちらを向いた気がした。'),
  card(24, 'サンダーバード', 'awaken', 'r', '羽ばたきが、そのまま雷になる。'),
  card(25, 'ウォーターエレメンタル', 'awaken', 'r', '斬っても、また水に戻るだけ。'),
  card(26, 'ファイアスピリッド', 'awaken', 'r', '消し方を知らないと、森ごと焼ける。'),

  // ---- 第2弾 王国の章（027〜045） ----
  card(27, 'ホーンドビースト', 'kingdom', 'sr', '角の傷の数だけ、勝ってきた。'),
  card(28, 'グリフォン', 'kingdom', 'sr', '空の王を名乗るが、王はもう一羽いる。'),
  card(29, 'ワイバーン', 'kingdom', 'sr', '竜の下位種と呼ぶと、たいてい怒る。'),
  card(30, 'トレント', 'kingdom', 'sr', '切り倒そうとした木が、こちらを見下ろした。'),
  card(31, 'フェンリル', 'kingdom', 'sr', '鎖でしか止められなかった、という記録だけが残る。'),
  card(32, 'ミノタウロス', 'kingdom', 'sr', '迷宮のあるじ。出口を知っているのは、こいつだけ。'),
  card(33, 'マーメイド', 'kingdom', 'sr', '歌が聞こえたら耳をふさげ。振り返ってはいけない。'),
  card(34, 'サラマンダー', 'kingdom', 'sr', '炎の中でしか眠らない。寝床はいつも、誰かの跡地。'),
  card(35, 'ユニコーン', 'kingdom', 'sr', '角は万病に効くという。だから狩られ、だから減った。'),
  card(36, 'ケルベロス', 'kingdom', 'sr', '三つの頭が、それぞれ別の獲物を見ている。'),
  card(37, 'フロストドラゴン', 'kingdom', 'sr', '吐息の届いた谷は、いまも凍ったまま。'),
  card(38, 'サンダードラゴン', 'kingdom', 'sr', '雲の上に巣がある。落雷は、寝返りの音。'),
  card(39, 'フェニックス', 'kingdom', 'ssr', '灰になるのは終わりではなく、手順。'),
  card(40, 'リヴァイアサン', 'kingdom', 'ssr', '海が盛り上がったら、それは波ではない。'),
  card(41, 'ディアブロス', 'kingdom', 'ssr', '角で大地を裂く。裂けた跡が、そのまま国境になった。'),
  card(42, 'エンシェントゴーレム', 'kingdom', 'ssr', '作った者はもういない。命令だけが残っている。'),
  card(43, 'フェアリードラゴン', 'kingdom', 'ssr', '小さいが、竜。なめた者から順に消えた。'),
  card(44, 'ダークエルフ', 'kingdom', 'ssr', '光を捨てたのではなく、選ばなかっただけ。'),
  card(45, 'エンジェル', 'kingdom', 'ssr', '救いに来たのか、数えに来たのか、誰も知らない。'),

  // ---- 第3弾 神話の章（046〜064） ----
  card(46, '古の森の守り手', 'myth', 'ar', '森が減るたび、この者は少しずつ怒っている。'),
  card(47, '深海の王', 'myth', 'ar', '光の届かない場所にも、玉座はある。'),
  card(48, '砂漠の覇者', 'myth', 'ar', '水のない国をおさめる。臣下は砂だけ。'),
  card(49, '天空の支配者', 'myth', 'ar', '雲の切れ目から見下ろしている。ずっと、ただ見ている。'),
  card(50, '終雨の騎士', 'myth', 'ar', 'この者が通ったあと、雨はもう降らない。'),
  card(51, '四季の精霊', 'myth', 'ar', '四つの顔を持ち、どれも人には見せない。'),
  card(52, '星巡る竜', 'myth', 'ar', 'ひと巡りに千年。次に来るのは、誰の代か。'),
  card(53, '幽玄の狐', 'myth', 'ar', '尾の数だけ、名を変えて生きてきた。'),
  card(54, '眠りの巨人', 'myth', 'ar', '起こしてはいけない。目を覚ますのは、世界が終わる日。'),
  card(55, '蒼の歌姫', 'myth', 'ar', 'その声を聞いた海は、二度と荒れなかった。'),
  card(56, '峰を刻む竜', 'myth', 'sar', '山脈のかたちは、この竜が飛んだ跡だという。'),
  card(57, '次元の観測者', 'myth', 'sar', 'こちらを見ている。こちら側からは、目が見えない。'),
  card(58, '世界樹の化身', 'myth', 'sar', '枝は空へ、根は冥府へ。まんなかに世界がある。'),
  card(59, '溟渕の覇龍', 'myth', 'sar', '深すぎて、誰も全身を見たことがない。'),
  card(60, '黄昏の女王', 'myth', 'sar', '日が沈むのを、ただ待つためだけの玉座。'),
  card(61, '太陽の騎士', 'myth', 'sar', '影を持たない。そのかわり、眠れない。'),
  card(62, '月の巫女', 'myth', 'sar', '満ちるときだけ言葉を話す。欠けるときは、聞くだけ。'),
  card(63, '終夜の黒竜', 'myth', 'sar', '翼を広げると、朝が来なくなる。'),
  card(64, '創造の天使', 'myth', 'sar', 'まだ何もない場所に、最初の線を引く者。'),

  // ---- 第4弾 終焉の章（065〜080） ----
  card(65, '星の巨獣', 'end', 'ur', 'ひと呼吸で、星の空気が入れ替わる。'),
  card(66, '次元竜オルド', 'end', 'ur', '同じ場所に、同時にいくつもいる。'),
  card(67, '光翼の天使', 'end', 'ur', '翼の一枚一枚が、誰かの祈りでできている。'),
  card(68, '深淵の王', 'end', 'ur', '底のない場所の、その底に座っている。'),
  card(69, '万象の監視者', 'end', 'ur', '見落としはない。忘れることもない。'),
  card(70, '虚無の化身', 'end', 'ur', 'そこにいるのではなく、そこだけが無い。'),
  card(71, '神樹の竜', 'end', 'ur', '根に巻きついたまま、千年眠っている。'),
  card(72, '永劫のフェニックス', 'end', 'ur', '何度目の灰かを、もう数えていない。'),
  card(73, '銀河のクジラ', 'end', 'ur', '星の海を泳ぐ。餌は、たぶん時間。'),
  card(74, '時空のがしゃ', 'end', 'ur', '骨の鳴る音が、過去からも未来からも聞こえる。'),
  card(75, '創世の籠', 'end', 'ur', 'まだ生まれていないものが、ぜんぶこの中にある。'),
  card(76, '原初の存在', 'end', 'lr', '名前がつく前から、ここにいた。'),
  card(77, '終焉と始まり', 'end', 'ur', '終わりの側から数えると、これが一枚目。'),
  card(78, '無限の竜王', 'end', 'ur', '尾を追って飛び続け、いつのまにか環になった。'),
  card(79, '世界を繋ぐ者', 'end', 'ur', 'どの世界にもひとりいて、全員が同じ顔をしている。'),
  card(80, '星海の覇者', 'end', 'lr', '征くべき星が尽きたので、いまは海を探している。'),

  // ---- 第5弾 創世の章（081〜100） ----
  card(81, '光と闇の双生', 'genesis', 'lr', '片方だけを倒すことはできない。'),
  card(82, '天界の門番', 'genesis', 'lr', '通してもらえた者は、まだひとりもいない。'),
  card(83, '深淵の歌姫', 'genesis', 'lr', '歌詞のない歌。聞いた者から順に、忘れていく。'),
  card(84, '終わりなき時', 'genesis', 'lr', '砂時計をひっくり返す手が、どこにもない。'),
  card(85, '世界樹レグナ', 'genesis', 'lr', 'この木が枯れる日を、世界の暦は想定していない。'),
  card(86, '創造主', 'genesis', 'lr', '作ったものを、いまも直し続けている。'),
  card(87, '破壊の竜神', 'genesis', 'lr', '壊すことでしか次を作れないと、信じている。'),
  card(88, '運命の三女神', 'genesis', 'lr', '紡ぐ者、測る者、断つ者。話が合ったことはない。'),
  card(89, '虚空の王', 'genesis', 'lr', '玉座も国も民もない。王だけがいる。'),
  card(90, '全ての終わり', 'genesis', 'lr', '最後に残るのは、これを見ている誰かの記憶だけ。'),
  card(91, '始まりの竜', 'genesis', 'lr', '最初のひと息が、そのまま風になった。'),
  card(92, '星屑の旅人', 'genesis', 'lr', '行き先を決めていない。だから、どこにでも現れる。'),
  card(93, '人理の守護者', 'genesis', 'lr', '守っているものが何なのか、本人も忘れている。'),
  card(94, '無垢なる少女', 'genesis', 'lr', '何も知らない。だから、何でもできてしまう。'),
  card(95, '機械仕掛けの神', 'genesis', 'lr', '答えは持っている。呼ばれるまで、黙っている。'),
  card(96, '天地の竜', 'genesis', 'lr', '上と下を、この体ひとつで繋いでいる。'),
  card(97, '幻獣王', 'genesis', 'lr', '実在しない獣たちの、実在する王。'),
  card(98, '満ちる世界', 'genesis', 'lr', '欠けたところがひとつもない。だから、もう何も入らない。'),
  card(99, '拘束の地', 'genesis', 'lr', 'ここから先へ進めた者は、まだいない。'),
  card(100, 'そして、次の世界へ', 'genesis', 'lr', 'この一枚を引いた人へ。物語は、ここから始まる。'),
];

export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const CARD_IDS = CARDS.map((c) => c.id);

/** シリーズごとのカード */
export function cardsOf(series: string): CardDef[] {
  return CARDS.filter((c) => c.series === series);
}

export interface PackDef {
  id: string;
  name: string;
  icon: string;
  /** 1パックの値段（円） */
  cost: number;
  /** 1パックに入る枚数 */
  cards: number;
  /** どのシリーズから出るか（空ならすべて） */
  series?: string[];
  /** レア度の出やすさ（合計1） */
  rates: Partial<Record<CardRarity, number>>;
  /** 解放に必要な研究 */
  research?: string;
  note: string;
}

/**
 * パックの値段は、中身の見込み（packValue）より必ず高くしてある。
 * 見込みは「熱」が最大のときでも値段の 0.88 倍までに収まる。
 * カードで儲けるのはパックを開けることではなく、相場の安いときに買って高いときに売ること、
 * そして図鑑をそろえて研究ポイントを受け取ることにしてある。
 */
export const PACKS: readonly PackDef[] = [
  {
    id: 'starter',
    name: 'スターターパック',
    icon: 'icon_card_pack',
    cost: 5_500,
    cards: 5,
    series: ['awaken'],
    rates: { n: 0.88, r: 0.12 },
    note: '第1弾だけが出る、いちばん安いパック。まずはここから。',
  },
  {
    id: 'standard',
    name: 'ブースターパック',
    icon: 'icon_card_pack',
    cost: 24_000,
    cards: 5,
    series: ['awaken', 'kingdom'],
    rates: { n: 0.72, r: 0.22, sr: 0.05, ssr: 0.01 },
    note: '第1〜2弾から出る、ふつうのパック。SSR もここから出る。',
  },
  {
    id: 'premium',
    name: 'プレミアムパック',
    icon: 'icon_card_pack_premium',
    cost: 270_000,
    cards: 5,
    series: ['awaken', 'kingdom', 'myth'],
    rates: { n: 0.52, r: 0.25, sr: 0.14, ssr: 0.06, ar: 0.025, sar: 0.005 },
    note: '第3弾まで出る。AR・SAR が入るのはここから。',
  },
  {
    id: 'legend',
    name: 'レジェンドパック',
    icon: 'icon_card_pack_premium',
    cost: 2_400_000,
    cards: 5,
    rates: { n: 0.3, r: 0.26, sr: 0.2, ssr: 0.12, ar: 0.075, sar: 0.035, ur: 0.008, lr: 0.002 },
    note: '全5弾から出る。UR と LR が出るのはこのパックと神話箱だけ。',
  },
  {
    id: 'myth_box',
    name: '神話箱',
    icon: 'icon_card_box',
    cost: 29_000_000,
    cards: 5,
    series: ['myth', 'end', 'genesis'],
    rates: { ar: 0.55, sar: 0.28, ur: 0.14, lr: 0.03 },
    note: '第3〜5弾しか入っていない。N や R は1枚も出ない、上だけの箱。',
  },
  {
    id: 'box',
    name: '1箱（レジェンド20パック）',
    icon: 'icon_card_box',
    cost: 45_000_000,
    cards: 100,
    rates: { n: 0.3, r: 0.26, sr: 0.2, ssr: 0.12, ar: 0.075, sar: 0.035, ur: 0.008, lr: 0.002 },
    note: 'レジェンドパック20個ぶんを一度に開ける。まとめて買うと少しだけ安い。',
  },
];

export const PACK_MAP: Record<string, PackDef> = Object.fromEntries(PACKS.map((p) => [p.id, p]));

/** 買うときの上乗せ（売値より高く買う） */
export const CARD_BUY_SPREAD = 1.3;
/** 相場の下限・上限 */
export const CARD_PRICE_MIN = 0.25;
export const CARD_PRICE_MAX = 6;
/**
 * 相場ぜんたいの「熱（はやり）」の下限・上限。
 * ここを広げすぎると、熱が高い時期にパックを開けるだけで儲かってしまうので、
 * いちばん中身の良い箱でも見込みが1を超えない幅にしてある。
 */
export const CARD_HYPE_MIN = 0.6;
export const CARD_HYPE_MAX = 1.6;
/**
 * パックの中身の見込みを出すときに掛ける割引。
 * 出たカードをすぐ売ると相場が下がるので、額面どおりには換金できない。
 */
export const CARD_LIQUIDATION = 0.85;
