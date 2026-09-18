/**
 * 設定の筋が通っているかを見張る。
 *
 * 「鉱山が無いのに鉱石が出る」「作ると損をする工程がある」「どこからも手に入らない資源がある」
 * といった、遊んでいて気づいたときに冷めるものを、データから機械的に見つける。
 */
import { describe, expect, it } from 'vitest';
import { FACILITIES, type FacilityDef } from '@/game/data/facilities';
import { LANDS } from '@/game/data/lands';
import { RECIPES } from '@/game/data/recipes';
import { RESOURCES, RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { GATHER_ACTIONS } from '@/game/data/gathering';

const price = (id: string) => RESOURCE_MAP[id as ResourceId]?.basePrice ?? 0;
const value = (m: Partial<Record<string, number>> | undefined) =>
  Object.entries(m ?? {}).reduce((a, [k, v]) => a + price(k) * (v ?? 0), 0);

describe('設定の筋が通っているか', () => {
  it('材料より安い製品を作る工程がない（作ると損をしない）', () => {
    const bad: string[] = [];
    for (const f of FACILITIES as readonly FacilityDef[]) {
      const ins = f.production?.inputs;
      const outs = f.production?.outputs;
      if (!ins || !outs) continue;
      const ci = value(ins);
      const co = value(outs);
      if (ci > 0 && co <= ci) bad.push(`${f.name}: 材料${ci} → 製品${co}`);
    }
    for (const r of RECIPES) {
      const outs = 'outputs' in r ? r.outputs : undefined;
      if (!outs) continue; // 道具は売り物ではないので対象外
      const ci = value(r.inputs);
      const co = value(outs);
      if (ci > 0 && co > 0 && co <= ci) bad.push(`${r.name}: 材料${ci} → 製品${co}`);
    }
    expect(bad).toEqual([]);
  });

  it('どこからも手に入らない資源がない', () => {
    const obtainable = new Set<string>();
    for (const g of GATHER_ACTIONS) obtainable.add(g.resource);
    for (const f of FACILITIES as readonly FacilityDef[]) for (const k of Object.keys(f.production?.outputs ?? {})) obtainable.add(k);
    for (const r of RECIPES) if ('outputs' in r && r.outputs) for (const k of Object.keys(r.outputs)) obtainable.add(k);
    for (const l of LANDS) for (const k of Object.keys(l.deposits)) obtainable.add(k);
    const missing = RESOURCES.filter((r) => !obtainable.has(r.id)).map((r) => `${r.name}(${r.id})`);
    expect(missing).toEqual([]);
  });

  it('鉱脈から掘る施設には、その鉱脈がある土地が必ずある', () => {
    const depositLands = new Set<string>();
    for (const l of LANDS) for (const k of Object.keys(l.deposits)) depositLands.add(k);
    const orphan: string[] = [];
    for (const f of FACILITIES as readonly FacilityDef[]) {
      if (!f.extractsDeposit) continue;
      const outs = Object.keys(f.production?.outputs ?? {});
      if (!outs.some((o) => depositLands.has(o))) orphan.push(`${f.name} → ${outs.join('・')}`);
    }
    expect(orphan).toEqual([]);
  });

  it('鉱脈のある資源は、必ず掘る手立てがある', () => {
    const minable = new Set<string>();
    for (const f of FACILITIES as readonly FacilityDef[]) if (f.extractsDeposit) for (const o of Object.keys(f.production?.outputs ?? {})) minable.add(o);
    const stuck: string[] = [];
    for (const l of LANDS) {
      for (const k of Object.keys(l.deposits)) {
        if (!minable.has(k)) stuck.push(`${l.name} の ${RESOURCE_MAP[k as ResourceId]?.name ?? k}`);
      }
    }
    expect(stuck).toEqual([]);
  });

  it('本社で建てられる施設は、鉱石をひとつも生まない', () => {
    const ores: string[] = ['iron_ore', 'coal', 'copper_ore', 'crude_oil', 'uranium_ore', 'gold_ore', 'silver_ore', 'rough_gem'];
    const bad: string[] = [];
    for (const f of FACILITIES as readonly FacilityDef[]) {
      if (f.site !== 'hq') continue;
      for (const o of Object.keys(f.production?.outputs ?? {})) if (ores.includes(o)) bad.push(`${f.name} → ${o}`);
    }
    expect(bad).toEqual([]);
  });

  it('施設と資源の名前が重複していない', () => {
    expect(new Set(FACILITIES.map((f) => f.id)).size).toBe(FACILITIES.length);
    expect(new Set(FACILITIES.map((f) => f.name)).size).toBe(FACILITIES.length);
    expect(new Set(RESOURCES.map((r) => r.id)).size).toBe(RESOURCES.length);
    expect(new Set(RESOURCES.map((r) => r.name)).size).toBe(RESOURCES.length);
    expect(new Set(LANDS.map((l) => l.id)).size).toBe(LANDS.length);
  });
});
