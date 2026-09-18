/**
 * ゲームの中の暦。
 *
 * 現実の1日をゲームの中では短い時間に圧縮する（早送り）。
 * こうしないと、現実どおりの値段と給料で「石を拾う人」から始めた会社が
 * ビルを買うまでに何十年もかかってしまう。
 *
 * 給料日・家賃・決算・季節は、すべてこの暦で回す。
 */

/**
 * 早送りの速さ。
 *
 * ここは**わざと固定にしてある**。
 * 離れているあいだに進んだぶんも同じ速さで計算するので、
 * あとから速さを変えられると「閉じている間に何日進んだか」が食い違ってしまう。
 * 決算・給料日・季節もこの長さを前提に組んであるため、遊びやすい1つの速さに決めている。
 *
 * 1日 = 現実の60秒。1時間遊ぶとゲームの中では約2か月進む。
 */
export const SECONDS_PER_DAY = 60;

/** 1日にかかる現実の秒数 */
export function secondsPerDay(): number {
  return SECONDS_PER_DAY;
}

/** 画面に出す説明（設定でそのまま使う） */
export const TIME_SCALE_NOTE = '1日＝1分で進みます。1時間遊ぶとゲームの中では約2か月。離れているあいだも同じ速さで進みます。';

/** 会社を興した日。日本の会計年度に合わせて4月始まりにしてある */
export const EPOCH = { year: 2025, month: 4, day: 1 } as const;

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonDef {
  id: SeasonId;
  label: string;
  /** 帯に使う絵（assets/art） */
  art: string;
  months: readonly number[];
  note: string;
}

export const SEASONS: Record<SeasonId, SeasonDef> = {
  spring: { id: 'spring', label: '春', art: 'season_spring', months: [3, 4, 5], note: '種をまく季節。畑の実りが増え、人の動きも増える' },
  summer: { id: 'summer', label: '夏', art: 'season_summer', months: [6, 7, 8], note: '日照が強く太陽光がよく働く。暑さで電気の使用量も増える' },
  autumn: { id: 'autumn', label: '秋', art: 'season_autumn', months: [9, 10, 11], note: '収穫の季節。農作物がいちばん多く採れる' },
  winter: { id: 'winter', label: '冬', art: 'season_winter', months: [12, 1, 2], note: '畑は休み、暖房で電気が要る。運ぶのにも時間がかかる' },
};

export function seasonOf(month: number): SeasonId {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  return m === 2 && isLeap(y) ? 29 : DAYS_IN_MONTH[m - 1];
}

export interface GameDate {
  year: number;
  month: number;
  day: number;
  /** 0=日曜 */
  weekday: number;
  weekdayLabel: string;
  season: SeasonId;
  /** 会社を興してからの日数（0始まり） */
  elapsedDays: number;
  /** その日の進み具合 0〜1 */
  dayProgress: number;
}

/**
 * 「会社を興してから何日たったか」を暦の日付に直す。
 * うるう年も数えるので、長く遊んでも日付がずれない。
 */
export function dateFromDays(elapsed: number): GameDate {
  /*
   * 小数の足し算をくり返すと、ちょうど10日ぶん進めても 9.999999… になる。
   * そのまま切り捨てると1日足りなくなるので、ごく小さい値（0.09秒ぶん）を足してから切り捨てる。
   */
  const whole = Math.max(0, Math.floor(elapsed + 1e-6));
  let y: number = EPOCH.year;
  let m: number = EPOCH.month;
  let d: number = EPOCH.day;
  let left = whole;
  // 年単位でまとめて進めてから、月・日を詰める（何万日でもすぐ終わる）
  for (;;) {
    const yearLen = isLeap(y) ? 366 : 365;
    if (left < yearLen) break;
    left -= yearLen;
    y += 1;
  }
  for (;;) {
    const room = daysInMonth(y, m) - d + 1;
    if (left < room) break;
    left -= room;
    m += 1;
    d = 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  d += left;
  // 2025-04-01 は火曜日
  const weekday = (2 + whole) % 7;
  return {
    year: y,
    month: m,
    day: d,
    weekday,
    weekdayLabel: WEEKDAYS[weekday],
    season: seasonOf(m),
    elapsedDays: whole,
    dayProgress: Math.max(0, Math.min(1, elapsed + 1e-6 - whole)),
  };
}

/** 画面に出す日付（2025年4月1日(火)） */
export function formatGameDate(d: GameDate): string {
  return `${d.year}年${d.month}月${d.day}日(${d.weekdayLabel})`;
}

/** 短い日付（4/1） */
export function formatGameDateShort(d: GameDate): string {
  return `${d.month}/${d.day}`;
}
