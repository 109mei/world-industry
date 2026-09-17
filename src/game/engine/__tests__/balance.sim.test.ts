import { it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { type FacilityId } from '@/game/data/facilities';
import { isUnlocked } from '../systems/unlocks';

// 簡単な「それなりに賢い」プレイヤーを模擬して、進行速度を確認する（開発用）
it.runIf(process.env.WI_SIM === '1')('balance simulation (WI_SIM=1 で実行)', { timeout: 600_000 }, () => {
  let s = 1;
  const rng = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const e = new GameEngine({ rng, now: () => 0 });
  const log: string[] = [];
  let t = 0;
  const milestones: Record<string, number> = {};
  const mark = (k: string) => { if (!(k in milestones)) { milestones[k] = t; log.push(`${(t / 60).toFixed(1)}min ${k}`); } };
  const tapsPerSec = 3;
  while (t < 3 * 3600) {
    // 手作業: 毎秒3タップ（序盤のみ）
    if (t < 1800) {
      for (let i = 0; i < tapsPerSec; i++) {
        const inv = e.state.inventory;
        if ((inv.stone ?? 0) < 20) e.gather('gather_stone');
        else if ((inv.wood ?? 0) < 20) e.gather('gather_wood');
        else if (e.state.tools.stone_hammer && (inv.scrap_metal ?? 0) < 30) e.gather('gather_scrap');
        else if (e.state.tools.stone_pickaxe || e.state.tools.iron_pickaxe) e.gather('gather_iron_ore');
        else e.gather('gather_stone');
      }
    }
    // クラフト
    if (!e.state.tools.stone_hammer) e.craft('craft_stone_hammer');
    if (isUnlocked(e.state, 'recipe', 'craft_stone_pickaxe') && !e.state.tools.stone_pickaxe && !e.state.tools.iron_pickaxe) e.craft('craft_stone_pickaxe');
    if (isUnlocked(e.state, 'recipe', 'craft_iron_pickaxe') && !e.state.tools.iron_pickaxe && (e.state.inventory.iron ?? 0) >= 6) e.craft('craft_iron_pickaxe');
    if ((e.state.inventory.scrap_metal ?? 0) >= 3) e.craft('smelt_scrap', 'max');
    if ((e.state.inventory.iron_ore ?? 0) >= 2 && !e.state.facilities.some((f) => f.typeId === 'simple_smelter')) e.craft('smelt_iron_ore', 'max');
    if ((e.state.inventory.iron ?? 0) >= 4 && (e.state.inventory.wood ?? 0) >= 2) e.craft('craft_tool', 'max');
    // 売却: 工具・機械部品・鉄くず・余った石
    for (const id of ['tool', 'machine_parts', 'brick'] as const) if ((e.state.inventory[id] ?? 0) >= 1) e.sell(id, 'all');
    if ((e.state.inventory.scrap_metal ?? 0) > 0 && !isUnlocked(e.state, 'recipe', 'smelt_scrap')) e.sell('scrap_metal', 'all');
    if ((e.state.inventory.stone ?? 0) > 60) e.sell('stone', Math.floor((e.state.inventory.stone ?? 0) - 40));
    // 施設購入: 解放済みの中で高いものから1つずつ
    const order: FacilityId[] = ['parts_workshop', 'tool_workshop', 'small_mine', 'simple_smelter', 'small_warehouse', 'worker_miner', 'worker_scrap', 'worker_wood', 'worker_stone'];
    for (const id of order) {
      if (!isUnlocked(e.state, 'facility', id)) continue;
      const cnt = e.state.facilities.find((f) => f.typeId === id)?.count ?? 0;
      const cap = { worker_stone: 8, worker_wood: 12, worker_scrap: 10, worker_miner: 15, small_warehouse: 6, simple_smelter: 8, tool_workshop: 6, parts_workshop: 4, small_mine: 4 }[id as string] ?? 3;
      if (cnt < cap && e.buyFacility(id, 1) > 0) break;
    }
    e.tick(1); t += 1;
    if (e.state.tools.stone_hammer) mark('hammer');
    if (e.state.company.totalEarned > 0) mark('first sale');
    if (e.state.facilities.length > 0) mark('first worker');
    if ((e.state.stats.totalObtained.iron ?? 0) >= 1) mark('first iron');
    if (e.state.facilities.some((f) => f.typeId === 'simple_smelter')) mark('smelter');
    if (e.state.facilities.some((f) => f.typeId === 'tool_workshop')) mark('tool workshop');
    if (e.state.facilities.some((f) => f.typeId === 'small_mine')) mark('small mine');
    if (e.state.company.cash >= 10_000) mark('cash 10K');
    if (e.state.company.cash >= 100_000) mark('cash 100K');
    if (e.derived.assets >= 1_000_000) { mark('assets 1M'); break; }
  }
  const fac = e.state.facilities.map((f) => `${f.typeId}x${f.count}`).join(', ');
  console.log(log.join('\n') + `\nend: t=${(t/60).toFixed(0)}min cash=${Math.round(e.state.company.cash)} assets=${Math.round(e.derived.assets)} income/s=${e.derived.incomePerSec.toFixed(2)}\n${fac}`);
});
