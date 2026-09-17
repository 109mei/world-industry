import { it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { type FacilityId } from '@/game/data/facilities';
import { MANAGERS } from '@/game/data/managers';
import { isManagerHired, isManagerUnlocked } from '../systems/automation';
import { isUnlocked } from '../systems/unlocks';
import { recommend } from '../analysis/recommend';
import { rankInvestments } from '../analysis/roi';

// 序盤は自分で回し、雇えるようになったらマネージャーに任せきりにするプレイヤーを模擬する（開発用）。
// 給料が収入を食いつぶさないか・投資係が進行を止めないかを見る
it.runIf(process.env.WI_SIM === '1')('managers simulation (WI_SIM=1 で実行)', { timeout: 600_000 }, () => {
  let s = 7;
  const rng = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const e = new GameEngine({ rng, now: () => 0 });
  const log: string[] = [];
  let t = 0;
  const seen = new Set<string>();
  const mark = (k: string) => {
    if (!seen.has(k)) {
      seen.add(k);
      log.push(`${(t / 60).toFixed(1)}min ${k}`);
    }
  };
  const hours = Number(process.env.WI_SIM_HOURS ?? 6);
  const recs: Record<string, number> = {};
  while (t < hours * 3600) {
    const inv = e.state.inventory;
    // 手作業（採集係を雇うまで）
    if (!isManagerHired(e.state, 'gather')) {
      for (let i = 0; i < 3; i++) {
        if ((inv.stone ?? 0) < 20) e.gather('gather_stone');
        else if ((inv.wood ?? 0) < 20) e.gather('gather_wood');
        else if (e.state.tools.stone_hammer && (inv.scrap_metal ?? 0) < 30) e.gather('gather_scrap');
        else if (e.state.tools.stone_pickaxe || e.state.tools.iron_pickaxe) e.gather('gather_iron_ore');
        else e.gather('gather_stone');
      }
    }
    // クラフト（クラフト係を雇うまで）
    if (!isManagerHired(e.state, 'craft')) {
      if (!e.state.tools.stone_hammer) e.craft('craft_stone_hammer');
      if (isUnlocked(e.state, 'recipe', 'craft_stone_pickaxe') && !e.state.tools.stone_pickaxe && !e.state.tools.iron_pickaxe) e.craft('craft_stone_pickaxe');
      if ((inv.scrap_metal ?? 0) >= 3) e.craft('smelt_scrap', 'max');
      if ((inv.iron_ore ?? 0) >= 2 && !e.state.facilities.some((f) => f.typeId === 'simple_smelter')) e.craft('smelt_iron_ore', 'max');
      if ((inv.iron ?? 0) >= 4 && (inv.wood ?? 0) >= 2) e.craft('craft_tool', 'max');
      if ((e.state.stats.crafted.fire_brick ?? 0) < 1 && (inv.clay ?? 0) >= 2) e.craft('fire_brick');
    }
    // 売却（販売係を雇うまでは手で。以降は自動売却＋おまかせ）
    for (const id of ['tool', 'machine_parts', 'brick'] as const) if ((inv[id] ?? 0) >= 1) e.sell(id, 'all');
    if ((inv.stone ?? 0) > 60) e.sell('stone', Math.floor((inv.stone ?? 0) - 40));
    // 施設購入（投資係を雇うまで）: 「おすすめの次の一手」に従う。なければ従来の順番
    // 投資係が雇えるようになったら、雇うまで手動の購入をやめて現金を貯める
    if (!isManagerHired(e.state, 'invest') && !isManagerUnlocked(e.state, 'invest', e.derived.assets) && t % 5 === 0) {
      const rec = recommend(e.state, e.derived, 3).find((r) => r.enabled && r.action.kind === 'buyFacility');
      if (rec && rec.action.kind === 'buyFacility') {
        e.buyFacility(rec.action.typeId, 1, rec.action.landId);
        recs[rec.action.typeId] = (recs[rec.action.typeId] ?? 0) + 1;
      } else {
        const order: FacilityId[] = ['parts_workshop', 'tool_workshop', 'small_mine', 'simple_smelter', 'small_warehouse', 'worker_miner', 'worker_scrap', 'worker_wood', 'worker_stone'];
        for (const id of order) {
          if (!isUnlocked(e.state, 'facility', id)) continue;
          const cnt = e.state.facilities.find((f) => f.typeId === id)?.count ?? 0;
          const cap = { worker_stone: 8, worker_wood: 12, worker_scrap: 10, worker_miner: 15, small_warehouse: 6, simple_smelter: 8, tool_workshop: 6, parts_workshop: 4, small_mine: 4 }[id as string] ?? 3;
          if (cnt < cap && e.buyFacility(id, 1) > 0) break;
        }
      }
    }
    // 雇えるマネージャーは雇う（採用費の 2 倍の現金があるとき）
    for (const m of MANAGERS) {
      if (!isManagerHired(e.state, m.id) && isManagerUnlocked(e.state, m.id, e.derived.assets) && e.state.company.cash >= m.hireCost * 2) {
        if (e.hireManager(m.id)) mark(`hire ${m.id}`);
      }
    }
    if (isManagerHired(e.state, 'craft')) e.setCraftTarget('iron', 10);
    if (isManagerHired(e.state, 'sales')) e.setSmartSell(true);
    if (isManagerHired(e.state, 'invest')) e.updateInvestRule({ reserve: 200_000, properties: true });
    for (const id of ['tool', 'machine_parts', 'brick', 'steel'] as const) if (!e.state.market.autoSell[id]) e.setAutoSell(id, true, 5);
    e.tick(1);
    t += 1;
    for (const [k, v] of [['cash100K', 1e5], ['cash1M', 1e6], ['assets3M', 3e6], ['assets10M', 1e7], ['assets100M', 1e8], ['assets1B', 1e9]] as const) {
      if ((k.startsWith('cash') ? e.state.company.cash : e.derived.assets) >= v) mark(k);
    }
    if (t % 1800 === 0) {
      const st = e.state.stats;
      log.push(`${(t / 60).toFixed(0)}min cash=${Math.round(e.state.company.cash).toLocaleString()} assets=${Math.round(e.derived.assets).toLocaleString()} income/s=${e.derived.incomePerSec.toFixed(1)} salary/s=${e.derived.salaryPerSec.toFixed(1)} salaries=${Math.round(st.salariesPaid).toLocaleString()} contracts=${st.contractsCompleted}/${st.contractsFailed} credit=${e.state.contracts.credit} fac=${e.state.facilities.reduce((a, f) => a + f.count, 0)} lands=${e.state.lands.length} props=${Object.keys(e.state.estate.owned).length} mgr=${Object.keys(e.state.automation.managers).join(',')}`);
    }
  }
  const fac = e.state.facilities.map((f) => `${f.landId}:${f.typeId}x${f.count}`).join(', ');
  const top = rankInvestments(e.state, e.derived, { realizedOnly: true }).slice(0, 8).map((o) => `${o.typeId}@${o.landId} cost=${Math.round(o.cost)} v=${o.valuePerSec.toFixed(2)} pb=${Math.round(o.paybackSeconds)} ${o.feasible ? 'ok' : 'starved'}`);
  console.log(log.join('\n') + `\n${fac}\nrecommended: ${JSON.stringify(recs)}\ntop: ${top.join(' | ')}`);
});
