/**
 * 事業（お店・IT会社・パソコン製造・ゲーム会社・アプリ会社・広告代理店）。
 *
 * 共通するのは「人を雇って、知名度とブランドを育てて、稼ぐ」という形。
 *  - お店は、仕入れた品物を並べて売る。客足は場所の人通り・知名度・駐車場で決まる
 *  - そのほかの会社は、案件を選んで仕事量を積み、完成すると報酬が入る。
 *    製品になる案件は、発売後も利用者から毎秒お金が入り続ける（飽きられると減る）
 */
import { AD_MAP, BUSINESS_MAP, PARKING_PER_CUSTOMER, SQM_PER_PARKING, type BusinessKindId } from '@/game/data/business';
import { SEASON_SECONDS, SHOP_MODELS, type ShopModel } from '@/game/data/shopModels';
import { GAMES, expectedReturn } from '@/game/data/gambling';
import { PROJECT_MAP, type ProjectDef } from '@/game/data/projects';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { getCustom } from './customEstate';
import { landCustomId } from './customEstate';
import { getLand, landPopulation } from '../land';
import { referencePrice } from './market';
import { isUnlocked } from './unlocks';
import { addResource, clean } from '../inventory';
import { safe, safePositive } from '@/utils/numbers';
import type { ActiveProject, BusinessState, Division, GameState } from '@/types/state';
import type { EngineContext } from '../context';

export function businessState(state: GameState): BusinessState {
  if (!state.business) state.business = { divisions: [], nextId: 1 };
  return state.business;
}

export function divisions(state: GameState): Division[] {
  return businessState(state).divisions;
}

export function getDivision(state: GameState, id: number): Division | null {
  return divisions(state).find((d) => d.id === id) ?? null;
}

/** その業種を研究で解放しているか */
export function isBusinessUnlocked(state: GameState, kind: BusinessKindId): boolean {
  const def = BUSINESS_MAP[kind];
  return state.research.completed[def.research] === true;
}

/** その案件を受けられるか（研究で解放しているか） */
export function isProjectAvailable(state: GameState, def: ProjectDef): boolean {
  return !def.research || state.research.completed[def.research] === true;
}

// ---------- 場所の力 ----------

/**
 * その場所の「人通り」。
 * 人口の多い用途（店・駅前・住宅）ほど高く、郊外の倉庫や畑は低い。
 * 土地の値段も効くので、一等地に構えるほど客が来る。
 */
export function footfall(state: GameState, landId: string): number {
  const land = getLand(state, landId);
  if (!land) return 0;
  const pop = landPopulation(land);
  const value = land.value ?? 0;
  // 地価は 3万円/㎡ を基準にして、そこからの伸びをゆるやかに効かせる
  const cp = getCustom(state, landCustomId(landId) ?? '');
  const unit = cp?.unitPrice ?? 30_000;
  const placeMult = Math.min(4, Math.max(0.3, Math.pow(unit / 30_000, 0.45)));
  const sizeMult = cp ? Math.min(3, Math.max(0.4, Math.pow(Math.max(30, cp.areaSqm) / 200, 0.3))) : 1;
  return safePositive(pop * placeMult * sizeMult * (value > 0 ? 1 : 1));
}

/**
 * その場所の「競争の激しさ」。
 * 同じ街に自分の店をいくつも出すと、客を取り合って一店あたりは落ちる。
 */
export function competition(state: GameState, div: Division): number {
  const here = getCustom(state, landCustomId(div.landId) ?? '');
  if (!here) return 1;
  let near = 0;
  for (const d of divisions(state)) {
    if (d.id === div.id || d.kind !== div.kind) continue;
    const other = getCustom(state, landCustomId(d.landId) ?? '');
    if (!other) continue;
    const dLat = (other.lat - here.lat) * 111;
    const dLon = (other.lon - here.lon) * 111 * Math.cos((here.lat * Math.PI) / 180);
    const km = Math.sqrt(dLat * dLat + dLon * dLon);
    if (km < 3) near += 1 - km / 3;
  }
  return 1 / (1 + near * 0.5);
}

