import { it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { LANDS, type LandDefId } from '@/game/data/lands';
import { RESEARCH, type ResearchId } from '@/game/data/research';
import { FACILITY_MAP, facilityCost, type FacilityId } from '@/game/data/facilities';
import { getLand } from '../land';
import { isUnlocked } from '../systems/unlocks';

/**
 * 土地以降の進行速度を確認する簡易シミュレーション（開発用）。
 * 総資産100万円・所持金80万円・工具工房などの中盤の状態から始める。
 */
it.runIf(process.env.WI_SIM === '1')('world simulation (WI_SIM=1 で実行)', () => {
  let s = 3;
  const rng = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const e = new GameEngine({ rng, now: () => 0 });
  // 中盤の状態を作る
  e.debugAddCash(800_000);
  e.state.unlocked['facility:large_warehouse'] = true;
  e.buyFacility('small_warehouse', 5);
  e.buyFacility('large_warehouse', 1);
  for (const id of ['worker_stone', 'worker_wood', 'worker_miner', 'worker_scrap'] as FacilityId[]) { e.state.unlocked[`facility:${id}`] = true; e.buyFacility(id, 10); }
  for (const id of ['small_mine', 'simple_smelter', 'tool_workshop', 'parts_workshop'] as FacilityId[]) { e.state.unlocked[`facility:${id}`] = true; e.buyFacility(id, 4); }
  e.setAutoSell('tool', true, 0);
  e.setAutoSell('machine_parts', true, 0);
  e.setAutoSell('stone', true, 200);
  e.state.stats.totalObtained.iron = 1000;
  e.tick(1);
  const log: string[] = [];
  let t = 0;
  const milestones: Record<string, number> = {};
  const mark = (k: string) => { if (!(k in milestones)) { milestones[k] = t; log.push(`${(t / 60).toFixed(1)}min ${k} (cash ${Math.round(e.state.company.cash)}, income ${e.derived.incomePerSec.toFixed(1)}/s)`); } };
  const cnt = (id: FacilityId, land = 'hq') => e.state.facilities.find((f) => f.typeId === id && f.landId === land)?.count ?? 0;
  const own = (id: LandDefId) => !!getLand(e.state, id);
  // 高収益の大型施設（目標数に達していないもの）。これがあるときは小口の買い物を控えて貯金する
  const BIG: [FacilityId, number][] = [['electronics_factory', 4], ['office', 4], ['car_factory', 3], ['datacenter', 3], ['chip_fab', 2], ['robot_factory', 2]];
  const bigTarget = (): number => {
    let best = Infinity;
    for (const [id, target] of BIG) {
      if (!isUnlocked(e.state, 'facility', id) || cnt(id) >= target) continue;
      best = Math.min(best, facilityCost(FACILITY_MAP[id], cnt(id)));
    }
    return best;
  };
  while (t < 14 * 3600) {
    const cash = e.state.company.cash;
    const big = bigTarget();
    // 大型施設を優先して買う
    for (const [id, target] of BIG) {
      if (isUnlocked(e.state, 'facility', id) && cnt(id) < target && e.state.company.cash >= facilityCost(FACILITY_MAP[id], cnt(id))) {
        if (id === 'car_factory' && !((e.state.inventory.rubber ?? 0) > 50 && (e.state.inventory.plastic ?? 0) > 50)) continue;
        if (id === 'chip_fab' && (e.state.inventory.silicon ?? 0) < 20) continue;
        if (id === 'robot_factory' && (e.state.inventory.semiconductor ?? 0) < 20) continue;
        if (e.buyFacility(id, 1) > 0) log.push(`${(t / 60).toFixed(1)}min buy ${id} #${cnt(id)}`);
      }
    }
    // 貯金モード: 大型施設の 40% 以上を貯めるまで小口の買い物を控える
    const saving = Number.isFinite(big) && cash < big * 0.4;
    // 研究: できるものから安い順
    for (const r of [...RESEARCH].sort((a, b) => a.cost - b.cost)) if (e.research(r.id as ResearchId)) log.push(`${(t / 60).toFixed(1)}min research ${r.id}`);
    if (!saving) {
      // 研究所
      if (isUnlocked(e.state, 'facility', 'research_lab') && cnt('research_lab') < (cash > 5_000_000 ? 8 : 4)) e.buyFacility('research_lab', 1);
      // 土地: 十勝 → 筑豊 → 海外
      for (const l of LANDS) {
        if (!own(l.id) && isUnlocked(e.state, 'land', l.id) && cash > l.price * 1.5) { if (e.buyLand(l.id)) log.push(`${(t / 60).toFixed(1)}min buy ${l.id}`); break; }
      }
      // 各土地: 調査 → 鉱山 → 輸送 → 発電
      for (const land of e.state.lands) {
        if (land.id === 'hq') continue;
        if (land.survey < 2 && !land.surveyProgress) e.startSurvey(land.id);
        const deposits = Object.keys(land.deposits);
        if (land.survey >= 2) {
          if (deposits.includes('coal') && cnt('coal_mine', land.id) < 6) e.buyFacility('coal_mine', 1, land.id);
          if (deposits.includes('iron_ore') && cnt('iron_mine', land.id) < 6) e.buyFacility('iron_mine', 1, land.id);
          if (deposits.includes('copper_ore') && cnt('copper_mine', land.id) < 6) e.buyFacility('copper_mine', 1, land.id);
          if (deposits.includes('crude_oil') && cnt('oil_well', land.id) < 6) e.buyFacility('oil_well', 1, land.id);
        }
        if (land.terrain === 'plains' && cnt('wheat_farm', land.id) < 6) e.buyFacility('wheat_farm', 1, land.id);
        if (isUnlocked(e.state, 'facility', 'rubber_plantation') && (land.terrain === 'forest' || land.terrain === 'river' || land.terrain === 'plains') && cnt('rubber_plantation', land.id) < 4) e.buyFacility('rubber_plantation', 1, land.id);
        // 輸送: 使用率が高ければ追加
        const rt = e.derived.lands[land.id];
        if (rt && (rt.transportCapacity === 0 || rt.transportUsed > rt.transportCapacity * 0.9)) {
          if (isUnlocked(e.state, 'facility', 'cargo_plane') && cash > 30_000_000) e.buyFacility('cargo_plane', 1, land.id);
          else if (isUnlocked(e.state, 'facility', 'freight_train') && cash > 1_000_000) e.buyFacility('freight_train', 1, land.id);
          else e.buyFacility('truck', 1, land.id);
        }
        if (cnt('land_warehouse', land.id) < 2 && (rt?.noRoute === false) && Object.values(land.stock).some((v) => (v ?? 0) > 1500)) e.buyFacility('land_warehouse', 1, land.id);
      }
      // 本社: 電力と加工
      const p = e.derived.power;
      if (p.demand > p.capacity * 0.9 || (p.capacity === 0 && (e.state.inventory.coal ?? 0) > 100)) {
        if (isUnlocked(e.state, 'facility', 'coal_power')) e.buyFacility('coal_power', 1);
      }
      if (isUnlocked(e.state, 'facility', 'steel_mill') && cnt('steel_mill') < 4 && (e.state.inventory.coal ?? 0) > 200) e.buyFacility('steel_mill', 1);
      if (isUnlocked(e.state, 'facility', 'copper_smelter') && cnt('copper_smelter') < 4 && (e.state.inventory.copper_ore ?? 0) > 200) e.buyFacility('copper_smelter', 1);
      if (isUnlocked(e.state, 'facility', 'flour_mill') && cnt('flour_mill') < 4 && (e.state.inventory.wheat ?? 0) > 200) e.buyFacility('flour_mill', 1);
      if (isUnlocked(e.state, 'facility', 'electronics_factory') && cnt('electronics_factory') < 4 && (e.state.inventory.copper ?? 0) > 100) e.buyFacility('electronics_factory', 1);
      // 巨大産業
      if (isUnlocked(e.state, 'facility', 'glass_factory') && cnt('glass_factory') < 2 && (e.state.inventory.sand ?? 0) > 500) e.buyFacility('glass_factory', 1);
      if (isUnlocked(e.state, 'facility', 'plastic_plant') && cnt('plastic_plant') < 2 && (e.state.inventory.crude_oil ?? 0) > 500) e.buyFacility('plastic_plant', 1);
      if (isUnlocked(e.state, 'facility', 'car_factory') && cnt('car_factory') < 3 && (e.state.inventory.rubber ?? 0) > 100 && (e.state.inventory.plastic ?? 0) > 100) e.buyFacility('car_factory', 1);
      if (isUnlocked(e.state, 'facility', 'silicon_plant') && cnt('silicon_plant') < 2 && cash > 20_000_000) e.buyFacility('silicon_plant', 1);
      if (isUnlocked(e.state, 'facility', 'chip_fab') && cnt('chip_fab') < 2 && (e.state.inventory.silicon ?? 0) > 20) e.buyFacility('chip_fab', 1);
      if (isUnlocked(e.state, 'facility', 'robot_factory') && cnt('robot_factory') < 2 && (e.state.inventory.semiconductor ?? 0) > 20) e.buyFacility('robot_factory', 1);
      if (isUnlocked(e.state, 'facility', 'worker_gatherer') && cnt('worker_gatherer') < 40 && (e.state.inventory.sand ?? 0) < 200 && cash > 50_000) e.buyFacility('worker_gatherer', 5);
      if (isUnlocked(e.state, 'facility', 'office') && cnt('office') < 4 && cash > 10_000_000) e.buyFacility('office', 1);
      if (isUnlocked(e.state, 'facility', 'datacenter') && cnt('datacenter') < 2 && cash > 50_000_000) e.buyFacility('datacenter', 1);
      if (isUnlocked(e.state, 'facility', 'oil_power') && p.demand > p.capacity * 0.9 && (e.state.inventory.fuel ?? 0) > 200) e.buyFacility('oil_power', 1);
      if (isUnlocked(e.state, 'facility', 'parking') && cnt('parking') < 5) e.buyFacility('parking', 1);
      if (isUnlocked(e.state, 'facility', 'shop') && cnt('shop') < 5) e.buyFacility('shop', 1);
      if (cnt('tool_workshop') < 12 && cash > 100_000) e.buyFacility('tool_workshop', 1);
    }
    // 売却設定
    for (const id of ['flour', 'wheat'] as const) if ((e.state.inventory[id] ?? 0) > 50) e.setAutoSell(id, true, 50);
    for (const id of ['steel', 'copper', 'electronics', 'fuel', 'glass', 'plastic', 'rubber', 'silicon'] as const) if ((e.state.inventory[id] ?? 0) > 500) e.setAutoSell(id, true, 500);
    for (const id of ['car', 'robot', 'semiconductor'] as const) if ((e.state.inventory[id] ?? 0) > 0) e.setAutoSell(id, true, 0);
    if ((e.state.inventory.coal ?? 0) > 5000) e.setAutoSell('coal', true, 5000);
    if ((e.state.inventory.iron_ore ?? 0) > 5000) e.setAutoSell('iron_ore', true, 5000);
    e.tick(1); t += 1;
    if (e.state.lands.length > 1) mark('first land');
    if (e.state.lands.some((l) => l.survey >= 2)) mark('survey 2');
    if ((e.state.stats.totalObtained.coal ?? 0) > 0) mark('coal at hq');
    if (e.derived.power.capacity > 0) mark('power');
    if ((e.state.stats.totalObtained.steel ?? 0) > 0) mark('steel');
    if (e.state.research.completed.overseas) mark('overseas');
    if (e.state.lands.length > 3) mark('3 lands');
    if (e.derived.assets >= 10_000_000) mark('assets 10M');
    if ((e.state.stats.totalProduced.car ?? 0) > 0) mark('first car');
    if ((e.state.stats.totalProduced.semiconductor ?? 0) > 0) mark('first chip');
    if ((e.state.stats.totalProduced.robot ?? 0) > 0) mark('first robot');
    if (e.derived.assets >= 100_000_000) mark('assets 100M');
    if (e.derived.assets >= 1_000_000_000) { mark('assets 1B'); break; }
  }
  const fac = e.state.facilities.map((f) => `${f.landId}:${f.typeId}x${f.count}`).join(', ');
  const lands = e.state.lands.map((l) => `${l.id}(s${l.survey})`).join(', ');
  console.log(log.join('\n') + `\nend: t=${(t / 60).toFixed(0)}min cash=${Math.round(e.state.company.cash)} assets=${Math.round(e.derived.assets)} income/s=${e.derived.incomePerSec.toFixed(2)} power=${e.derived.power.generation.toFixed(1)}/${e.derived.power.capacity.toFixed(1)}MW transportCost=${e.derived.transportCost.toFixed(1)}/s research=${Object.keys(e.state.research.completed).join(',')}\nlands: ${lands}\n${fac}`);
});
