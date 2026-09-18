/**
 * 「まだ使えない機能は画面に出さない」ための判定をここに集める。
 *
 * 出したり消したりする場所が増えると、どこかだけ直し忘れて
 * 「タブはあるのに中身が使えない」状態になりやすい。判定は必ずここを通す。
 */
import type { DerivedState, GameState } from '@/types/state';
import type { NavTab } from '@/types/ui';
import { BUSINESSES } from '@/game/data/business';
import { isBusinessUnlocked } from './business';
import { isSalesUnlocked } from './sales';
import { isTradeUnlocked } from './trade';
import { isEstateSystemUnlocked, isLandSystemUnlocked } from './unlocks';

export type HomeSub = 'home' | 'resources' | 'sales' | 'business' | 'company';
export type MapSub = 'map' | 'owned' | 'marks' | 'stocks';

/** 下のタブ（ホーム・クラフト・施設・地図・研究・設定）のうち、いま出すもの */
export function visibleTabs(state: GameState, derived: DerivedState): NavTab[] {
  const out: NavTab[] = ['home', 'craft', 'factory'];
  // 地図は「土地を買えるだけの資産」になってから
  if (isLandSystemUnlocked(state, derived.assets)) out.push('map');
  // 研究は、研究所を建てられる土地を持てるようになってから
  // （土地が無いと研究所が建てられず、ポイントが1も入らないため）
  if (isLandSystemUnlocked(state, derived.assets) || (state.research?.totalPoints ?? 0) > 0) out.push('research');
  out.push('settings');
  return out;
}

/** ホームの中の切替のうち、いま出すもの */
export function visibleHomeSubs(state: GameState): HomeSub[] {
  const out: HomeSub[] = ['home', 'resources'];
  // 取引: 相手から話が来るようになるか、貿易ができるようになってから
  if (isSalesUnlocked(state) || isTradeUnlocked(state)) out.push('sales');
  // 事業: 始められる業種が1つでもあるか、すでに始めているとき
  const hasBusiness = (state.business?.divisions.length ?? 0) > 0 || BUSINESSES.some((k) => isBusinessUnlocked(state, k.id));
  if (hasBusiness) out.push('business');
  // 会社: 一度でも売上が立ってから（それまでは見ても0が並ぶだけ）
  if (state.company.totalEarned > 0) out.push('company');
  return out;
}

/** 地図の中の切替のうち、いま出すもの */
export function visibleMapSubs(state: GameState, derived: DerivedState): MapSub[] {
  const out: MapSub[] = ['map'];
  if (state.lands.length > 1) out.push('owned');
  // 印を1つでも付けたら「気になる」が出る
  if ((state.bookmarks?.length ?? 0) > 0) out.push('marks');
  if (isEstateSystemUnlocked(state, derived.assets)) out.push('stocks');
  return out;
}
