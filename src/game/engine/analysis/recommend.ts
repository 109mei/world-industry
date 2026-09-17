import { FACILITY_MAP, isFacilityId, type FacilityId } from '@/game/data/facilities';
import { LANDS, type LandDef } from '@/game/data/lands';
import { RESEARCH, type ResearchDef } from '@/game/data/research';
import { RESOURCE_MAP } from '@/game/data/resources';
import type { DerivedState, GameState } from '@/types/state';
import { getLand } from '../land';
import { isLandSystemUnlocked, isUnlocked } from '../systems/unlocks';
import type { FixAction } from './diagnose';
import { rankInvestments, type InvestmentOption } from './roi';

export interface Recommendation {
  id: string;
  icon: string;
  title: string;
  reason: string;
  /** 費用（円）。不明なら undefined */
  cost?: number;
  /** 回収の目安（秒） */
  paybackSeconds?: number;
  action: FixAction | { kind: 'research'; researchId: string } | { kind: 'buyLand'; landId: string };
  enabled: boolean;
}

/** 回収が最も早く、建てれば動く見込みのある投資 */
export function bestInvestment(state: GameState, derived: DerivedState, maxPaybackSeconds = Infinity, maxCash = state.company.cash, realizedOnly = false): InvestmentOption | null {
  const ranked = rankInvestments(state, derived, { affordableOnly: true, maxCash, realizedOnly });
  for (const r of ranked) {
    if (!r.feasible) continue;
    if (r.paybackSeconds > maxPaybackSeconds) continue;
    return r;
  }
  return null;
}

/**
 * 「おすすめの次の一手」。困りごと（電力・倉庫・輸送）を先に、なければ回収の早い投資と研究を出す
 */
