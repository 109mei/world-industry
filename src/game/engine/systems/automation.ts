/**
 * 自動化。再出発（永続ポイント）で買うと使えるようになり、スイッチで ON/OFF できる。
 *
 * 「あとは眺めているだけ」にならないよう、どれも
 * 「自分でやると面倒なところ」だけを肩代わりする作りにしている。
 */
import { GATHER_ACTIONS, GATHER_MAP, type GatherActionId } from '@/game/data/gathering';
import { FACILITY_MAP, facilityCost, type FacilityId } from '@/game/data/facilities';
import { RECIPE_MAP, type RecipeId } from '@/game/data/recipes';
import { SURVEY_LEVEL_TO_BUILD } from '@/game/data/survey';
import type { AutomationKey, AutomationState, GameState } from '@/types/state';
import type { EngineContext } from '../context';
import { craft, craftableTimes } from '../actions/craft';
import { previewGather, gather } from '../actions/gather';
import { buyFacility, facilityCount } from '../actions/facility';
import { startSurvey, surveyCost } from '../actions/land';
import { canBuildOn, getLand } from '../land';
import { pitchCost } from '@/game/data/clients';
import { clientList, deliverDeal, pitchToClient, pitchCooldownLeft, salesState, wantedByKind } from './sales';
import { levelOf } from '@/game/data/prestigeTree';
import { buildCostMult } from './synergy';

export const AUTOMATION_KEYS: readonly AutomationKey[] = ['gather', 'craft', 'deliver', 'pitch', 'survey', 'build'];

/** 自動化のキー → それを解放する永続アップグレードの ID */
export const AUTOMATION_UPGRADE_ID: Record<AutomationKey, string> = {
  gather: 'auto_gather',
  craft: 'auto_craft',
  deliver: 'auto_deliver',
  pitch: 'auto_pitch',
  survey: 'auto_survey',
  build: 'auto_build',
};

export function automationState(state: GameState): AutomationState {
  if (!state.automation) state.automation = { on: {}, recipes: [], gathers: [], timers: {} };
  return state.automation;
}

/** 買った段階（0 なら未購入） */
export function automationLevel(state: GameState, key: AutomationKey): number {
  return levelOf(state.prestige?.upgrades, AUTOMATION_UPGRADE_ID[key]);
}

export function isAutomationOwned(state: GameState, key: AutomationKey): boolean {
  return automationLevel(state, key) > 0;
}

/** 買っていて、かつスイッチが入っているか */
export function isAutomationOn(state: GameState, key: AutomationKey): boolean {
  return isAutomationOwned(state, key) && automationState(state).on[key] === true;
}

export function setAutomation(state: GameState, key: AutomationKey, on: boolean): void {
  const a = automationState(state);
  if (!isAutomationOwned(state, key)) return;
  a.on[key] = on;
}

/** 自動クラフトに登録できるレシピの数 */
export function autoCraftSlots(state: GameState): number {
  return automationLevel(state, 'craft') * 2;
}

/** 自動クラフトの登録を入れ替える。上限を超えたら何もしない */
export function toggleAutoRecipe(state: GameState, recipeId: RecipeId): boolean {
  const a = automationState(state);
  const i = a.recipes.indexOf(recipeId);
  if (i >= 0) {
    a.recipes.splice(i, 1);
    return true;
  }
  if (a.recipes.length >= autoCraftSlots(state)) return false;
  a.recipes.push(recipeId);
  return true;
}

/** 自動採集する行動。選んでいなければ解放済みのものすべて */
export function autoGatherActions(state: GameState): GatherActionId[] {
  const a = automationState(state);
  const chosen = a.gathers.filter((id) => previewGather(state, id).available);
  if (chosen.length > 0) return chosen;
  return GATHER_ACTIONS.filter((g) => previewGather(state, g.id).available).map((g) => g.id);
}

/**
 * 自動採集の対象を切り替える。
 * 空の配列は「解放しているもの全部」という意味なので、
 * その状態からひとつ外すときは、いったん全部を入れてから外す
 * （そうしないと、外したはずのものだけが選ばれてしまう）。
 */
export function toggleAutoGather(state: GameState, actionId: GatherActionId): void {
  const a = automationState(state);
  const all = GATHER_ACTIONS.filter((g) => previewGather(state, g.id).unlocked).map((g) => g.id);
  const current = a.gathers.length === 0 ? all : a.gathers;
  const next = current.includes(actionId) ? current.filter((id) => id !== actionId) : [...current, actionId];
  // 全部そろっているときは「全部」の意味の空配列に戻す
  a.gathers = next.length === all.length && all.every((id) => next.includes(id)) ? [] : next;
}

/**
 * 1 tick でこなせる自動採集の回数。
 * 追いつき計算の1回ぶん（最大 60 秒）× 段階の上限（5）＝ 300 を上回るようにしてある。
 * ここが足りないと、追いつきのたびに段階ぶんの採集が黙って消える。
 */
