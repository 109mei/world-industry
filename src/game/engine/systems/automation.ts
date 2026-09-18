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
function resetTimer(a: AutomationState, key: AutomationKey, spent: number): void {
  a.timers[key] = Math.max(0, (a.timers[key] ?? 0) - spent);
}

/** interval ごとに1回だけ動かすもの用。溜まったぶんは切り捨てる */
function consumeInterval(a: AutomationState, key: AutomationKey, interval: number): boolean {
  const t = a.timers[key] ?? 0;
  if (t < interval) return false;
  a.timers[key] = t % interval;
  return true;
}

/** 自動採集: 1秒あたり段階ぶんの手作業をこなす */
function runAutoGather(ctx: EngineContext, dt: number): void {
  const { state, derived } = ctx;
  const a = automationState(state);
  const level = automationLevel(state, 'gather');
  const t = timer(a, 'gather', dt * level);
  const times = Math.floor(t);
  if (times <= 0) return;
  resetTimer(a, 'gather', times);
  const actions = autoGatherActions(state);
  if (actions.length === 0) return;
  for (let i = 0; i < Math.min(times, 60); i++) {
    const id = actions[(state.stats.taps + i) % actions.length];
    // 倉庫が満杯のときは警告を出さずに飛ばす
    const res = GATHER_MAP[id].resource;
    if ((state.inventory[res] ?? 0) >= derived.capacity - 1e-9) continue;
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
  resetTimer(a, 'craft', times);
  const slots = a.recipes.slice(0, autoCraftSlots(state));
  for (const id of slots) {
    const def = RECIPE_MAP[id];
    if (!def) continue;
    const possible = Math.min(craftableTimes(state, id), Math.min(times, 50));
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
  if (!consumeInterval(a, 'pitch', 10)) return;
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
  if (!consumeInterval(a, 'survey', 5)) return;
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
  if (!consumeInterval(a, 'build', 60)) return;
  let best: { typeId: FacilityId; landId: string; cost: number } | null = null;
  for (const inst of state.facilities) {
    if (inst.count <= 0 || !inst.enabled) continue;
    const def = FACILITY_MAP[inst.typeId as FacilityId];
    if (!def) continue;
    const land = getLand(state, inst.landId);
    if (!land || !canBuildOn(def, land).ok) continue;
    if (def.maxCount !== undefined && facilityCount(state, inst.typeId as FacilityId, inst.landId) >= def.maxCount) continue;
    const cost = facilityCost(def, facilityCount(state, inst.typeId as FacilityId, inst.landId));
    // 所持金の 10% までに収まるものだけ（使い切らせない）
    if (cost > state.company.cash * 0.1) continue;
    if (!best || cost < best.cost) best = { typeId: inst.typeId as FacilityId, landId: inst.landId, cost };
  }
  if (best) buyFacility(ctx, best.typeId, 1, best.landId);
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
