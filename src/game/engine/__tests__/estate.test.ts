import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { CITIES } from '@/game/data/cities';
import { COMPANIES, COMPANY_MAP, CONTROL_RATIO } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { GAME_META } from '@/game/data/meta';
import { PROPERTIES, PROPERTY_MAP, propertyYield } from '@/game/data/properties';
import { propertyBuyCost, propertyOwner, propertyPrice } from '../systems/estate';
import { acquireCost, expandCost, hasControl, liquidationValue, sharesToControl, stockPrice } from '../systems/stocks';
import { migrateSave } from '../state/migrations';
import { createInitialState } from '../state/createInitialState';

function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeEngine(cash = 0) {
  const e = new GameEngine({ rng: seeded(), now: () => 1_000_000 });
  e.updateSettings({ events: false });
  if (cash > 0) e.debugAddCash(cash);
  return e;
}

describe('データの整合性', () => {
  it('物件の都市・会社の物件がすべて定義されている', () => {
    const cityIds = new Set(CITIES.map((c) => c.id as string));
    for (const p of PROPERTIES) expect(cityIds.has(p.city)).toBe(true);
    const propIds = new Set(PROPERTIES.map((p) => p.id as string));
    const seen = new Set<string>();
    for (const c of COMPANIES) {
      for (const p of c.properties) {
        expect(propIds.has(p)).toBe(true);
        // 同じ物件を2社が持たない
        expect(seen.has(p)).toBe(false);
        seen.add(p);
      }
    }
    // ID の重複なし
    expect(propIds.size).toBe(PROPERTIES.length);
    expect(new Set(COMPANIES.map((c) => c.id)).size).toBe(COMPANIES.length);
  });

  it('価格と利回りが正の値で、いちばん安い物件は解放直後に買える', () => {
    let min = Infinity;
    for (const p of PROPERTIES) {
      expect(p.price).toBeGreaterThan(0);
      expect(propertyYield(p)).toBeGreaterThan(0);
      min = Math.min(min, p.price);
    }
    expect(min * (1 + CONFIG.estate.buyFee)).toBeLessThanOrEqual(CONFIG.estate.unlockAssets);
  });
});

describe('不動産', () => {
  it('総資産が足りないと解放されず、買えない', () => {
    const e = makeEngine(1_000_000);
    expect(e.isEstateUnlocked()).toBe(false);
    expect(e.buyProperty('iz_house_lot')).toBe(false);
  });

  it('物件を買うと手数料込みで支払い、賃料が入り、総資産に評価額が含まれる', () => {
    const e = makeEngine(20_000_000);
    e.tick(1);
    expect(e.isEstateUnlocked()).toBe(true);
    const cost = propertyBuyCost(e.state, 'iz_shop');
    expect(cost).toBe(Math.ceil(12_000_000 * 1.03));
    const before = e.state.company.cash;
    expect(e.buyProperty('iz_shop')).toBe(true);
    expect(e.state.company.cash).toBeCloseTo(before - cost, 3);
    expect(propertyOwner(e.state, 'iz_shop').type).toBe('player');
    // 同じ物件は二度買えない
    expect(e.buyProperty('iz_shop')).toBe(false);
    // 賃料: 価格 × 利回り / 3600 per 秒
    const cashBefore = e.state.company.cash;
    e.tick(1);
    const expectedRent = (propertyPrice(e.state, 'iz_shop') * PROPERTY_MAP['iz_shop'].kind.length * 0 + propertyPrice(e.state, 'iz_shop') * propertyYield(PROPERTY_MAP['iz_shop'])) / 3600;
    expect(e.state.company.cash - cashBefore).toBeCloseTo(expectedRent, 0);
    expect(e.derived.rentPerSec).toBeCloseTo(expectedRent, 3);
    expect(e.derived.estateValue).toBeCloseTo(propertyPrice(e.state, 'iz_shop'), 3);
    expect(e.derived.assets).toBeGreaterThan(e.state.company.cash);
    expect(e.state.achievements['first_property']).toBeTruthy();
  });

  it('売ると手数料を引いた額が戻り、損益が記録される', () => {
    const e = makeEngine(20_000_000);
    e.tick(1);
    e.buyProperty('iz_house_lot');
    const price = propertyPrice(e.state, 'iz_house_lot');
    const cash = e.state.company.cash;
    const got = e.sellProperty('iz_house_lot');
    expect(got).toBe(Math.floor(price * (1 - CONFIG.estate.sellFee)));
    expect(e.state.company.cash).toBeCloseTo(cash + got, 3);
    expect(propertyOwner(e.state, 'iz_house_lot').type).toBe('market');
    expect(e.state.stats.tradingProfit).toBeLessThan(0); // 往復の手数料ぶん損
  });

  it('会社が持つ物件は買えない', () => {
    const e = makeEngine(1_000_000_000_000);
    e.tick(1);
    expect(propertyOwner(e.state, 'iz_solar_land')).toEqual({ type: 'company', companyId: 'chikuho_energy' });
    expect(e.buyProperty('iz_solar_land')).toBe(false);
  });

  it('地価は時間で動き、上限・下限に収まる', () => {
    const e = makeEngine(20_000_000);
    e.advance(3600 * 5);
    const mults = Object.values(e.state.estate.cityMult);
    expect(mults.length).toBe(CITIES.length);
    expect(mults.some((m) => Math.abs(m - 1) > 0.001)).toBe(true);
    for (const m of mults) {
      expect(m).toBeGreaterThanOrEqual(CONFIG.estate.minMult);
      expect(m).toBeLessThanOrEqual(CONFIG.estate.maxMult);
    }
  });

  it('地価上昇イベントで対象都市の物件が値上がりする', () => {
    const e = makeEngine(20_000_000);
    e.tick(1);
    e.buyProperty('iz_house_lot');
    e.updateSettings({ events: true });
    const before = propertyPrice(e.state, 'iz_house_lot');
    // 対象はプレイヤーの物件がある都市が優先される。何度か試す
    let hit = false;
    for (let i = 0; i < 20 && !hit; i++) {
      const mult = e.state.estate.cityMult['iizuka'];
      if (e.debugTriggerEvent('land_boom') && e.state.estate.cityMult['iizuka'] > mult) hit = true;
    }
    expect(hit).toBe(true);
    expect(propertyPrice(e.state, 'iz_house_lot')).toBeGreaterThan(before);
  });
});

