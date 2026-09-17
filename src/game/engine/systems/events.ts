import { CONFIG } from '@/game/data/config';
import { EVENTS, EVENT_MAP, isEventDefId, type EventDef } from '@/game/data/events';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import type { ActiveEvent, EventModifiers, GameState } from '@/types/state';
import type { EngineContext } from '../context';
import { getLand, ownedLands } from '../land';
import { getMarketState } from './market';

export function createEmptyEventMods(): EventModifiers {
  return { landProduction: {}, transport: {}, power: 1, commercial: 1 };
}

/** 売れる資源のうち、プレイヤーが持っている・売ったことのあるもの（イベントの対象候補） */
function marketTargets(state: GameState): ResourceId[] {
  const ids = Object.keys(RESOURCE_MAP) as ResourceId[];
  return ids.filter((id) => RESOURCE_MAP[id].sellable && state.discovered[id] && ((state.stats.totalSold[id] ?? 0) > 0 || (state.inventory[id] ?? 0) > 0));
}

function hasTransport(state: GameState, kinds: readonly string[]): boolean {
  return state.facilities.some((f) => isFacilityId(f.typeId) && f.count > 0 && kinds.includes(FACILITY_MAP[f.typeId].transport?.kind ?? ''));
}

/** そのイベントがいま起こりうるか。対象があれば対象IDを返す */
function pickTarget(ctx: EngineContext, def: EventDef): { ok: boolean; target: string | null } {
  const { state, rng, derived } = ctx;
  const choose = <T>(arr: T[]): T => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
  switch (def.kind) {
    case 'boom':
    case 'crash':
    case 'demand': {
      const targets = marketTargets(state).filter((id) => !state.events.active.some((e) => e.target === id));
      if (targets.length === 0) return { ok: false, target: null };
      return { ok: true, target: choose(targets) };
    }
    case 'quake': {
      const lands = ownedLands(state).filter((l) => state.facilities.some((f) => f.landId === l.id && f.count > 0) && !state.events.active.some((e) => e.target === l.id));
      if (lands.length === 0) return { ok: false, target: null };
      return { ok: true, target: choose(lands).id };
    }
    case 'storm':
      return { ok: hasTransport(state, def.transport ?? []) && !state.events.active.some((e) => e.defId === def.id), target: null };
    case 'heatwave':
      return { ok: derived.power.demand > 0 && !state.events.active.some((e) => e.defId === def.id), target: null };
    case 'festival':
      return { ok: state.facilities.some((f) => isFacilityId(f.typeId) && f.count > 0 && FACILITY_MAP[f.typeId].income !== undefined) && !state.events.active.some((e) => e.defId === def.id), target: null };
    case 'discovery': {
      const lands = ownedLands(state).filter((l) => l.survey >= 2 && Object.keys(l.deposits).length > 0);
      if (lands.length === 0) return { ok: false, target: null };
      return { ok: true, target: choose(lands).id };
    }
    case 'subsidy':
      return { ok: state.stats.playtimeSeconds > 300, target: null };
    default:
      return { ok: false, target: null };
  }
}

function describe(def: EventDef, target: string | null, state: GameState): string {
  let name = '';
  if (target) {
    if (target in RESOURCE_MAP) name = RESOURCE_MAP[target as ResourceId].name;
    else name = getLand(state, target)?.name ?? target;
  }
  return def.description.replace('{target}', name);
}

/** 即時効果のイベントを適用する */
function applyInstant(ctx: EngineContext, def: EventDef, target: string | null): string {
  const { state, derived } = ctx;
  if (def.kind === 'discovery' && target) {
    const land = getLand(state, target);
    if (land) {
      const parts: string[] = [];
      for (const [rid, dep] of Object.entries(land.deposits) as [ResourceId, { total: number; remaining: number }][]) {
        if (!dep) continue;
        const add = Math.round(dep.total * def.magnitude);
        dep.remaining += add;
        dep.total += add;
        parts.push(`${RESOURCE_MAP[rid]?.name ?? rid} +${add.toLocaleString('ja-JP')}`);
      }
      return `${describe(def, target, state)}（${parts.join('、')}）`;
    }
  }
  if (def.kind === 'subsidy') {
    // 収入の magnitude 秒ぶん（最低 5万円）
    const amount = Math.max(50_000, Math.round(Math.max(0, derived.incomePerSec) * def.magnitude));
    state.company.cash += amount;
    state.company.totalEarned += amount;
    return `${describe(def, target, state)} +${amount.toLocaleString('ja-JP')}円`;
  }
  return describe(def, target, state);
}

