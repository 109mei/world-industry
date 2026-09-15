import { FACILITIES } from '@/game/data/facilities';
import { GATHER_ACTIONS } from '@/game/data/gathering';
import { RECIPES } from '@/game/data/recipes';
import type { UnlockCondition } from '@/game/data/unlockTypes';
import type { GameState } from '@/types/state';
import type { EngineContext } from '../context';

export function evaluateCondition(cond: UnlockCondition, state: GameState, assets: number): boolean {
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
      return assets >= cond.min;
    case 'crafted':
      return (state.stats.crafted[cond.recipe] ?? 0) >= cond.min;
    case 'toolCrafted':
      return (state.stats.toolsCrafted[cond.tool] ?? 0) >= 1;
    case 'facility':
      return state.facilities.filter((f) => f.typeId === cond.facility).reduce((a, f) => a + f.count, 0) >= cond.min;
    case 'tutorialStep':
      return state.tutorial.step >= cond.min || state.tutorial.completed;
    case 'all':
      return cond.conditions.every((c) => evaluateCondition(c, state, assets));
    case 'any':
      return cond.conditions.some((c) => evaluateCondition(c, state, assets));
    default:
      return false;
  }
}

/** 条件を人が読める文にする（ロック表示用） */
export function describeCondition(cond: UnlockCondition, names: { resource: (id: string) => string; tool: (id: string) => string; recipe: (id: string) => string; facility: (id: string) => string }): string {
  switch (cond.type) {
    case 'always':
      return '';
    case 'obtained':
      return `${names.resource(cond.resource)}を累計${cond.min}個入手`;
    case 'sold':
      return `${names.resource(cond.resource)}を累計${cond.min}個売却`;
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
    case 'all':
      return cond.conditions.map((c) => describeCondition(c, names)).filter(Boolean).join(' ＋ ');
    case 'any':
      return cond.conditions.map((c) => describeCondition(c, names)).filter(Boolean).join(' または ');
    default:
      return '';
  }
}

export function unlockKey(kind: 'facility' | 'recipe' | 'gather', id: string): string {
  return `${kind}:${id}`;
}

export function isUnlocked(state: GameState, kind: 'facility' | 'recipe' | 'gather', id: string): boolean {
  return state.unlocked[unlockKey(kind, id)] === true;
}

/** まだ解放されていないものの条件を確認し、満たしていれば解放してイベントを出す */
export function runUnlocks(ctx: EngineContext): void {
  const { state, derived } = ctx;
  for (const f of FACILITIES) {
    const key = unlockKey('facility', f.id);
    if (state.unlocked[key]) continue;
    if (evaluateCondition(f.unlock, state, derived.assets)) {
      state.unlocked[key] = true;
      if (f.unlock.type !== 'always') ctx.emit('unlock', `新しい施設が解放: ${f.name}`, { toast: true });
    }
  }
  for (const r of RECIPES) {
    const key = unlockKey('recipe', r.id);
    if (state.unlocked[key]) continue;
    if (evaluateCondition(r.unlock, state, derived.assets)) {
      state.unlocked[key] = true;
      if (r.unlock.type !== 'always') ctx.emit('unlock', `新しいレシピが解放: ${r.name}`, { toast: true });
    }
  }
  for (const g of GATHER_ACTIONS) {
    const key = unlockKey('gather', g.id);
    if (state.unlocked[key]) continue;
    if (evaluateCondition(g.unlock, state, derived.assets)) {
      state.unlocked[key] = true;
      if (g.unlock.type !== 'always') ctx.emit('unlock', `新しい採集が解放: ${g.label}`, { toast: true });
    }
  }
}

/** 条件の進捗（単純な条件のみ）。UI の「次の目標」表示用 */
export function conditionProgress(cond: UnlockCondition, state: GameState, assets: number): { current: number; target: number } | null {
  switch (cond.type) {
    case 'obtained':
      return { current: Math.min(cond.min, state.stats.totalObtained[cond.resource] ?? 0), target: cond.min };
    case 'sold':
      return { current: Math.min(cond.min, state.stats.totalSold[cond.resource] ?? 0), target: cond.min };
    case 'cash':
      return { current: Math.min(cond.min, state.company.cash), target: cond.min };
    case 'assets':
      return { current: Math.min(cond.min, assets), target: cond.min };
    case 'crafted':
      return { current: Math.min(cond.min, state.stats.crafted[cond.recipe] ?? 0), target: cond.min };
    case 'toolCrafted':
      return { current: Math.min(1, state.stats.toolsCrafted[cond.tool] ?? 0), target: 1 };
    case 'facility':
      return { current: Math.min(cond.min, state.facilities.filter((f) => f.typeId === cond.facility).reduce((a, f) => a + f.count, 0)), target: cond.min };
    default:
      return null;
  }
}
