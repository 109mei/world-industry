/**
 * 事業どうしの連携を数字にする。
 *
 * 「運送会社を持っていると自社の輸送費が下がる」といった効果を、
 * 事業の規模（人数・知名度・ブランド）から計算して会社全体の係数に混ぜる。
 */
import { BUSINESS_MAP, type BusinessKindId } from '@/game/data/business';
import { SYNERGIES, SYNERGY_BY_KIND, SYNERGY_KEYS, type SynergyKey } from '@/game/data/synergies';
import type { Division, GameState, Modifiers } from '@/types/state';

/** 費用を下げる効果は、ここより下には行かない */
const COST_FLOOR = 0.2;
/** 増やす効果は、ここより上には行かない */
const GAIN_CAP = 4;

/**
 * 事業ひとつの「効きの強さ」0〜1。
 * 人数が主で、知名度とブランドが足しになる。
 * 開いたばかりでも少しは効くように、人数は平方根で効かせている。
 */
export function divisionStrength(div: Division): number {
  const def = BUSINESS_MAP[div.kind];
  if (!def) return 0;
  const staff = Math.max(0, div.staff ?? 0);
  const maxStaff = Math.max(1, def.maxStaff);
  const size = Math.min(1, Math.sqrt(staff / maxStaff));
  const fame = Math.min(1, ((div.awareness ?? 0) + (div.brand ?? 0)) / 200);
  return Math.min(1, size * 0.65 + fame * 0.35);
}

/**
 * 業種ごとの合計の強さ 0〜1。
 * 同じ業種をいくつも持つと重なるが、だんだん効きにくくなる。
 */
export function kindStrengths(state: GameState): Map<BusinessKindId, number> {
  const out = new Map<BusinessKindId, number>();
  for (const div of state.business?.divisions ?? []) {
    if (!BUSINESS_MAP[div.kind]) continue;
    const s = divisionStrength(div);
    if (s <= 0) continue;
    const prev = out.get(div.kind) ?? 0;
    // 1 - (1-a)(1-b)：重ねるほど 1 に近づくが超えない
    out.set(div.kind, 1 - (1 - prev) * (1 - s));
  }
  return out;
}

export interface SynergyLine {
  key: SynergyKey;
  label: string;
  lowerIsBetter: boolean;
  /** 効いている倍率（0.7 なら 3割引き、1.25 なら 25%増し） */
  mult: number;
  /** どの業種がどれだけ効かせているか */
  from: { kind: BusinessKindId; name: string; amount: number }[];
}

/** 会社全体に効いている連携の一覧（画面用） */
export function synergyReport(state: GameState): SynergyLine[] {
  const strengths = kindStrengths(state);
  const lines = new Map<SynergyKey, SynergyLine>();
  for (const def of SYNERGIES) {
    const s = strengths.get(def.from) ?? 0;
    if (s <= 0) continue;
    for (const e of def.effects) {
      const amount = e.max * s;
      if (amount <= 0.0005) continue;
      const meta = SYNERGY_KEYS[e.key];
      let line = lines.get(e.key);
      if (!line) {
        line = { key: e.key, label: meta.label, lowerIsBetter: meta.lowerIsBetter, mult: 1, from: [] };
        lines.set(e.key, line);
      }
      line.mult *= meta.lowerIsBetter ? 1 - amount : 1 + amount;
      line.from.push({ kind: def.from, name: BUSINESS_MAP[def.from]?.name ?? def.from, amount });
    }
  }
  for (const line of lines.values()) {
    line.mult = line.lowerIsBetter ? Math.max(COST_FLOOR, line.mult) : Math.min(GAIN_CAP, line.mult);
    line.from.sort((a, b) => b.amount - a.amount);
  }
  return [...lines.values()].sort((a, b) => Math.abs(b.mult - 1) - Math.abs(a.mult - 1));
}

/** 事業ひとつが会社全体に効かせている内容（画面用） */
export function divisionSynergy(div: Division): { note: string; lines: { label: string; text: string }[] } | null {
  const def = SYNERGY_BY_KIND.get(div.kind);
  if (!def) return null;
  const s = divisionStrength(div);
  const lines = def.effects.map((e) => {
    const meta = SYNERGY_KEYS[e.key];
    const pct = Math.round(e.max * s * 1000) / 10;
    return { label: meta.label, text: `${meta.lowerIsBetter ? '−' : '+'}${pct}%` };
  });
  return { note: def.note, lines };
}

/** 連携の倍率をまとめて引く */
export function synergyMults(state: GameState): Record<SynergyKey, number> {
  const out = {} as Record<SynergyKey, number>;
  for (const k of Object.keys(SYNERGY_KEYS) as SynergyKey[]) out[k] = 1;
  for (const line of synergyReport(state)) out[line.key] = line.mult;
  return out;
}

/** 会社全体の係数に連携を混ぜる */
export function applySynergies(state: GameState, m: Modifiers): void {
  const s = synergyMults(state);
  m.transportCost *= s.transportCost;
  m.transportCapacity *= s.transportCapacity;
  m.adCost *= s.adCost;
  m.awarenessGain *= s.awarenessGain;
  m.brandGain *= s.brandGain;
  m.wage *= s.wage;
  m.devSpeed *= s.devSpeed;
  m.productRevenue *= s.productRevenue;
  m.shopSales *= s.shopSales;
  m.sellPrice *= s.sellPrice;
  m.researchRate *= s.researchRate;
  m.surveyCost *= s.surveyCost;
  m.depositAmount *= s.depositAmount;
  m.buildCost *= s.buildCost;
  m.rentIncome *= s.rentIncome;
  m.interestRate *= s.interestRate;
  m.tradeFee *= s.tradeFee;
  m.eventDamage *= s.eventDamage;
  m.casinoEdge *= s.casinoEdge;
  m.projectCost *= s.projectCost;
}

// ---------- 個別に引きたいところ用（tick の外からも使う） ----------

function one(state: GameState, key: SynergyKey): number {
  const strengths = kindStrengths(state);
  let mult = 1;
  const meta = SYNERGY_KEYS[key];
  for (const def of SYNERGIES) {
    const s = strengths.get(def.from) ?? 0;
    if (s <= 0) continue;
    for (const e of def.effects) {
      if (e.key !== key) continue;
      mult *= meta.lowerIsBetter ? 1 - e.max * s : 1 + e.max * s;
    }
  }
  return meta.lowerIsBetter ? Math.max(COST_FLOOR, mult) : Math.min(GAIN_CAP, mult);
}

/** 施設の建設費の倍率（建設会社を持っていると安くなる） */
export function buildCostMult(state: GameState): number {
  return one(state, 'buildCost');
}

/** 売買の手数料の倍率（銀行・証券・不動産を持っていると安くなる） */
export function tradeFeeMult(state: GameState): number {
  return one(state, 'tradeFee');
}

/** 借金の利息の倍率（銀行を持っていると安くなる） */
export function interestMult(state: GameState): number {
  return one(state, 'interestRate');
}

/** 災害・事故の損害の倍率（保険・警備を持っていると小さくなる） */
export function eventDamageMult(state: GameState): number {
  return one(state, 'eventDamage');
}

/** 自社物件の賃料の倍率（不動産を持っていると増える） */
export function rentMult(state: GameState): number {
  return one(state, 'rentIncome');
}

/** カジノの取り分の倍率（警備を持っていると増える） */
export function casinoEdgeMult(state: GameState): number {
  return one(state, 'casinoEdge');
}

/** 案件の着手金の倍率（自社で部品を作れると安くなる） */
export function projectCostMult(state: GameState): number {
  return one(state, 'projectCost');
}