const MAX_GATHER_PER_TICK = 360;
/** 1 tick でこなせる自動クラフトの回数（追いつき1回ぶん 60 回を上回るようにしてある） */
const MAX_CRAFT_PER_TICK = 120;

function timer(a: AutomationState, key: AutomationKey, dt: number): number {
  const next = (a.timers[key] ?? 0) + dt;
  a.timers[key] = next;
  return next;
}

/**
 * 使ったぶんだけ時計を戻す。
 * 追いつき計算（dt=10秒）では何回ぶんも溜まるので、間隔の倍数でまとめて引かないと
 * 時計が増え続け、次に開いたときに一気に動いてしまう。
 */
function resetTimer(a: AutomationState, key: AutomationKey, spent: number, maxBacklog = Infinity): void {
  // 溜めておける量に上限を置く。置かないと、こなせない量が延々と積もって
  // 次に開いた瞬間に一気に動いてしまう
  a.timers[key] = Math.min(maxBacklog, Math.max(0, (a.timers[key] ?? 0) - spent));
}

/**
 * interval ごとに1回動かすもの用。溜まっている回数を返す。
 *
 * 追いつき計算では dt が 60 秒になるので、「1 tick に1回だけ」にすると
 * 段階を上げても頻度が上がらない（dt=60 のとき 60 秒間隔なら常に1回）。
 * 溜まったぶんをまとめて返して、呼び出し側でその回数だけ動かす。
 * 1 tick で走らせすぎないよう上限を付ける。
 */
function consumeInterval(a: AutomationState, key: AutomationKey, interval: number, maxTimes = 20): number {
  const t = a.timers[key] ?? 0;
  if (t < interval) return 0;
  const times = Math.min(maxTimes, Math.floor(t / interval));
  // 余りだけ残す（こなせなかったぶんは持ち越さない）。
  // ここを引き算にすると、動くものが無いときに時計が延々と積もってしまう
  a.timers[key] = t % interval;
  return times;
}

/** 自動採集: 1秒あたり段階ぶんの手作業をこなす */
function runAutoGather(ctx: EngineContext, dt: number): void {
  const { state, derived } = ctx;
  const a = automationState(state);
  const level = automationLevel(state, 'gather');
  const t = timer(a, 'gather', dt * level);
  const times = Math.floor(t);
  if (times <= 0) return;
  const actions = autoGatherActions(state);
  if (actions.length === 0) {
    // 採集するものが無いときは時計を伸ばし続けない
    resetTimer(a, 'gather', times);
    return;
  }
  // 1 tick でこなせる回数には上限がある。こなせなかったぶんは時計に残して次の tick に持ち越す
  // （全部引いてしまうと、追いつき計算のたびに段階ぶんが黙って消える）
  const run = Math.min(times, MAX_GATHER_PER_TICK);
  resetTimer(a, 'gather', run, MAX_GATHER_PER_TICK);
  // 並び順の起点はループの前に1回だけ読む。
  // gather() が中で taps を増やすので、ループの中で読むと添字が2つずつ飛び、
  // 対象が偶数個のときに半分の資源がまったく採れなくなる。
  const base = state.stats.taps;
  for (let i = 0; i < run; i++) {
    const id = actions[(base + i) % actions.length];
    // 倉庫が満杯のときは警告を出さずに飛ばす
    const def = GATHER_MAP[id];
    if (!def) continue;
    if ((state.inventory[def.resource] ?? 0) >= derived.capacity - 1e-9) continue;
    gather(ctx, id);
  }
}

/** 自動クラフト: 登録したレシピを作れるだけ作る（1秒に1回ぶん） */
function runAutoCraft(ctx: EngineContext, dt: number): void {
  const { state, derived } = ctx;
  const a = automationState(state);
  const t = timer(a, 'craft', dt);
  const times = Math.floor(t);
  if (times <= 0) return;
  const slots = a.recipes.slice(0, autoCraftSlots(state));
  if (slots.length === 0) {
    resetTimer(a, 'craft', times);
    return;
  }
  // 1 tick で回せる回数には上限がある。残りは時計に置いて次の tick に持ち越す
  const run = Math.min(times, MAX_CRAFT_PER_TICK);
  resetTimer(a, 'craft', run, MAX_CRAFT_PER_TICK);
  for (const id of slots) {
    const def = RECIPE_MAP[id];
    if (!def) continue;
    const possible = Math.min(craftableTimes(state, id), run);
    if (possible <= 0) continue;
    // 倉庫が満杯なら警告を出さずに飛ばす
    let room = possible;
    const yieldMult = derived.modifiers?.craftYield ?? 1;
    for (const [out, n] of Object.entries(def.outputs ?? {}) as [keyof typeof state.inventory, number][]) {
      const space = derived.capacity - (state.inventory[out] ?? 0);
      room = Math.min(room, Math.floor(space / (n * yieldMult)));
    }
    if (room <= 0) continue;
    craft(ctx, id, room);
  }
}

