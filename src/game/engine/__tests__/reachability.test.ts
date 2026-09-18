/**
 * 「そこへたどり着けるか」の見張り。
 *
 * 一覧に載っているのに永久に解放されない施設、どこからも手に入らない素材、
 * 前提が回り道になっていて誰も進めない研究——こういうものは遊んでいて気づきにくく、
 * 気づいたときには冷める。データだけを見て、届くものを少しずつ広げながら確かめる。
 *
 * やり方は単純で、
 *   1. 最初から手に入るもの（採集・always のレシピ／施設・鉱脈・貿易）を「届く」に入れる
 *   2. 届くものだけで解放できるものを足す
 *   3. これ以上増えなくなるまで繰り返す
 * 最後まで「届く」に入らなかったものが、矛盾。
 */
import { describe, expect, it } from 'vitest';
import { FACILITIES, type FacilityDef } from '@/game/data/facilities';
import { RECIPES, type RecipeDef } from '@/game/data/recipes';
import { RESEARCH, type ResearchDef } from '@/game/data/research';
import { RESOURCES } from '@/game/data/resources';
import { GATHER_ACTIONS } from '@/game/data/gathering';
import { LANDS } from '@/game/data/lands';
import { TOOLS } from '@/game/data/tools';
import type { UnlockCondition } from '@/game/data/unlockTypes';

interface World {
  resources: Set<string>;
  recipes: Set<string>;
  facilities: Set<string>;
  research: Set<string>;
  tools: Set<string>;
}

/** その条件が、いま届いているものだけで満たせるか */
function satisfied(cond: UnlockCondition, w: World): boolean {
  switch (cond.type) {
    case 'always':
      return true;
    // お金・資産・電力・チュートリアルは、遊んでいれば必ず届く（量の問題であって、道が無いわけではない）
    case 'cash':
    case 'assets':
    case 'powerCapacity':
    case 'tutorialStep':
    case 'landOwned':
      return true;
    case 'obtained':
    case 'sold':
      return w.resources.has(cond.resource);
    case 'crafted':
      return w.recipes.has(cond.recipe);
    case 'toolCrafted':
      return w.tools.has(cond.tool);
    case 'facility':
      return w.facilities.has(cond.facility);
    case 'research':
      return w.research.has(cond.research);
    case 'all':
      return cond.conditions.every((c) => satisfied(c, w));
    case 'any':
      return cond.conditions.some((c) => satisfied(c, w));
    default:
      return false;
  }
}

/** 届くものを、増えなくなるまで広げる */
function explore(): World {
  const w: World = { resources: new Set(), recipes: new Set(), facilities: new Set(), research: new Set(), tools: new Set() };
  // 手で採れるもの
  for (const g of GATHER_ACTIONS) w.resources.add(g.resource);
  // 土地の鉱脈（土地は買えば手に入る）
  for (const l of LANDS) for (const d of Object.keys(l.deposits ?? {})) w.resources.add(d);

  for (let round = 0; round < 40; round++) {
    const before = w.resources.size + w.recipes.size + w.facilities.size + w.research.size + w.tools.size;

    for (const r of RESEARCH as readonly ResearchDef[]) {
      if (w.research.has(r.id)) continue;
      if (r.requires.every((q) => w.research.has(q))) w.research.add(r.id);
    }
    for (const r of RECIPES as readonly RecipeDef[]) {
      if (w.recipes.has(r.id)) continue;
      if (!satisfied(r.unlock, w)) continue;
      // 材料がそろわないと作れない
      if (!Object.keys(r.inputs).every((i) => w.resources.has(i))) continue;
      w.recipes.add(r.id);
      for (const o of Object.keys(r.outputs ?? {})) w.resources.add(o);
      if (r.outputTool) w.tools.add(r.outputTool);
    }
    for (const f of FACILITIES as readonly FacilityDef[]) {
      if (w.facilities.has(f.id)) continue;
      if (!satisfied(f.unlock, w)) continue;
      w.facilities.add(f.id);
      // 建てられれば、材料がそろったときに作れるようになる
      const ins = Object.keys(f.production?.inputs ?? {});
      if (ins.every((i) => w.resources.has(i))) {
        for (const o of Object.keys(f.production?.outputs ?? {})) w.resources.add(o);
      }
    }
    // 建ててあるが材料待ちだった施設も、材料がそろえば動く
    for (const f of FACILITIES as readonly FacilityDef[]) {
      if (!w.facilities.has(f.id)) continue;
      const ins = Object.keys(f.production?.inputs ?? {});
      if (ins.every((i) => w.resources.has(i))) {
        for (const o of Object.keys(f.production?.outputs ?? {})) w.resources.add(o);
      }
    }

    const after = w.resources.size + w.recipes.size + w.facilities.size + w.research.size + w.tools.size;
    if (after === before) break;
  }
  return w;
}

