/**
 * 表示に使う通貨。
 * ゲームの中の金額はすべて「円」で計算していて、ここで表示だけを換算する。
 * レートは目安の固定値で、為替として動くことはない。
 */

export interface CurrencyDef {
  id: string;
  /** 表示名 */
  name: string;
  /** 記号・単位（¥ や 円 など） */
  symbol: string;
  /** 記号を数字の前に置くか（¥100 / 100円） */
  prefix: boolean;
  /** 1円が何単位にあたるか */
  rate: number;
}

export const CURRENCIES: readonly CurrencyDef[] = [
  { id: 'jpy', name: '円', symbol: '円', prefix: false, rate: 1 },
  { id: 'usd', name: 'アメリカドル', symbol: '$', prefix: true, rate: 1 / 150 },
  { id: 'eur', name: 'ユーロ', symbol: '€', prefix: true, rate: 1 / 165 },
  { id: 'gbp', name: 'イギリスポンド', symbol: '£', prefix: true, rate: 1 / 195 },
  { id: 'cny', name: '中国元', symbol: '元', prefix: false, rate: 1 / 21 },
  { id: 'krw', name: '韓国ウォン', symbol: '₩', prefix: true, rate: 9 },
  { id: 'inr', name: 'インドルピー', symbol: '₹', prefix: true, rate: 1 / 1.8 },
  { id: 'aud', name: 'オーストラリアドル', symbol: 'A$', prefix: true, rate: 1 / 100 },
  { id: 'brl', name: 'ブラジルレアル', symbol: 'R$', prefix: true, rate: 1 / 27 },
  { id: 'chf', name: 'スイスフラン', symbol: 'CHF ', prefix: true, rate: 1 / 170 },
  { id: 'twd', name: '台湾ドル', symbol: 'NT$', prefix: true, rate: 1 / 4.7 },
  { id: 'coin', name: 'コイン（架空）', symbol: 'C', prefix: false, rate: 1 / 1000 },
];

export const CURRENCY_MAP: Record<string, CurrencyDef> = Object.fromEntries(CURRENCIES.map((c) => [c.id, c]));

export const DEFAULT_CURRENCY = CURRENCIES[0];

export function currencyOf(id: string | undefined): CurrencyDef {
  return (id && CURRENCY_MAP[id]) || DEFAULT_CURRENCY;
}
