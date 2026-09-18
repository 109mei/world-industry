import { FACILITY_CATEGORIES } from '@/game/data/facilities';
import { SKILL_MAP, type SkillId } from '@/game/data/minigames';
import { RESEARCH, type ResearchDef } from '@/game/data/research';
import type { GameState, Modifiers } from '@/types/state';
import { applySynergies } from './synergy';

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
    demandRecovery: 1,
    researchRate: 1,
    gatherAmount: 1,
    craftYield: 1,
    sellPrice: 1,
    depositAmount: 1,
    pitchChance: 0,
    dealPrice: 1,
    relationGain: 1,
    offlineBonusSec: 0,
    wage: 1,
    devSpeed: 1,
    productRevenue: 1,
    shopSales: 1,
    adCost: 1,
    awarenessGain: 1,
    brandGain: 1,
    buildCost: 1,
    rentIncome: 1,
    interestRate: 1,
    tradeFee: 1,
    eventDamage: 1,
    casinoEdge: 1,
    projectCost: 1,
  };
}

/** 永続アップグレードの効果をまとめる */
export function applyPrestigeUpgrades(state: GameState, m: Modifiers): void {
  const up = state.prestige?.upgrades ?? {};
  const lv = (id: string) => Math.max(0, up[id] ?? 0);
  const prod = 1 + 0.06 * lv('production');
  for (const c of Object.keys(m.production)) m.production[c] *= prod;
  m.gatherAmount *= 1 + 0.12 * lv('gather');
  m.craftYield *= 1 + 0.1 * lv('craft');
  m.researchRate *= 1 + 0.1 * lv('research');
  m.sellPrice *= 1 + 0.03 * lv('sell_price');
  m.surveyCost *= Math.pow(0.92, lv('survey'));
  m.surveyTime *= Math.pow(0.95, lv('survey'));
  m.transportCost *= Math.pow(0.92, lv('transport'));
  m.transportCapacity *= 1 + 0.06 * lv('transport');
  m.depositAmount *= 1 + 0.15 * lv('deposit');
  m.pitchChance += 0.08 * lv('sales');
  m.dealPrice *= 1 + 0.03 * lv('sales');
  m.relationGain *= 1 + 0.25 * lv('relation');
  m.powerGeneration *= 1 + 0.1 * lv('power');
  m.storage *= 1 + 0.15 * lv('storage');
  m.offlineBonusSec += 7200 * lv('offline');
}

/**
 * 手仕事の腕（ミニゲームで伸びる熟練度）の効果をまとめる。
 *
 * 腕ごとに効き先を変えてあるので、4つとも別の意味がある。
 * ここが重なっていると「どれか1つを鍛えれば済む」になってしまう。
 */
export function applySkills(state: GameState, m: Modifiers): void {
  const lv = (id: SkillId) => Math.min(SKILL_MAP[id].maxLevel, Math.max(0, state.skills?.[id]?.level ?? 0));
  // 選別の腕: 混ざりものを外してから溶かすので、加工の取り分が増える
  m.production.PROCESSING = (m.production.PROCESSING ?? 1) * (1 + SKILL_MAP.sorting.perLevel * lv('sorting'));
  // 栽培の腕: 畑・林・鉱山など「採ってくる」施設に効く
  m.production.RESOURCE = (m.production.RESOURCE ?? 1) * (1 + SKILL_MAP.growing.perLevel * lv('growing'));
  // 採掘の腕: 岩の目を読めると、同じ鉱区から多く掘れる。調査も手際よくなる
  m.depositAmount *= 1 + SKILL_MAP.mining.perLevel * lv('mining');
  m.surveyCost *= Math.max(0.5, 1 - 0.01 * lv('mining'));
  // 手際: 手で集める量と、手作りの歩留まり
  m.gatherAmount *= 1 + SKILL_MAP.handling.perLevel * lv('handling');
  m.craftYield *= 1 + 0.02 * lv('handling');
}

/** 完了した研究と再出発ボーナスから係数をまとめて計算する */
export function computeModifiers(state: GameState): Modifiers {
  const m = createBaseModifiers();
  applyPrestigeUpgrades(state, m);
  applySkills(state, m);
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
        case 'demandRecovery':
          m.demandRecovery *= e.mult;
          break;
        case 'wage':
          m.wage *= e.mult;
          break;
        case 'devSpeed':
          m.devSpeed *= e.mult;
          break;
        case 'productRevenue':
          m.productRevenue *= e.mult;
          break;
        case 'shopSales':
          m.shopSales *= e.mult;
          break;
        case 'adCost':
          m.adCost *= e.mult;
          break;
        case 'awarenessGain':
          m.awarenessGain *= e.mult;
          break;
        case 'brandGain':
          m.brandGain *= e.mult;
          break;
        case 'researchRate':
          m.researchRate *= e.mult;
          break;
        default:
          break;
      }
    }
  }
  // 事業どうしの連携（運送・広告代理・人材など、持っているだけで会社全体に効く）
  applySynergies(state, m);
  return m;
}