/** 新しいイベントを起こす。起こせたら true */
export function triggerEvent(ctx: EngineContext, defId?: string): boolean {
  const { state, rng } = ctx;
  if (state.events.active.length >= CONFIG.events.maxActive) return false;
  const candidates: { def: EventDef; target: string | null }[] = [];
  for (const def of EVENTS as readonly EventDef[]) {
    if (defId && def.id !== defId) continue;
    const pick = pickTarget(ctx, def);
    if (pick.ok) candidates.push({ def, target: pick.target });
  }
  if (candidates.length === 0) return false;
  const totalWeight = candidates.reduce((a, c) => a + c.def.weight, 0);
  let r = rng() * totalWeight;
  let chosen = candidates[candidates.length - 1];
  for (const c of candidates) {
    r -= c.def.weight;
    if (r <= 0) {
      chosen = c;
      break;
    }
  }
  const { def, target } = chosen;
  state.stats.eventsOccurred += 1;
  if (def.disaster) state.stats.disasters += 1;
  if (def.duration <= 0) {
    const text = applyInstant(ctx, def, target);
    ctx.emit('event', `${def.name}: ${text}`, { toast: true, eventId: def.id });
    return true;
  }
  const ev: ActiveEvent = { id: state.events.nextId++, defId: def.id, target, remaining: def.duration, total: def.duration, magnitude: def.magnitude };
  if (def.kind === 'demand' && target && target in RESOURCE_MAP) {
    // 需要急増は飽和もリセットする
    getMarketState(state, target as ResourceId).saturation = 0;
  }
  state.events.active.push(ev);
  ctx.emit('event', `${def.name}: ${describe(def, target, state)}`, { toast: true, eventId: def.id });
  return true;
}

/**
 * イベントの進行。残り時間を減らし、期限切れを取り除き、間隔が来たら新しいイベントを起こす。
 * オフライン計算中（offline=true）は新しいイベントを起こさない。
 */
export function runEvents(ctx: EngineContext, dt: number): void {
  const { state, rng } = ctx;
  const ev = state.events;
  for (let i = ev.active.length - 1; i >= 0; i--) {
    const a = ev.active[i];
    a.remaining -= dt;
    if (a.remaining <= 0) {
      ev.active.splice(i, 1);
      const def = isEventDefId(a.defId) ? EVENT_MAP[a.defId] : null;
      if (def) ctx.emit('info', `${def.name}が終わりました`, { toast: false });
    }
  }
  if (!state.settings.events) return;
  ev.nextIn -= dt;
  if (ev.nextIn <= 0) {
    const { minIntervalSeconds, maxIntervalSeconds } = CONFIG.events;
    ev.nextIn = minIntervalSeconds + rng() * (maxIntervalSeconds - minIntervalSeconds);
    if (!ctx.offline()) triggerEvent(ctx);
  }
  ctx.derived.eventMods = computeEventMods(state);
}

/** 進行中のイベントから係数を計算する */
export function computeEventMods(state: GameState): EventModifiers {
  const mods = createEmptyEventMods();
  for (const a of state.events?.active ?? []) {
    if (!isEventDefId(a.defId)) continue;
    const def = EVENT_MAP[a.defId];
    switch (def.kind) {
      case 'quake':
        if (a.target) {
          mods.landProduction[a.target] = (mods.landProduction[a.target] ?? 1) * a.magnitude;
          for (const k of def.transport ?? []) mods.transport[`${a.target}:${k}`] = (mods.transport[`${a.target}:${k}`] ?? 1) * a.magnitude;
        }
        break;
      case 'storm':
        for (const k of def.transport ?? []) mods.transport[k] = (mods.transport[k] ?? 1) * a.magnitude;
        break;
      case 'heatwave':
        mods.power *= a.magnitude;
        break;
      case 'festival':
        mods.commercial *= a.magnitude;
        break;
      default:
        break;
    }
  }
  return mods;
}

/** ある土地の輸送手段（種類）に掛かる倍率 */
export function transportEventMultiplier(mods: EventModifiers, landId: string, kind: string): number {
  return (mods.transport[kind] ?? 1) * (mods.transport[`${landId}:${kind}`] ?? 1);
}
