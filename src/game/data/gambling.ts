/**
 * 賭け事。カジノを建てて客に遊んでもらう側と、自分で遊ぶ側の両方がある。
 *
 * どの遊びも「胴元が少しだけ有利」になっていて、長く遊べば必ず減る。
 * そのぶん、カジノを「開く側」に回ると安定して儲かる——という作りにしている。
 * 期待値は画面にそのまま表示して、隠さない。
 *
 * 遊ぶ側は、実際に手を動かすミニゲームとして遊べる。
 *  - スロット: 自分で3つのリールを止める（本物のパチスロと同じで、当たりは先に決まっていてリールが少し滑る）
 *  - ルーレット: 赤黒・偶数奇数・ダース・一点から賭け方を選び、玉が落ちるところを見る
 *  - バカラ: プレイヤー／バンカー／引き分けに賭けて、札がめくれるのを見る
 *  - パチンコ: ハンドルを握って玉を打ち、入賞したらデジタルが回る
 * 賭け方によって配当と当たりやすさは変わるが、どれを選んでも胴元の取り分は変わらない。
 */

export type GameId = 'slot' | 'roulette' | 'cards' | 'pachinko';

/** 演出の種類（画面がどのミニゲームを出すか） */
export type GameKind = 'slot' | 'wheel' | 'cards' | 'pachinko';

export interface GameOutcome {
  /** 配当の倍率（賭け金の何倍が返るか。0 ははずれ、1 は返ってくるだけ） */
  payout: number;
  /** その目が出る確率 */
  p: number;
  label: string;
}

/** 賭け方。ひとつの遊びの中で選べる（ルーレットの赤黒・一点など） */
export interface BetDef {
  id: string;
  name: string;
  /** 一言の説明 */
  note: string;
  outcomes: GameOutcome[];
}

export interface GameDef {
  id: GameId;
  name: string;
  icon: string;
  kind: GameKind;
  /** 1回の賭け金（総資産に応じて上がる。これはその基準） */
  baseBet: number;
  /** 選べる賭け方（1つしかない遊びもある） */
  bets: BetDef[];
  description: string;
}

/** ルーレットの赤い数字（本物と同じ並び） */
export const ROULETTE_RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
/** ルーレットの盤の並び（0 から時計回り。ヨーロッパ式の1つゼロ） */
export const ROULETTE_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

/** スロットの絵柄（リールに並べる順） */
export const SLOT_SYMBOLS = [
  { id: 'grape', name: 'ぶどう', icon: 'icon_slot_grape' },
  { id: 'bell', name: 'ベル', icon: 'icon_slot_bell' },
  { id: 'bar', name: 'BAR', icon: 'icon_slot_bar' },
  { id: 'seven', name: '7', icon: 'icon_slot_seven' },
  { id: 'jackpot', name: 'ジャックポット', icon: 'icon_slot_jackpot' },
] as const;

export type SlotSymbolId = (typeof SLOT_SYMBOLS)[number]['id'];

/** スロットの出目 → 揃う絵柄 */
export const SLOT_BY_LABEL: Record<string, SlotSymbolId> = {
  ぶどう: 'grape',
  ベル: 'bell',
  BAR: 'bar',
  '7が2つ': 'seven',
  ジャックポット: 'jackpot',
};

/** 絵柄が見つからないときに使う代わりのアイコン（素材が入るまでの仮） */
export const SLOT_FALLBACK_ICON: Record<SlotSymbolId, string> = {
  grape: 'icon_food_grape',
  bell: 'icon_ui_bell',
  bar: 'icon_ui_pause',
  seven: 'icon_ui_star',
  jackpot: 'icon_ui_crown',
};

