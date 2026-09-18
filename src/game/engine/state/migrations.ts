import { LAND_MAP, isLandDefId } from '@/game/data/lands';
import { GAME_META } from '@/game/data/meta';
import { dropBrokenCustom, addCustomLand } from '../systems/customEstate';
import { createInitialSales } from '../systems/sales';
import { addPropertyLand } from '../systems/estate';
import type { GameState, LandState } from '@/types/state';
import { createHqLand, createInitialAutomation, createInitialBusiness, createInitialCompanyStock, createInitialContracts, createInitialEstate, createInitialPrestige, createInitialState, createInitialStocks } from './createInitialState';
import { CARD_HYPE_MAX, CARD_HYPE_MIN, CARD_MAP, CARD_PRICE_MAX, CARD_PRICE_MIN, SERIES_MAP } from '@/game/data/cards';
import { GATHER_MAP } from '@/game/data/gathering';
import { SKILL_IDS, SKILL_MAP } from '@/game/data/minigames';
import { RECIPE_MAP } from '@/game/data/recipes';
import { createInitialCards } from '../systems/cards';
import { createInitialTrade } from '../systems/trade';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { COUNTRIES, COUNTRY_PRICE_MAX, COUNTRY_PRICE_MIN, FX_MAX, FX_MIN, SHIP_MODE_MAP, isCountryCode } from '@/game/data/trade';

/**
 * 保存されたセーブデータを、いまの形に整えて読み込む。
 *
 * 版をまたぐ「移行処理」はもう持っていない。
 * カード100種の入れ替えに合わせて保存先そのものを v2 にし、
 * それより前のセーブは読まずに捨てることにしたため（SaveService の LEGACY_SAVE_KEYS）。
 *
 * ここに残っているのは移行ではなく「繕い」で、
 * 欠けている項目を埋め、null や壊れた数値を落とす。
 * 保存の途中で電源が落ちたようなセーブでも開けるようにするためのもので、
 * これが無いと一度壊れたセーブは二度と読めなくなる。
 */
export function migrateSave(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new Error('セーブデータの形式が不正です');
  const data = raw as Record<string, unknown>;
  const version = typeof data.saveVersion === 'number' ? data.saveVersion : 0;
  // このコードより新しいセーブは、知らない項目を落としてしまうので読まない
  if (version > GAME_META.saveVersion) {
    throw new Error(`このセーブデータは新しいバージョン(${version})のものです`);
  }
  return fillDefaults(data);
}

function fixEstate(e: Partial<GameState['estate']> | undefined): GameState['estate'] {
  const base = createInitialEstate();
  if (!e) return base;
  const owned = { ...(e.owned ?? {}) };
  // 会社所有の物件: 保存されていればそれを使い、なければ初期値。プレイヤーが持っている物件は会社所有から外す
  const companyOwned = { ...(e.companyOwned ?? base.companyOwned) };
  for (const id of Object.keys(owned)) delete companyOwned[id];
  return { ...base, ...e, owned, custom: { ...(e.custom ?? {}) }, cityMult: { ...base.cityMult, ...(e.cityMult ?? {}) }, companyOwned, nextUpdateIn: typeof e.nextUpdateIn === 'number' ? e.nextUpdateIn : base.nextUpdateIn };
}

function fixSales(v: Partial<GameState['sales']> | undefined): GameState['sales'] {
  const base = createInitialSales();
  if (!v) return base;
  return {
    clients: { ...(v.clients ?? {}) },
    offers: Array.isArray(v.offers) ? v.offers : [],
    deals: Array.isArray(v.deals) ? v.deals : [],
    nextId: typeof v.nextId === 'number' ? v.nextId : 1,
  };
}

