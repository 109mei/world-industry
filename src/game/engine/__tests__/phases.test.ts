import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { BUSINESS_MAP } from '@/game/data/business';
import { PROJECT_MAP } from '@/game/data/projects';
import { PACE_MAP, PHASE_ORDER, PROJECT_PHASES, crewSize, qualityRewardMult } from '@/game/data/projectPhases';
import { currentPhase, getDivision, phaseProgress, projectQuality, projectWork } from '../systems/business';
import type { OsmFeature } from '@/game/services/osm/overpass';

let clock = 1_000_000;

function makeEngine() {
  clock = 1_000_000;
  const e = new GameEngine({ rng: () => 0.42, now: () => clock });
  e.updateSettings({ events: false });
  return e;
}

function buyPlace(e: GameEngine, id: string): string {
  const f: OsmFeature = {
    id, kind: 'retail', label: '店舗', name: 'テスト商会', named: false,
    lat: 35.42, lon: 139.35, areaSqm: 600, levels: 2, polygon: [],
  };
  e.debugAddCash(500_000_000_000);
  if (!e.buyCustomProperty(f)) throw new Error('買えませんでした');
  return `osm:${id}`;
}

/** IT会社をひとつ開いて、人を staff 人にする */
function openIt(e: GameEngine, place: string, staff: number, brand = 0) {
  const def = BUSINESS_MAP.it;
  e.state.research.completed[def.research] = true;
  e.debugAddCash(def.setupCost * 10 + 10_000_000_000);
  const r = e.openDivision('it', place);
  if (!r.ok || r.id === undefined) throw new Error(r.reason);
  e.setDivisionStaff(r.id, staff);
  const div = getDivision(e.state, r.id)!;
  div.brand = brand;
  e.refreshDerived();
  return div;
}

