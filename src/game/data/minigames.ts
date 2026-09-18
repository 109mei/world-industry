/**
 * 手仕事のミニゲームと、そこで身につく「腕（熟練度）」。
 *
 * 狙いは「序盤のやれることを増やす」こと。押すだけの採集に加えて、
 * うまくやれば手応えのある遊びを置く。
 *
 * 報酬は2つある。
 * 1つはその場で手に入る素材で、手で拾い続けるよりだいぶ多い（遊ぶ理由になる量）。
 * もう1つが**腕**で、これは一度上がったら下がらず、終盤の施設の生産にもそのまま効き続ける。
 * 腕が上がると手に入る素材も増えるので、鍛えるほど1回の実入りも良くなる。
 *
 * それでも施設の生産には遠く及ばない量にしてある（工具工房1棟＝毎分14万円に対し、
 * 廃品の仕分け1回＝約5,700円）。序盤の後押しにはなるが、
 * 延々と回すのが最適解にはならない、という位置に置いている。
 */
import type { ResourceId } from './resources';
import type { UnlockCondition } from './unlockTypes';

export type SkillId = 'sorting' | 'growing' | 'mining' | 'handling';

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  /** 1レベルあたり何割効くか（0.02 なら +2%） */
  perLevel: number;
  /** ここで頭打ち。無限に遊んで無限に強くなる形にはしない */
  maxLevel: number;
  /** 画面に出す効果の説明（perLevel と maxLevel から作らず、ここに書く） */
  effect: string;
  /** なぜその腕がそこに効くのか（一行） */
  why: string;
}

export const SKILLS = [
  {
    id: 'sorting',
    name: '選別の腕',
    icon: 'icon_game_sorting',
    perLevel: 0.025,
    maxLevel: 20,
    effect: '加工施設の生産 +2.5%（最大 +50%）',
    why: '混ざりものを外してから溶かすと、同じ材料でも多く取れる。',
  },
  {
    id: 'growing',
    name: '栽培の腕',
    icon: 'icon_farm_sprout',
    perLevel: 0.02,
    maxLevel: 20,
    effect: '採集施設の生産 +2%（最大 +40%）',
    why: '水と日当たりの加減が分かると、畑も林も採れる量が変わる。',
  },
  {
    id: 'mining',
    name: '採掘の腕',
    icon: 'icon_game_break',
    perLevel: 0.02,
    maxLevel: 20,
    effect: '買った土地の鉱脈の量 +2%、調査費 −1%（最大 +40% / −20%）',
    why: '岩の目を読めると、同じ鉱区からより多く掘り出せる。買う前に鍛えておくと効く。',
  },
  {
    id: 'handling',
    name: '手際',
    icon: 'icon_game_timing',
    perLevel: 0.03,
    maxLevel: 20,
    effect: '手作業の採集量 +3%、手作りの歩留まり +2%（最大 +60% / +40%）',
    why: '無駄な動きが減ると、一度に運べる量も作れる数も増える。',
  },
] as const satisfies readonly SkillDef[];

export const SKILL_MAP: Record<SkillId, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;
export const SKILL_IDS = SKILLS.map((s) => s.id) as SkillId[];

export function isSkillId(id: string): id is SkillId {
  return id in SKILL_MAP;
}

export type MinigameId = 'sort' | 'grow' | 'dig' | 'timing';

export interface MinigameDef {
  id: MinigameId;
  name: string;
  icon: string;
  /** この遊びで伸びる腕 */
  skill: SkillId;
  /** 何をする遊びか（1〜2文） */
  description: string;
  /** うまくやるこつ。読むだけで少し上手くなる程度のことを書く */
  hint: string;
  /**
   * やり方。初めて開いたときに出す。
   * 「何をするか」→「どう操作するか」→「どうなると良いか」の順に並べる。
   */
  howto: readonly { readonly label: string; readonly text: string }[];
  /** 出来（点）のつけ方。ここを隠さないほうが、うまくなろうという気になる */
  scoring: string;
  /** 遊んでいるあいだに実際に出るもの */
  reward: ResourceId;
  /** 満点・腕が Lv.0 のときに手に入る量（kg）。腕が上がるとここから増える */
  rewardMax: number;
  /** 出来が良かったとき（BONUS_SCORE 以上）だけ出る、別のもの。無い遊びもある */
  bonus?: ResourceId;
  /** その最大量 */
  bonusMax?: number;
  unlock: UnlockCondition;
}

