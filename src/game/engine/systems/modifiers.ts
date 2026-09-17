import { FACILITY_CATEGORIES } from '@/game/data/facilities';
import { RESEARCH, type ResearchDef } from '@/game/data/research';
import type { GameState, Modifiers } from '@/types/state';

export function createBaseModifiers(): Modifiers {
  const production: Record<string, number> = {};
  for (const c of FACILITY_CATEGORIES) production[c] = 1;
  return {
    production,
    powerGeneration: 1,
    renewableGeneration: 1,
    transportCapacity: 1,
    transportCost: 1,
    surveyCost: 1,
    surveyTime: 1,
    storage: 1,
    commercialIncome: 1,
  };
}

/** 完了した研究から係数をまとめて計算する */
export function computeModifiers(state: GameState): Modifiers {
  const m = createBaseModifiers();
  for (const r of RESEARCH as readonly ResearchDef[]) {
    if (!state.research.completed[r.id]) continue;
    for (const e of r.effects) {
      switch (e.type) {
        case 'production':
          if (e.category === 'all') for (const c of Object.keys(m.production)) m.production[c] *= e.mult;
          else m.production[e.category] = (m.production[e.category] ?? 1) * e.mult;
          break;
        case 'powerGeneration':
          m.powerGeneration *= e.mult;
          break;
        case 'renewableGeneration':
          m.renewableGeneration *= e.mult;
          break;
        case 'transportCapacity':
          m.transportCapacity *= e.mult;
          break;
        case 'transportCost':
          m.transportCost *= e.mult;
          break;
        case 'survey':
          m.surveyCost *= e.costMult;
          m.surveyTime *= e.timeMult;
          break;
        case 'storage':
          m.storage *= e.mult;
          break;
        case 'commercialIncome':
          m.commercialIncome *= e.mult;
          break;
        default:
          break;
      }
    }
  }
  return m;
}
