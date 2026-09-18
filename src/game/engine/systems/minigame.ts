/**
 * ミニゲームの結果を受け取って、腕（熟練度）を伸ばす。
 *
 * 画面側は「どれだけうまくやれたか」を 0〜1 の一つの数にして渡すだけにしてある。
 * 遊びごとの細かい判定は画面側に置き、ここには**伸び方と上限**だけを置く。
 * そうしておくと、遊びを足したり作り替えたりしても、伸び方の釣り合いは1ヵ所で見られる。
 */
import { BONUS_SCORE, MINIGAME_MAP, SKILL_MAP, expFromScore, expToNext, isMinigameId, rewardMultiplier, type MinigameId, type SkillId } from '@/game/data/minigames';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { GameState, SkillState } from '@/types/state';
import type { EngineContext } from '../context';
import { addResource } from '../inventory';
import { evaluateCondition, envOf } from './unlocks';

export interface MinigameResult {
  ok: boolean;
  reason?: string;
  /** 伸びた経験値 */
  exp: number;
  /** 上がったレベル（上がらなければ 0） */
  levelUp: number;
  level: number;
  /** 実際に手に入った量 */
  gained: number;
  /** おまけが出たときの、その資源と量 */
  bonus?: { id: ResourceId; amount: number };
  /** 自己最高を更新したか */
  best: boolean;
}

const EMPTY: SkillState = { level: 0, exp: 0, plays: 0, best: 0 };

export function skillOf(state: GameState, id: SkillId): SkillState {
  return state.skills?.[id] ?? EMPTY;
}

export function skillLevel(state: GameState, id: SkillId): number {
  return skillOf(state, id).level;
}

/** いまのレベルでの伸び具合（0〜1）。頭打ちなら 1 */
export function skillProgress(state: GameState, id: SkillId): number {
  const s = skillOf(state, id);
  if (s.level >= SKILL_MAP[id].maxLevel) return 1;
  const need = expToNext(s.level);
  return need > 0 ? Math.min(1, s.exp / need) : 0;
}

/** その遊びがいま遊べるか（状態は変えない） */
export function isMinigameUnlocked(state: GameState, id: MinigameId, assets: number): boolean {
  const def = MINIGAME_MAP[id];
  if (!def) return false;
  return evaluateCondition(def.unlock, state, assets);
}

/**
 * 1回ぶんの結果を反映する。
 *
 * score は画面側が出した「出来」（0〜1）。ここで必ず挟み込んでから使う。
 * 画面の作りが変わっても、ここを通るかぎり1回の伸びは 10 を超えない。
 */
export function playMinigame(ctx: EngineContext, id: MinigameId, score: number): MinigameResult {
  const { state, derived } = ctx;
  const miss: MinigameResult = { ok: false, exp: 0, levelUp: 0, level: 0, gained: 0, best: false };
  if (!isMinigameId(id)) return { ...miss, reason: 'その遊びはありません' };
  const def = MINIGAME_MAP[id];
  if (!isMinigameUnlocked(state, id, envOf(derived).assets)) return { ...miss, reason: 'まだ遊べません' };

  const s = Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0));
  const skillId = def.skill;
  const max = SKILL_MAP[skillId].maxLevel;
  if (!state.skills) state.skills = {};
  const cur: SkillState = { ...(state.skills[skillId] ?? EMPTY) };

  const exp = expFromScore(s);
  let levelUp = 0;
  // 自己最高かどうかは、書き換える前の値と比べる（初回は「更新」と言わない）
  const best = cur.plays > 0 && s > cur.best;
  cur.plays += 1;
  cur.best = Math.max(cur.best, s);
  // 頭打ちに達したら経験値は貯めない（数字だけ増えて何も起きない状態を作らない）
  if (cur.level < max) {
    cur.exp += exp;
    while (cur.level < max && cur.exp >= expToNext(cur.level)) {
      cur.exp -= expToNext(cur.level);
      cur.level += 1;
      levelUp += 1;
    }
    if (cur.level >= max) cur.exp = 0;
  }
  state.skills[skillId] = cur;

  // 出来に応じて素材が入る。腕が上がっているほど多く持ち帰れる。倉庫が満杯なら入らない
  const want = def.rewardMax * s * rewardMultiplier(cur.level);
  const gained = want > 0 ? addResource(state, def.reward, want, derived.capacity, 'gathered') : 0;

  // 出来が良かったときだけ出るおまけ
  let bonus: { id: ResourceId; amount: number } | undefined;
  if (def.bonus && def.bonusMax && s >= BONUS_SCORE) {
    const amount = addResource(state, def.bonus, def.bonusMax * s * rewardMultiplier(cur.level), derived.capacity, 'gathered');
    if (amount > 0) bonus = { id: def.bonus, amount };
  }

  if (levelUp > 0) {
    ctx.emit('unlock', `${SKILL_MAP[skillId].name}が レベル${cur.level} になりました`, { toast: true });
  } else if (bonus) {
    ctx.emit('info', `${def.name}: ${RESOURCE_MAP[def.reward].name}と${RESOURCE_MAP[bonus.id].name}が増えました`);
  } else if (gained > 0) {
    ctx.emit('info', `${def.name}: ${RESOURCE_MAP[def.reward].name}が増えました`);
  }
  return { ok: true, exp, levelUp, level: cur.level, gained, bonus, best };
}

/** 腕の合計レベル。実績や「どれだけ手を動かしたか」の目安に使う */
export function totalSkillLevel(state: GameState): number {
  let sum = 0;
  for (const s of Object.values(state.skills ?? {})) sum += s?.level ?? 0;
  return sum;
}