export const MINIGAMES = [
  {
    id: 'timing',
    name: '手を合わせる',
    icon: 'icon_game_timing',
    skill: 'handling',
    description: '動いている印を、狙いの帯の中で止める。5回ぶん。帯は回を追うごとに狭くなる。',
    hint: '止めたい所の少し手前で押す。指が動くまでに印は進む。',
    howto: [
      { label: '何をする', text: '棒の上を左右に動いている印を、色のついた帯の中で止めます。' },
      { label: '押すところ', text: '下の「止める」を押すと、その瞬間の位置で判定します。' },
      { label: 'うまくいくと', text: '帯の真ん中に近いほど高い点。5回ぶん続けて、その平均が出来になります。' },
      { label: '難しくなる', text: '回を追うごとに帯は狭く、印は速くなります。最後の1回がいちばん狭い。' },
    ],
    scoring: '帯の外なら0点。中に入れば、真ん中に近いほど1点に近づきます。',
    reward: 'wood',
    rewardMax: 80,
    bonus: 'stone',
    bonusMax: 40,
    unlock: { type: 'always' },
  },
  {
    id: 'sort',
    name: '廃品を仕分ける',
    icon: 'icon_game_sorting',
    skill: 'sorting',
    description: '流れてくる廃品を、鉄・銅・ごみの3つに分ける。12個ぶん。',
    hint: '迷ったら形を見る。板と棒は鉄、線と管は銅、それ以外はごみ。',
    howto: [
      { label: '何をする', text: '真ん中に出てくる廃品を、鉄・銅・ごみの3つに分けます。' },
      { label: '押すところ', text: '下の3つのボタンのうち、その品が入る箱を押します。' },
      { label: '見分け方', text: '板・棒・缶・ボルトは鉄。線・管・コイル・端子は銅。木・布・紙・ガラスはごみ。' },
      { label: '持ち時間', text: '上のバーが減りきると、その品は取りこぼしになります。迷いすぎないこと。' },
    ],
    scoring: '12個のうち、正しく分けられた割合がそのまま出来になります。',
    reward: 'scrap_metal',
    rewardMax: 100,
    // 選り分けているのだから、銅は銅で出てくる
    bonus: 'copper_ore',
    bonusMax: 8,
    unlock: { type: 'obtained', resource: 'scrap_metal', min: 10 },
  },
  {
    id: 'grow',
    name: '苗を育てる',
    icon: 'icon_farm_sprout',
    skill: 'growing',
    description: '水やりで土の湿り気を、ちょうどよい帯の中に保つ。20秒ぶん。',
    hint: '乾いてから足すより、減り始めで少しずつ足すほうが保ちやすい。やりすぎは根腐れ。',
    howto: [
      { label: '何をする', text: '土の湿り気を、緑の帯の中に保ちます。20秒ぶん。' },
      { label: '押すところ', text: '「水をやる」を押すと湿り気が増えます。押さなければ、じわじわ乾いていきます。' },
      { label: '気をつける', text: '帯より上は水のやりすぎ（根腐れ）、下は乾きすぎ。どちらも点になりません。' },
      { label: '後半ほど乾く', text: '日が高くなるぶん、後半は乾きが速くなります。同じ間隔では間に合いません。' },
    ],
    scoring: '20秒のうち、帯の中に収まっていた時間の割合が出来になります。',
    reward: 'plant_fiber',
    rewardMax: 80,
    // よく育った株からは樹液も採れる
    bonus: 'sap',
    bonusMax: 10,
    unlock: { type: 'obtained', resource: 'plant_fiber', min: 10 },
  },
  {
    id: 'dig',
    name: '岩を割る',
    icon: 'icon_game_break',
    skill: 'mining',
    description: '岩に走ったひびが光った所を叩く。10回ぶん。光っているあいだしか割れない。',
    hint: 'ひびは次に光る所の近くに出やすい。手を戻さず、近いところから順に狙う。',
    howto: [
      { label: '何をする', text: '岩に走ったひびのうち、光っている所を叩いて割ります。10回ぶん。' },
      { label: '押すところ', text: '光っているマスを押します。光っていないマスを押すと空振りです。' },
      { label: '時間がある', text: 'ひとつのひびが光っているのは1秒たらず。切れる前に押さないと空振りになります。' },
      { label: 'こつ', text: '次のひびは、いま光っている所の近くに出やすくしてあります。指を遠くへ戻さないこと。' },
    ],
    scoring: '10回のうち、割れた回数の割合が出来になります。',
    reward: 'iron_ore',
    rewardMax: 150,
    // 鉄鉱石の層には石炭が並んで走っていることが多い
    bonus: 'coal',
    bonusMax: 60,
    unlock: { type: 'toolCrafted', tool: 'stone_pickaxe' },
  },
] as const satisfies readonly MinigameDef[];

export const MINIGAME_MAP: Record<MinigameId, MinigameDef> = Object.fromEntries(MINIGAMES.map((g) => [g.id, g])) as unknown as Record<MinigameId, MinigameDef>;
export const MINIGAME_IDS = MINIGAMES.map((g) => g.id) as MinigameId[];

export function isMinigameId(id: string): id is MinigameId {
  return id in MINIGAME_MAP;
}

/**
 * 次のレベルまでに要る経験値。
 *
 * 1回の出来（0〜1）に応じて 0〜10 入る。満点を続けても
 * レベル20（頭打ち）までおよそ1,500回かかる勘定で、
 * 「少しずつ上手くなる」実感が長く続くようにしてある。
 */
export function expToNext(level: number): number {
  return Math.round(30 * Math.pow(level + 1, 1.35));
}

/** これ以上の出来で、おまけの素材が出る */
export const BONUS_SCORE = 0.8;

/**
 * 腕が上がると、同じ出来でも多く持ち帰れる。
 * Lv.1 ごとに +10%、頭打ちの Lv.20 で3倍。
 * 施設の生産には遠く及ばないので、これで釣り合いが壊れることはない。
 */
export function rewardMultiplier(level: number): number {
  return 1 + Math.max(0, level) * 0.1;
}

/** 満点＝10、まったく駄目＝0。0.5 を下回るぶんは伸びが鈍る（雑にこなしても伸びない） */
export function expFromScore(score: number): number {
  const s = Math.max(0, Math.min(1, score));
  return Math.round(10 * s * s * 100) / 100;
}
