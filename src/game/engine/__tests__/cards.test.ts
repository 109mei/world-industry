import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { CARDS, CARD_MAP, CARD_PRICE_MAX, CARD_PRICE_MIN, CARD_SERIES, PACKS, RARITIES, RARITY_MAP, cardsOf } from '@/game/data/cards';
import { cardBuyPrice, cardPrice, cardState, collectionValue, packValue, seriesProgress } from '../systems/cards';

let clock = 1_000_000;

function makeEngine(cash = 0, rng: () => number = () => 0.42) {
  clock = 1_000_000;
  const e = new GameEngine({ rng, now: () => clock });
  e.updateSettings({ events: false });
  e.state.research.completed.card_market = true;
  if (cash > 0) e.debugAddCash(cash);
  e.refreshDerived();
  return e;
}

function lcg(seed = 987654321) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('カードのデータ', () => {
  it('すべてのカードは実在する弾に属する', () => {
    const ids = new Set(CARD_SERIES.map((s) => s.id));
    for (const c of CARDS) {
      expect(ids.has(c.series), c.id).toBe(true);
      expect(RARITY_MAP[c.rarity], c.id).toBeTruthy();
      expect(c.basePrice, c.id).toBeGreaterThan(0);
      expect(c.flavor.length, c.id).toBeGreaterThan(3);
    }
  });

  it('どの弾にも1枚以上あり、id は重複しない', () => {
    const seen = new Set<string>();
    for (const c of CARDS) {
      expect(seen.has(c.id), c.id).toBe(false);
      seen.add(c.id);
    }
    for (const s of CARD_SERIES) expect(cardsOf(s.id).length, s.id).toBeGreaterThan(0);
  });

  it('どのパックも確率の合計が1で、出るカードが必ずある', () => {
    for (const p of PACKS) {
      const sum = Object.values(p.rates).reduce((a, n) => a + (n ?? 0), 0);
      expect(sum, p.id).toBeCloseTo(1, 6);
      for (const [rarity, rate] of Object.entries(p.rates)) {
        if ((rate ?? 0) <= 0) continue;
        const pool = CARDS.filter((c) => c.rarity === rarity && (!p.series || p.series.includes(c.series)));
        expect(pool.length, `${p.id}:${rarity}`).toBeGreaterThan(0);
      }
    }
  });

  it('どのパックも、中身の見込みは値段より安い（開け続けると減る）', () => {
    const e = makeEngine();
    for (const p of PACKS) {
      expect(packValue(e.state, p) / p.cost, p.id).toBeLessThan(1);
    }
  });
});

describe('パックを開ける', () => {
  it('研究していないと開けられない', () => {
    const e = makeEngine(10_000_000);
    (e.state.research.completed as Record<string, boolean>).card_market = false;
    expect(e.openPack('starter').ok).toBe(false);
  });

  it('お金が足りないと開けられない', () => {
    const e = makeEngine(10);
    expect(e.openPack('premium').ok).toBe(false);
  });

  it('開けると枚数ぶん増え、お金が減る', () => {
    const e = makeEngine(10_000_000, lcg());
    const before = e.state.company.cash;
    const r = e.openPack('starter');
    expect(r.ok).toBe(true);
    expect(r.cards.length).toBe(5);
    const cs = cardState(e.state);
    expect(Object.values(cs.owned).reduce((a, n) => a + n, 0)).toBe(5);
    expect(e.state.company.cash).toBeLessThan(before);
    expect(cs.packsOpened).toBe(1);
  });

  it('スターターパックからは第1弾しか出ない', () => {
    const e = makeEngine(100_000_000, lcg(5));
    for (let i = 0; i < 40; i++) e.openPack('starter');
    for (const id of Object.keys(cardState(e.state).owned)) {
      expect(CARD_MAP[id].series, id).toBe('awaken');
    }
  });

  it('たくさん開けても、かけた額より値打ちのほうが小さくなる', () => {
    const e = makeEngine(2_000_000_000, lcg(77));
    for (let i = 0; i < 300; i++) e.openPack('standard');
    const cs = cardState(e.state);
    const value = collectionValue(e.state);
    expect(cs.spent).toBeGreaterThan(0);
    expect(value / cs.spent).toBeLessThan(1);
  });
});

