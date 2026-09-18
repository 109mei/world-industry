import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { GAMES, GAME_MAP, ROULETTE_RED, ROULETTE_WHEEL, SLOT_BY_LABEL, SLOT_FALLBACK_ICON, SLOT_SYMBOLS, betOf, betReturn, expectedReturn } from '@/game/data/gambling';

let clock = 1_000_000;

function makeEngine(cash: number, rng: () => number = () => 0.42) {
  clock = 1_000_000;
  const e = new GameEngine({ rng, now: () => clock });
  e.updateSettings({ events: false });
  e.state.research.completed.gaming_license = true;
  e.debugAddCash(cash);
  e.refreshDerived();
  return e;
}

describe('賭け事のデータ', () => {
  it('どの賭け方も確率の合計が1になる', () => {
    for (const g of GAMES) {
      for (const b of g.bets) {
        const sum = b.outcomes.reduce((a, o) => a + o.p, 0);
        expect(sum, `${g.id}:${b.id}`).toBeCloseTo(1, 6);
      }
    }
  });

  it('どの賭け方も、長く遊べば必ず減る（期待値が1未満）', () => {
    for (const g of GAMES) {
      for (const b of g.bets) {
        expect(betReturn(b), `${g.id}:${b.id}`).toBeLessThan(1);
      }
      expect(expectedReturn(g), g.id).toBeLessThan(1);
    }
  });

  it('ルーレットはどの賭け方でも胴元の取り分が同じ', () => {
    const rets = GAME_MAP.roulette.bets.map((b) => betReturn(b));
    for (const r of rets) expect(r).toBeCloseTo(36 / 37, 6);
  });

  it('ルーレットの盤は0を含む37個で、赤は18個', () => {
    expect(ROULETTE_WHEEL.length).toBe(37);
    expect(new Set(ROULETTE_WHEEL).size).toBe(37);
    expect(ROULETTE_RED.length).toBe(18);
    for (const n of ROULETTE_RED) expect(ROULETTE_WHEEL).toContain(n);
  });

  it('当たりの出目には必ず絵柄が割り当ててある（はずれは揃わない並びで表す）', () => {
    for (const o of GAME_MAP.slot.bets[0].outcomes) {
      if (o.payout <= 0) {
        // はずれ：専用の絵柄は持たない
        expect(SLOT_BY_LABEL[o.label], o.label).toBeUndefined();
        continue;
      }
      expect(SLOT_BY_LABEL[o.label], o.label).toBeTruthy();
    }
    for (const s of SLOT_SYMBOLS) {
      expect(SLOT_FALLBACK_ICON[s.id], s.id).toBeTruthy();
    }
  });

  it('賭け方は id で選べて、なければ最初のものになる', () => {
    expect(betOf(GAME_MAP.roulette, 'straight').id).toBe('straight');
    expect(betOf(GAME_MAP.roulette, 'nope').id).toBe(GAME_MAP.roulette.bets[0].id);
    expect(betOf(GAME_MAP.slot).id).toBe('spin');
  });
});

describe('遊ぶ', () => {
  it('研究が終わっていないと遊べない', () => {
    const e = makeEngine(10_000_000);
    (e.state.research.completed as Record<string, boolean>).gaming_license = false;
    expect(e.playGame('slot').ok).toBe(false);
  });

  it('選んだ賭け方が結果に入る', () => {
    const e = makeEngine(1_000_000_000);
    const r = e.playGame('roulette', 'straight');
    expect(r.ok).toBe(true);
    expect(r.betId).toBe('straight');
  });

  it('一点賭けは当たりにくく、当たると大きい', () => {
    // 出目は確率の順に並んでいる。0.5 は最初のはずれ、0.99 は最後の1/37に入る
    const lose = makeEngine(1_000_000_000, () => 0.5).playGame('roulette', 'straight');
    const win = makeEngine(1_000_000_000, () => 0.99).playGame('roulette', 'straight');
    expect(lose.payout).toBe(0);
    expect(win.payout).toBe(win.bet * 36);
    expect(win.won).toBe(true);
  });

  it('バカラの引き分けは賭け金が返ってくるだけ（勝ちではない）', () => {
    // プレイヤーに賭けて、2番目の出目（引き分け）を引く乱数
    const e = makeEngine(1_000_000_000, () => 0.5);
    const r = e.playGame('cards', 'player');
    expect(r.ok).toBe(true);
    expect(r.label).toContain('引き分け');
    expect(r.payout).toBe(r.bet);
    expect(r.won).toBe(false);
    expect(r.push).toBe(true);
  });

  it('たくさん遊べば、返ってくる額は賭けた額より少なくなる', () => {
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const e = makeEngine(50_000_000_000, rng);
    for (let i = 0; i < 4000; i++) e.playGame('slot');
    const bet = e.state.stats.gambleBet ?? 0;
    const won = e.state.stats.gambleWon ?? 0;
    expect(bet).toBeGreaterThan(0);
    expect(won / bet).toBeLessThan(1.1);
    expect(won / bet).toBeGreaterThan(0.6);
  });
});
