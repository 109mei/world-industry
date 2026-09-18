import type { CountryCode } from './lands';
import { REAL_SECOND_TO_GAME, SECONDS_PER_GAME_DAY } from './scale';

/**
 * 電力会社から電気を「借りる」ときの条件。
 *
 * 自分で発電所を建てるかわりに、電力会社と契約して買うこともできる。
 * 現実の産業用電力と同じく、料金は
 *   基本料金（契約した容量ぶん。使わなくてもかかる）＋ 従量料金（実際に使ったぶん）
 * の2本立てにしてある。だから「大きく契約して使わない」のがいちばん損になる。
 *
 * 自前の発電より割高にしてあるので、電気を買うのは
 * 「まだ発電所を建てる金がない」「工場を増やしたが発電が追いつかない」ときの選択肢になる。
 */
export const GRID = {
  /** 従量料金の基準（円/MWh）。日本の産業用電力（およそ20円/kWh）に合わせてある */
  basePricePerMWh: 20_000,
  /** 基本料金（円/MW/月）。契約容量ぶん、使わなくても毎月かかる */
  basicChargePerMWPerMonth: 1_800_000,
  /** 売るときの卸値（円/MWh）。日本の卸電力市場の平均に近い水準 */
  wholesalePerMWh: 12_000,
  /** 再生可能エネルギーの買取の上乗せ */
  renewableBonus: 1.35,
} as const;

/**
 * 国ごとの電気代の差（日本を1.0とした倍率）。
 * 産業用電力料金の実際の比に近づけてある（安い順に サウジアラビア・ノルウェー・カナダ・中国 …）。
 */
export const COUNTRY_POWER_PRICE: Record<CountryCode, number> = {
  JP: 1,
  US: 0.55,
  CN: 0.5,
  DE: 1.15,
  CA: 0.45,
  NO: 0.4,
  AU: 0.75,
  CL: 0.7,
  BR: 0.6,
  SA: 0.3,
};

/** 契約できる容量の段（MW）。0 は「契約しない」 */
export const CONTRACT_STEPS: readonly number[] = [0, 1, 5, 20, 100, 500, 2_000];

/** その国での従量料金（円/MWh） */
export function gridPricePerMWh(country: CountryCode): number {
  return GRID.basePricePerMWh * (COUNTRY_POWER_PRICE[country] ?? 1);
}

/**
 * 電力会社から買ったときに本当にかかる額（円/MWh）。
 *
 * 従量料金だけを見ると自前の発電より安く見えるが、契約容量ぶんの基本料金が別にかかる。
 * 契約した容量をめいっぱい使い切ったときでも、1MWの契約は1ヵ月あたり720MWhにしかならないので、
 * 基本料金は 1,800,000 ÷ 720 ＝ 2,500円/MWh ぶん上乗せになる。使い切らなければもっと高くつく。
 */
export function gridTotalPerMWh(country: CountryCode): number {
  const hoursPerMonth = 30 * 24;
  return gridPricePerMWh(country) + (GRID.basicChargePerMWPerMonth * (COUNTRY_POWER_PRICE[country] ?? 1)) / hoursPerMonth;
}

/** 電気を売るときの卸値（円/MWh）。買う値段より安い（小売と卸の差） */
export function sellPricePerMWh(country: CountryCode, renewable = false): number {
  const base = GRID.wholesalePerMWh * (COUNTRY_POWER_PRICE[country] ?? 1);
  return renewable ? base * GRID.renewableBonus : base;
}

/**
 * 契約容量にかかる基本料金（円/秒）。
 * 現実の「1ヵ月ぶん」を、ゲームの1ヵ月（現実の30分）に割り付ける。
 */
export function basicChargePerSec(contractMW: number, country: CountryCode): number {
  if (contractMW <= 0) return 0;
  const gameMonthSeconds = 30 * SECONDS_PER_GAME_DAY;
  return (contractMW * GRID.basicChargePerMWPerMonth * (COUNTRY_POWER_PRICE[country] ?? 1)) / gameMonthSeconds;
}

/** 実際に買った電気の従量料金（円/秒）。現実の1時間ぶんを、ゲームの物差しに直す */
export function usageChargePerSec(purchasedMW: number, country: CountryCode): number {
  if (purchasedMW <= 0) return 0;
  return ((purchasedMW * gridPricePerMWh(country)) / 3600) * REAL_SECOND_TO_GAME;
}

/** 売った電気の代金（円/秒） */
export function sellIncomePerSec(soldMW: number, country: CountryCode, renewable = false): number {
  if (soldMW <= 0) return 0;
  return ((soldMW * sellPricePerMWh(country, renewable)) / 3600) * REAL_SECOND_TO_GAME;
}
