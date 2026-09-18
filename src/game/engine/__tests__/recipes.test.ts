/**
 * 手作り（クラフト）の一覧が太りすぎないようにする見張り。
 *
 * 工房・工場を建てれば自動で作れるものを手作りにも残しておくと、
 * 「施設を建てる意味は？」という話になり、一覧も長くなって探しにくい。
 * 手作りに残してよいのは次の3つだけ。
 *   1. 道具
 *   2. 材料が全部「手で採れるもの」でできる、いちばん最初の加工
 *   3. それを作ることが施設の解放条件になっているもの（施設へ進む入口）
 * どれにも当てはまらないのに施設と同じものを作るレシピがあれば、ここで落ちる。
 */
import { describe, expect, it } from 'vitest';
import { FACILITIES, type FacilityDef } from '@/game/data/facilities';
import { RECIPES, type RecipeDef } from '@/game/data/recipes';
import { GATHER_ACTIONS } from '@/game/data/gathering';
import type { ResourceId } from '@/game/data/resources';

/** 手で採れる資源 */
const RAW = new Set<string>(GATHER_ACTIONS.map((g) => g.resource));

/** 施設が作る資源 → その施設の名前 */
const byFacility = new Map<string, string[]>();
for (const f of FACILITIES as readonly FacilityDef[]) {
  for (const o of Object.keys(f.production?.outputs ?? {})) {
    if (!byFacility.has(o)) byFacility.set(o, []);
    byFacility.get(o)!.push(f.name);
  }
}

/** そのレシピを作ることが、何かの解放条件になっているか */
const gateway = new Set<string>();
for (const f of FACILITIES as readonly FacilityDef[]) {
  const u = f.unlock as { type?: string; recipe?: string };
  if (u?.type === 'crafted' && u.recipe) gateway.add(u.recipe);
}
for (const r of RECIPES as readonly RecipeDef[]) {
  const u = r.unlock as { type?: string; recipe?: string };
  if (u?.type === 'crafted' && u.recipe) gateway.add(u.recipe);
}

describe('手作りの一覧', () => {
  it('施設で作れるものを、手作りにも残していない', () => {
    const bad: string[] = [];
    for (const r of RECIPES as readonly RecipeDef[]) {
      if (r.outputTool) continue; // 道具はいつでも手作り
      if (gateway.has(r.id)) continue; // 施設へ進む入口
      const inputs = Object.keys(r.inputs) as ResourceId[];
      if (inputs.every((i) => RAW.has(i))) continue; // 手で採れるものだけで作れる最初の加工
      for (const o of Object.keys(r.outputs ?? {})) {
        const fac = byFacility.get(o);
        if (fac) bad.push(`${r.name}(${r.id}) は ${fac.join('・')} と同じ ${o} を作る`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('入口になっているレシピは、ちゃんと残っている', () => {
    const ids = new Set((RECIPES as readonly RecipeDef[]).map((r) => r.id));
    const missing = [...gateway].filter((g) => !ids.has(g));
    expect(missing).toEqual([]);
  });

  it('手作りで作るものは、どこかで使えるか売れる', () => {
    // 作ったきり誰も使わない、値段も付かない、では作る意味がない
    const usedAsInput = new Set<string>();
    for (const f of FACILITIES as readonly FacilityDef[]) for (const i of Object.keys(f.production?.inputs ?? {})) usedAsInput.add(i);
    for (const r of RECIPES as readonly RecipeDef[]) for (const i of Object.keys(r.inputs)) usedAsInput.add(i);
    const bad: string[] = [];
    for (const r of RECIPES as readonly RecipeDef[]) {
      for (const o of Object.keys(r.outputs ?? {})) {
        if (!usedAsInput.has(o)) bad.push(`${r.name}: ${o} は誰も使わない`);
      }
    }
    // 売り物として作るもの（工具・宝石など）もあるので、ここは「使い道がない」ものが
    // 増えすぎていないかの目安として見る
    expect(bad.length).toBeLessThanOrEqual(6);
  });

  it('道具のレシピは残っている', () => {
    const tools = (RECIPES as readonly RecipeDef[]).filter((r) => r.outputTool);
    expect(tools.length).toBeGreaterThanOrEqual(7);
  });
});
