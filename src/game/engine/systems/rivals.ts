import { CITY_MAP } from '@/game/data/cities';
import { COMPANIES, COMPANY_MAP, CONTROL_RATIO, type CompanyDef } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { PROPERTIES, PROPERTY_MAP, isPropertyId, type PropertyDef } from '@/game/data/properties';
import type { EngineContext } from '../context';
import { companyProperties, isEstateUnlocked, propertyOwner, propertyPrice, resetCompanyOwnedIndex } from './estate';
import { computeStocks, fundamentalPrice, ownershipOf, sharesOf } from './stocks';

/** 会社の本社がある国（都市データから引く。見つからなければ null） */
function companyCountry(def: CompanyDef): string | null {
  // 本社の緯度経度に一番近い都市の国
  let best: { d: number; country: string } | null = null;
  for (const c of Object.values(CITY_MAP)) {
    const d = Math.hypot(c.lat - def.lat, c.lon - def.lon);
    if (!best || d < best.d) best = { d, country: c.country };
  }
  return best?.country ?? null;
}

/**
 * ライバル会社の行動。
 * - 物件の購入: 現金のある会社が、本社と同じ国の市場の物件（価格 ≤ 現金×比率）から確率で1件買う
 * - 増資: 成長重視の会社が確率で株を増やす（現金が増え、他の株主の持分が薄まる）。プレイヤーが経営権を持つ会社は増資しない
 */
export function runRivals(ctx: EngineContext, dt: number): void {
  const { state, derived } = ctx;
  const st = state.stocks;
  // プレイヤーが不動産・株式に参加できるようになってから動き出す
  if (!isEstateUnlocked(state, derived.assets)) return;
  if (typeof st.rivalIn !== 'number') st.rivalIn = CONFIG.rivals.buyIntervalSeconds;
  if (typeof st.issueIn !== 'number') st.issueIn = CONFIG.rivals.issueIntervalSeconds;
  st.rivalIn -= dt;
  let guard = 0;
  while (st.rivalIn <= 0 && guard++ < 100) {
    st.rivalIn += CONFIG.rivals.buyIntervalSeconds;
    if (!ctx.offline()) rivalsBuyProperties(ctx);
  }
  st.issueIn -= dt;
  guard = 0;
  while (st.issueIn <= 0 && guard++ < 100) {
    st.issueIn += CONFIG.rivals.issueIntervalSeconds;
    rivalsIssueShares(ctx);
  }
}

function rivalsBuyProperties(ctx: EngineContext): void {
  const { state, rng } = ctx;
  const cfg = CONFIG.rivals;
  let changed = false;
  const all = PROPERTIES as readonly PropertyDef[];
  let onMarket = all.filter((p) => propertyOwner(state, p.id).type === 'market').length;
  const floor = Math.ceil(all.length * cfg.marketFloorRatio);
  for (const c of COMPANIES as readonly CompanyDef[]) {
    if (onMarket <= floor) break; // 市場に一定数は残す
    const s = state.stocks.companies[c.id];
    if (!s || s.dissolved || s.cash <= 0) continue;
    // プレイヤーが完全所有している会社は、プレイヤーの意思で動く（勝手に買わない）
    if (ownershipOf(state, c.id) >= 0.999) continue;
    if (companyProperties(state, c.id).length >= c.properties.length + cfg.maxExtraProperties) continue;
    if (rng() >= cfg.buyChance) continue;
    const country = companyCountry(c);
    const budget = s.cash * cfg.buyCashRatio;
    const cands = (PROPERTIES as readonly PropertyDef[]).filter((p) => {
      if (propertyOwner(state, p.id).type !== 'market') return false;
      const price = propertyPrice(state, p.id);
      if (price > budget) return false;
      if (country && CITY_MAP[p.city].country !== country) return false;
      return true;
    });
    if (cands.length === 0) continue;
    // 高いものほど買いたい（大きな会社ほど一等地を取る）
    cands.sort((a, b) => propertyPrice(state, b.id) - propertyPrice(state, a.id));
    const pick = cands[Math.min(cands.length - 1, Math.floor(rng() * Math.min(3, cands.length)))];
    const price = propertyPrice(state, pick.id);
    s.cash -= price;
    state.estate.companyOwned[pick.id] = c.id;
    resetCompanyOwnedIndex();
    onMarket -= 1;
    changed = true;
    const held = ownershipOf(state, c.id) > 0;
    ctx.emit(held ? 'info' : 'event', `${c.name}が${pick.name}を取得しました（${Math.round(price).toLocaleString('ja-JP')}円）`, { toast: held });
  }
  if (changed) computeStocks(ctx);
}

function rivalsIssueShares(ctx: EngineContext): void {
  const { state, rng } = ctx;
  const cfg = CONFIG.rivals;
  let changed = false;
  for (const c of COMPANIES as readonly CompanyDef[]) {
    const s = state.stocks.companies[c.id];
    if (!s || s.dissolved || s.policy !== 'growth') continue;
    const own = ownershipOf(state, c.id);
    if (own + 1e-9 >= CONTROL_RATIO) continue; // 経営権を持っていれば増資を止められる
    if (rng() >= cfg.issueChance) continue;
    const before = sharesOf(state, c.id);
    const add = Math.max(1, Math.round(before * cfg.issueRatio));
    const price = fundamentalPrice(state, COMPANY_MAP[c.id as keyof typeof COMPANY_MAP]);
    s.extraShares = (s.extraShares ?? 0) + add;
    s.cash += add * price; // 新株の代金は会社の現金になる（1株あたりの価値はほぼ変わらない）
    changed = true;
    if (own > 0) {
      const after = ownershipOf(state, c.id);
      ctx.emit('warn', `${c.name}が${(cfg.issueRatio * 100).toFixed(0)}%増資。持株比率 ${(own * 100).toFixed(1)}% → ${(after * 100).toFixed(1)}%（経営権を取る前に増資されると必要な株数が増えます）`, { toast: true });
    }
  }
  if (changed) computeStocks(ctx);
}

/** 物件の名前（通知用） */
export function propertyName(id: string): string {
  return isPropertyId(id) ? PROPERTY_MAP[id].name : id;
}
