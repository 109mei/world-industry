/**
 * プレイヤーの行動が業種の株価に与える影響。
 *
 * - 自分がたくさん作る資源を売っている業種は、競合が増えて株価が下がる
 * - その資源を材料に使う業種は、安く手に入るので上がる
 * - 契約して納品している会社は、仕入れが安定して上がる
 * - 不動産をたくさん持つと、不動産業は物件を取られて下がる
 * 影響はゆっくり効き、±30% を超えない。
 */
import { SECTOR_NEEDS } from '@/game/data/clients';
import { COMPANIES, COMPANY_MAP, isCompanyId, type CompanyDef, type Sector } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { COMPETITION_SCALE, DEFAULT_SCALE, SECTOR_PRODUCES } from '@/game/data/sectorBusiness';
import type { ResourceId } from '@/game/data/resources';
import type { DerivedState, GameState } from '@/types/state';

/** 1時間あたりの効き方（大きいほど急に効く） */
const RATE_PER_HOUR = 0.25;
/** 影響の上限・下限 */
const MAX_INFLUENCE = 0.3;

export interface InfluenceReason {
  label: string;
  value: number;
}

/** その会社へのプレイヤーの影響（-0.3〜0.3）と理由 */
export function influenceOn(state: GameState, derived: DerivedState, def: CompanyDef): { total: number; reasons: InfluenceReason[] } {
  const reasons: InfluenceReason[] = [];
  let total = 0;

  // 競合: その業種が売っているものを自分も作っている
  let competition = 0;
  for (const r of SECTOR_PRODUCES[def.sector] ?? []) {
    const rate = derived.production[r as ResourceId] ?? 0;
    if (rate <= 0) continue;
    const scale = COMPETITION_SCALE[r as ResourceId] ?? DEFAULT_SCALE;
    competition += Math.min(1, rate / scale);
  }
  if (competition > 0) {
    const v = -Math.min(0.22, competition * 0.12);
    reasons.push({ label: '同じものを作っている（競合）', value: v });
    total += v;
  }

  // 追い風: その業種が使う材料を自分が大量に作っている（安く手に入る）
  let supply = 0;
  for (const r of SECTOR_NEEDS[def.sector] ?? []) {
    const rate = derived.production[r as ResourceId] ?? 0;
    if (rate <= 0) continue;
    const scale = COMPETITION_SCALE[r as ResourceId] ?? DEFAULT_SCALE;
    supply += Math.min(1, rate / scale);
  }
  if (supply > 0) {
    const v = Math.min(0.15, supply * 0.06);
    reasons.push({ label: '材料を供給している', value: v });
    total += v;
  }

  // 取引: 契約して納品している
  const deals = (state.sales?.deals ?? []).filter((d) => d.companyId === def.id).length;
  const relation = state.sales?.clients[def.id]?.relation ?? 0;
  if (deals > 0 || relation > 0) {
    const v = Math.min(0.12, deals * 0.04 + relation / 1200);
    reasons.push({ label: '取引がある', value: v });
    total += v;
  }

  // 不動産: 自分が土地・建物をたくさん持つと不動産業は苦しい
  if (def.sector === 'realestate') {
    const mine = Object.keys(state.estate.owned).length + Object.keys(state.estate.custom ?? {}).length;
    if (mine > 0) {
      const v = -Math.min(0.2, mine * 0.012);
      reasons.push({ label: '物件を買い集めている', value: v });
      total += v;
    }
  }

  // 物流: 自分で運ぶほど運輸・海運・航空の仕事が減る
  if (def.sector === 'logistics' || def.sector === 'shipping' || def.sector === 'airline') {
    const carriers = state.facilities.filter((f) => f.count > 0 && ['truck', 'freight_train', 'cargo_ship', 'pipeline', 'cargo_plane'].includes(f.typeId)).reduce((a, f) => a + f.count, 0);
    if (carriers > 0) {
      const v = -Math.min(0.18, carriers * 0.01);
      reasons.push({ label: '自前で輸送している', value: v });
      total += v;
    }
  }

  return { total: Math.max(-MAX_INFLUENCE, Math.min(MAX_INFLUENCE, total)), reasons };
}

/** 毎 tick: 影響のぶんだけ需給（sentiment）を動かす */
export function runInfluence(ctx: { state: GameState; derived: DerivedState }, dt: number): void {
  const { state, derived } = ctx;
  const dtH = dt / 3600;
  for (const def of COMPANIES as readonly CompanyDef[]) {
    const s = state.stocks.companies[def.id];
    if (!s || s.dissolved) continue;
    const { total } = influenceOn(state, derived, def);
    if (total === 0) continue;
    // 目標に向かってゆっくり動かす（行き過ぎない）
    const target = 1 + total;
    const k = Math.min(1, RATE_PER_HOUR * dtH * 60);
    s.sentiment = Math.min(CONFIG.stocks.maxSentiment, Math.max(CONFIG.stocks.minSentiment, s.sentiment + (target - s.sentiment) * k));
  }
}

/** 表示用 */
export function influenceLabel(id: string, state: GameState, derived: DerivedState): { total: number; reasons: InfluenceReason[] } | null {
  if (!isCompanyId(id)) return null;
  return influenceOn(state, derived, COMPANY_MAP[id]);
}

export type { Sector };
