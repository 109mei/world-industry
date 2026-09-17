import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { PRESTIGE_UPGRADES, upgradeCost } from '@/game/data/prestigeTree';
import { availablePoints, spentPoints, startingCash } from '../systems/prestige';
import { computeModifiers } from '../systems/modifiers';

function makeEngine() {
  const e = new GameEngine({ now: () => 1_000_000 });
  e.updateSettings({ events: false });
  return e;
}

describe('永続アップグレード', () => {
  it('ポイントがないと買えない', () => {
    const e = makeEngine();
    expect(availablePoints(e.state)).toBe(0);
    expect(e.buyPrestigeUpgrade('production')).toBe(false);
  });

  it('買うとポイントが減り、効果が出る', () => {
    const e = makeEngine();
    e.state.prestige.points = 10;
    expect(e.buyPrestigeUpgrade('production')).toBe(true);
    expect(spentPoints(e.state)).toBe(upgradeCost('production', 0));
    const m = computeModifiers(e.state);
    expect(m.production.PROCESSING).toBeGreaterThan(1);
  });

  it('最大まで上げるとそれ以上は買えない', () => {
    const e = makeEngine();
    e.state.prestige.points = 999;
    const def = PRESTIGE_UPGRADES.find((u) => u.id === 'relation')!;
    for (let i = 0; i < def.maxLevel; i++) expect(e.buyPrestigeUpgrade('relation')).toBe(true);
    expect(e.buyPrestigeUpgrade('relation')).toBe(false);
  });

  it('知らないアップグレードは買えない', () => {
    const e = makeEngine();
    e.state.prestige.points = 50;
    expect(e.buyPrestigeUpgrade('nope')).toBe(false);
  });

  it('開業資金・採集・売値・オフラインに効く', () => {
    const e = makeEngine();
    e.state.prestige.points = 200;
    e.buyPrestigeUpgrade('start_cash');
    e.buyPrestigeUpgrade('gather');
    e.buyPrestigeUpgrade('sell_price');
    e.buyPrestigeUpgrade('offline');
    expect(startingCash(e.state)).toBe(500_000);
    const m = computeModifiers(e.state);
    expect(m.gatherAmount).toBeGreaterThan(1);
    expect(m.sellPrice).toBeGreaterThan(1);
    expect(m.offlineBonusSec).toBe(7200);
  });

  it('再出発してもアップグレードは残る', () => {
    const e = makeEngine();
    e.state.prestige.points = 20;
    e.buyPrestigeUpgrade('production');
    e.debugAddCash(2_000_000_000);
    e.tick(1);
    const before = e.state.prestige.upgrades?.production ?? 0;
    expect(e.prestige()).toBe(true);
    expect(e.state.prestige.upgrades?.production).toBe(before);
    expect(e.state.prestige.count).toBe(1);
  });
});
