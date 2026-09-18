/**
 * はじめかた（チュートリアル）の点検。
 *
 * 「押す場所」がすべての手順に書いてあるか、順番どおりに一歩ずつ進むか、
 * そして途中で消えたり飛ばされたりしないかを確かめる。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TUTORIAL_STEPS } from '@/game/data/tutorial';
import { GameEngine } from '../GameEngine';
import { createInitialState } from '../state/createInitialState';
import { previewGather } from '../actions/gather';

let clock = 1_000_000;

function makeEngine() {
  clock = 1_000_000;
  const e = new GameEngine({ rng: () => 0.42, now: () => clock });
  e.keepDefaultHq();
  e.updateSettings({ events: false });
  e.refreshDerived();
  return e;
}

describe('はじめかたの手順', () => {
  it('id が重複していない', () => {
    const ids = new Set(TUTORIAL_STEPS.map((s) => s.id));
    expect(ids.size).toBe(TUTORIAL_STEPS.length);
  });

  it('すべての手順に、やること・なぜ・押す場所が書いてある', () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.title.length, s.id).toBeGreaterThan(2);
      expect(s.text.length, s.id).toBeGreaterThan(8);
      expect(s.where, s.id).toBeTruthy();
      // 「押す場所」は画面の名前を › でつないだ形にそろえてある
      expect(s.where, s.id).toMatch(/›|ホーム|クラフト|施設|研究|地図/);
    }
  });

  it('最初の状態では、どの手順もまだ終わっていない', () => {
    const s = createInitialState();
    expect(TUTORIAL_STEPS[0].check(s)).toBe(false);
  });

  it('「集めた素材を売ってみる」がある', () => {
    const sell = TUTORIAL_STEPS.find((s) => s.id === 'sell');
    expect(sell).toBeTruthy();
    expect(sell!.title).toContain('売');
    expect(sell!.where).toContain('資源');
    // 売って現金が入ったら終わり
    const e = makeEngine();
    expect(sell!.check(e.state)).toBe(false);
    e.state.company.totalEarned = 10;
    expect(sell!.check(e.state)).toBe(true);
  });

  it('石を拾うと最初の手順が進み、飛び越えない', () => {
    const e = makeEngine();
    expect(e.state.tutorial.step).toBe(0);
    for (let i = 0; i < 3; i++) e.gather('gather_stone');
    e.tick(0.1);
    expect(e.state.tutorial.step).toBe(1);
    expect(e.state.tutorial.completed).toBe(false);
  });

  it('手順を全部終えると完了になり、そこで止まる', () => {
    const e = makeEngine();
    // 実際の達成条件を無視して、進行だけを最後まで回す
    e.state.tutorial.step = TUTORIAL_STEPS.length;
    e.tick(0.1);
    expect(e.state.tutorial.completed).toBe(true);
    const before = e.state.tutorial.step;
    e.tick(1);
    expect(e.state.tutorial.step).toBe(before);
  });

  it('進み具合を出す手順は、目標を超えた値を返さない', () => {
    const e = makeEngine();
    for (let i = 0; i < 50; i++) e.gather('gather_stone');
    for (const s of TUTORIAL_STEPS) {
      const p = s.progress?.(e.state);
      if (!p) continue;
      expect(p.target, s.id).toBeGreaterThan(0);
      expect(p.current, s.id).toBeLessThanOrEqual(p.target);
      expect(p.current, s.id).toBeGreaterThanOrEqual(0);
    }
  });
});

/**
 * 古いセーブに「もう無い採集」が残っていると、自動採集の巡回がそこで落ちて
 * ゲームごと開けなくなる。読み込みで落とすのと、万一残っても黙って飛ばすのと、両方で守る。
 */
describe('もう無い採集を指されても落ちない', () => {
  it('知らない採集は「できない」として返る', () => {
    const e = makeEngine();
    const p = previewGather(e.state, 'nope_gather' as never);
    expect(p.available).toBe(false);
    expect(p.amount).toBe(0);
    expect(e.gather('nope_gather' as never)).toBe(0);
  });

  it('自動採集にまぎれこんでいても、tick は止まらない', () => {
    const e = makeEngine();
    e.state.automation.on.gather = true;
    e.state.automation.gathers = ['gather_stone', 'nope_gather' as never];
    e.state.research.completed.basic_automation = true;
    expect(() => {
      for (let i = 0; i < 20; i++) e.tick(1);
    }).not.toThrow();
  });
});

/**
 * 案内に書いたボタン名が、画面に無い名前だと道案内にならない。
 * （「売る」と書いてあるのに、実際のボタンは「1個売る」だった、という取りこぼしが実際にあった）
 * ここでは where に並べたボタン名が、画面を作っているコードに文字として在ることを確かめる。
 */
describe('押す場所に書いたボタンが、画面に実在する', () => {
  /** 画面に出る文字が入っているソースを全部つなげたもの（画面の部品と、名前を決めているデータ） */
  function uiSource(): string {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(readFileSync(p, 'utf8'));
      }
    };
    // 画面の部品
    walk(resolve(__dirname, '../../../features'));
    // 施設・道具・採集などの名前
    walk(resolve(__dirname, '../../data'));
    // 画面の切替（ホーム／資源 など）の名前
    out.push(readFileSync(resolve(__dirname, '../../../types/ui.ts'), 'utf8'));
    // 案内そのものは、自分で自分を証明してしまうので外す
    return out.filter((t) => !t.includes('TUTORIAL_STEPS: TutorialStepDef[]')).join('\n');
  }

  it('where のボタン名がソースに見つかる', () => {
    const src = uiSource();
    const missing: string[] = [];
    for (const step of TUTORIAL_STEPS) {
      for (const part of (step.where ?? '').split('›')) {
        for (const name of part.split('/')) {
          const t = name.trim();
          if (!t) continue;
          // 「〜をタップ」は特定のボタンではなく、場所の指し示し
          if (t.endsWith('をタップ')) continue;
          if (!src.includes(t)) missing.push(`${step.id}: ${t}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
