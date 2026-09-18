/**
 * 解放条件がつながっているかの見張り。
 *
 * 「その工場が作るものを持っていたら、その工場が建てられる」という条件は、
 * 他に作る手段があるうちは動くが、手作りのレシピを1つ消した瞬間に
 * 永久に解放されない工場になる。気づきにくいので、機械的に見つける。
 */
import { describe, expect, it } from 'vitest';
import { FACILITIES, type FacilityDef } from '@/game/data/facilities';
import { RECIPES, type RecipeDef } from '@/game/data/recipes';
import { GATHER_ACTIONS } from '@/game/data/gathering';
import { LANDS } from '@/game/data/lands';

/** その資源を手に入れる方法（採集・手作り・施設・鉱脈）をすべて集める */
function sourcesOf(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (res: string, how: string) => {
    if (!m.has(res)) m.set(res, []);
    m.get(res)!.push(how);
  };
  for (const g of GATHER_ACTIONS) add(g.resource, '採集');
  for (const r of RECIPES as readonly RecipeDef[]) for (const o of Object.keys(r.outputs ?? {})) add(o, '手:' + r.id);
  for (const f of FACILITIES as readonly FacilityDef[]) for (const o of Object.keys(f.production?.outputs ?? {})) add(o, '施:' + f.id);
  for (const l of LANDS) for (const d of Object.keys(l.deposits ?? {})) add(d, '鉱脈:' + l.id);
  return m;
}

const SOURCES = sourcesOf();

describe('解放条件', () => {
  it('自分が作るものだけを条件にしている施設がない（永久に出てこない施設）', () => {
    const bad: string[] = [];
    for (const f of FACILITIES as readonly FacilityDef[]) {
      const u = f.unlock as { type?: string; resource?: string };
      if (u?.type !== 'obtained' || !u.resource) continue;
      const others = (SOURCES.get(u.resource) ?? []).filter((s) => s !== '施:' + f.id);
      if (others.length === 0) bad.push(`${f.name}: 「${u.resource}を入手」が条件だが、自分以外に作る手段がない`);
    }
    expect(bad).toEqual([]);
  });

  it('自分が作るものだけを条件にしているレシピがない', () => {
    const bad: string[] = [];
    for (const r of RECIPES as readonly RecipeDef[]) {
      const u = r.unlock as { type?: string; resource?: string };
      if (u?.type !== 'obtained' || !u.resource) continue;
      const others = (SOURCES.get(u.resource) ?? []).filter((s) => s !== '手:' + r.id);
      if (others.length === 0) bad.push(`${r.name}: 「${u.resource}を入手」が条件だが、自分以外に作る手段がない`);
    }
    expect(bad).toEqual([]);
  });

  it('無くなったレシピを条件にしている施設がない', () => {
    const ids = new Set((RECIPES as readonly RecipeDef[]).map((r) => r.id));
    const bad: string[] = [];
    for (const f of FACILITIES as readonly FacilityDef[]) {
      const u = f.unlock as { type?: string; recipe?: string };
      if (u?.type === 'crafted' && u.recipe && !ids.has(u.recipe)) bad.push(`${f.name}: レシピ ${u.recipe} が無い`);
    }
    expect(bad).toEqual([]);
  });

  it('施設が使う材料には、必ず手に入れる方法がある', () => {
    const bad: string[] = [];
    for (const f of FACILITIES as readonly FacilityDef[]) {
      for (const i of Object.keys(f.production?.inputs ?? {})) {
        if (!SOURCES.has(i)) bad.push(`${f.name}: 材料 ${i} をどこからも手に入れられない`);
      }
      for (const i of Object.keys(f.fuel ?? {})) {
        if (!SOURCES.has(i)) bad.push(`${f.name}: 燃料 ${i} をどこからも手に入れられない`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('手作りが使う材料にも、必ず手に入れる方法がある', () => {
    const bad: string[] = [];
    for (const r of RECIPES as readonly RecipeDef[]) {
      for (const i of Object.keys(r.inputs)) {
        if (!SOURCES.has(i)) bad.push(`${r.name}: 材料 ${i} をどこからも手に入れられない`);
      }
    }
    expect(bad).toEqual([]);
  });
});