describe('工程のデータ', () => {
  it('3工程の割合を足すと1になる', () => {
    const sum = PROJECT_PHASES.reduce((a, p) => a + p.share, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('急ぐほど仕事量は減り、じっくりほど増える', () => {
    expect(PACE_MAP.rush.workMult).toBeLessThan(PACE_MAP.normal.workMult);
    expect(PACE_MAP.careful.workMult).toBeGreaterThan(PACE_MAP.normal.workMult);
    expect(PACE_MAP.rush.quality).toBeLessThan(PACE_MAP.careful.quality);
  });

  it('品質が上がるほど報酬も上がる', () => {
    expect(qualityRewardMult(90)).toBeGreaterThan(qualityRewardMult(50));
    expect(qualityRewardMult(10)).toBeLessThan(1);
    expect(qualityRewardMult(0)).toBeGreaterThan(0);
  });
});

describe('案件の工程が進む', () => {
  it('始めると設計から入り、進むにつれて工程が移る', () => {
    const e = makeEngine();
    const div = openIt(e, buyPlace(e, 'p801'), 6);
    expect(e.startProject(div.id, 'it_inhouse').ok).toBe(true);
    const active = div.projects[0];
    const def = PROJECT_MAP.it_inhouse;
    expect(active.phase).toBe('design');
    expect(currentPhase(def, active)).toBe('design');
    const total = projectWork(def, 'normal');
    active.work = total * 0.4;
    expect(currentPhase(def, active)).toBe('prototype');
    active.work = total * 0.8;
    expect(currentPhase(def, active)).toBe('production');
    expect(phaseProgress(def, active)).toBeGreaterThan(0);
    expect(phaseProgress(def, active)).toBeLessThanOrEqual(1);
  });

  it('工程が終わるごとに出来の良さが記録される', () => {
    const e = makeEngine();
    const div = openIt(e, buyPlace(e, 'p802'), 8);
    e.startProject(div.id, 'it_inhouse');
    for (let i = 0; i < 400 && div.projects.length > 0; i++) e.tick(1);
    // 完成しているはず。記録は完了時に消えるので、通算に残る
    expect(div.completed).toBeGreaterThan(0);
    expect(div.avgQuality).toBeGreaterThan(0);
    expect(div.avgQuality).toBeLessThanOrEqual(100);
  });

  it('人が足りていると出来が良く、足りないと悪い', () => {
    const e = makeEngine();
    const def = PROJECT_MAP.it_datacenter;
    const want = crewSize(def.work);
    const few = openIt(e, buyPlace(e, 'p803'), 1);
    const many = openIt(e, buyPlace(e, 'p804'), want * 2);
    const blank = { projectId: def.id, work: 0, startedAt: 0, pace: 'normal' as const, phaseScores: [] };
    expect(projectQuality(e.state, many, def, blank)).toBeGreaterThan(projectQuality(e.state, few, def, blank));
  });

  it('急ぐと出来が落ち、じっくりやると上がる', () => {
    const e = makeEngine();
    const div = openIt(e, buyPlace(e, 'p805'), 6);
    const def = PROJECT_MAP.it_inhouse;
    const q = (pace: 'careful' | 'normal' | 'rush') =>
      projectQuality(e.state, div, def, { projectId: def.id, work: 0, startedAt: 0, pace, phaseScores: [] });
    expect(q('rush')).toBeLessThan(q('normal'));
    expect(q('careful')).toBeGreaterThan(q('normal'));
  });

  it('急ぐと早く終わる（仕事量が少ない）', () => {
    const def = PROJECT_MAP.it_inhouse;
    expect(projectWork(def, 'rush')).toBeLessThan(projectWork(def, 'normal'));
    expect(projectWork(def, 'careful')).toBeGreaterThan(projectWork(def, 'normal'));
  });

  it('出来が良いと報酬が増え、悪いと減る', () => {
    const good = makeEngine();
    const gd = openIt(good, buyPlace(good, 'p806'), 40, 100);
    good.startProject(gd.id, 'it_inhouse', 'careful');
    const gBefore = gd.totalEarned;
    for (let i = 0; i < 3000 && gd.projects.length > 0; i++) good.tick(1);
    const gEarned = gd.totalEarned - gBefore;

    const bad = makeEngine();
    const bd = openIt(bad, buyPlace(bad, 'p807'), 1, 0);
    bad.startProject(bd.id, 'it_inhouse', 'rush');
    const bBefore = bd.totalEarned;
    for (let i = 0; i < 6000 && bd.projects.length > 0; i++) bad.tick(1);
    const bEarned = bd.totalEarned - bBefore;

    expect(gd.completed).toBe(1);
    expect(bd.completed).toBe(1);
    expect(gEarned).toBeGreaterThan(bEarned);
    expect(gd.avgQuality!).toBeGreaterThan(bd.avgQuality!);
  });

  it('ひどい出来だと評判（ブランド）が落ちる', () => {
    const e = makeEngine();
    const div = openIt(e, buyPlace(e, 'p808'), 1, 20);
    const before = div.brand;
    e.startProject(div.id, 'it_inhouse', 'rush');
    for (let i = 0; i < 20000 && div.projects.length > 0; i++) e.tick(1);
    expect(div.completed).toBe(1);
    expect(div.avgQuality!).toBeLessThan(40);
    expect(div.brand).toBeLessThan(before);
  });

  it('古いセーブ（工程のない案件）を読み込んでも進む', () => {
    const e = makeEngine();
    const div = openIt(e, buyPlace(e, 'p809'), 8);
    e.startProject(div.id, 'it_inhouse');
    // 古い形（pace も phaseScores もない）に戻す
    div.projects[0] = { projectId: 'it_inhouse', work: 0, startedAt: 0 } as (typeof div.projects)[number];
    for (let i = 0; i < 400 && div.projects.length > 0; i++) e.tick(1);
    expect(div.completed).toBe(1);
    expect(PHASE_ORDER.length).toBe(3);
  });
});
