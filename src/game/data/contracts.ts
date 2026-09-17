import type { CreditRank } from '@/types/state';

/** 注文の依頼主（架空の会社・団体） */
export const CONTRACT_CLIENTS = [
  '青葉建設', 'つばめ運輸', '北都ハウジング', '南洋商事', '桜庭工務店', '瀬戸内造船', 'ハイランド電機', '大和農業協同組合',
  '港湾整備公社', 'ノーザン・ロジスティクス', 'Vega Motors', 'Kestrel Aerospace', '灯台食品', '日之出精機', 'Meridian Data',
] as const;

export interface CreditRankDef {
  rank: CreditRank;
  /** このポイント以上でこのランク */
  min: number;
  /** 不動産の売買手数料（価格に対する割合） */
  estateFee: number;
  /** 株の売買スプレッド（片道） */
  stockSpread: number;
  /** 輸送費の倍率 */
  transportCost: number;
  /** 注文の報酬倍率 */
  rewardMult: number;
  label: string;
}

/** 信用ランク。注文を達成すると上がり、期限切れで下がる */
export const CREDIT_RANKS: readonly CreditRankDef[] = [
  { rank: 'E', min: 0, estateFee: 0.03, stockSpread: 0.005, transportCost: 1, rewardMult: 1, label: '無名' },
  { rank: 'D', min: 100, estateFee: 0.025, stockSpread: 0.0045, transportCost: 0.98, rewardMult: 1.05, label: '駆け出し' },
  { rank: 'C', min: 300, estateFee: 0.02, stockSpread: 0.004, transportCost: 0.96, rewardMult: 1.1, label: '信頼できる取引先' },
  { rank: 'B', min: 700, estateFee: 0.015, stockSpread: 0.0035, transportCost: 0.94, rewardMult: 1.2, label: '優良企業' },
  { rank: 'A', min: 1500, estateFee: 0.01, stockSpread: 0.003, transportCost: 0.92, rewardMult: 1.3, label: '一流企業' },
  { rank: 'S', min: 3000, estateFee: 0.005, stockSpread: 0.0025, transportCost: 0.9, rewardMult: 1.5, label: '業界の盟主' },
];

export function creditRankOf(points: number): CreditRankDef {
  let best = CREDIT_RANKS[0];
  for (const r of CREDIT_RANKS) if (points >= r.min) best = r;
  return best;
}

/** 次のランクまでのポイント（最高ランクなら null） */
export function nextCreditRank(points: number): CreditRankDef | null {
  for (const r of CREDIT_RANKS) if (points < r.min) return r;
  return null;
}
