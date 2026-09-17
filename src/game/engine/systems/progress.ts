import { ACHIEVEMENTS } from '@/game/data/achievements';
import { TUTORIAL_STEPS } from '@/game/data/tutorial';
import type { EngineContext } from '../context';

export function runTutorial(ctx: EngineContext): void {
  const { state } = ctx;
  if (state.tutorial.completed) return;
  // 1 tick で複数ステップ進むこともある
  let guard = 0;
  while (!state.tutorial.completed && guard++ < 10) {
    const step = TUTORIAL_STEPS[state.tutorial.step];
    if (!step) {
      state.tutorial.completed = true;
      ctx.emit('tutorial', 'チュートリアル完了！ここからは自由に会社を育てよう。', { toast: true });
      break;
    }
    if (!step.check(state)) break;
    state.tutorial.step += 1;
    if (state.tutorial.step >= TUTORIAL_STEPS.length) {
      state.tutorial.completed = true;
      ctx.emit('tutorial', 'チュートリアル完了！ここからは自由に会社を育てよう。', { toast: true });
    } else {
      ctx.emit('tutorial', `完了: ${step.title}`, { toast: true });
    }
  }
}

export function runAchievements(ctx: EngineContext): void {
  const { state, derived, now } = ctx;
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    if (a.check(state, derived)) {
      state.achievements[a.id] = now();
      ctx.emit('achievement', `実績解除: ${a.name}`, { toast: true, achievementId: a.id });
    }
  }
}