const W = explore();

describe('たどり着けるか', () => {
  it('永久に解放されない施設がない', () => {
    const unreachable = (FACILITIES as readonly FacilityDef[]).filter((f) => !W.facilities.has(f.id)).map((f) => `${f.name}(${f.id})`);
    expect(unreachable).toEqual([]);
  });

  it('永久に作れないレシピがない', () => {
    const unreachable = (RECIPES as readonly RecipeDef[]).filter((r) => !W.recipes.has(r.id)).map((r) => `${r.name}(${r.id})`);
    expect(unreachable).toEqual([]);
  });

  it('永久に進められない研究がない（前提が回り道になっていない）', () => {
    const unreachable = (RESEARCH as readonly ResearchDef[]).filter((r) => !W.research.has(r.id)).map((r) => `${r.name}(${r.id})`);
    expect(unreachable).toEqual([]);
  });

  it('どこからも手に入らない素材がない', () => {
    const missing = RESOURCES.filter((r) => !W.resources.has(r.id)).map((r) => `${r.name}(${r.id})`);
    expect(missing).toEqual([]);
  });

  it('作れない道具がない', () => {
    const missing = TOOLS.filter((t) => !W.tools.has(t.id)).map((t) => `${t.name}(${t.id})`);
    expect(missing).toEqual([]);
  });

  it('研究の前提が、存在しない研究を指していない', () => {
    const ids = new Set((RESEARCH as readonly ResearchDef[]).map((r) => r.id));
    const bad: string[] = [];
    for (const r of RESEARCH as readonly ResearchDef[]) {
      for (const q of r.requires) if (!ids.has(q)) bad.push(`${r.name}: 前提 ${q} が無い`);
    }
    expect(bad).toEqual([]);
  });

  it('解放条件が、存在しない施設・レシピ・研究を指していない', () => {
    const fac = new Set((FACILITIES as readonly FacilityDef[]).map((f) => f.id));
    const rec = new Set((RECIPES as readonly RecipeDef[]).map((r) => r.id));
    const res = new Set((RESEARCH as readonly ResearchDef[]).map((r) => r.id));
    const resources = new Set(RESOURCES.map((r) => r.id as string));
    const bad: string[] = [];
    const check = (where: string, cond: UnlockCondition): void => {
      switch (cond.type) {
        case 'facility':
          if (!fac.has(cond.facility)) bad.push(`${where}: 施設 ${cond.facility} が無い`);
          break;
        case 'crafted':
          if (!rec.has(cond.recipe)) bad.push(`${where}: レシピ ${cond.recipe} が無い`);
          break;
        case 'research':
          if (!res.has(cond.research)) bad.push(`${where}: 研究 ${cond.research} が無い`);
          break;
        case 'obtained':
        case 'sold':
          if (!resources.has(cond.resource)) bad.push(`${where}: 資源 ${cond.resource} が無い`);
          break;
        case 'all':
        case 'any':
          for (const c of cond.conditions) check(where, c);
          break;
        default:
          break;
      }
    };
    for (const f of FACILITIES as readonly FacilityDef[]) check(f.name, f.unlock);
    for (const r of RECIPES as readonly RecipeDef[]) check(r.name, r.unlock);
    for (const g of GATHER_ACTIONS) check(g.label, g.unlock);
    for (const l of LANDS) check(l.name, l.unlock);
    expect(bad).toEqual([]);
  });

  it('研究の効果が、存在しない資源や施設を指していない', () => {
    const resources = new Set(RESOURCES.map((r) => r.id as string));
    const bad: string[] = [];
    for (const r of RESEARCH as readonly ResearchDef[]) {
      for (const e of r.effects as readonly Record<string, unknown>[]) {
        const rid = e.resource;
        if (typeof rid === 'string' && !resources.has(rid)) bad.push(`${r.name}: 資源 ${rid} が無い`);
      }
    }
    expect(bad).toEqual([]);
  });
});
