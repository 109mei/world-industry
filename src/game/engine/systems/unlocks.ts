import { CONFIG } from '@/game/data/config';
import { FACILITIES } from '@/game/data/facilities';
import { GATHER_ACTIONS } from '@/game/data/gathering';
import { LANDS } from '@/game/data/lands';
import { RECIPES } from '@/game/data/recipes';
import { RESEARCH_MAP, isResearchId } from '@/game/data/research';
import type { UnlockCondition } from '@/game/data/unlockTypes';
import type { DerivedState, GameState } from '@/types/state';
import type { EngineContext } from '../context';

export interface UnlockEnv {
  assets: number;
  powerCapacity: number;
}

export function envOf(derived: DerivedState): UnlockEnv {
  return { assets: derived.assets, powerCapacity: derived.power.capacity };
}

export function evaluateCondition(cond: UnlockCondition, state: GameState, env: UnlockEnv | number): boolean {
  const e: UnlockEnv = typeof env === 'number' ? { assets: env, powerCapacity: 0 } : env;
  switch (cond.type) {
    case 'always':
      return true;
    case 'obtained':
      return (state.stats.totalObtained[cond.resource] ?? 0) >= cond.min;
    case 'sold':
      return (state.stats.totalSold[cond.resource] ?? 0) >= cond.min;
    case 'cash':
      return state.company.cash >= cond.min;
    case 'assets':
      return e.assets >= cond.min;
    case 'crafted':
      return (state.stats.crafted[cond.recipe] ?? 0) >= cond.min;
    case 'toolCrafted':
      return (state.stats.toolsCrafted[cond.tool] ?? 0) >= 1;
    case 'facility':
      return state.facilities.filter((f) => f.typeId === cond.facility).reduce((a, f) => a + f.count, 0) >= cond.min;
    case 'tutorialStep':
      return state.tutorial.step >= cond.min || state.tutorial.completed;
    case 'research':
      return state.research.completed[cond.research] === true;
    case 'landOwned':
      return state.lands.filter((l) => l.id !== 'hq').length >= cond.min;
    case 'powerCapacity':
      return e.powerCapacity >= cond.min;
    case 'all':
      return cond.conditions.every((c) => evaluateCondition(c, state, e));
    case 'any':
      return cond.conditions.some((c) => evaluateCondition(c, state, e));
    default:
      return false;
  }
}

export interface ConditionNames {
  resource: (id: string) => string;
  tool: (id: string) => string;
  recipe: (id: string) => string;
  facility: (id: string) => string;
}

/** 条件を人が読める文にする（ロック表示用） */
export function describeCondition(cond: UnlockCondition, names: ConditionNames): string {
  switch (cond.type) {
    case 'always':
      return '';
    case 'obtained':
      return `${names.resource(cond.resource)}を累計${cond.min.toLocaleString('ja-JP')}個入手`;
    case 'sold':
      return `${names.resource(cond.resource)}を累計${cond.min.toLocaleString('ja-JP')}個売却`;
    case 'cash':
      return `所持金 ${cond.min.toLocaleString('ja-JP')}円`;
    case 'assets':
      return `総資産 ${cond.min.toLocaleString('ja-JP')}円`;
    case 'crafted':
      return `${names.recipe(cond.recipe)}を${cond.min}回クラフト`;
    case 'toolCrafted':
      return `${names.tool(cond.tool)}を作る`;
    case 'facility':
      return `${names.facility(cond.facility)}を${cond.min}個所有`;
    case 'tutorialStep':
      return `チュートリアルを進める`;
    case 'research':
      return `研究「${isResearchId(cond.research) ? RESEARCH_MAP[cond.research].name : cond.research}」を完了`;
    case 'landOwned':
      return cond.min <= 1 ? '土地を購入する' : `土地を${cond.min}か所所有`;
    case 'powerCapacity':
      return `発電能力 ${cond.min}MW`;
    case 'all':
      return cond.conditions.map((c) => describeCondition(c, names)).filter(Boolean).join(' ＋ ');
    case 'any':
      return cond.conditions.map((c) => describeCondition(c, names)).filter(Boolean).join(' または ');
    default:
      return '';
  }
}

export type UnlockKind = 'facility' | 'recipe' | 'gather' | 'land';

export function unlockKey(kind: UnlockKind, id: string): string {
  return `${kind}:${id}`;
}

