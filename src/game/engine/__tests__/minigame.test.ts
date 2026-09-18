/**
 * 手仕事のミニゲームと、そこで伸びる腕（熟練度）。
 *
 * 出来（score）は画面側が出す数なので、そこが壊れてもゲームが壊れないことを見張る。
 * 「腕は下がらない」「無限には強くならない」「4つとも別の意味がある」の3つが要。
 */
import { describe, expect, it } from 'vitest';
import { BONUS_SCORE, MINIGAMES, MINIGAME_MAP, SKILLS, SKILL_MAP, expFromScore, expToNext, rewardMultiplier, type SkillId } from '@/game/data/minigames';
import { RESOURCE_MAP } from '@/game/data/resources';
import { FACILITY_MAP } from '@/game/data/facilities';
import { WAGE_PER_EMPLOYEE } from '../systems/finance';
import { createBaseModifiers, applySkills } from '../systems/modifiers';
import { isMinigameUnlocked, skillOf, skillProgress, totalSkillLevel } from '../systems/minigame';
import { GameEngine } from '../GameEngine';
import { deserializeState, serializeState } from '@/game/services/save/SaveService';
import type { GameState } from '@/types/state';

function makeEngine() {
  const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
  e.updateSettings({ events: false });
  e.refreshDerived();
  return e;
}

/** その腕をレベル lv まで上げた状態を作る（判定を通さず、状態だけ置く） */
function withSkill(id: SkillId, lv: number): GameState {
  const e = makeEngine();
  e.state.skills = { [id]: { level: lv, exp: 0, plays: 0, best: 0 } };
  return e.state;
}

