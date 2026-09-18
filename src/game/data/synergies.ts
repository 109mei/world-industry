/**
 * 事業どうしの連携。
 *
 * 業種はそれぞれ独立して稼ぐだけでなく、「持っているだけで会社全体に効く」。
 * 運送会社を持てば自社の輸送費が下がり、広告代理店を持てば広告費が下がり、
 * 人材サービスを持てば人件費が下がる……というように、事業をつなげるほど強くなる。
 *
 * 効きの強さは、その事業の規模（人数・知名度・ブランド）で決まる。
 * 同じ業種を複数持つと重なるが、だんだん効きにくくなる（上限に近づくだけ）。
 */
import type { BusinessKindId } from './business';

/** 連携が効く先 */
export type SynergyKey =
  | 'transportCost'
  | 'transportCapacity'
  | 'adCost'
  | 'awarenessGain'
  | 'brandGain'
  | 'wage'
  | 'devSpeed'
  | 'productRevenue'
  | 'shopSales'
  | 'sellPrice'
  | 'researchRate'
  | 'surveyCost'
  | 'depositAmount'
  | 'buildCost'
  | 'rentIncome'
  | 'interestRate'
  | 'tradeFee'
  | 'eventDamage'
  | 'casinoEdge'
  | 'projectCost';

export interface SynergyKeyDef {
  key: SynergyKey;
  /** 画面に出す名前 */
  label: string;
  /** 小さいほど良い値か（費用など）。true なら「下がる」と書く */
  lowerIsBetter: boolean;
}

export const SYNERGY_KEYS: Record<SynergyKey, SynergyKeyDef> = {
  transportCost: { key: 'transportCost', label: '輸送費', lowerIsBetter: true },
  transportCapacity: { key: 'transportCapacity', label: '運べる量', lowerIsBetter: false },
  adCost: { key: 'adCost', label: '広告費', lowerIsBetter: true },
  awarenessGain: { key: 'awarenessGain', label: '知名度の伸び', lowerIsBetter: false },
  brandGain: { key: 'brandGain', label: 'ブランドの伸び', lowerIsBetter: false },
  wage: { key: 'wage', label: '人件費', lowerIsBetter: true },
  devSpeed: { key: 'devSpeed', label: '仕事の速さ', lowerIsBetter: false },
  productRevenue: { key: 'productRevenue', label: '製品の収入', lowerIsBetter: false },
  shopSales: { key: 'shopSales', label: 'お店の売値', lowerIsBetter: false },
  sellPrice: { key: 'sellPrice', label: '資源の売値', lowerIsBetter: false },
  researchRate: { key: 'researchRate', label: '研究の進み', lowerIsBetter: false },
  surveyCost: { key: 'surveyCost', label: '調査の費用', lowerIsBetter: true },
  depositAmount: { key: 'depositAmount', label: '埋蔵量', lowerIsBetter: false },
  buildCost: { key: 'buildCost', label: '施設の建設費', lowerIsBetter: true },
  rentIncome: { key: 'rentIncome', label: '自社物件の賃料', lowerIsBetter: false },
  interestRate: { key: 'interestRate', label: '借金の利息', lowerIsBetter: true },
  tradeFee: { key: 'tradeFee', label: '売買の手数料', lowerIsBetter: true },
  eventDamage: { key: 'eventDamage', label: '災害・事故の損害', lowerIsBetter: true },
  casinoEdge: { key: 'casinoEdge', label: 'カジノの取り分', lowerIsBetter: false },
  projectCost: { key: 'projectCost', label: '案件の着手金', lowerIsBetter: true },
};

export interface SynergyEffect {
  key: SynergyKey;
  /**
   * 全力（規模が最大）のときの効き幅。
   * lowerIsBetter なら「最大でこれだけ下がる」（0.3 = 30%引き）、
   * そうでなければ「最大でこれだけ増える」（0.3 = +30%）。
   */
  max: number;
}