/** 駐車場の台数（割り当てた土地の面積から計算する） */
export function parkingSpaces(state: GameState, div: Division): number {
  let spaces = 0;
  for (const landId of div.parkingLands ?? []) {
    const cp = getCustom(state, landCustomId(landId) ?? '');
    if (!cp) continue;
    spaces += Math.floor(cp.areaSqm / SQM_PER_PARKING);
  }
  return spaces;
}

/** 広告が上げている知名度の上限と、毎秒の上がり方 */
function adEffect(div: Division): { cap: number; perSec: number; costPerSec: number } {
  let cap = 0;
  let perSec = 0;
  let costPerSec = 0;
  for (const ad of div.ads ?? []) {
    const def = AD_MAP[ad.adId];
    if (!def || ad.remaining <= 0) continue;
    cap = Math.max(cap, def.cap);
    perSec += def.awarenessPerSec;
    costPerSec += def.costPerSec;
  }
  return { cap, perSec, costPerSec };
}

/** 事業の人件費（円/秒） */
export function divisionWage(_state: GameState, div: Division): number {
  const def = BUSINESS_MAP[div.kind];
  return div.staff * def.wagePerStaff;
}

/** すべての事業の人件費の合計（円/秒） */
export function businessWageTotal(state: GameState): number {
  let sum = 0;
  for (const d of divisions(state)) sum += divisionWage(state, d);
  return sum;
}

/** 事業が抱えている人数の合計 */
export function businessStaffTotal(state: GameState): number {
  let sum = 0;
  for (const d of divisions(state)) sum += d.staff;
  return sum;
}

// ---------- お店 ----------

/** その店の商売のしかた */
export function shopModel(kind: BusinessKindId): ShopModel {
  return (
    SHOP_MODELS[kind] ?? {
      itemsPerCustomer: 1,
      markup: 1.5,
      spoilPerHour: 0,
      capacityPerSqm: 0,
      staffPerCapacity: 0,
      seasonal: false,
      varietyWeight: 0.3,
      browseRate: 0.1,
      note: '',
      tips: [],
    }
  );
}

/** 席・部屋・台の数（広さで決まる。0 なら上限なし） */
export function shopCapacity(state: GameState, div: Division): number {
  const m = shopModel(div.kind);
  if (m.capacityPerSqm <= 0) return 0;
  const cp = getCustom(state, landCustomId(div.landId) ?? '');
  const area = cp ? cp.areaSqm * Math.max(1, cp.levels) : 200;
  return Math.max(1, Math.floor(area * m.capacityPerSqm));
}

/** 人手が足りているか（1 なら十分、下回ると回らない） */
export function staffRatio(state: GameState, div: Division): number {
  const m = shopModel(div.kind);
  const cap = shopCapacity(state, div);
  if (m.staffPerCapacity <= 0 || cap <= 0) return 1;
  const need = cap * m.staffPerCapacity;
  return Math.min(1, div.staff / Math.max(1e-6, need));
}

/** 品ぞろえの充実ぐあい（0〜1） */
export function variety(_state: GameState, div: Division): number {
  const def = BUSINESS_MAP[div.kind];
  const goods = def.goods ?? [];
  if (goods.length === 0) return 1;
  const have = goods.filter((g) => (div.stock[g] ?? 0) > 0).length;
  return have / goods.length;
}

/** 流行・季節の係数（アパレルとホテルに効く） */
export function seasonFactor(state: GameState, div: Division): number {
  if (!shopModel(div.kind).seasonal) return 1;
  const t = (state.stats.playtimeSeconds % SEASON_SECONDS) / SEASON_SECONDS;
  return 0.75 + 0.5 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t + div.id * 0.11)));
}

/** カジノで客1人が1回に賭ける額 */
export function averageBet(_state: GameState, div: Division): number {
  const base = 2_000 + div.awareness * 120 + div.brand * 260;
  return base;
}

/** カジノの取り分（ハウスエッジの平均） */
export function houseEdge(): number {
  const avg = GAMES.reduce((a, g) => a + expectedReturn(g), 0) / GAMES.length;
  return Math.max(0.01, 1 - avg);
}

