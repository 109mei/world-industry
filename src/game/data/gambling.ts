/**
 * 賭け事。カジノを建てて客に遊んでもらう側と、自分で遊ぶ側の両方がある。
 *
 * どの遊びも「胴元が少しだけ有利」になっていて、長く遊べば必ず減る。
 * そのぶん、カジノを「開く側」に回ると安定して儲かる——という作りにしている。
 * 期待値は画面にそのまま表示して、隠さない。
 */

export type GameId = 'slot' | 'roulette' | 'cards' | 'pachinko';

export interface GameOutcome {
  /** 配当の倍率（賭け金の何倍が返るか。0 ははずれ） */
  payout: number;
  /** その目が出る確率 */
  p: number;
  label: string;
}

export interface GameDef {
  id: GameId;
  name: string;
  icon: string;
  /** 1回の賭け金（総資産に応じて上がる。これはその基準） */
  baseBet: number;
  /** 出目 */
  outcomes: GameOutcome[];
  description: string;
}

export const GAMES: readonly GameDef[] = [
  {
    id: 'slot',
    name: 'スロット',
    icon: 'icon_ui_star',
    baseBet: 1_000,
    outcomes: [
      { payout: 0, p: 0.7, label: 'はずれ' },
      { payout: 1.2, p: 0.18, label: 'チェリー' },
      { payout: 2.5, p: 0.08, label: 'ベル' },
      { payout: 8, p: 0.03, label: 'スイカ' },
      { payout: 20, p: 0.0088, label: '7が2つ' },
      { payout: 90, p: 0.0012, label: 'ジャックポット' },
    ],
    description: '回して揃える。当たりは軽いが、まれに大きいのが来る。',
  },
  {
    id: 'roulette',
    name: 'ルーレット',
    icon: 'icon_ui_time',
    baseBet: 5_000,
    outcomes: [
      { payout: 0, p: 0.514, label: 'はずれ' },
      { payout: 2, p: 0.486, label: '赤か黒が的中' },
    ],
    description: '赤か黒か。当たれば2倍。0 があるぶんだけ胴元が有利。',
  },
  {
    id: 'cards',
    name: 'カード',
    icon: 'icon_office_documents',
    baseBet: 10_000,
    outcomes: [
      { payout: 0, p: 0.49, label: '負け' },
      { payout: 1, p: 0.08, label: '引き分け' },
      { payout: 2, p: 0.39, label: '勝ち' },
      { payout: 2.5, p: 0.04, label: '一発勝負に勝ち' },
    ],
    description: '配られた手で勝負する。勝ち負けが五分に近く、長く遊べる。',
  },
  {
    id: 'pachinko',
    name: 'パチンコ',
    icon: 'icon_ui_company',
    baseBet: 2_000,
    outcomes: [
      { payout: 0, p: 0.8, label: 'はずれ' },
      { payout: 2, p: 0.16, label: '小当たり' },
      { payout: 8, p: 0.036, label: '確変' },
      { payout: 80, p: 0.004, label: '大当たり' },
    ],
    description: '玉を打って穴を狙う。小当たりで粘りながら、大当たりを待つ。',
  },
];

export const GAME_MAP: Record<GameId, GameDef> = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameDef>;

/** その遊びの期待値（賭け金1に対して返ってくる割合）。1 未満なら長く遊ぶほど減る */
export function expectedReturn(def: GameDef): number {
  return def.outcomes.reduce((a, o) => a + o.payout * o.p, 0);
}

/** 宝くじ */
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
  /** 1回に買える上限 */
  maxPerDraw: 5_000_000,
} as const;
