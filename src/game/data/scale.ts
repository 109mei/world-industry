/**
 * お金と量の「ものさし」。
 *
 * この game は1日を現実の60秒に圧縮している（data/calendar.ts の SECONDS_PER_DAY）。
 * だから「毎秒の数字」は、現実の1日ぶんを60で割ったものとして読む。
 *
 *   ゲームの毎秒の量 = 現実の1日ぶんの量 ÷ 60
 *
 * こうしておくと、ゲーム内で1日たつと現実の1日ぶんが動く。
 * 給料も、電気代も、工場の生産も、すべて同じ物差しで測れるので、
 * 「現実の会社の数字」をそのまま持ち込んで比べられる。
 *
 * 電力だけは例外で、MW（一瞬あたりの値）は現実の値をそのまま出す。
 * 読みやすさのためで、代わりに電気の代金だけをこの物差しに合わせている。
 */

/** 現実の1日 = ゲームの何秒か */
export const SECONDS_PER_GAME_DAY = 60;

/** 「現実の1日ぶん」を「ゲームの毎秒」に直す */
export function perDay(amountPerRealDay: number): number {
  return amountPerRealDay / SECONDS_PER_GAME_DAY;
}

/** 「現実の1時間ぶん」を「ゲームの毎秒」に直す */
export function perHour(amountPerRealHour: number): number {
  return (amountPerRealHour * 24) / SECONDS_PER_GAME_DAY;
}

/**
 * 現実の「毎秒」を、ゲームの「毎秒」に直す倍率。
 * 電気代のように、現実の単価（円/MWh）から計算するものに掛ける。
 */
export const REAL_SECOND_TO_GAME = 86400 / SECONDS_PER_GAME_DAY; // = 1440

/** 1人あたりの人件費（円/現実1日）。時給1,080円 × 24時間ぶんの負担として置く */
export const WAGE_PER_DAY = 25_920;
