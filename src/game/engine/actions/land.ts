import { CONFIG } from '@/game/data/config';
import { LAND_MAP, isLandDefId, type LandDefId } from '@/game/data/lands';
import type { ResourceId } from '@/game/data/resources';
import { nextSurveyStage } from '@/game/data/survey';
import type { LandState } from '@/types/state';
import type { EngineContext } from '../context';
import { getLand } from '../land';
import { isUnlocked } from '../systems/unlocks';

/** 土地を購入する。購入時に鉱脈の量が決まる */
export function buyLand(ctx: EngineContext, id: LandDefId): boolean {
  const { state, rng } = ctx;
  if (!isLandDefId(id)) return false;
  if (getLand(state, id)) return false;
  if (!isUnlocked(state, 'land', id)) return false;
  const def = LAND_MAP[id];
  if (state.company.cash + 1e-9 < def.price) return false;
  state.company.cash -= def.price;
  state.company.totalSpent += def.price;
  state.company.landInvestment += def.price;
  const deposits: LandState['deposits'] = {};
  for (const [rid, base] of Object.entries(def.deposits) as [ResourceId, number][]) {
    const v = CONFIG.depositVariance;
    const total = Math.round(base * (1 - v + rng() * 2 * v));
    deposits[rid] = { total, remaining: total };
  }
  state.lands.push({
    id: def.id,
    name: def.name,
    country: def.country,
    region: def.region,
    terrain: def.terrain,
    purchasedAt: ctx.now(),
    survey: 0,
    surveyProgress: null,
    deposits,
    stock: {},
  });
  ctx.emit('success', `${def.name}を購入しました (-${def.price.toLocaleString('ja-JP')}円)`, { toast: true });
  return true;
}

export function surveyCost(landId: string, level: number, costMult: number): number {
  if (!isLandDefId(landId)) return 0;
  const stage = nextSurveyStage(level as 0 | 1 | 2 | 3 | 4);
  if (!stage) return 0;
  return Math.ceil(LAND_MAP[landId].price * stage.costRatio * costMult);
}

/** 次の段階の調査を始める */
export function startSurvey(ctx: EngineContext, landId: string): boolean {
  const { state, derived } = ctx;
  const land = getLand(state, landId);
  if (!land || land.id === 'hq' || land.surveyProgress) return false;
  const stage = nextSurveyStage(land.survey);
  if (!stage) return false;
  const cost = surveyCost(landId, land.survey, derived.modifiers.surveyCost);
  if (state.company.cash + 1e-9 < cost) return false;
  state.company.cash -= cost;
  state.company.totalSpent += cost;
  const total = Math.max(1, Math.round(stage.duration * derived.modifiers.surveyTime));
  land.surveyProgress = { targetLevel: stage.level, remaining: total, total };
  ctx.emit('info', `${land.name}で${stage.name}を開始 (-${cost.toLocaleString('ja-JP')}円)`);
  return true;
}