/** 品物1個の売値（仕入れ値より高く売る。ブランドが高いほど高く売れる） */
export function retailPrice(state: GameState, div: Division, id: ResourceId, shopMult = 1): number {
  const base = referencePrice(state, id);
  const m = shopModel(div.kind);
  // 売れ残りが値下がりする店（アパレルなど）は、流行の谷で安くなる
  const season = m.seasonal ? 0.7 + 0.3 * seasonFactor(state, div) : 1;
  return Math.max(1, base * (m.markup + div.brand / 120) * shopMult * season);
}

/** 1秒あたりに来る客の数 */
export function customersPerSec(state: GameState, div: Division): number {
  const m = shopModel(div.kind);
  const place = footfall(state, div.landId);
  const known = 0.25 + div.awareness / 100;
  const liked = 1 + div.brand / 150;
  const staffed = Math.min(1.5, 0.4 + div.staff * 0.25);
  // 品ぞろえ・流行・人手・席数で、入れる客の数が変わる
  const varietyMult = 1 - m.varietyWeight + m.varietyWeight * variety(state, div);
  let raw = place * known * liked * staffed * competition(state, div) * varietyMult * seasonFactor(state, div) * 0.05;
  const cap = shopCapacity(state, div);
  if (cap > 0) {
    // 席・部屋・台の数と人手で頭打ちになる（1つあたり毎秒 0.02人＝50秒で1回転）
    raw = Math.min(raw, cap * 0.02 * staffRatio(state, div));
  }
  // 駐車場が足りないと、車で来る客は入れない
  const spaces = parkingSpaces(state, div);
  const needed = raw * PARKING_PER_CUSTOMER;
  const parkingOk = needed <= spaces ? 1 : 0.55 + 0.45 * (spaces / Math.max(1e-6, needed));
  return safePositive(raw * Math.min(1, parkingOk));
}

/** お店を1 tick 進める。売上を返す（業種ごとにやり方が違う） */
function runShop(ctx: EngineContext, div: Division, dt: number): number {
  const { state } = ctx;
  const def = BUSINESS_MAP[div.kind];
  const m = shopModel(div.kind);

  // 在庫が傷む（食材・生鮮）。傷んだぶんは捨てる
  if (m.spoilPerHour > 0) {
    const keep = Math.pow(1 - m.spoilPerHour, dt / 3600);
    for (const [id, n] of Object.entries(div.stock) as [ResourceId, number][]) {
      if (!n || n <= 0) continue;
      const left = n * keep;
      const lost = n - left;
      if (lost > 0) {
        div.stock[id] = clean(left);
        div.wasted = safe((div.wasted ?? 0) + lost);
      }
    }
  }

  const customers = customersPerSec(state, div) * dt;
  if (customers <= 0) return 0;

  // カジノは品物ではなく「賭け」で稼ぐ
  if (div.kind === 'casino') {
    const handle = customers * averageBet(state, div);
    const revenue = handle * houseEdge();
    if (revenue > 0) {
      state.company.cash = safe(state.company.cash + revenue);
      state.company.totalEarned = safe(state.company.totalEarned + revenue);
      div.totalEarned = safe(div.totalEarned + revenue);
      state.stats.totalCommercialIncome = safe(state.stats.totalCommercialIncome + revenue);
      div.handle = safe((div.handle ?? 0) + handle);
      div.awareness = Math.min(100, div.awareness + Math.min(0.04, customers * 0.0005) * dt);
    }
    return revenue;
  }

  const goods = (def.goods ?? []).filter((g) => (div.stock[g] ?? 0) > 0);
  if (goods.length === 0) {
    // 品物がないと、来た客はがっかりして帰る（少しずつ知名度が下がる）
    div.awareness = Math.max(0, div.awareness - 0.02 * dt);
    div.lostSales = safe((div.lostSales ?? 0) + customers);
    return 0;
  }

  // 見るだけで帰る客がいる（宝石店やアパレルほど多い。ブランドが上がると決まりやすい）
  const browse = Math.max(0, m.browseRate * (1 - div.brand / 220));
  const buyers = customers * (1 - browse);
  const want = buyers * m.itemsPerCustomer;

  let revenue = 0;
  let sold = 0;
  const shopMult = ctx.derived.modifiers?.shopSales ?? 1;
  const per = want / goods.length;
  for (const g of goods) {
    const have = div.stock[g] ?? 0;
    const take = Math.min(have, per);
    if (take <= 0) continue;
    div.stock[g] = clean(have - take);
    revenue += take * retailPrice(state, div, g, shopMult);
    sold += take;
  }
  if (sold > 0) {
    state.company.cash = safe(state.company.cash + revenue);
    state.company.totalEarned = safe(state.company.totalEarned + revenue);
    div.totalEarned = safe(div.totalEarned + revenue);
    state.stats.totalCommercialIncome = safe(state.stats.totalCommercialIncome + revenue);
    div.sold = safe((div.sold ?? 0) + sold);
    // 売れた数のぶんだけ、口コミで少しずつ知られていく
    const gain = Math.min(0.05, sold * 0.0006) * (ctx.derived.modifiers?.awarenessGain ?? 1);
    div.awareness = Math.min(100, div.awareness + gain * dt);
  }
  // 売り切れていたぶんは機会損失
  if (sold + 1e-9 < want) {
    div.lostSales = safe((div.lostSales ?? 0) + (want - sold));
    div.awareness = Math.max(0, div.awareness - 0.01 * dt);
  }
  return revenue;
}

