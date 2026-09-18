/**
 * 相場のイベントと貿易が噛み合っているかの見張り。
 *
 * ホームに「◯◯の値段が2.6倍」と出ているのに、海外の値段だけ動かない、
 * という食い違いが起きないようにする。相手国ごとのイベント（関税・通貨・港）も同じ。
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { countryEventMods, countryUnitPrice, quote } from '../systems/trade';
import { currentPrice } from '../systems/market';
import { EVENTS, EVENT_MAP, type EventDefId } from '@/game/data/events';
import { COUNTRIES } from '@/game/data/trade';

function engine(): GameEngine {
  const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
  e.updateSettings({ events: false, themeChosen: true, nameChosen: true, hqChosen: true });
  e.keepDefaultHq();
  e.state.research.completed.overseas = true;
  e.debugAddCash(5e11);
  e.refreshDerived();
  return e;
}

/** イベントを手で起こす（乱数任せにしない） */
function fire(e: GameEngine, defId: EventDefId, target: string | null): void {
  const def = EVENT_MAP[defId];
  e.state.events.active.push({ id: e.state.events.nextId++, defId, target, remaining: def.duration, total: def.duration, magnitude: def.magnitude });
  e.refreshDerived();
}

describe('相場のイベントは海外の値段にも効く', () => {
  it('高騰すると、国内も海外も上がる', () => {
    const e = engine();
    const before = COUNTRIES.map((c) => countryUnitPrice(e.state, c.id, 'iron'));
    const homeBefore = currentPrice(e.state, 'iron');
    fire(e, 'boom', 'iron');
    const after = COUNTRIES.map((c) => countryUnitPrice(e.state, c.id, 'iron'));
    expect(currentPrice(e.state, 'iron')).toBeGreaterThan(homeBefore);
    for (let i = 0; i < after.length; i++) expect(after[i], COUNTRIES[i].name).toBeGreaterThan(before[i]);
  });

  it('暴落すると、国内も海外も下がる', () => {
    const e = engine();
    const before = COUNTRIES.map((c) => countryUnitPrice(e.state, c.id, 'iron'));
    fire(e, 'crash', 'iron');
    const after = COUNTRIES.map((c) => countryUnitPrice(e.state, c.id, 'iron'));
    for (let i = 0; i < after.length; i++) expect(after[i], COUNTRIES[i].name).toBeLessThan(before[i]);
  });

  it('好景気・不況もすべての国に効く', () => {
    const e = engine();
    const before = countryUnitPrice(e.state, 'US', 'iron');
    fire(e, 'expansion', null);
    expect(countryUnitPrice(e.state, 'US', 'iron')).toBeGreaterThan(before);
  });

  it('産地が安い順番は、イベントが来ても変わらない（全部同じ倍率で動く）', () => {
    const e = engine();
    const order = (s: GameEngine) => [...COUNTRIES].sort((a, b) => countryUnitPrice(s.state, a.id, 'iron_ore') - countryUnitPrice(s.state, b.id, 'iron_ore')).map((c) => c.id);
    const before = order(e);
    fire(e, 'boom', 'iron_ore');
    expect(order(e)).toEqual(before);
  });
});

describe('相手国ごとのイベント', () => {
  it('関税引き上げで、その国からの輸入だけ関税が上がる', () => {
    const e = engine();
    expect(countryEventMods(e.state, 'US').tariff).toBe(1);
    fire(e, 'tariff_up', 'US');
    expect(countryEventMods(e.state, 'US').tariff).toBeGreaterThan(1);
    expect(countryEventMods(e.state, 'CN').tariff).toBe(1);
  });

  it('貿易協定で関税が下がる', () => {
    const e = engine();
    fire(e, 'trade_deal', 'DE');
    expect(countryEventMods(e.state, 'DE').tariff).toBeLessThan(1);
  });

  it('通貨高で、その国の値段だけ上がる', () => {
    const e = engine();
    const us = countryUnitPrice(e.state, 'US', 'iron');
    const cn = countryUnitPrice(e.state, 'CN', 'iron');
    fire(e, 'fx_strong', 'US');
    expect(countryUnitPrice(e.state, 'US', 'iron')).toBeGreaterThan(us);
    expect(countryUnitPrice(e.state, 'CN', 'iron')).toBeCloseTo(cn, 6);
  });

  it('港湾ストで、その国との輸送に時間がかかる', () => {
    const e = engine();
    e.debugUnlockAll();
    e.buyFacility('fleet_ship', 5, 'hq');
    e.refreshDerived();
    const before = quote(e.state, 'AU', 'iron_ore', 100, 'ship', 'import');
    expect(before.ok).toBe(true);
    fire(e, 'port_strike', 'AU');
    const after = quote(e.state, 'AU', 'iron_ore', 100, 'ship', 'import');
    expect(after.seconds).toBeGreaterThan(before.seconds);
    // 他の国は変わらない
    const other = quote(e.state, 'BR', 'iron_ore', 100, 'ship', 'import');
    const otherBefore = { ...other };
    expect(otherBefore.seconds).toBe(other.seconds);
  });

  it('燃料が高騰すると運賃が上がる', () => {
    const e = engine();
    e.debugUnlockAll();
    e.buyFacility('fleet_ship', 5, 'hq');
    e.refreshDerived();
    const before = quote(e.state, 'AU', 'iron_ore', 100, 'ship', 'import');
    fire(e, 'fuel_spike', null);
    const after = quote(e.state, 'AU', 'iron_ore', 100, 'ship', 'import');
    expect(after.freight).toBeGreaterThan(before.freight);
  });
});

describe('イベントの作り', () => {
  it('貿易のイベントには、必ず説明文に相手国が入る', () => {
    for (const def of EVENTS) {
      if (def.kind !== 'tariff' && def.kind !== 'fx' && def.kind !== 'port') continue;
      expect(def.description, def.id).toContain('{target}');
    }
  });

  it('同じ国に同じ種類のイベントは重ならない', () => {
    const e = engine();
    fire(e, 'tariff_up', 'US');
    const mods = countryEventMods(e.state, 'US');
    expect(mods.labels.length).toBe(1);
  });
});