describe('株式', () => {
  it('株を買うと株価が上がり、配当が入る', () => {
    const e = makeEngine(100_000_000);
    e.tick(1);
    const p0 = stockPrice(e.state, 'chikuho_energy');
    expect(p0).toBeCloseTo((30 * 1e8 + propertyPrice(e.state, 'iz_solar_land')) / 1_000_000, 0);
    const bought = e.buyShares('chikuho_energy', 1000);
    expect(bought).toBe(1000);
    const s = e.state.stocks.companies['chikuho_energy'];
    expect(s.playerShares).toBe(1000);
    expect(stockPrice(e.state, 'chikuho_energy')).toBeGreaterThan(p0);
    expect(e.derived.stockValue).toBeGreaterThan(0);
    expect(e.state.achievements['shareholder']).toBeTruthy();
    const cash = e.state.company.cash;
    e.tick(1);
    const rt = e.derived.companies['chikuho_energy'];
    expect(rt.dividendPerSec).toBeGreaterThan(0);
    expect(e.state.company.cash - cash).toBeCloseTo(rt.dividendPerSec, 0);
    expect(e.state.stats.dividendsEarned).toBeGreaterThan(0);
  });

  it('売ると株価が下がり、損益が記録される', () => {
    const e = makeEngine(100_000_000);
    e.tick(1);
    e.buyShares('chikuho_energy', 1000);
    const p1 = stockPrice(e.state, 'chikuho_energy');
    const got = e.sellShares('chikuho_energy', 1000);
    expect(got).toBeGreaterThan(0);
    expect(stockPrice(e.state, 'chikuho_energy')).toBeLessThan(p1);
    expect(e.state.stocks.companies['chikuho_energy'].playerShares).toBe(0);
    // スプレッドと値動きぶんだけ損
    expect(e.state.stats.tradingProfit).toBeLessThan(0);
  });

  it('3分の2を持つと経営権を得て、方針変更・増設・買収ができ、物件を受け取る', () => {
    const e = makeEngine(100_000_000_000);
    e.tick(1);
    const need = sharesToControl(e.state, 'chikuho_energy');
    expect(need).toBe(Math.ceil(1_000_000 * CONTROL_RATIO - 1e-6));
    expect(e.setCompanyPolicy('chikuho_energy', 'growth')).toBe(false);
    expect(e.buyShares('chikuho_energy', need - 1)).toBe(need - 1);
    expect(hasControl(e.state, 'chikuho_energy')).toBe(false);
    expect(e.buyShares('chikuho_energy', 1)).toBe(1);
    expect(hasControl(e.state, 'chikuho_energy')).toBe(true);
    expect(e.state.achievements['controller']).toBeTruthy();
    // 方針
    expect(e.setCompanyPolicy('chikuho_energy', 'growth')).toBe(true);
    expect(e.state.stocks.companies['chikuho_energy'].policy).toBe('growth');
    // 増設
    const g0 = e.state.stocks.companies['chikuho_energy'].growth;
    const cost = expandCost(e.state, 'chikuho_energy');
    const cash = e.state.company.cash;
    expect(e.expandCompany('chikuho_energy')).toBe(true);
    expect(e.state.company.cash).toBeCloseTo(cash - cost, 3);
    expect(e.state.stocks.companies['chikuho_energy'].growth).toBeCloseTo(g0 * 1.1, 6);
    // 買収
    const acq = acquireCost(e.state, 'chikuho_energy');
    expect(acq).toBeGreaterThan(0);
    expect(propertyOwner(e.state, 'iz_solar_land').type).toBe('company');
    expect(e.acquireCompany('chikuho_energy')).toBe(true);
    expect(e.state.stocks.companies['chikuho_energy'].playerShares).toBe(COMPANY_MAP['chikuho_energy'].shares);
    expect(propertyOwner(e.state, 'iz_solar_land').type).toBe('player');
    expect(e.derived.companies['chikuho_energy'].ownership).toBeCloseTo(1, 9);
    expect(e.state.stats.companiesAcquired).toBe(1);
    expect(e.state.achievements['acquirer']).toBeTruthy();
    // 完全子会社の配当は全額
    e.tick(1);
    const rt = e.derived.companies['chikuho_energy'];
    expect(rt.dividendPerSec).toBeCloseTo((rt.earningsPerHour * 0.2) / 3600, 3);
  });

  it('解体すると持株比率ぶんを受け取り、会社の物件は市場に戻る', () => {
    const e = makeEngine(100_000_000_000);
    e.tick(1);
    e.buyShares('genkai_resort', sharesToControl(e.state, 'genkai_resort'));
    expect(hasControl(e.state, 'genkai_resort')).toBe(true);
    const value = liquidationValue(e.state, 'genkai_resort');
    expect(value).toBeGreaterThan(0);
    const cash = e.state.company.cash;
    expect(e.dissolveCompany('genkai_resort')).toBe(true);
    expect(e.state.company.cash).toBeCloseTo(cash + value, 3);
    expect(e.state.stocks.companies['genkai_resort'].dissolved).toBe(true);
    expect(propertyOwner(e.state, 'ok_onna_resort').type).toBe('market');
    expect(stockPrice(e.state, 'genkai_resort')).toBe(0);
    expect(e.buyShares('genkai_resort', 10)).toBe(0);
  });

  it('成長方針では事業価値が増え、株価の理論値が上がる', () => {
    const e = makeEngine(100_000_000_000);
    e.tick(1);
    e.buyShares('chikuho_energy', sharesToControl(e.state, 'chikuho_energy'));
    e.setCompanyPolicy('chikuho_energy', 'growth');
    const f0 = e.derived.companies['chikuho_energy'].fundamental;
    e.advance(3600);
    const f1 = e.derived.companies['chikuho_energy'].fundamental;
    expect(f1).toBeGreaterThan(f0 * 1.02);
  });

  it('株高イベントで株価が上がる', () => {
    const e = makeEngine(100_000_000);
    e.tick(1);
    e.updateSettings({ events: true });
    const p0 = stockPrice(e.state, 'wakaba_foods');
    expect(e.debugTriggerEvent('bull')).toBe(true);
    e.tick(0.2);
    expect(e.derived.eventMods.stock).toBeCloseTo(1.3, 6);
    expect(e.derived.companies['wakaba_foods'].price).toBeGreaterThan(p0 * 1.2);
  });

  it('所持金より多くは買えない', () => {
    const e = makeEngine(5_000_000);
    e.tick(1);
    expect(e.buyShares('nishiki_motors', 1_000_000)).toBe(0);
    const n = e.buyShares('nishiki_motors', 100);
    expect(n).toBe(100);
    expect(e.state.company.cash).toBeGreaterThanOrEqual(0);
  });
});

