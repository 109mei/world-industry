/**
 * 人件費・赤字・破産。
 *
 * 従業員には毎秒 人件費がかかる。売上より人件費のほうが大きければ所持金は減り、
 * ゼロを割ると借金になる。借金には利息が付き、返せる見込みがないほど膨らむと破産する。
 * 破産しても、これまでに貯めた永続ポイントと実績は残る。
 */
import { CONFIG } from '@/game/data/config';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import type { GameState } from '@/types/state';
import type { EngineContext } from '../context';
import { safe } from '@/utils/numbers';
import { businessStaffTotal, businessWageTotal } from './business';

/** 従業員1人あたりの人件費（円/秒）。1時間で 1,080円 */
export const WAGE_PER_EMPLOYEE = 0.3;
/** 借金の利息（1時間あたり） */
export const DEBT_INTEREST_PER_HOUR = 0.2;
/** 赤字のまま耐えられる時間（秒）。これを超えると破産 */
export const GRACE_SECONDS = 900;

/** いまの人件費（円/秒） */
export function wagePerSec(state: GameState): number {
  let employees = 0;
  for (const f of state.facilities) {
    if (f.count <= 0 || !isFacilityId(f.typeId)) continue;
    // 止めている施設の人にも給料は出る（雇っているので）
    employees += FACILITY_MAP[f.typeId].employees * f.count;
  }
  return employees * WAGE_PER_EMPLOYEE + businessWageTotal(state);
}

/** 会社全体の従業員数（施設＋事業） */
export function employeeTotal(state: GameState): number {
  let employees = 0;
  for (const f of state.facilities) {
    if (f.count <= 0 || !isFacilityId(f.typeId)) continue;
    employees += FACILITY_MAP[f.typeId].employees * f.count;
  }
  return employees + businessStaffTotal(state);
}

/** 破産とみなす借金の額（円、正の数）。会社が大きいほど耐えられる */
export function debtLimit(assets: number): number {
  return Math.max(2_000_000, Math.abs(assets) * 0.35);
}

/** いま赤字（借金）か */
export function inDebt(state: GameState): boolean {
  return state.company.cash < 0;
}

/**
 * 破産してやり直した状態を作る。
 * 永続ポイント・アップグレード・実績・会社名・設定は残し、それ以外は最初からにする。
 * 再出発（プレステージ）と違ってポイントは増えない。
 */
export function buildBankruptState(state: GameState, now: number, createInitialState: (n?: number) => GameState): GameState {
  const next = createInitialState(now);
  next.prestige = {
    count: state.prestige?.count ?? 0,
    points: state.prestige?.points ?? 0,
    upgrades: { ...(state.prestige?.upgrades ?? {}) },
    history: [...(state.prestige?.history ?? [])],
  };
  next.achievements = { ...state.achievements };
  next.settings = { ...state.settings };
  next.company.name = state.company.name;
  // 立て直すための元手。開業資金のアップグレードを買っていれば、そのぶんから再開できる
  next.company.cash = Math.max(CONFIG.initialCash, 500_000 * (next.prestige.upgrades?.start_cash ?? 0));
  next.tutorial = { step: 0, completed: true };
  next.stats = { ...next.stats, playtimeSeconds: state.stats.playtimeSeconds, taps: state.stats.taps, bankruptcies: (state.stats.bankruptcies ?? 0) + 1 };
  next.eventLog = [];
  next.nextEventId = 1;
  return next;
}

/** 毎 tick（前半）: 人件費を払う。収支の判定はこの tick の収入が入ったあとに行う */
export function runWages(ctx: EngineContext, dt: number): number {
  const { state, derived } = ctx;
  const wageMult = derived.modifiers?.wage ?? 1;
  const perSec = wagePerSec(state) * wageMult;
  const wages = perSec * dt;
  if (wages > 0) {
    state.company.cash = safe(state.company.cash - wages);
    state.company.totalSpent = safe(state.company.totalSpent + wages);
    state.stats.totalWages = safe((state.stats.totalWages ?? 0) + wages);
  }
  derived.wageCost = perSec;
  return wages;
}

/**
 * 毎 tick（後半）: その tick の収入がすべて入ったあとで、赤字かどうかを見る。
 * 先に判定すると「売れば足りるのに倒産する」ことになるので、順番が大事。
 */
export function runSolvency(ctx: EngineContext, dt: number): { bankrupt: boolean } {
  const { state, derived } = ctx;
  if (state.company.cash >= 0) {
    state.company.debtSeconds = 0;
    return { bankrupt: false };
  }
  // 借金には利息が付く
  const interest = -state.company.cash * DEBT_INTEREST_PER_HOUR * (dt / 3600);
  state.company.cash = safe(state.company.cash - interest);
  const before = state.company.debtSeconds ?? 0;
  state.company.debtSeconds = before + dt;
  // 初めて赤字になったとき、そして半分を過ぎたときに知らせる
  if (before <= 0) {
    ctx.emit('warn', `資金がマイナスになりました。${Math.round(GRACE_SECONDS / 60)}分以内に立て直さないと倒産します（施設を売るか、資源を売って現金を作りましょう）`, { toast: true });
  } else if (before < GRACE_SECONDS / 2 && state.company.debtSeconds >= GRACE_SECONDS / 2) {
    ctx.emit('warn', '赤字が続いています。このままだと倒産します', { toast: true });
  }
  const limit = debtLimit(derived.assets);
  const bankrupt = state.company.debtSeconds >= GRACE_SECONDS || -state.company.cash >= limit;
  return { bankrupt };
}