/** 本社の在庫からお店へ品物を送る（入荷）。送った数を返す */
export function restockShop(ctx: EngineContext, div: Division, resource: ResourceId, amount: number): number {
  const { state } = ctx;
  const have = state.inventory[resource] ?? 0;
  const take = Math.min(have, Math.floor(amount));
  if (take <= 0) return 0;
  state.inventory[resource] = clean(have - take);
  div.stock[resource] = clean((div.stock[resource] ?? 0) + take);
  return take;
}

/** 店から本社へ品物を戻す（出荷の取り消し） */
export function returnFromShop(ctx: EngineContext, div: Division, resource: ResourceId, amount: number): number {
  const { state, derived } = ctx;
  const have = div.stock[resource] ?? 0;
  const room = Math.max(0, derived.capacity - (state.inventory[resource] ?? 0));
  const take = Math.min(have, Math.floor(amount), Math.floor(room));
  if (take <= 0) return 0;
  div.stock[resource] = clean(have - take);
  state.inventory[resource] = clean((state.inventory[resource] ?? 0) + take);
  return take;
}

/** 自動入荷（目標の個数まで、本社の在庫から補充する） */
function runAutoRestock(ctx: EngineContext, div: Division): void {
  for (const [id, target] of Object.entries(div.restock ?? {}) as [ResourceId, number][]) {
    if (!target || target <= 0) continue;
    const have = div.stock[id] ?? 0;
    if (have >= target * 0.5) continue;
    restockShop(ctx, div, id, target - have);
  }
}


// ---------- 鉱区（ゴールドラッシュ） ----------

/** 掘って出るもののうち、価値の高い順に優先する */
const PRECIOUS: ResourceId[] = ['gold_ore', 'rough_gem', 'silver_ore', 'uranium_ore', 'copper_ore', 'iron_ore', 'coal', 'crude_oil', 'stone'];

/** その鉱区に残っている埋蔵の一覧（多い順ではなく、価値の高い順） */
export function claimDeposits(state: GameState, div: Division): { id: ResourceId; remaining: number }[] {
  const land = getLand(state, div.landId);
  if (!land) return [];
  const out: { id: ResourceId; remaining: number }[] = [];
  for (const id of PRECIOUS) {
    const d = land.deposits[id];
    if (d && d.remaining > 0) out.push({ id, remaining: d.remaining });
  }
  for (const [id, d] of Object.entries(land.deposits) as [ResourceId, { remaining: number } | undefined][]) {
    if (!d || d.remaining <= 0 || PRECIOUS.includes(id)) continue;
    out.push({ id, remaining: d.remaining });
  }
  return out;
}

/** 1秒あたりに掘れる量 */
export function digPerSec(state: GameState, div: Division, mult = 1): number {
  const land = getLand(state, div.landId);
  if (!land || land.survey < 2) return 0;
  return safePositive(div.staff * 0.4 * (1 + div.brand / 250) * (div.rush && div.rush > 0 ? 3 : 1) * mult);
}

