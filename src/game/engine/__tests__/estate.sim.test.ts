import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { CITY_MAP } from '@/game/data/cities';
import { COMPANIES, COMPANY_MAP } from '@/game/data/companies';
import { PROPERTIES, propertyYield, type PropertyDef } from '@/game/data/properties';
import { propertyBuyCost, propertyOwner } from '../systems/estate';
import { acquireCost, expandCost, hasControl, maxAffordableShares, sharesToControl } from '../systems/stocks';

/**
 * 不動産・株式の進行速度を確認する簡易シミュレーション（開発用）。
 * 中盤（総資産 5,000万円、産業の収入 3,000円/秒）から始めて、資産がどれくらいの速さで増えるかを見る。
 */
it.runIf(process.env.WI_SIM === '1')('estate simulation (WI_SIM=1 で実行)', { timeout: 600_000 }, () => {
  let s = 5;
  const rng = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const e = new GameEngine({ rng, now: () => 0 });
  e.updateSettings({ events: true });
  e.debugAddCash(50_000_000);
  const INDUSTRY_INCOME = 3_000; // 円/秒（産業の収入の代わり）
  const log: string[] = [];
  const milestones: Record<string, number> = {};
  let t = 0;
  const mark = (k: string) => {
    if (!(k in milestones)) {
      milestones[k] = t;
      log.push(`${(t / 3600).toFixed(1)}h ${k} (cash ${Math.round(e.state.company.cash).toLocaleString()}, assets ${Math.round(e.derived.assets).toLocaleString()}, rent ${e.derived.rentPerSec.toFixed(0)}/s, div ${e.derived.dividendPerSec.toFixed(0)}/s)`);
    }
  };
  const props = PROPERTIES as readonly PropertyDef[];
  while (t < 120 * 3600) {
    e.state.company.cash += INDUSTRY_INCOME;
    if (t % 30 === 0) {
      const cash = e.state.company.cash;
      // 1. 物件: 利回り＋地価トレンドが高いものから、所持金の 90% 以内で買える最も高いもの
      const buyable = props
        .filter((p) => propertyOwner(e.state, p.id).type === 'market' && propertyBuyCost(e.state, p.id) <= cash * 0.9)
        .map((p) => ({ p, score: propertyYield(p) + CITY_MAP[p.city].trend, cost: propertyBuyCost(e.state, p.id) }))
        .filter((x) => x.score >= 0.1)
        .sort((a, b) => b.cost - a.cost);
      if (buyable.length > 0) {
        const pick = buyable[0];
        if (e.buyProperty(pick.p.id)) log.push(`${(t / 3600).toFixed(1)}h buy ${pick.p.id} ${Math.round(pick.cost).toLocaleString()}`);
      } else {
        // 2. 株: 支配できそうな会社（経営権まで買う費用が所持金の 80% 以内）があれば買う
        const targets = COMPANIES.filter((c) => !e.state.stocks.companies[c.id].dissolved && !hasControl(e.state, c.id))
          .map((c) => ({ c, need: sharesToControl(e.state, c.id) }))
          .filter((x) => x.need > 0 && x.need <= maxAffordableShares(e.state, x.c.id) * 0.8)
          .sort((a, b) => b.c.baseCap - a.c.baseCap);
        if (targets.length > 0) {
          const { c, need } = targets[0];
          e.buyShares(c.id, need);
          if (hasControl(e.state, c.id)) {
            e.setCompanyPolicy(c.id, 'growth');
            log.push(`${(t / 3600).toFixed(1)}h control ${c.id}`);
          }
        } else if (cash > 5_000_000) {
          // 3. 配当狙い: 利益率の高い会社を少しずつ
          const best = [...COMPANIES].filter((c) => !e.state.stocks.companies[c.id].dissolved).sort((a, b) => b.earningsYield - a.earningsYield)[0];
          const q = Math.floor(maxAffordableShares(e.state, best.id) * 0.3);
          if (q > 0) e.buyShares(best.id, q);
        }
      }
      // 支配している会社: 買収できるなら買収、余裕があれば増設
      for (const c of COMPANIES) {
        if (!hasControl(e.state, c.id)) continue;
        const st = e.state.stocks.companies[c.id];
        if (st.playerShares < c.shares && acquireCost(e.state, c.id) <= e.state.company.cash * 0.5) {
          if (e.acquireCompany(c.id)) log.push(`${(t / 3600).toFixed(1)}h acquire ${c.id}`);
        }
        if (expandCost(e.state, c.id) <= e.state.company.cash * 0.2 && st.expansions < 10) e.expandCompany(c.id);
      }
    }
    e.tick(1);
    t += 1;
    if (e.derived.assets >= 100_000_000) mark('assets 1億');
    if (e.derived.assets >= 1_000_000_000) mark('assets 10億');
    if (e.derived.assets >= 10_000_000_000) mark('assets 100億');
    if (e.derived.assets >= 100_000_000_000) mark('assets 1000億');
    if (e.derived.assets >= 1_000_000_000_000) {
      mark('assets 1兆');
      break;
    }
    if (e.state.estate.owned['tk_ginza_bldg']) mark('ginza');
  }
  const owned = Object.keys(e.state.estate.owned).length;
  const held = Object.entries(e.state.stocks.companies)
    .filter(([, c]) => c.playerShares > 0)
    .map(([id, c]) => `${COMPANY_MAP[id as keyof typeof COMPANY_MAP].name}:${((c.playerShares / COMPANY_MAP[id as keyof typeof COMPANY_MAP].shares) * 100).toFixed(0)}%`);
  const out =
    log.join('\n') +
      `\nend: t=${(t / 3600).toFixed(1)}h cash=${Math.round(e.state.company.cash).toLocaleString()} assets=${Math.round(e.derived.assets).toLocaleString()} estate=${Math.round(e.derived.estateValue).toLocaleString()} stocks=${Math.round(e.derived.stockValue).toLocaleString()} rent/s=${e.derived.rentPerSec.toFixed(0)} div/s=${e.derived.dividendPerSec.toFixed(0)} owned=${owned} held=${held.join(', ')}`;
  console.log(out);
  writeFileSync('estate-sim.log', out);
});