export function isUnlocked(state: GameState, kind: UnlockKind, id: string): boolean {
  return state.unlocked[unlockKey(kind, id)] === true;
}

/** まだ解放されていないものの条件を確認し、満たしていれば解放してイベントを出す */
export function runUnlocks(ctx: EngineContext): void {
  const { state, derived } = ctx;
  const env = envOf(derived);
  for (const f of FACILITIES) {
    const key = unlockKey('facility', f.id);
    if (state.unlocked[key]) continue;
    if (evaluateCondition(f.unlock, state, env)) {
      state.unlocked[key] = true;
      if (f.unlock.type !== 'always') ctx.emit('unlock', `新しい施設が解放: ${f.name}`, { toast: true });
    }
  }
  for (const r of RECIPES) {
    const key = unlockKey('recipe', r.id);
    if (state.unlocked[key]) continue;
    if (evaluateCondition(r.unlock, state, env)) {
      state.unlocked[key] = true;
      if (r.unlock.type !== 'always') ctx.emit('unlock', `新しいレシピが解放: ${r.name}`, { toast: true });
    }
  }
  for (const g of GATHER_ACTIONS) {
    const key = unlockKey('gather', g.id);
    if (state.unlocked[key]) continue;
    if (evaluateCondition(g.unlock, state, env)) {
      state.unlocked[key] = true;
      if (g.unlock.type !== 'always') ctx.emit('unlock', `新しい採集が解放: ${g.label}`, { toast: true });
    }
  }
  // 土地は「土地システム解放（総資産）」＋各土地の条件
  if (isLandSystemUnlocked(state, env.assets)) {
    if (!state.unlocked['system:land']) {
      state.unlocked['system:land'] = true;
      ctx.emit('unlock', '土地システムが解放されました。LAND画面から土地を購入できます', { toast: true });
    }
    for (const l of LANDS) {
      const key = unlockKey('land', l.id);
      if (state.unlocked[key]) continue;
      if (evaluateCondition(l.unlock, state, env)) {
        state.unlocked[key] = true;
        ctx.emit('unlock', `購入できる土地が増えました: ${l.name}`, { toast: true });
      }
    }
  }
}

/** 土地システムが使えるか（状態は変えない） */
export function isLandSystemUnlocked(state: GameState, assets: number): boolean {
  return state.unlocked['system:land'] === true || assets >= CONFIG.landUnlockAssets || state.lands.length > 1;
}

/** 条件の進捗（単純な条件のみ）。UI の「次の目標」表示用 */
export function conditionProgress(cond: UnlockCondition, state: GameState, env: UnlockEnv | number): { current: number; target: number } | null {
  const e: UnlockEnv = typeof env === 'number' ? { assets: env, powerCapacity: 0 } : env;
  switch (cond.type) {
    case 'obtained':
      return { current: Math.min(cond.min, state.stats.totalObtained[cond.resource] ?? 0), target: cond.min };
    case 'sold':
      return { current: Math.min(cond.min, state.stats.totalSold[cond.resource] ?? 0), target: cond.min };
    case 'cash':
      return { current: Math.min(cond.min, state.company.cash), target: cond.min };
    case 'assets':
      return { current: Math.min(cond.min, e.assets), target: cond.min };
    case 'crafted':
      return { current: Math.min(cond.min, state.stats.crafted[cond.recipe] ?? 0), target: cond.min };
    case 'toolCrafted':
      return { current: Math.min(1, state.stats.toolsCrafted[cond.tool] ?? 0), target: 1 };
    case 'facility':
      return { current: Math.min(cond.min, state.facilities.filter((f) => f.typeId === cond.facility).reduce((a, f) => a + f.count, 0)), target: cond.min };
    case 'landOwned':
      return { current: Math.min(cond.min, state.lands.length - 1), target: cond.min };
    case 'powerCapacity':
      return { current: Math.min(cond.min, e.powerCapacity), target: cond.min };
    case 'research':
      return { current: state.research.completed[cond.research] ? 1 : 0, target: 1 };
    case 'all': {
      // 最初の未達成条件の進捗
      for (const c of cond.conditions) {
        if (!evaluateCondition(c, state, e)) return conditionProgress(c, state, e);
      }
      return null;
    }
    default:
      return null;
  }
}