/** 鉱区を1 tick 進める。掘り出したものを本社の在庫に入れる */
function runMine(ctx: EngineContext, div: Division, dt: number): number {
  const { state, derived, rng } = ctx;
  const land = getLand(state, div.landId);
  if (!land) return 0;
  if (div.rush && div.rush > 0) div.rush = Math.max(0, div.rush - dt);
  if (land.survey < 2) {
    div.note = 'この土地はまだ地質調査が終わっていません（地図の詳細から調査できます）';
    return 0;
  }
  const deposits = claimDeposits(state, div);
  if (deposits.length === 0) {
    div.note = 'ここはもう掘り尽くしました。別の土地に移すか、事業をたたみましょう';
    return 0;
  }
  div.note = '';
  // まれに大鉱脈に当たる（ゴールドラッシュ）
  if (!div.rush && rng() < 0.00008 * dt * Math.max(1, div.staff)) {
    div.rush = 180;
    div.awareness = Math.min(100, div.awareness + 8);
    div.brand = Math.min(100, div.brand + 3);
    ctx.emit('success', `${div.name}が大きな鉱脈を掘り当てました！ しばらく産出が3倍になります`, { toast: true });
  }
  const total = digPerSec(state, div, derived.modifiers?.devSpeed ?? 1) * dt;
  if (total <= 0) return 0;
  // 価値の高いものほど出にくい。上から順に少しずつ
  let left = total;
  let value = 0;
  for (let i = 0; i < deposits.length && left > 0; i++) {
    const d = deposits[i];
    const share = i === 0 ? left * 0.55 : left * 0.35;
    const take = Math.min(d.remaining, share, left);
    if (take <= 0) continue;
    const dep = land.deposits[d.id];
    if (dep) dep.remaining = clean(dep.remaining - take);
    const added = addResource(state, d.id, take, derived.capacity, 'gathered');
    value += added * (RESOURCE_MAP[d.id]?.basePrice ?? 1);
    left -= take;
  }
  div.dug = safe((div.dug ?? 0) + (total - left));
  return value;
}

// ---------- 案件と製品 ----------

/** 1秒あたりの仕事量（開発力）。運用に取られている人は引く */
export function devPerSec(_state: GameState, div: Division, devMult = 1): number {
  const def = BUSINESS_MAP[div.kind];
  const busy = div.products.reduce((a, p) => a + (PROJECT_MAP[p.projectId]?.product?.upkeepStaff ?? 0), 0);
  const free = Math.max(0, div.staff - busy);
  // ブランドが高いほど良い人が集まり、1人あたりの仕事量も上がる
  return safePositive(free * def.outputPerStaff * (1 + div.brand / 200) * devMult);
}

/** 製品の利用者数の目標（知名度とブランドで決まる） */
function targetUsers(div: Division, def: ProjectDef): number {
  const p = def.product;
  if (!p) return 0;
  return p.baseUsers * (0.5 + div.awareness / 70) * (1 + div.brand / 100);
}

/** 案件を始める */
export function startProject(ctx: EngineContext, div: Division, projectId: string): { ok: boolean; reason?: string } {
  const { state } = ctx;
  const def = PROJECT_MAP[projectId];
  if (!def) return { ok: false, reason: 'その案件はありません' };
  if (def.business !== div.kind) return { ok: false, reason: 'この事業では受けられない案件です' };
  if (!isProjectAvailable(state, def)) return { ok: false, reason: '研究がまだ終わっていません' };
  if (div.projects.some((p) => p.projectId === projectId)) return { ok: false, reason: 'すでに進めています' };
  if (div.projects.length >= 3) return { ok: false, reason: '同時に進められるのは3件までです' };
  if (state.company.cash + 1e-9 < def.startCost) return { ok: false, reason: '着手金が足りません' };
  if (def.inputs) {
    for (const [id, n] of Object.entries(def.inputs) as [ResourceId, number][]) {
      if ((state.inventory[id] ?? 0) + 1e-9 < n) return { ok: false, reason: `材料が足りません（${RESOURCE_MAP[id].name} ${n}個）` };
    }
    for (const [id, n] of Object.entries(def.inputs) as [ResourceId, number][]) {
      state.inventory[id] = clean((state.inventory[id] ?? 0) - n);
    }
  }
  if (def.startCost > 0) {
    state.company.cash = safe(state.company.cash - def.startCost);
    state.company.totalSpent = safe(state.company.totalSpent + def.startCost);
  }
  div.projects.push({ projectId, work: 0, startedAt: ctx.now() });
  ctx.emit('info', `${div.name}で「${def.name}」を始めました`);
  return { ok: true };
}