describe('カードの売り買い', () => {
  it('売ると相場が下がり、買い占めると上がる', () => {
    const e = makeEngine(1_000_000_000, lcg(9));
    e.openPack('starter');
    const id = Object.keys(cardState(e.state).owned)[0];
    // まず10枚まで買い足す
    const up0 = cardState(e.state).price[id] ?? 1;
    e.buyCard(id, 10);
    const up1 = cardState(e.state).price[id] ?? 1;
    expect(up1).toBeGreaterThan(up0);
    e.sellCard(id, 8);
    const down = cardState(e.state).price[id] ?? 1;
    expect(down).toBeLessThan(up1);
  });

  it('買値は売値より高いので、買ってすぐ売ると損をする', () => {
    const e = makeEngine(1_000_000_000);
    const id = CARDS[0].id;
    expect(cardBuyPrice(e.state, id)).toBeGreaterThan(cardPrice(e.state, id));
    const before = e.state.company.cash;
    e.buyCard(id, 5);
    e.sellCard(id, 5);
    expect(e.state.company.cash).toBeLessThan(before);
  });

  it('持っていないカードは売れない', () => {
    const e = makeEngine(1_000_000);
    expect(e.sellCard(CARDS[0].id, 1).ok).toBe(false);
  });

  it('相場は決まった幅を出ない', () => {
    const e = makeEngine(10_000_000_000, lcg(31));
    const id = CARDS[0].id;
    for (let i = 0; i < 300; i++) e.buyCard(id, 5);
    expect(cardState(e.state).price[id]).toBeLessThanOrEqual(CARD_PRICE_MAX);
    for (let i = 0; i < 400; i++) e.sellCard(id, 5);
    expect(cardState(e.state).price[id] ?? 1).toBeGreaterThanOrEqual(CARD_PRICE_MIN);
  });
});

describe('図鑑', () => {
  it('そろうまでは見返りを受け取れない', () => {
    const e = makeEngine(1_000_000);
    expect(e.claimCardSeries('awaken').ok).toBe(false);
  });

  it('そろえると研究ポイントがもらえて、二度はもらえない', () => {
    const e = makeEngine(10_000_000_000);
    for (const c of cardsOf('awaken')) cardState(e.state).owned[c.id] = 1;
    const p = seriesProgress(e.state).find((s) => s.id === 'awaken')!;
    expect(p.complete).toBe(true);
    const before = e.state.research.points;
    const r = e.claimCardSeries('awaken');
    expect(r.ok).toBe(true);
    expect(e.state.research.points).toBe(before + p.reward);
    expect(e.claimCardSeries('awaken').ok).toBe(false);
  });
});

describe('カードの相場が時間で動く', () => {
  it('熱（はやり）は決まった幅に収まる', () => {
    const e = makeEngine(10_000_000, lcg(4));
    e.openPack('starter');
    for (let i = 0; i < 2000; i++) e.tick(1);
    const cs = cardState(e.state);
    expect(cs.hype).toBeGreaterThanOrEqual(0.5);
    expect(cs.hype).toBeLessThanOrEqual(2.4);
    for (const v of Object.values(cs.price)) {
      expect(v).toBeGreaterThanOrEqual(CARD_PRICE_MIN);
      expect(v).toBeLessThanOrEqual(CARD_PRICE_MAX);
    }
  });
});

describe('モンスターカード100種', () => {
  it('ちょうど100種あり、番号は1から100まで抜けがない', () => {
    expect(CARDS.length).toBe(100);
    const nos = CARDS.map((c) => c.no).sort((a, b) => a - b);
    expect(nos).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it('名前が重複していない', () => {
    const names = new Set(CARDS.map((c) => c.name));
    expect(names.size).toBe(100);
  });

  /** 絵に描いてあるレア度の枚数。ここが変わったら絵か表のどちらかがずれている */
  it('レア度の枚数が絵のとおりになっている', () => {
    const count: Record<string, number> = {};
    for (const c of CARDS) count[c.rarity] = (count[c.rarity] ?? 0) + 1;
    expect(count).toEqual({ n: 12, r: 14, sr: 12, ssr: 7, ar: 10, sar: 9, ur: 14, lr: 22 });
  });

  it('番号が上がるほどレア度は下がらない（076と080のLRだけが例外）', () => {
    const order = RARITIES.map((r) => r.id);
    const sorted = [...CARDS].sort((a, b) => a.no - b.no);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.no === 76 || prev.no === 80) continue; // 飛び番のLRの次は UR に戻る
      expect(order.indexOf(cur.rarity), `${prev.no}->${cur.no}`).toBeGreaterThanOrEqual(order.indexOf(prev.rarity));
    }
  });

  it('レア度が上がるほど基準の値段も上がる', () => {
    const prices = RARITIES.map((r) => Math.round(400 * r.priceMult));
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1]);
  });

  it('100枚ぶんの絵のファイルが実際に置いてある', () => {
    const dir = resolve(__dirname, '../../../../public/assets/cards');
    for (const c of CARDS) {
      expect(existsSync(resolve(dir, `${c.art}.webp`)), `${c.id} (${c.name})`).toBe(true);
    }
  });
});