/** ゲームの中の暦。壊れていると日付が NaN になって画面が崩れるので、必ず数に直す */
function fixCalendar(v: unknown): GameState['calendar'] {
  const x = (v ?? {}) as Record<string, unknown>;
  const days = typeof x.elapsedDays === 'number' && Number.isFinite(x.elapsedDays) ? Math.max(0, x.elapsedDays) : 0;
  const month = typeof x.lastMonth === 'number' && x.lastMonth >= 1 && x.lastMonth <= 12 ? Math.floor(x.lastMonth) : 4;
  const season = typeof x.lastSeason === 'string' ? x.lastSeason : 'spring';
  return { elapsedDays: days, lastMonth: month, lastSeason: season };
}

/**
 * 気になる場所の印。
 * 壊れた要素（座標が数でないものなど）は、そのままだと地図が飛べなくなるので落とす。
 */
/**
 * 手仕事の腕。壊れていると倍率が NaN になって生産が全部止まるので、必ず数に直す。
 * 知らない腕の名前は捨てる（遊びを入れ替えたときに古い値が残らないように）。
 */
function fixSkills(v: unknown): GameState['skills'] {
  const out: NonNullable<GameState['skills']> = {};
  const x = (v ?? {}) as Record<string, unknown>;
  for (const id of SKILL_IDS) {
    const row = (x[id] ?? {}) as Record<string, unknown>;
    const num = (k: string) => (typeof row[k] === 'number' && Number.isFinite(row[k] as number) ? Math.max(0, row[k] as number) : 0);
    const level = Math.min(SKILL_MAP[id].maxLevel, Math.floor(num('level')));
    out[id] = { level, exp: num('exp'), plays: Math.floor(num('plays')), best: Math.min(1, num('best')) };
  }
  return out;
}