describe('セーブの移行（v3 → v4）', () => {
  it('v3 のセーブに不動産・株式・テーマが補われる', () => {
    const old = createInitialState() as unknown as Record<string, unknown>;
    old.saveVersion = 3;
    delete old.estate;
    delete old.stocks;
    const settings = old.settings as Record<string, unknown>;
    delete settings.theme;
    const stats = old.stats as Record<string, unknown>;
    delete stats.rentEarned;
    const migrated = migrateSave(old);
    expect(migrated.saveVersion).toBe(GAME_META.saveVersion);
    expect(migrated.settings.theme).toBe('dark');
    expect(migrated.stats.rentEarned).toBe(0);
    expect(Object.keys(migrated.estate.cityMult).length).toBe(CITIES.length);
    expect(migrated.estate.companyOwned['iz_solar_land']).toBe('chikuho_energy');
    expect(Object.keys(migrated.stocks.companies).length).toBe(COMPANIES.length);
    const e = new GameEngine({ state: migrated, rng: seeded() });
    e.tick(1);
    expect(e.derived.companies['chikuho_energy'].price).toBeGreaterThan(0);
  });

  it('プレイヤーが持つ物件は会社所有から外れる', () => {
    const base = createInitialState();
    base.estate.owned['tk_marunouchi_office'] = { boughtAt: 1, boughtPrice: 1 };
    const raw = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    const migrated = migrateSave(raw);
    expect(migrated.estate.companyOwned['tk_marunouchi_office']).toBeUndefined();
  });
});
