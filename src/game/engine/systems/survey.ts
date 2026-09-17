import { SURVEY_LEVEL_LABEL } from '@/game/data/survey';
import type { EngineContext } from '../context';
import { ownedLands } from '../land';

/** 進行中の調査を進める */
export function runSurveys(ctx: EngineContext, dt: number): void {
  for (const land of ownedLands(ctx.state)) {
    const p = land.surveyProgress;
    if (!p) continue;
    p.remaining -= dt;
    if (p.remaining <= 1e-9) {
      land.survey = p.targetLevel;
      land.surveyProgress = null;
      ctx.emit('success', `${land.name}の${SURVEY_LEVEL_LABEL[p.targetLevel].replace('済み', '')}が完了しました`, { toast: true });
    }
  }
}
