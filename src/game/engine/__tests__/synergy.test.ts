import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { BUSINESS_MAP } from '@/game/data/business';
import { SYNERGIES, SYNERGY_KEYS, type SynergyKey } from '@/game/data/synergies';
import { getDivision } from '../systems/business';
import { buildCostMult, divisionStrength, kindStrengths, synergyReport, tradeFeeMult } from '../systems/synergy';
import type { OsmFeature } from '@/game/services/osm/overpass';

let clock = 1_000_000;

function makeEngine(cash = 0) {
  clock = 1_000_000;
  const e = new GameEngine({ rng: () => 0.42, now: () => clock });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  return e;
}

/** 地図の建物を1つ買って、その土地 ID を返す */
function buyPlace(e: GameEngine, id: string): string {
  const f: OsmFeature = {
    id,
    kind: 'retail',
    label: '店舗',
    name: 'テスト商会',
    named: false,
    lat: 35.42,
    lon: 139.35,
    areaSqm: 600,
    levels: 2,
    polygon: [],
  };
  e.debugAddCash(500_000_000_000);
  if (!e.buyCustomProperty(f)) throw new Error('買えませんでした');
  return `osm:${id}`;
}

/** 業種をひとつ開いて、人をいっぱいまで雇う */
function openFull(e: GameEngine, kind: Parameters<GameEngine['openDivision']>[0], place: string) {
  const def = BUSINESS_MAP[kind];
  e.state.research.completed[def.research] = true;
  e.debugAddCash(def.setupCost * 10 + 1_000_000_000);
  const r = e.openDivision(kind, place);
  if (!r.ok || r.id === undefined) throw new Error(r.reason ?? '開業できませんでした');
  e.setDivisionStaff(r.id, def.maxStaff);
  const div = getDivision(e.state, r.id)!;
  div.awareness = 100;
  div.brand = 100;
  e.refreshDerived();
  return div;
}

describe('連携のデータ', () => {
  it('連携の業種と効き先はすべて実在する', () => {
    for (const s of SYNERGIES) {
      expect(BUSINESS_MAP[s.from], s.from).toBeTruthy();
      expect(s.effects.length, s.from).toBeGreaterThan(0);
      for (const e of s.effects) {
        expect(SYNERGY_KEYS[e.key], `${s.from}:${e.key}`).toBeTruthy();
        expect(e.max, `${s.from}:${e.key}`).toBeGreaterThan(0);
        expect(e.max, `${s.from}:${e.key}`).toBeLessThanOrEqual(0.6);
      }
      expect(s.note.length, s.from).toBeGreaterThan(5);
    }
  });

  it('同じ業種の連携は1つだけ（重複定義がない）', () => {
    const seen = new Set<string>();
    for (const s of SYNERGIES) {
      expect(seen.has(s.from), s.from).toBe(false);
      seen.add(s.from);
    }
  });
});

describe('連携の効き', () => {
  it('事業がなければ何も効かない', () => {
    const e = makeEngine();
    expect(synergyReport(e.state)).toEqual([]);
    expect(buildCostMult(e.state)).toBe(1);
  });

  it('開いたばかりより、人を雇って知名度が上がったほうが強く効く', () => {
    const e = makeEngine();
    const place = buyPlace(e, 'w801');
    const def = BUSINESS_MAP.transport;
    e.state.research.completed[def.research] = true;
    e.debugAddCash(def.setupCost * 10 + 1_000_000_000);
    const r = e.openDivision('transport', place);
    expect(r.ok).toBe(true);
    const div = getDivision(e.state, r.id!)!;
    const small = divisionStrength(div);
    div.staff = def.maxStaff;
    div.awareness = 100;
    div.brand = 100;
    const big = divisionStrength(div);
    expect(big).toBeGreaterThan(small);
    expect(big).toBeLessThanOrEqual(1);
  });

  it('運送会社を持つと輸送費が下がり、運べる量が増える', () => {
    const e = makeEngine();
    const before = { ...e.derived.modifiers };
    openFull(e, 'transport', buyPlace(e, 'w802'));
    const after = e.derived.modifiers;
    expect(after.transportCost).toBeLessThan(before.transportCost);
    expect(after.transportCapacity).toBeGreaterThan(before.transportCapacity);
  });

  it('人材サービスを持つと人件費が下がる', () => {
    const e = makeEngine();
    const before = e.derived.modifiers.wage;
    openFull(e, 'staffing', buyPlace(e, 'w803'));
    expect(e.derived.modifiers.wage).toBeLessThan(before);
  });

  it('建設会社を持つと施設が安く建つ', () => {
    const e = makeEngine();
    expect(buildCostMult(e.state)).toBe(1);
    openFull(e, 'construction', buyPlace(e, 'w804'));
    const mult = buildCostMult(e.state);
    expect(mult).toBeLessThan(1);
    expect(mult).toBeGreaterThan(0.5);
  });

  it('銀行を持つと売買の手数料が下がる', () => {
    const e = makeEngine();
    expect(tradeFeeMult(e.state)).toBe(1);
    openFull(e, 'bank', buyPlace(e, 'w805'));
    expect(tradeFeeMult(e.state)).toBeLessThan(1);
  });

  it('同じ業種を2つ持っても、効きは1を超えない', () => {
    const e = makeEngine();
    openFull(e, 'transport', buyPlace(e, 'w806'));
    const one = kindStrengths(e.state).get('transport') ?? 0;
    openFull(e, 'transport', buyPlace(e, 'w807'));
    const two = kindStrengths(e.state).get('transport') ?? 0;
    expect(two).toBeGreaterThanOrEqual(one);
    expect(two).toBeLessThanOrEqual(1);
  });

  it('費用の効果が積み重なっても、ただにはならない', () => {
    const e = makeEngine();
    let i = 0;
    for (const s of SYNERGIES) {
      if (!s.effects.some((x) => SYNERGY_KEYS[x.key].lowerIsBetter)) continue;
      openFull(e, s.from, buyPlace(e, `w9${i++}`));
    }
    const m = e.derived.modifiers;
    const costs: SynergyKey[] = ['transportCost', 'adCost', 'wage', 'surveyCost', 'buildCost', 'interestRate', 'tradeFee', 'eventDamage', 'projectCost'];
    for (const k of costs) {
      const v = (m as unknown as Record<string, number>)[k];
      expect(v, k).toBeGreaterThan(0.1);
      expect(v, k).toBeLessThanOrEqual(1);
    }
  });

  it('連携の一覧は、効いているものだけを強い順に返す', () => {
    const e = makeEngine();
    openFull(e, 'agency', buyPlace(e, 'w810'));
    const lines = synergyReport(e.state);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.from.length).toBeGreaterThan(0);
    for (let i = 1; i < lines.length; i++) {
      expect(Math.abs(lines[i - 1].mult - 1)).toBeGreaterThanOrEqual(Math.abs(lines[i].mult - 1) - 1e-9);
    }
    const ad = lines.find((l) => l.key === 'adCost');
    expect(ad).toBeTruthy();
    expect(ad!.mult).toBeLessThan(1);
  });
});