/** 案件をやめる（着手金は戻らない） */
export function cancelProject(ctx: EngineContext, div: Division, projectId: string): boolean {
  const before = div.projects.length;
  div.projects = div.projects.filter((p) => p.projectId !== projectId);
  if (div.projects.length === before) return false;
  ctx.emit('warn', `${div.name}の「${PROJECT_MAP[projectId]?.name ?? projectId}」をやめました`);
  return true;
}

/** 案件が完成したときの処理 */
function completeProject(ctx: EngineContext, div: Division, active: ActiveProject): void {
  const { state } = ctx;
  const def = PROJECT_MAP[active.projectId];
  if (!def) return;
  if (def.reward > 0) {
    state.company.cash = safe(state.company.cash + def.reward);
    state.company.totalEarned = safe(state.company.totalEarned + def.reward);
    div.totalEarned = safe(div.totalEarned + def.reward);
  }
  div.brand = Math.min(100, div.brand + def.brand * (ctx.derived.modifiers?.brandGain ?? 1));
  div.awareness = Math.min(100, div.awareness + def.awareness * (ctx.derived.modifiers?.awarenessGain ?? 1));
  if (def.research_points > 0) {
    state.research.points = safe(state.research.points + def.research_points);
    state.research.totalPoints = safe(state.research.totalPoints + def.research_points);
  }
  div.completed += 1;
  // 運営（アップデート）は、出している製品の利用者を呼び戻す
  if (def.id === 'game_live' || def.id === 'app_recommend') {
    for (const p of div.products) {
      const d = PROJECT_MAP[p.projectId];
      if (d?.product) p.users = Math.min(targetUsers(div, d) * 1.2, p.users * 1.8 + d.product.baseUsers * 0.2);
    }
  }
  if (def.product) {
    const users = targetUsers(div, def);
    const bs = businessState(state);
    div.products.push({ id: bs.nextId++, projectId: def.id, name: def.name, users, peakUsers: users, releasedAt: ctx.now() });
    ctx.emit('success', `${div.name}が「${def.name}」を発売しました（利用者 ${Math.round(users).toLocaleString('ja-JP')}人）`, { toast: true });
  } else {
    ctx.emit('success', `${div.name}が「${def.name}」を完了しました${def.reward > 0 ? ` (+${def.reward.toLocaleString('ja-JP')}円)` : ''}`, { toast: true });
  }
}

/** 会社（案件をこなす事業）を1 tick 進める。収入を返す */
function runStudio(ctx: EngineContext, div: Division, dt: number): number {
  const { state } = ctx;
  const power = devPerSec(state, div, ctx.derived.modifiers?.devSpeed ?? 1) * dt;
  if (power > 0 && div.projects.length > 0) {
    const share = power / div.projects.length;
    for (const active of [...div.projects]) {
      const def = PROJECT_MAP[active.projectId];
      if (!def) continue;
      active.work += share;
      if (active.work >= def.work) {
        div.projects = div.projects.filter((p) => p !== active);
        completeProject(ctx, div, active);
      }
    }
  }
  // 発売した製品の収入
  let revenue = 0;
  for (const p of [...div.products]) {
    const def = PROJECT_MAP[p.projectId];
    if (!def?.product) continue;
    revenue += p.users * def.product.revenuePerUser * (ctx.derived.modifiers?.productRevenue ?? 1) * dt;
    // 飽きられて減っていく。知名度とブランドが高いと減りが遅い
    const decay = def.product.decayPerHour * (1 - Math.min(0.6, div.awareness / 250 + div.brand / 250));
    p.users = safePositive(p.users * Math.pow(1 - decay, dt / 3600));
    if (p.users < 10) {
      div.products = div.products.filter((x) => x.id !== p.id);
      ctx.emit('info', `${div.name}の「${p.name}」は利用者がいなくなりました`);
    }
  }
  if (revenue > 0) {
    state.company.cash = safe(state.company.cash + revenue);
    state.company.totalEarned = safe(state.company.totalEarned + revenue);
    div.totalEarned = safe(div.totalEarned + revenue);
  }
  return revenue;
}