export interface SynergyDef {
  /** この業種を持っていると */
  from: BusinessKindId;
  /** 会社全体にこう効く */
  effects: SynergyEffect[];
  /** 画面に出す一言 */
  note: string;
}

export const SYNERGIES: readonly SynergyDef[] = [
  // ---- 運ぶ ----
  {
    from: 'transport',
    effects: [
      { key: 'transportCost', max: 0.3 },
      { key: 'transportCapacity', max: 0.25 },
    ],
    note: '自社便で運ぶので、よその運送会社に払う運賃がいらなくなる',
  },
  {
    from: 'railway',
    effects: [
      { key: 'transportCost', max: 0.25 },
      { key: 'transportCapacity', max: 0.6 },
    ],
    note: '貨物列車でまとめて運べる。一度に運べる量が大きく増える',
  },
  {
    from: 'airline',
    effects: [
      { key: 'transportCost', max: 0.18 },
      { key: 'transportCapacity', max: 0.35 },
    ],
    note: '自社便の貨物室が空いているぶん、遠くへも安く運べる',
  },
  {
    from: 'shipyard',
    effects: [
      { key: 'transportCapacity', max: 0.4 },
      { key: 'buildCost', max: 0.1 },
    ],
    note: '自社で船を造るので、大量輸送の船がすぐ手に入る',
  },
  {
    from: 'automaker',
    effects: [
      { key: 'transportCost', max: 0.15 },
      { key: 'projectCost', max: 0.1 },
    ],
    note: '自社のトラックを自社で使う。車両代と燃費が浮く',
  },
  // ---- 広める ----
  {
    from: 'agency',
    effects: [
      { key: 'adCost', max: 0.4 },
      { key: 'awarenessGain', max: 0.35 },
    ],
    note: '自社の広告を自社で作る。外に払う広告費がまるごと浮く',
  },
  {
    from: 'media',
    effects: [
      { key: 'awarenessGain', max: 0.3 },
      { key: 'brandGain', max: 0.3 },
      { key: 'shopSales', max: 0.1 },
    ],
    note: '自社メディアで取り上げられるので、名前が広まりやすい',
  },
  {
    from: 'music',
    effects: [
      { key: 'awarenessGain', max: 0.2 },
      { key: 'brandGain', max: 0.15 },
    ],
    note: '人気の曲がそのまま会社の顔になる',
  },
  {
    from: 'game',
    effects: [
      { key: 'brandGain', max: 0.25 },
      { key: 'awarenessGain', max: 0.1 },
    ],
    note: '遊んだ人がそのまま会社のファンになる',
  },
  // ---- 人 ----
  {
    from: 'staffing',
    effects: [{ key: 'wage', max: 0.25 }],
    note: '自社で人を集めるので、紹介料も採用費もかからない',
  },
  {
    from: 'school',
    effects: [
      { key: 'devSpeed', max: 0.25 },
      { key: 'wage', max: 0.08 },
    ],
    note: '自社で育てた人が入ってくる。教えなおす手間がいらない',
  },
  {
    from: 'clinic',
    effects: [
      { key: 'wage', max: 0.1 },
      { key: 'devSpeed', max: 0.1 },
    ],
    note: '社員が健康だと休まない。現場が止まらなくなる',
  },
  {
    from: 'pharma',
    effects: [
      { key: 'wage', max: 0.08 },
      { key: 'eventDamage', max: 0.1 },
    ],
    note: '自社の薬を社員に回せる。体調不良で止まる日が減る',
  },
  // ---- お金 ----
  {
    from: 'bank',
    effects: [
      { key: 'interestRate', max: 0.45 },
      { key: 'tradeFee', max: 0.25 },
    ],
    note: '自社の銀行から借りるので、利息をほとんど自分に払う形になる',
  },
  {
    from: 'securities',
    effects: [
      { key: 'tradeFee', max: 0.35 },
      { key: 'rentIncome', max: 0.05 },
    ],
    note: '株や土地の売買を自社で通すので、手数料が内側に残る',
  },
  {
    from: 'insurance',
    effects: [
      { key: 'eventDamage', max: 0.45 },
      { key: 'tradeFee', max: 0.05 },
    ],
    note: '災害や事故で失う額を自社の保険で埋められる',
  },
  {
    from: 'security',
    effects: [
      { key: 'casinoEdge', max: 0.2 },
      { key: 'eventDamage', max: 0.15 },
    ],
    note: '自社の警備が入ると、盗難やイカサマで消える分が減る',
  },
  // ---- 建てる・持つ ----
  {
    from: 'construction',
    effects: [
      { key: 'buildCost', max: 0.3 },
      { key: 'projectCost', max: 0.1 },
    ],
    note: '自社で建てるので、施設の建設費が原価で済む',
  },
  {
    from: 'realestate',
    effects: [
      { key: 'rentIncome', max: 0.3 },
      { key: 'tradeFee', max: 0.2 },
    ],
    note: '自社で客付けするので、空室が減り仲介料もかからない',
  },
  {
    from: 'hotel',
    effects: [
      { key: 'shopSales', max: 0.1 },
      { key: 'awarenessGain', max: 0.1 },
    ],
    note: '泊まった客がそのまま自社の店にも寄ってくれる',
  },
  // ---- つくる ----
  {
    from: 'pc',
    effects: [
      { key: 'researchRate', max: 0.2 },
      { key: 'projectCost', max: 0.12 },
    ],
    note: '自社製の計算機を研究と開発に回せる',
  },
  {
    from: 'appliance',
    effects: [
      { key: 'projectCost', max: 0.2 },
      { key: 'buildCost', max: 0.08 },
    ],
    note: '自社の部品を自社の案件に回せるので、着手金が安く済む',
  },
  {
    from: 'aerospace',
    effects: [
      { key: 'researchRate', max: 0.2 },
      { key: 'transportCapacity', max: 0.2 },
    ],
    note: '極限を相手にした技術が、会社じゅうの研究に降りてくる',
  },
  {
    from: 'foodmaker',
    effects: [
      { key: 'shopSales', max: 0.15 },
      { key: 'projectCost', max: 0.08 },
    ],
    note: '自社の食品を自社の店と飲食店に回せる',
  },
  // ---- 情報 ----
  {
    from: 'it',
    effects: [
      { key: 'researchRate', max: 0.25 },
      { key: 'devSpeed', max: 0.1 },
    ],
    note: '社内の仕組みを自社で作れる。会社ぜんたいの段取りが速くなる',
  },
  {
    from: 'app',
    effects: [
      { key: 'productRevenue', max: 0.2 },
      { key: 'awarenessGain', max: 0.1 },
    ],
    note: '自社アプリから自社の製品へ人を送れる',
  },
  // ---- 掘る・売る ----
  {
    from: 'prospecting',
    effects: [
      { key: 'depositAmount', max: 0.3 },
      { key: 'surveyCost', max: 0.25 },
    ],
    note: '自社の探鉱班が先に見てくれるので、外れを掘らずに済む',
  },
  {
    from: 'jewelry',
    effects: [
      { key: 'sellPrice', max: 0.1 },
      { key: 'brandGain', max: 0.1 },
    ],
    note: '良い石を高く買う先が自社にある',
  },
  {
    from: 'convenience',
    effects: [{ key: 'sellPrice', max: 0.06 }],
    note: '自社の棚があるので、余った品物も値崩れさせずに流せる',
  },
  {
    from: 'casino',
    effects: [
      { key: 'awarenessGain', max: 0.15 },
      { key: 'casinoEdge', max: 0.05 },
    ],
    note: '派手な看板が街じゅうから見える',
  },
] as const;

/** 業種 → その業種が会社全体に与える効果 */
export const SYNERGY_BY_KIND = new Map<BusinessKindId, SynergyDef>(SYNERGIES.map((s) => [s.from, s]));