export function recommend(state: GameState, derived: DerivedState, limit = 3): Recommendation[] {
  const out: Recommendation[] = [];
  const cash = state.company.cash;
  const push = (r: Recommendation) => {
    if (out.length < limit && !out.some((x) => x.id === r.id)) out.push(r);
  };
  const ranked = rankInvestments(state, derived, { affordableOnly: false });
  const byType = (pred: (o: InvestmentOption) => boolean) => ranked.filter((o) => pred(o) && o.valuePerSec > 0).sort((a, b) => a.paybackSeconds - b.paybackSeconds)[0];
  const landName = (id: string) => (id === 'hq' ? '本社' : getLand(state, id)?.name ?? id);

  // 1. 電力不足
  if (derived.power.demand > 0 && derived.power.ratio < 0.95) {
    const o = byType((x) => !!FACILITY_MAP[x.typeId].powerGen);
    if (o) {
      const def = FACILITY_MAP[o.typeId];
      push({ id: `power:${o.typeId}:${o.landId}`, icon: def.icon, title: `${landName(o.landId)}に${def.name}を建てる`, reason: `電力の供給率が ${(derived.power.ratio * 100).toFixed(0)}% で工場が減速しています`, cost: o.cost, paybackSeconds: o.paybackSeconds, action: { kind: 'buyFacility', typeId: o.typeId, landId: o.landId, cost: o.cost }, enabled: cash >= o.cost });
    }
  }
  // 2. 倉庫満杯
  const full = Object.entries(derived.facilityRuntime).filter(([, r]) => r.status === 'storage_full');
  if (full.length > 0) {
    const inst = state.facilities.find((f) => f.id === full[0][0]);
    const o = byType((x) => !!FACILITY_MAP[x.typeId].storageBonus && (!inst || x.landId === inst.landId));
    const blocked = full[0][1].blockedOutputs[0];
    if (o) {
      const def = FACILITY_MAP[o.typeId];
      push({ id: `storage:${o.typeId}:${o.landId}`, icon: def.icon, title: `${landName(o.landId)}に${def.name}を建てる`, reason: `${blocked ? RESOURCE_MAP[blocked].name + 'の' : ''}倉庫が満杯で生産が止まっています${blocked && RESOURCE_MAP[blocked].sellable ? '（売るか自動売却でも解決）' : ''}`, cost: o.cost, paybackSeconds: o.paybackSeconds, action: { kind: 'buyFacility', typeId: o.typeId, landId: o.landId, cost: o.cost }, enabled: cash >= o.cost });
    } else if (blocked && RESOURCE_MAP[blocked].sellable) {
      push({ id: `sell:${blocked}`, icon: RESOURCE_MAP[blocked].icon, title: `${RESOURCE_MAP[blocked].name}を売る／自動売却を設定`, reason: '倉庫が満杯で生産が止まっています', action: { kind: 'openResource', resource: blocked }, enabled: true });
    }
  }
  // 3. 輸送手段がない土地
  for (const [landId, rt] of Object.entries(derived.lands)) {
    if (!rt.noRoute) continue;
    const o = byType((x) => !!FACILITY_MAP[x.typeId].transport && x.landId === landId);
    if (o) {
      const def = FACILITY_MAP[o.typeId];
      push({ id: `route:${landId}`, icon: def.icon, title: `${landName(landId)}に${def.name}を配備`, reason: '輸送手段がなく、資源が本社に届いていません', cost: o.cost, paybackSeconds: o.paybackSeconds, action: { kind: 'buyFacility', typeId: o.typeId, landId, cost: o.cost }, enabled: cash >= o.cost });
    }
    break;
  }
  // 4. 回収の早い投資（動く見込みのあるもの）
  const best = ranked.filter((o) => o.feasible && o.valuePerSec > 0 && !FACILITY_MAP[o.typeId].powerGen && !FACILITY_MAP[o.typeId].storageBonus && !FACILITY_MAP[o.typeId].transport).slice(0, 2);
  for (const o of best) {
    const def = FACILITY_MAP[o.typeId];
    push({ id: `invest:${o.typeId}:${o.landId}`, icon: def.icon, title: `${landName(o.landId)}に${def.name}${def.isWorker ? 'を雇う' : 'を建てる'}`, reason: `回収まで約${formatSeconds(o.paybackSeconds)}（+${formatYenPerSec(o.valuePerSec)}円/秒の見込み）`, cost: o.cost, paybackSeconds: o.paybackSeconds, action: { kind: 'buyFacility', typeId: o.typeId, landId: o.landId, cost: o.cost }, enabled: cash >= o.cost });
  }
  // 5. 研究
  const research = (RESEARCH as readonly ResearchDef[]).filter((r) => !state.research.completed[r.id] && r.requires.every((q) => state.research.completed[q])).sort((a, b) => a.cost - b.cost)[0];
  if (research) {
    const ok = state.research.points >= research.cost;
    push({ id: `research:${research.id}`, icon: research.icon, title: `研究「${research.name}」`, reason: ok ? research.description : `あと ${Math.ceil(research.cost - state.research.points)} RP（${research.description}）`, action: { kind: 'research', researchId: research.id }, enabled: ok });
  }
  // 6. 土地（まだ持っていない）
  if (isLandSystemUnlocked(state, derived.assets) && state.lands.length === 1) {
    const land = (LANDS as readonly LandDef[]).filter((l) => isUnlocked(state, 'land', l.id)).sort((a, b) => a.price - b.price)[0];
    if (land) push({ id: `land:${land.id}`, icon: 'icon_ui_land', title: `${land.name}を購入`, reason: '最初の土地。採石場・農園・鉱山を建てられます', cost: land.price, action: { kind: 'buyLand', landId: land.id }, enabled: cash >= land.price });
  }
  // 7. 研究所がない
  if (out.length < limit && !state.facilities.some((f) => f.typeId === 'research_lab' && f.count > 0) && isUnlocked(state, 'facility', 'research_lab')) {
    const def = FACILITY_MAP['research_lab' as FacilityId];
    const o = ranked.find((x) => x.typeId === 'research_lab');
    const cost = o?.cost ?? def.baseCost;
    push({ id: 'lab', icon: def.icon, title: '研究所を建てる', reason: '研究ポイントがないと研究が進みません', cost, action: { kind: 'buyFacility', typeId: 'research_lab' as FacilityId, landId: 'hq', cost }, enabled: cash >= cost });
  }
  return out.filter((r) => !('typeId' in r.action) || isFacilityId(r.action.typeId));
}

function formatYenPerSec(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString('ja-JP');
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function formatSeconds(s: number): string {
  if (!Number.isFinite(s)) return '不明';
  if (s < 60) return `${Math.ceil(s)}秒`;
  if (s < 3600) return `${Math.ceil(s / 60)}分`;
  return `${(s / 3600).toFixed(1)}時間`;
}
