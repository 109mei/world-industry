import type { SurveyLevel } from '@/types/state';

/** 地下資源調査の段階。土地価格に対する費用比率と所要時間（ゲーム内秒） */
export interface SurveyStageDef {
  /** 完了後の段階 */
  level: SurveyLevel;
  name: string;
  actionLabel: string;
  /** 土地価格に対する費用の割合 */
  costRatio: number;
  /** 所要時間（秒） */
  duration: number;
  description: string;
}

export const SURVEY_STAGES: SurveyStageDef[] = [
  { level: 1, name: '簡易調査', actionLabel: '簡易調査を行う', costRatio: 0.03, duration: 60, description: 'どの資源が埋まっているかが分かる。' },
  { level: 2, name: '地質調査', actionLabel: '地質調査を行う', costRatio: 0.08, duration: 180, description: 'おおよその埋蔵量が分かり、鉱山を建てられるようになる。' },
  { level: 3, name: '試掘', actionLabel: '試掘を行う', costRatio: 0.15, duration: 300, description: '正確な埋蔵量が分かり、この土地の採掘効率が +20% される。' },
];

export const SURVEY_LEVEL_LABEL: Record<SurveyLevel, string> = {
  0: '未調査',
  1: '簡易調査済み',
  2: '地質調査済み',
  3: '試掘済み',
  4: '確定',
};

/** 試掘済み以上の土地の採掘ボーナス */
export const SURVEY_EXTRACT_BONUS = 0.2;

/** 鉱山を建てられる最低の調査段階 */
export const SURVEY_LEVEL_TO_BUILD: SurveyLevel = 2;

export function nextSurveyStage(level: SurveyLevel): SurveyStageDef | null {
  return SURVEY_STAGES.find((s) => s.level === level + 1) ?? null;
}