function fixBookmarks(v: unknown): GameState['bookmarks'] {
  if (!Array.isArray(v)) return [];
  const out: NonNullable<GameState['bookmarks']> = [];
  const seen = new Set<string>();
  for (const b of v) {
    if (!b || typeof b !== 'object') continue;
    const x = b as Record<string, unknown>;
    if (typeof x.id !== 'string' || typeof x.label !== 'string') continue;
    if (typeof x.lat !== 'number' || typeof x.lon !== 'number' || !Number.isFinite(x.lat) || !Number.isFinite(x.lon)) continue;
    const kind = x.kind === 'land' || x.kind === 'property' || x.kind === 'client' || x.kind === 'company' ? x.kind : 'feature';
    const key = `${kind}:${x.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind,
      id: x.id,
      label: x.label,
      sub: typeof x.sub === 'string' ? x.sub : undefined,
      lat: x.lat,
      lon: x.lon,
      note: typeof x.note === 'string' ? x.note : undefined,
      at: typeof x.at === 'number' && Number.isFinite(x.at) ? x.at : 0,
    });
  }
  return out.slice(-200);
}

/**
 * 電力会社との契約。
 * 壊れた値（マイナス・数でないもの）が入っていると基本料金の計算が狂って
 * 所持金が飛ぶので、必ず 0 以上の数に直す。
 */
function fixPower(v: Partial<GameState['power']> | undefined): GameState['power'] {
  const mw = typeof v?.contractMW === 'number' && Number.isFinite(v.contractMW) ? Math.max(0, v.contractMW) : 0;
  return { contractMW: mw };
}

/** グラフ用の記録。配列でなければ作り直す（壊れていると毎 tick で例外になる） */
function fixHistory(v: Partial<GameState['history']> | undefined): GameState['history'] {
  const nums = (a: unknown): number[] => (Array.isArray(a) ? a.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : []);
  return {
    assets: nums(v?.assets),
    income: nums(v?.income),
    employees: nums(v?.employees),
    nextIn: typeof v?.nextIn === 'number' && Number.isFinite(v.nextIn) ? v.nextIn : 0,
  };
}

function fixBusiness(v: Partial<GameState['business']> | undefined): GameState['business'] {
  const base = createInitialBusiness();
  if (!v) return base;
  return {
    divisions: Array.isArray(v.divisions)
      ? v.divisions
          // 業種と場所が分からない事業は、置いておくと毎 tick で落ちるので捨てる
          .filter((d) => !!d && typeof d === 'object' && typeof d.kind === 'string' && typeof d.landId === 'string')
          .map((d) => ({
          ...d,
          ads: Array.isArray(d.ads) ? d.ads : [],
          parkingLands: Array.isArray(d.parkingLands) ? d.parkingLands : [],
          stock: { ...(d.stock ?? {}) },
          restock: { ...(d.restock ?? {}) },
          projects: Array.isArray(d.projects)
            ? d.projects
                .filter((pr) => !!pr && typeof pr === 'object' && typeof pr.projectId === 'string')
                .map((pr) => ({
                  ...pr,
                  work: num(pr.work, 0),
                  // 工程と進め方は後から足したもの。古いセーブは「ふつう」で進めていたことにする
                  pace: pr.pace ?? 'normal',
                  phaseScores: Array.isArray(pr.phaseScores) ? pr.phaseScores.map((x) => num(x, 50)) : [],
                }))
            : [],
          products: Array.isArray(d.products) ? d.products.filter((pd) => !!pd && typeof pd === 'object') : [],
          staff: num(d.staff, 0),
          awareness: num(d.awareness, 0),
          brand: num(d.brand, 0),
          totalEarned: num(d.totalEarned, 0),
          completed: num(d.completed, 0),
        }))
      : [],
    nextId: typeof v.nextId === 'number' ? v.nextId : 1,
  };
}

/**
 * 市場の相場を直す。
 * history が配列でないと runMarket の push で落ちる（読み込みは通ってしまうので、
 * バックアップ復元も働かないまま毎 tick 例外になる）。
 */
function fixMarketPrices(v: GameState['market']['prices'] | undefined): GameState['market']['prices'] {
  const out: GameState['market']['prices'] = {};
  for (const [id, m] of Object.entries(v ?? {})) {
    if (!m || typeof m !== 'object') continue;
    out[id as keyof GameState['market']['prices']] = {
      modifier: num(m.modifier, 1),
      history: Array.isArray(m.history) ? m.history.filter((x) => Number.isFinite(x)) : [],
      saturation: num(m.saturation, 0),
    };
  }
  return out;
}

function fixCards(v: Partial<GameState['cards']> | undefined): GameState['cards'] {
  const base = createInitialCards();
  if (!v) return base;
  const owned: Record<string, number> = {};
  for (const [id, n] of Object.entries(v.owned ?? {})) {
    if (!CARD_MAP[id]) continue;
    const c = num(n, 0);
    if (c > 0) owned[id] = Math.floor(c);
  }
  const price: Record<string, number> = {};
  for (const [id, n] of Object.entries(v.price ?? {})) {
    if (!CARD_MAP[id]) continue;
    price[id] = Math.max(CARD_PRICE_MIN, Math.min(CARD_PRICE_MAX, num(n, 1)));
  }
  return {
    owned,
    price,
    hype: Math.max(CARD_HYPE_MIN, Math.min(CARD_HYPE_MAX, num(v.hype, 1))),
    nextDriftIn: num(v.nextDriftIn, 45),
    packsOpened: num(v.packsOpened, 0),
    spent: num(v.spent, 0),
    earned: num(v.earned, 0),
    // もう無い弾の受け取り済み印は捨てる（入れ替え前のカードの名残）
    claimed: Object.fromEntries(
      Object.entries(v.claimed ?? {}).filter(([id, on]) => on === true && SERIES_MAP[id] !== undefined),
    ),
    bestPull: typeof v.bestPull === 'string' ? v.bestPull : '',
  };
}

/**
 * 貿易の状態を繕う。
 * 輸送中の荷は「もう無い国・品・手段」を指していたら捨てる（そのまま進めると届いた瞬間に落ちる）。
 */
function fixTrade(v: Partial<GameState['trade']> | undefined): GameState['trade'] {
  const base = createInitialTrade();
  if (!v) return base;
  const fx: Record<string, number> = { ...base.fx };
  for (const c of COUNTRIES) {
    const got = num((v.fx ?? {})[c.id], 1);
    fx[c.id] = Math.max(FX_MIN, Math.min(FX_MAX, got));
  }
  const priceMult: Record<string, number> = {};
  for (const [k, n] of Object.entries(v.priceMult ?? {})) {
    const [country, resource] = k.split(':');
    if (!isCountryCode(country) || !RESOURCE_MAP[resource as ResourceId]) continue;
    priceMult[k] = Math.max(COUNTRY_PRICE_MIN, Math.min(COUNTRY_PRICE_MAX, num(n, 1)));
  }
  const shipments = (Array.isArray(v.shipments) ? v.shipments : []).filter(
    (s) => s && isCountryCode(s.country) && RESOURCE_MAP[s.resource as ResourceId] && SHIP_MODE_MAP[s.mode as keyof typeof SHIP_MODE_MAP] && num(s.qty, 0) > 0,
  ).map((s) => ({
    ...s,
    id: num(s.id, 0),
    qty: Math.max(0, Math.floor(num(s.qty, 0))),
    remaining: Math.max(0, num(s.remaining, 0)),
    totalSeconds: Math.max(1, num(s.totalSeconds, 1)),
    amount: Math.max(0, num(s.amount, 0)),
    kind: s.kind === 'export' ? ('export' as const) : ('import' as const),
  }));
  const offers = (Array.isArray(v.offers) ? v.offers : []).filter(
    (o) => o && isCountryCode(o.country) && RESOURCE_MAP[o.resource as ResourceId] && num(o.qty, 0) > 0 && num(o.unitPrice, 0) > 0,
  ).map((o) => ({
    ...o,
    id: num(o.id, 0),
    qty: Math.max(1, Math.floor(num(o.qty, 0))),
    unitPrice: Math.max(1, num(o.unitPrice, 1)),
    expiresIn: Math.max(0, num(o.expiresIn, 0)),
    kind: o.kind === 'sell' ? ('sell' as const) : ('buy' as const),
    company: typeof o.company === 'string' && o.company ? o.company : '取引先',
    place: typeof o.place === 'string' && o.place ? o.place : '',
  }));
  const maxId = Math.max(0, ...shipments.map((s) => s.id), ...offers.map((o) => o.id));
  return {
    fx,
    priceMult,
    shipments,
    offers,
    nextOfferIn: num(v.nextOfferIn, base.nextOfferIn),
    nextDriftIn: num(v.nextDriftIn, base.nextDriftIn),
    nextId: Math.max(num(v.nextId, 1), maxId + 1),
    spent: num(v.spent, 0),
    earned: num(v.earned, 0),
    freight: num(v.freight, 0),
    duty: num(v.duty, 0),
  };
}

function fixAutomation(v: Partial<GameState['automation']> | undefined): GameState['automation'] {
  const base = createInitialAutomation();
  if (!v) return base;
  return {
    on: { ...(v.on ?? {}) },
    // もう無いレシピや採集が残っていると、自動化の巡回がそこで止まる。読み込むときに落としておく
    recipes: Array.isArray(v.recipes) ? v.recipes.filter((id) => RECIPE_MAP[id] !== undefined) : [],
    gathers: Array.isArray(v.gathers) ? v.gathers.filter((id) => GATHER_MAP[id] !== undefined) : [],
    timers: { ...(v.timers ?? {}) },
  };
}

function fixStocks(s: Partial<GameState['stocks']> | undefined): GameState['stocks'] {
  const base = createInitialStocks();
  if (!s) return base;
  const companies: GameState['stocks']['companies'] = {};
  for (const id of Object.keys(base.companies)) {
    const c = s.companies?.[id];
    companies[id] = c ? { ...createInitialCompanyStock(), ...c, history: Array.isArray(c.history) ? c.history : [] } : createInitialCompanyStock();
  }
  return {
    companies,
    nextUpdateIn: typeof s.nextUpdateIn === 'number' ? s.nextUpdateIn : base.nextUpdateIn,
    rivalIn: typeof s.rivalIn === 'number' ? s.rivalIn : base.rivalIn,
    issueIn: typeof s.issueIn === 'number' ? s.issueIn : base.issueIn,
  };
}


function fixContracts(c: Partial<GameState['contracts']> | undefined): GameState['contracts'] {
  const base = createInitialContracts();
  if (!c) return base;
  return {
    ...base,
    ...c,
    active: Array.isArray(c.active) ? c.active.filter((a) => !!a && typeof a === 'object') : [],
    nextIn: num(c.nextIn, base.nextIn),
    nextId: num(c.nextId, 1),
    credit: num(c.credit, 0),
  };
}

function fixPrestige(p: Partial<GameState['prestige']> | undefined): GameState['prestige'] {
  const base = createInitialPrestige();
  if (!p) return base;
  return {
    ...base,
    ...p,
    // ポイントが null だと永続アップグレードが永久に買えなくなる
    points: num(p.points, 0),
    count: num(p.count, 0),
    upgrades: { ...(p.upgrades ?? {}) },
    history: Array.isArray(p.history) ? p.history.filter((h) => !!h && typeof h === 'object') : [],
  };
}

/** 数として読めないもの（null・undefined・NaN）を既定値にする */
function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** 数字だけの入れ物を掃除する（壊れた値が混ざっていても止まらないように） */
function cleanNumbers<T extends Record<string, unknown>>(rec: T | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** 欠けているフィールドを初期値で補う（部分的に壊れたセーブにも耐える） */
export function fillDefaults(data: Record<string, unknown>): GameState {
  const base = createInitialState();
  const d = data as Partial<GameState>;
  // 要素が null や文字列の土地が混ざっていると、読み込めてもそのあと毎 tick で落ちる。
  // ここで捨てておく（本社は下で必ず足しなおす）
  const rawLands = Array.isArray(d.lands) ? d.lands.filter((l) => !!l && typeof l === 'object' && typeof l.id === 'string') : [];
  const lands = rawLands.length > 0 ? rawLands : base.lands;
  const hqBase = createHqLand();
  const fixedLands: LandState[] = lands.map((l) => ({
    ...(l.id === 'hq' ? hqBase : {}),
    ...l,
    // 名前が欠けていると、画面に「undefined に輸送手段がありません」のような文が出てしまう。
    // 元の一覧にある土地なら名前を引き直し、無ければ当たり障りのない名前にしておく
    name: l.name ?? (l.id === 'hq' ? hqBase.name : (isLandDefId(l.id) ? LAND_MAP[l.id].name : '名前のない土地')),
    country: l.country ?? (l.id === 'hq' ? hqBase.country : (isLandDefId(l.id) ? LAND_MAP[l.id].country : '—')),
    region: l.region ?? (l.id === 'hq' ? hqBase.region : (isLandDefId(l.id) ? LAND_MAP[l.id].region : '—')),
    terrain: l.terrain ?? (l.id === 'hq' ? hqBase.terrain : (isLandDefId(l.id) ? LAND_MAP[l.id].terrain : 'plains')),
    purchasedAt: l.purchasedAt ?? 0,
    survey: l.survey ?? (l.id === 'hq' ? 4 : 0),
    surveyProgress: l.surveyProgress ?? null,
    deposits: l.deposits ?? {},
    stock: l.stock ?? {},
  }));
  if (!fixedLands.some((l) => l.id === 'hq')) fixedLands.unshift(hqBase);
  const result: GameState = {
    ...base,
    ...d,
    saveVersion: GAME_META.saveVersion,
    meta: { ...base.meta, ...(d.meta ?? {}) },
    // 壊れた数（null や NaN）が紛れ込んでいても、そこから先が全部おかしくならないように直す
    company: {
      ...base.company,
      ...(d.company ?? {}),
      cash: num(d.company?.cash, base.company.cash),
      totalEarned: num(d.company?.totalEarned, 0),
      totalSpent: num(d.company?.totalSpent, 0),
      facilityInvestment: num(d.company?.facilityInvestment, 0),
      landInvestment: num(d.company?.landInvestment, 0),
      debtSeconds: num(d.company?.debtSeconds, 0),
    },
    inventory: cleanNumbers(d.inventory as Record<string, unknown> | undefined),
    discovered: { ...base.discovered, ...(d.discovered ?? {}) },
    tools: { ...(d.tools ?? {}) },
    facilities: Array.isArray(d.facilities)
      ? d.facilities
          .filter((f) => f && typeof f.typeId === 'string')
          .map((f) => {
            const landId = f.landId ?? 'hq';
            const fixed = { ...f, landId, id: f.id ?? `${landId}:${f.typeId}`, enabled: f.enabled ?? true, count: num(f.count, 0) };
            if (f.spent !== undefined) fixed.spent = num(f.spent, 0);
            return fixed;
          })
      : [],
    lands: fixedLands,
    market: {
      ...base.market,
      ...(d.market ?? {}),
      nextUpdateIn: num(d.market?.nextUpdateIn, base.market.nextUpdateIn),
      prices: fixMarketPrices(d.market?.prices),
      autoSell: { ...(d.market?.autoSell ?? {}) },
    },
    stats: { ...base.stats, ...(d.stats ?? {}) },
    unlocked: { ...(d.unlocked ?? {}) },
    achievements: { ...(d.achievements ?? {}) },
    tutorial: { ...base.tutorial, ...(d.tutorial ?? {}) },
    research: {
      ...base.research,
      ...(d.research ?? {}),
      points: num(d.research?.points, 0),
      totalPoints: num(d.research?.totalPoints, 0),
      completed: { ...(d.research?.completed ?? {}) },
    },
    events: {
      ...base.events,
      ...(d.events ?? {}),
      active: Array.isArray(d.events?.active) ? d.events.active.filter((a) => !!a && typeof a === 'object') : [],
      nextIn: num(d.events?.nextIn, base.events.nextIn),
      nextId: num(d.events?.nextId, 1),
    },
    estate: fixEstate(d.estate),
    stocks: fixStocks(d.stocks),
    contracts: fixContracts(d.contracts),
    sales: fixSales(d.sales),
    prestige: fixPrestige(d.prestige),
    automation: fixAutomation(d.automation),
    business: fixBusiness(d.business),
    cards: fixCards(d.cards),
    trade: fixTrade(d.trade),
    power: fixPower(d.power),
    bookmarks: fixBookmarks(d.bookmarks),
    skills: fixSkills(d.skills),
    calendar: fixCalendar(d.calendar),
    history: fixHistory(d.history),
    eventLog: Array.isArray(d.eventLog) ? d.eventLog : [],
    nextEventId: typeof d.nextEventId === 'number' ? d.nextEventId : 1,
    // 既に本社を決めているセーブに、いまさら配色の選択を出さない
    settings: (() => {
      const merged = { ...base.settings, ...(d.settings ?? {}) };
      if (merged.themeChosen === undefined) merged.themeChosen = merged.hqChosen === true;
      if (merged.nameChosen === undefined) merged.nameChosen = merged.hqChosen === true;
      // 使い方ガイドの既読は、壊れていても必ず文字列の配列にする
      merged.guidesSeen = Array.isArray(merged.guidesSeen) ? merged.guidesSeen.filter((g: unknown) => typeof g === 'string') : [];
      merged.guidesOff = merged.guidesOff === true;
      return merged;
    })(),
  };
  // 壊れた物件（種類や値段が無いもの）を先に取り除く
  dropBrokenCustom(result);
  // 買った物件は「施設を建てられる土地」として扱う（古いセーブにも足す）
  for (const propertyId of Object.keys(result.estate.owned)) {
    const owned = result.estate.owned[propertyId];
    if (!owned || typeof owned !== 'object') continue;
    addPropertyLand(result, propertyId, num(owned.boughtAt, 0));
  }
  // 地図から買った実在の場所も同じように土地として扱う
  for (const cp of Object.values(result.estate.custom ?? {})) {
    if (!cp || typeof cp !== 'object' || typeof cp.id !== 'string') continue;
    addCustomLand(result, cp);
  }
  return result;
}