describe('ミニゲームの出来', () => {
  it('出来は 0〜1 に必ず収まる（画面がおかしな数を渡しても壊れない）', () => {
    for (const bad of [5, 100, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const e = makeEngine();
      const r = e.playMinigame('timing', bad);
      expect(r.ok).toBe(true);
      // 満点でも1回で入るのは 10 まで
      expect(r.exp).toBeLessThanOrEqual(10);
      expect(r.exp).toBeGreaterThanOrEqual(0);
      expect(skillOf(e.state, 'handling').best).toBeLessThanOrEqual(1);
      expect(Number.isFinite(skillOf(e.state, 'handling').exp)).toBe(true);
    }
  });

  it('雑にこなしても伸びない（半分の出来では満点の4分の1しか入らない）', () => {
    expect(expFromScore(1)).toBe(10);
    expect(expFromScore(0.5)).toBeCloseTo(2.5, 5);
    expect(expFromScore(0)).toBe(0);
  });

  it('遊ぶと経験値が入り、貯まるとレベルが上がる', () => {
    const e = makeEngine();
    const need = expToNext(0);
    let levelUps = 0;
    // 満点を続ければ、必要な回数でちょうど上がる
    for (let i = 0; i < Math.ceil(need / 10); i++) levelUps += e.playMinigame('timing', 1).levelUp;
    expect(levelUps).toBe(1);
    expect(skillOf(e.state, 'handling').level).toBe(1);
    expect(skillOf(e.state, 'handling').plays).toBe(Math.ceil(need / 10));
  });

  it('腕は下がらない（下手に遊んでもレベルは減らない）', () => {
    const e = makeEngine();
    for (let i = 0; i < 40; i++) e.playMinigame('timing', 1);
    const before = skillOf(e.state, 'handling').level;
    expect(before).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) e.playMinigame('timing', 0);
    expect(skillOf(e.state, 'handling').level).toBe(before);
  });

  it('頭打ちがある（無限に遊んでも無限には強くならない）', () => {
    const e = makeEngine();
    const max = SKILL_MAP.handling.maxLevel;
    for (let i = 0; i < 5000; i++) e.playMinigame('timing', 1);
    expect(skillOf(e.state, 'handling').level).toBe(max);
    expect(skillProgress(e.state, 'handling')).toBe(1);
    // 極めたあとは経験値を貯めない（増え続ける数字を残さない）
    expect(skillOf(e.state, 'handling').exp).toBe(0);
  });

  it('出来に応じて素材が入る', () => {
    const e = makeEngine();
    const def = MINIGAME_MAP.timing;
    const before = e.state.inventory[def.reward] ?? 0;
    const r = e.playMinigame('timing', 1);
    expect(r.gained).toBeCloseTo(def.rewardMax, 5);
    expect((e.state.inventory[def.reward] ?? 0) - before).toBeCloseTo(def.rewardMax, 5);
    // 出来が半分なら量も半分
    const half = makeEngine().playMinigame('timing', 0.5);
    expect(half.gained).toBeCloseTo(def.rewardMax * 0.5, 5);
  });

  it('腕が上がるほど多く持ち帰れる', () => {
    expect(rewardMultiplier(0)).toBe(1);
    expect(rewardMultiplier(20)).toBeCloseTo(3, 5);
    const e = makeEngine();
    e.state.skills = { handling: { level: SKILL_MAP.handling.maxLevel, exp: 0, plays: 1, best: 1 } };
    e.refreshDerived();
    const r = e.playMinigame('timing', 1);
    expect(r.gained).toBeCloseTo(MINIGAME_MAP.timing.rewardMax * rewardMultiplier(SKILL_MAP.handling.maxLevel), 5);
  });

  it('おまけは出来が良かったときだけ出る', () => {
    const def = MINIGAME_MAP.sort;
    expect(def.bonus, '廃品の仕分けにおまけが無い').toBeTruthy();
    // 解放してから遊ぶ（鉄くずを10kg以上入手している必要がある）
    const open = () => {
      const e = makeEngine();
      e.state.stats.totalObtained.scrap_metal = 100;
      e.refreshDerived();
      return e;
    };
    const low = open().playMinigame('sort', BONUS_SCORE - 0.01);
    expect(low.ok).toBe(true);
    expect(low.bonus, 'ぎりぎり届いていないのにおまけが出た').toBeUndefined();
    const high = open().playMinigame('sort', 1);
    expect(high.bonus?.id).toBe(def.bonus);
    expect(high.bonus?.amount).toBeCloseTo(def.bonusMax!, 5);
  });

  it('遊び続けるより、施設を建てるほうがずっと強い（延々と回すのが最適解にならない）', () => {
    // 工具工房1棟が1分で稼ぐ額（材料費と人件費を引いたあと）
    const w = FACILITY_MAP.tool_workshop;
    const val = (m: Record<string, number> | undefined) =>
      Object.entries(m ?? {}).reduce((a, [k, v]) => a + v * (RESOURCE_MAP[k as keyof typeof RESOURCE_MAP]?.basePrice ?? 0), 0);
    const perMinute = (val(w.production!.outputs) - val(w.production!.inputs) - (w.employees ?? 0) * WAGE_PER_EMPLOYEE) * 60;
    expect(perMinute).toBeGreaterThan(0);

    for (const g of MINIGAMES) {
      const skill = SKILL_MAP[g.skill];
      const mult = rewardMultiplier(skill.maxLevel);
      // 腕を極めた人が満点を取ったときの値打ち
      const best =
        g.rewardMax * mult * RESOURCE_MAP[g.reward].basePrice +
        (g.bonus && g.bonusMax ? g.bonusMax * mult * RESOURCE_MAP[g.bonus].basePrice : 0);
      // 1回およそ20〜30秒なので、1分あたりは多めに見て2回ぶん
      expect(best * 2, `${g.name}が工具工房より稼げてしまう`).toBeLessThan(perMinute);
    }
  });

  it('それでも、手で拾い続けるよりは実入りが良い（遊ぶ意味がある）', () => {
    // 同じ時間だけ手で拾った場合。1タップ1kg、毎秒2回、25秒ぶん
    const byHand = 50;
    for (const g of MINIGAMES) {
      const best = g.rewardMax * RESOURCE_MAP[g.reward].basePrice + (g.bonus && g.bonusMax ? g.bonusMax * RESOURCE_MAP[g.bonus].basePrice : 0);
      const hand = byHand * RESOURCE_MAP[g.reward].basePrice;
      expect(best, `${g.name}は手で拾うのと変わらない`).toBeGreaterThan(hand * 1.5);
    }
  });

  it('解放されていない遊びは遊べない', () => {
    const e = makeEngine();
    // 岩を割るは、石のつるはしを作ってから
    expect(isMinigameUnlocked(e.state, 'dig', e.derived.assets)).toBe(false);
    const r = e.playMinigame('dig', 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
    expect(skillOf(e.state, 'mining').plays).toBe(0);
  });
});

describe('腕の効き方', () => {
  it('4つの腕は、それぞれ別のところに効く（1つ鍛えれば済む形にしない）', () => {
    const base = createBaseModifiers();
    /** その腕だけを最大まで上げたとき、基準から変わった項目の名前 */
    const changedBy = (id: SkillId): string[] => {
      const m = createBaseModifiers();
      applySkills(withSkill(id, SKILL_MAP[id].maxLevel), m);
      const out: string[] = [];
      for (const [k, v] of Object.entries(m)) {
        if (k === 'production') {
          for (const [c, cv] of Object.entries(m.production)) if (Math.abs(cv - base.production[c]) > 1e-9) out.push(`production.${c}`);
        } else if (typeof v === 'number' && Math.abs(v - (base as unknown as Record<string, number>)[k]) > 1e-9) {
          out.push(k);
        }
      }
      return out.sort();
    };
    const map = new Map<SkillId, string[]>();
    for (const s of SKILLS) map.set(s.id, changedBy(s.id));
    // どの腕も、何かしらに効いている
    for (const [id, keys] of map) expect(keys.length, `${SKILL_MAP[id].name}が何にも効いていない`).toBeGreaterThan(0);
    // どの2つを取っても、効き先がまったく同じにはならない
    for (const a of SKILLS) {
      for (const b of SKILLS) {
        if (a.id === b.id) continue;
        expect(map.get(a.id)!.join(','), `${a.name}と${b.name}の効き先が同じ`).not.toBe(map.get(b.id)!.join(','));
      }
    }
  });

  it('腕が上がると実際に生産が増える', () => {
    const m0 = createBaseModifiers();
    applySkills(withSkill('sorting', 0), m0);
    const m1 = createBaseModifiers();
    applySkills(withSkill('sorting', SKILL_MAP.sorting.maxLevel), m1);
    expect(m1.production.PROCESSING).toBeGreaterThan(m0.production.PROCESSING);
    // 説明文どおりの効き（+2.5% × 20 ＝ +50%）
    expect(m1.production.PROCESSING).toBeCloseTo(1 + SKILL_MAP.sorting.perLevel * SKILL_MAP.sorting.maxLevel, 6);
  });

  it('手際は手作業の量に効く（採集ボタンの数字が実際に増える）', () => {
    const e = makeEngine();
    const before = e.derived.modifiers.gatherAmount;
    e.state.skills = { handling: { level: SKILL_MAP.handling.maxLevel, exp: 0, plays: 0, best: 1 } };
    e.refreshDerived();
    expect(e.derived.modifiers.gatherAmount).toBeGreaterThan(before);
    const got = e.gather('gather_stone');
    expect(got).toBeGreaterThan(1); // 素の1kgより多く採れる
  });

  it('レベルを超える値がセーブに入っていても、頭打ちを超えて効かない', () => {
    const m = createBaseModifiers();
    applySkills(withSkill('sorting', 9999), m);
    expect(m.production.PROCESSING).toBeCloseTo(1 + SKILL_MAP.sorting.perLevel * SKILL_MAP.sorting.maxLevel, 6);
  });
});

describe('データの筋が通っている', () => {
  it('遊びはすべて、実在する腕と実在する資源につながっている', () => {
    for (const g of MINIGAMES) {
      expect(SKILL_MAP[g.skill], `${g.name}の腕がない`).toBeTruthy();
      expect(RESOURCE_MAP[g.reward], `${g.name}の報酬の資源がない`).toBeTruthy();
    }
  });

  it('どの遊びにも、やり方と点のつけ方が書いてある', () => {
    for (const g of MINIGAMES) {
      expect(g.howto.length, `${g.name}のやり方が無い`).toBeGreaterThanOrEqual(3);
      for (const h of g.howto) {
        expect(h.label.length, `${g.name}のやり方に見出しが無い`).toBeGreaterThan(0);
        expect(h.text.length, `${g.name}のやり方の説明が短すぎる`).toBeGreaterThan(10);
      }
      expect(g.scoring.length, `${g.name}の点のつけ方が無い`).toBeGreaterThan(10);
      expect(g.hint.length, `${g.name}のこつが無い`).toBeGreaterThan(5);
    }
  });

  it('やり方は画面に英語のIDを出さない（日本語で書かれている）', () => {
    const latin = /[A-Za-z_]{4,}/;
    for (const g of MINIGAMES) {
      const all = [g.name, g.description, g.hint, g.scoring, ...g.howto.map((h) => `${h.label}${h.text}`)].join('');
      expect(latin.test(all), `${g.name}の説明に英語のIDらしき文字列がある`).toBe(false);
    }
    for (const s of SKILLS) {
      expect(latin.test(`${s.name}${s.effect}${s.why}`), `${s.name}の説明に英語のIDらしき文字列がある`).toBe(false);
    }
  });

  it('腕はすべて、どれかの遊びで伸ばせる（伸ばしようのない腕を残さない）', () => {
    for (const s of SKILLS) {
      expect(MINIGAMES.some((g) => g.skill === s.id), `${s.name}を伸ばす遊びがない`).toBe(true);
    }
  });

  it('壊れたセーブでも腕は数に直る', () => {
    const e = makeEngine();
    // 途中で電源が落ちたようなセーブを想定
    (e.state.skills as unknown as Record<string, unknown>).sorting = { level: 'x', exp: null, plays: -5, best: 99 };
    // セーブして読み直す道（migrateSave）を通す。ここが繕う役目を負っている
    const json = serializeState(e.state, 1);
    const e2 = new GameEngine({ state: deserializeState(json) });
    const s = skillOf(e2.state, 'sorting');
    expect(Number.isFinite(s.level)).toBe(true);
    expect(s.level).toBeGreaterThanOrEqual(0);
    expect(s.plays).toBeGreaterThanOrEqual(0);
    expect(s.best).toBeLessThanOrEqual(1);
    expect(totalSkillLevel(e2.state)).toBeGreaterThanOrEqual(0);
  });
});