export const GAMES: readonly GameDef[] = [
  {
    id: 'slot',
    name: 'スロット',
    icon: 'icon_ui_star',
    kind: 'slot',
    baseBet: 1_000,
    bets: [
      {
        id: 'spin',
        name: '回す',
        note: 'リールは自分で止める。当たりは回した時点で決まっていて、そこへ少し滑って揃う（本物のパチスロと同じ）',
        outcomes: [
          { payout: 0, p: 0.7, label: 'はずれ' },
          { payout: 1.2, p: 0.18, label: 'ぶどう' },
          { payout: 2.5, p: 0.08, label: 'ベル' },
          { payout: 8, p: 0.03, label: 'BAR' },
          { payout: 20, p: 0.0088, label: '7が2つ' },
          { payout: 90, p: 0.0012, label: 'ジャックポット' },
        ],
      },
    ],
    description: '3つのリールを自分で止めて揃える。当たりは軽いが、まれに大きいのが来る。',
  },
  {
    id: 'roulette',
    name: 'ルーレット',
    icon: 'icon_ui_time',
    kind: 'wheel',
    baseBet: 5_000,
    bets: [
      {
        id: 'color',
        name: '赤・黒',
        note: '18個の数字。当たれば2倍',
        outcomes: [
          { payout: 0, p: 19 / 37, label: 'はずれ' },
          { payout: 2, p: 18 / 37, label: '的中' },
        ],
      },
      {
        id: 'parity',
        name: '偶数・奇数',
        note: '18個の数字。当たれば2倍',
        outcomes: [
          { payout: 0, p: 19 / 37, label: 'はずれ' },
          { payout: 2, p: 18 / 37, label: '的中' },
        ],
      },
      {
        id: 'dozen',
        name: 'ダース（12個）',
        note: '1〜12 などの12個。当たれば3倍',
        outcomes: [
          { payout: 0, p: 25 / 37, label: 'はずれ' },
          { payout: 3, p: 12 / 37, label: '的中' },
        ],
      },
      {
        id: 'straight',
        name: '一点賭け',
        note: '数字をひとつだけ。当たれば36倍',
        outcomes: [
          { payout: 0, p: 36 / 37, label: 'はずれ' },
          { payout: 36, p: 1 / 37, label: '的中！' },
        ],
      },
    ],
    description: '玉が落ちる数字を当てる。0 があるぶんだけ胴元が有利で、どの賭け方でも取り分は同じ。',
  },
  {
    id: 'cards',
    name: 'バカラ',
    icon: 'icon_office_documents',
    kind: 'cards',
    baseBet: 10_000,
    bets: [
      {
        id: 'player',
        name: 'プレイヤー',
        note: '当たれば2倍。引き分けは返ってくる',
        outcomes: [
          { payout: 0, p: 0.4586, label: 'バンカーの勝ち' },
          { payout: 1, p: 0.0952, label: '引き分け（返却）' },
          { payout: 2, p: 0.4462, label: 'プレイヤーの勝ち' },
        ],
      },
      {
        id: 'banker',
        name: 'バンカー',
        note: '勝ちやすいぶん、配当から5%引かれる',
        outcomes: [
          { payout: 0, p: 0.4462, label: 'プレイヤーの勝ち' },
          { payout: 1, p: 0.0952, label: '引き分け（返却）' },
          { payout: 1.95, p: 0.4586, label: 'バンカーの勝ち' },
        ],
      },
      {
        id: 'tie',
        name: '引き分け',
        note: 'めったに出ないが9倍',
        outcomes: [
          { payout: 0, p: 0.9048, label: '決着（はずれ）' },
          { payout: 9, p: 0.0952, label: '引き分け！' },
        ],
      },
    ],
    description: 'プレイヤーとバンカー、どちらの手が9に近いかを当てる。札は本物と同じ決まりでめくれる。',
  },
  {
    id: 'pachinko',
    name: 'パチンコ',
    icon: 'icon_ui_company',
    kind: 'pachinko',
    baseBet: 2_000,
    bets: [
      {
        id: 'shoot',
        name: '打つ',
        note: 'ハンドルの強さで玉の飛び方が変わる。入賞するとデジタルが回る',
        outcomes: [
          { payout: 0, p: 0.8, label: 'はずれ' },
          { payout: 2, p: 0.16, label: '小当たり' },
          { payout: 8, p: 0.036, label: '確変' },
          { payout: 80, p: 0.004, label: '大当たり' },
        ],
      },
    ],
    description: 'ハンドルを握って玉を打ち、真ん中の穴を狙う。入賞するとデジタルが回って当たりが決まる。',
  },
];

export const GAME_MAP: Record<GameId, GameDef> = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameDef>;

/** 賭け方ひとつの期待値（賭け金1に対して返ってくる割合） */
export function betReturn(bet: BetDef): number {
  return bet.outcomes.reduce((a, o) => a + o.payout * o.p, 0);
}

/** その遊びの期待値（賭け方の平均）。1 未満なら長く遊ぶほど減る */
export function expectedReturn(def: GameDef): number {
  return def.bets.reduce((a, b) => a + betReturn(b), 0) / def.bets.length;
}

/** 賭け方を取り出す（id がなければ最初のもの） */
export function betOf(def: GameDef, betId?: string): BetDef {
  return def.bets.find((b) => b.id === betId) ?? def.bets[0];
}

/**
 * 宝くじ。
 *
 * はずれた回の賞金は次回に持ち越して膨らむので、
 * 「積み上がった回を狙って多めに買う」のがいちばん分がいい遊び方になる。
 * ただし賞金には上限があり、1回に買える枚数も出回っている枚数より少ないので、
 * どれだけうまく立ち回っても、買った額より戻る額のほうが小さい（胴元が勝つ）。
 */
export const LOTTERY = {
  /** 1枚の値段（円） */
  ticketPrice: 300,
  /** 抽選の間隔（秒） */
  intervalSec: 300,
  /** ほかの人が買っている枚数（自分の当選確率の分母になる） */
  publicTickets: 2_000_000,
  /** 売上のうち賞金に回る割合（残りは胴元の取り分） */
  payoutRatio: 0.47,
  /** 最初から積んである賞金（円） */
  baseJackpot: 200_000_000,
  /** 持ち越しで積み上がる賞金の上限（円）。ここで止めないと必ず勝てる回ができてしまう */
  maxJackpot: 600_000_000,
  /** 1回に買える上限（出回っている枚数の 1/4） */
  maxPerDraw: 500_000,
} as const;