// ---------- 開業・従業員・広告 ----------

/** 事業を始める */
export function openDivision(ctx: EngineContext, kind: BusinessKindId, landId: string, name?: string): { ok: boolean; reason?: string; id?: number } {
  const { state } = ctx;
  const def = BUSINESS_MAP[kind];
  if (!def) return { ok: false, reason: 'その業種はありません' };
  if (!isBusinessUnlocked(state, kind)) return { ok: false, reason: `研究「${def.research}」がまだです` };
  const land = getLand(state, landId);
  if (!land) return { ok: false, reason: 'その場所を持っていません' };
  if (divisions(state).some((d) => d.landId === landId)) return { ok: false, reason: 'そこにはもう事業があります' };
  if (state.company.cash + 1e-9 < def.setupCost) return { ok: false, reason: '開業の費用が足りません' };
  state.company.cash = safe(state.company.cash - def.setupCost);
  state.company.totalSpent = safe(state.company.totalSpent + def.setupCost);
  const bs = businessState(state);
  const div: Division = {
    id: bs.nextId++,
    kind,
    name: name?.trim() || `${state.company.name}${def.name}`,
    landId,
    staff: def.initialStaff,
    awareness: 0,
    brand: 0,
    openedAt: ctx.now(),
    ads: [],
    parkingLands: [],
    stock: {},
    restock: {},
    projects: [],
    products: [],
    totalEarned: 0,
    completed: 0,
  };
  bs.divisions.push(div);
  ctx.emit('success', `${land.name}に「${div.name}」を開きました (-${def.setupCost.toLocaleString('ja-JP')}円)`, { toast: true });
  return { ok: true, id: div.id };
}

/** 事業をたたむ（在庫は本社に戻る） */
export function closeDivision(ctx: EngineContext, id: number): boolean {
  const { state } = ctx;
  const div = getDivision(state, id);
  if (!div) return false;
  for (const [rid, n] of Object.entries(div.stock) as [ResourceId, number][]) {
    if (n > 0) returnFromShop(ctx, div, rid, n);
  }
  businessState(state).divisions = divisions(state).filter((d) => d.id !== id);
  ctx.emit('info', `「${div.name}」をたたみました`);
  return true;
}

/** 人を雇う・減らす */
export function setStaff(ctx: EngineContext, id: number, staff: number): boolean {
  const { state } = ctx;
  const div = getDivision(state, id);
  if (!div) return false;
  const def = BUSINESS_MAP[div.kind];
  div.staff = Math.max(0, Math.min(def.maxStaff, Math.floor(staff)));
  return true;
}

/** 広告を出す */
export function startAd(ctx: EngineContext, id: number, adId: string): { ok: boolean; reason?: string } {
  const { state } = ctx;
  const div = getDivision(state, id);
  if (!div) return { ok: false, reason: 'その事業はありません' };
  const def = AD_MAP[adId];
  if (!def) return { ok: false, reason: 'その広告はありません' };
  if (def.research && !state.research.completed[def.research]) return { ok: false, reason: '研究がまだ終わっていません' };
  if (div.ads.some((a) => a.adId === adId)) return { ok: false, reason: 'すでに出しています' };
  if (adId === 'billboard' && (div.parkingLands.length === 0 ? false : false)) return { ok: false };
  if (adId === 'billboard') {
    // 看板は自分の土地に立てる。どこか1つでも持っていればよい
    const owned = Object.keys(state.estate.custom ?? {}).length;
    if (owned === 0) return { ok: false, reason: '看板を立てる土地がありません（地図で土地を買ってください）' };
  }
  div.ads.push({ adId, remaining: def.duration });
  ctx.emit('info', `${div.name}で「${def.name}」を始めました（${Math.round(def.costPerSec)}円/秒）`);
  return { ok: true };
}