/** 自動納品: 期限が近い契約を、在庫があるうちに納める */
function runAutoDeliver(ctx: EngineContext): void {
  const { state } = ctx;
  const s = salesState(state);
  for (const deal of [...s.deals]) {
    // 期限の残り 40% を切ったら納める
    if (deal.remaining > deal.intervalSec * 0.4) continue;
    if ((state.inventory[deal.resource] ?? 0) + 1e-9 < deal.amountPer) continue;
    deliverDeal(ctx, deal.id);
  }
}

/** 自動営業: 関係の深い相手から順に、クールダウンが明けたところへ営業する */
function runAutoPitch(ctx: EngineContext, dt: number): void {
  const { state, derived } = ctx;
  const a = automationState(state);
  timer(a, 'pitch', dt);
  if (consumeInterval(a, 'pitch', 10, 4) <= 0) return;
  const cost = pitchCost(derived.assets);
  // 所持金を使い切らないよう、10回ぶんの余裕があるときだけ
  if (state.company.cash < cost * 10) return;
  const s = salesState(state);
  if (s.offers.length >= 6) return;
  const now = ctx.now();
  for (const c of clientList(state)) {
    if (pitchCooldownLeft(state, c.id, now) > 0) continue;
    if (wantedByKind(state, c.kind).length === 0) continue;
    pitchToClient(ctx, c.id);
    return;
  }
}

/** 自動調査: 施設を建てられるところまで、お金に余裕があれば進める */
function runAutoSurvey(ctx: EngineContext, dt: number): void {
  const { state, derived } = ctx;
  const a = automationState(state);
  timer(a, 'survey', dt);
  if (consumeInterval(a, 'survey', 5, 4) <= 0) return;
  for (const land of state.lands) {
    if (land.id === 'hq' || land.surveyProgress) continue;
    if (land.survey >= SURVEY_LEVEL_TO_BUILD) continue;
    const cost = surveyCost(state, land.id, land.survey, derived.modifiers.surveyCost);
    if (cost <= 0 || state.company.cash < cost * 4) continue;
    if (startSurvey(ctx, land.id)) return;
  }
}

/** 自動増設: すでに建てている施設のうち、いちばん安いものを1台だけ増やす */
function runAutoBuild(ctx: EngineContext, dt: number): void {
  const { state } = ctx;
  const a = automationState(state);
  const level = automationLevel(state, 'build');
  timer(a, 'build', dt * level);
  // 溜まっている回数ぶん増設する（追いつき計算でも段階どおりのペースになる）
  const rounds = consumeInterval(a, 'build', 60, 10);
  if (rounds <= 0) return;
  for (let r = 0; r < rounds; r++) if (!buildOnce(ctx)) break;
}

/** いちばん安いものを1台だけ増やす。増やせたら true */
function buildOnce(ctx: EngineContext): boolean {
  const { state } = ctx;
  let best: { typeId: FacilityId; landId: string; cost: number } | null = null;
  for (const inst of state.facilities) {
    if (inst.count <= 0 || !inst.enabled) continue;
    const def = FACILITY_MAP[inst.typeId as FacilityId];
    if (!def) continue;
    const land = getLand(state, inst.landId);
    if (!land || !canBuildOn(def, land).ok) continue;
    if (def.maxCount !== undefined && facilityCount(state, inst.typeId as FacilityId, inst.landId) >= def.maxCount) continue;
    const cost = Math.ceil(facilityCost(def, facilityCount(state, inst.typeId as FacilityId, inst.landId)) * buildCostMult(state));
    // 所持金の 10% までに収まるものだけ（使い切らせない）
    if (cost > state.company.cash * 0.1) continue;
    if (!best || cost < best.cost) best = { typeId: inst.typeId as FacilityId, landId: inst.landId, cost };
  }
  if (!best) return false;
  return buyFacility(ctx, best.typeId, 1, best.landId) > 0;
}

/** 毎 tick。買っていて ON のものだけ動く */
export function runAutomation(ctx: EngineContext, dt: number): void {
  const { state } = ctx;
  if (!state.automation) return;
  if (isAutomationOn(state, 'gather')) runAutoGather(ctx, dt);
  if (isAutomationOn(state, 'craft')) runAutoCraft(ctx, dt);
  if (isAutomationOn(state, 'deliver')) runAutoDeliver(ctx);
  if (isAutomationOn(state, 'pitch')) runAutoPitch(ctx, dt);
  if (isAutomationOn(state, 'survey')) runAutoSurvey(ctx, dt);
  if (isAutomationOn(state, 'build')) runAutoBuild(ctx, dt);
}
