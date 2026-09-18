/**
 * 「まだ使えない機能は画面に出さない」ための判定をここに集める。
 *
 * 出したり消したりする場所が増えると、どこかだけ直し忘れて
 * 「タブはあるのに中身が使えない」状態になりやすい。判定は必ずここを通す。
 */
import type { DerivedState, GameState } from '@/types/state';
import type { EngineContext } from '../context';
import type { NavTab } from '@/types/ui';
import { BUSINESSES } from '@/game/data/business';
import { isBusinessUnlocked } from './business';
import { isSalesUnlocked } from './sales';
import { isTradeUnlocked } from './trade';
import { isEstateSystemUnlocked, isLandSystemUnlocked } from './unlocks';

export type HomeSub = 'home' | 'resources' | 'sales' | 'business' | 'company';
export type MapSub = 'map' | 'owned' | 'marks' | 'stocks';

/**
 * いま出すものに「一度でも開いたもの」を足して、決まった並びに戻す。
 * 一度開いた画面は、条件を満たさなくなっても消さない（転生で全部消える、を防ぐ）。
 */
function withSeen<T extends string>(order: readonly T[], now: T[], seen: string[] | undefined): T[] {
  if (!seen || seen.length === 0) return now;
  const keep = new Set<string>(now);
  for (const s of seen) keep.add(s);
  return order.filter((x) => keep.has(x));
}

const TAB_ORDER: NavTab[] = ['home', 'craft', 'factory', 'map', 'research', 'settings'];
const HOME_SUB_ORDER: HomeSub[] = ['home', 'resources', 'sales', 'business', 'company'];
const MAP_SUB_ORDER: MapSub[] = ['map', 'owned', 'marks', 'stocks'];

/** 下のタブ（ホーム・クラフト・施設・地図・研究・設定）のうち、いま出すもの */
export function visibleTabs(state: GameState, derived: DerivedState): NavTab[] {
  const out: NavTab[] = ['home', 'craft', 'factory'];
  // 地図は「土地を買えるだけの資産」になってから
  if (isLandSystemUnlocked(state, derived.assets)) out.push('map');
  // 研究は、研究所を建てられる土地を持てるようになってから
  // （土地が無いと研究所が建てられず、ポイントが1も入らないため）
  if (isLandSystemUnlocked(state, derived.assets) || (state.research?.totalPoints ?? 0) > 0) out.push('research');
  out.push('settings');
  return withSeen(TAB_ORDER, out, state.settings?.seenTabs);
}

/** ホームの中の切替のうち、いま出すもの */
export function visibleHomeSubs(state: GameState): HomeSub[] {
  const out: HomeSub[] = ['home', 'resources'];
  // 取引: 相手から話が来るようになるか、貿易ができるようになってから
  if (isSalesUnlocked(state) || isTradeUnlocked(state)) out.push('sales');
  // 事業: 始められる業種が1つでもあるか、すでに始めているとき
  const hasBusiness = (state.business?.divisions.length ?? 0) > 0 || BUSINESSES.some((k) => isBusinessUnlocked(state, k.id));
  if (hasBusiness) out.push('business');
  // 会社: 一度でも売上が立ってから（それまでは見ても0が並ぶだけ）。
  // ただし転生したことがあるなら必ず出す。転生すると売上が0に戻るので、
  // ここを売上だけで判定していると、貯めた永続ポイントとアップグレードに
  // 二度と触れなくなってしまう（実際にそうなっていた）。
  const reborn = (state.prestige?.count ?? 0) > 0 || (state.prestige?.points ?? 0) > 0;
  if (state.company.totalEarned > 0 || reborn) out.push('company');
  return withSeen(HOME_SUB_ORDER, out, state.settings?.seenHomeSubs);
}

/** 地図の中の切替のうち、いま出すもの */
export function visibleMapSubs(state: GameState, derived: DerivedState): MapSub[] {
  const out: MapSub[] = ['map'];
  if (state.lands.length > 1) out.push('owned');
  // 印を1つでも付けたら「気になる」が出る
  if ((state.bookmarks?.length ?? 0) > 0) out.push('marks');
  if (isEstateSystemUnlocked(state, derived.assets)) out.push('stocks');
  return withSeen(MAP_SUB_ORDER, out, state.settings?.seenMapSubs);
}

/**
 * いま出ている画面を「一度は開いた」として覚える。毎 tick 呼ばれるので、
 * 増えたときだけ書き足す（毎回 new を作らない）。
 */
export function runSeen(ctx: EngineContext): void {
  const { state, derived } = ctx;
  const s = state.settings;
  if (!s) return;
  const add = (key: 'seenTabs' | 'seenHomeSubs' | 'seenMapSubs', now: string[]) => {
    const cur = s[key];
    if (!cur) {
      s[key] = [...now];
      return;
    }
    let changed = false;
    for (const x of now) {
      if (!cur.includes(x)) {
        cur.push(x);
        changed = true;
      }
    }
    if (changed) s[key] = [...cur];
  };
  add('seenTabs', visibleTabs(state, derived));
  add('seenHomeSubs', visibleHomeSubs(state));
  add('seenMapSubs', visibleMapSubs(state, derived));
}