/** 駐車場として土地を割り当てる・外す */
export function toggleParking(ctx: EngineContext, id: number, landId: string): boolean {
  const { state } = ctx;
  const div = getDivision(state, id);
  if (!div) return false;
  const i = div.parkingLands.indexOf(landId);
  if (i >= 0) div.parkingLands.splice(i, 1);
  else {
    // ほかの事業が使っている土地は使えない
    if (divisions(state).some((d) => d.parkingLands.includes(landId))) return false;
    if (!getCustom(state, landCustomId(landId) ?? '')) return false;
    div.parkingLands.push(landId);
  }
  return true;
}

// ---------- 毎 tick ----------

/** すべての事業を進める。収入の合計を返す */
export function runBusiness(ctx: EngineContext, dt: number): { income: number; wages: number } {
  const { state } = ctx;
  const bs = state.business;
  if (!bs || bs.divisions.length === 0) return { income: 0, wages: 0 };
  let income = 0;
  let adCost = 0;
  for (const div of bs.divisions) {
    // 広告
    const ad = adEffect(div);
    if (ad.perSec > 0) {
      const cost = ad.costPerSec * (ctx.derived.modifiers?.adCost ?? 1) * dt;
      if (state.company.cash >= cost) {
        state.company.cash = safe(state.company.cash - cost);
        state.company.totalSpent = safe(state.company.totalSpent + cost);
        adCost += cost;
        const gain = ad.perSec * (ctx.derived.modifiers?.awarenessGain ?? 1);
        if (div.awareness < ad.cap) div.awareness = Math.min(ad.cap, div.awareness + gain * dt);
      }
    }
    for (const a of div.ads) a.remaining -= dt;
    const expired = div.ads.filter((a) => a.remaining <= 0);
    if (expired.length > 0) {
      div.ads = div.ads.filter((a) => a.remaining > 0);
      for (const e of expired) ctx.emit('info', `${div.name}の「${AD_MAP[e.adId]?.name ?? e.adId}」の契約が終わりました`);
    }
    // 広告を出していないと、知名度は少しずつ下がる
    if (ad.perSec <= 0) div.awareness = Math.max(0, div.awareness - 0.004 * dt);

    const style = BUSINESS_MAP[div.kind].style;
    if (style === 'shop') {
      runAutoRestock(ctx, div);
      income += runShop(ctx, div, dt);
    } else if (style === 'mine') {
      // 掘り出したものは売上ではなく在庫として入る（値段は目安として数える）
      runMine(ctx, div, dt);
    } else {
      income += runStudio(ctx, div, dt);
    }
  }
  ctx.derived.businessIncome = dt > 0 ? income / dt : 0;
  ctx.derived.adCost = dt > 0 ? adCost / dt : 0;
  return { income, wages: 0 };
}

/** 表示用: 事業の1秒あたりの利益（売上 − 人件費 − 広告費） */
export function divisionProfitPerSec(state: GameState, div: Division): number {
  const def = BUSINESS_MAP[div.kind];
  const ad = adEffect(div);
  let revenue = 0;
  if (def.style === 'shop') {
    const m = shopModel(div.kind);
    const customers = customersPerSec(state, div);
    if (div.kind === 'casino') {
      revenue = customers * averageBet(state, div) * houseEdge();
    } else {
      const goods = (def.goods ?? []).filter((g) => (div.stock[g] ?? 0) > 0);
      const browse = Math.max(0, m.browseRate * (1 - div.brand / 220));
      const want = customers * (1 - browse) * m.itemsPerCustomer;
      const per = goods.length > 0 ? want / goods.length : 0;
      for (const g of goods) revenue += Math.min(div.stock[g] ?? 0, per) * retailPrice(state, div, g);
    }
  } else {
    for (const p of div.products) {
      const d = PROJECT_MAP[p.projectId];
      if (d?.product) revenue += p.users * d.product.revenuePerUser;
    }
  }
  return revenue - divisionWage(state, div) - ad.costPerSec;
}

/** 表示用: 事業を建てられる自分の土地（買った物件） */
export function availablePlaces(state: GameState): { landId: string; name: string }[] {
  const used = new Set(divisions(state).map((d) => d.landId));
  return state.lands
    .filter((l) => l.id !== 'hq' && !used.has(l.id))
    .map((l) => ({ landId: l.id, name: l.name }));
}

export { isUnlocked };
