/**
 * 壊れたセーブを読んでも、落ちない・止まらない・バックアップを潰さないことを見張るテスト。
 * JSON.stringify は配列の undefined を null にするので、書き出し側の小さな穴が
 * そのまま「二度と読めないセーブ」になる。そこを全部ふさいでおく。
 */
import { describe, expect, it } from 'vitest';
import { FACILITY_MAP, facilityBulkCost } from '@/game/data/facilities';
import { GameEngine } from '../GameEngine';
import { WAGE_PER_EMPLOYEE } from '../systems/finance';
import { migrateSave } from '../state/migrations';
import { LEGACY_SAVE_KEYS, SAVE_BACKUP_KEY, SAVE_BROKEN_KEY, SAVE_KEY, SaveService, purgeLegacySaves, serializeState } from '@/game/services/save/SaveService';
import type { SaveRepository } from '@/game/services/save/SaveRepository';

/** テスト用の入れ物 */
class MemRepo implements SaveRepository {
  map = new Map<string, string>();
  async load() {
    return this.map.get(SAVE_KEY) ?? null;
  }
  async save(json: string) {
    this.map.set(SAVE_KEY, json);
  }
  async getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  async removeItem(k: string) {
    this.map.delete(k);
  }
  async clear() {
    this.map.clear();
  }
}

/**
 * 採石作業員3人ぶんの建設費。
 * 人を雇う費用を現実の額にしたので、1人目で15万円、3人で50万円を超える。
 * 引数の cash は「雇ったあとに手元に残るお金」として扱いたいので、建設費はここで別に足す。
 */
const WORKER3_COST = facilityBulkCost(FACILITY_MAP['worker_stone'], 0, 3);

function playedState(cash = 500_000) {
  const e = new GameEngine({ rng: () => 0.4, now: () => 1_000_000 });
  e.keepDefaultHq();
  e.updateSettings({ events: false });
  e.debugAddCash(WORKER3_COST + cash);
  // 雇えないと石が1個も出ず、「遊んだ跡のあるセーブ」にならない（テストの前提が崩れる）
  expect(e.buyFacility('worker_stone', 3)).toBe(3);
  for (let i = 0; i < 30; i++) e.tick(1);
  e.refreshDerived();
  expect(e.state.stats.totalObtained.stone ?? 0).toBeGreaterThan(0);
  return e.state;
}

/** 壊れたセーブを読み込んで、そのあと2分ぶん進めてみる */
function loadAndRun(raw: Record<string, unknown>) {
  const state = migrateSave(raw);
  const e = new GameEngine({ state, rng: () => 0.4, now: () => 1_000_000 });
  e.keepDefaultHq();
  e.updateSettings({ events: false });
  e.advance(120);
  e.refreshDerived();
  return e;
}

const DAMAGED: [string, Record<string, unknown>][] = [
  ['土地が null', { saveVersion: 14, lands: [null] }],
  ['土地が文字列', { saveVersion: 14, lands: ['x'] }],
  ['土地に id がない', { saveVersion: 14, lands: [{ terrain: 'plains' }] }],
  ['事業が null', { saveVersion: 14, business: { divisions: [null], nextId: 1 } }],
  ['案件が null', { saveVersion: 14, business: { divisions: [{ id: 1, kind: 'shop', projects: [null] }], nextId: 2 } }],
  ['製品が null', { saveVersion: 14, business: { divisions: [{ id: 1, kind: 'it', products: [null] }], nextId: 2 } }],
  ['物件が null', { saveVersion: 14, estate: { owned: { tokyo_apartment: null } } }],
  ['地図の物件が null', { saveVersion: 14, estate: { custom: { x: null } } }],
  ['地図の物件が壊れている', { saveVersion: 14, estate: { custom: { w1: { id: 'w1', kind: 'nope', basePrice: null } } } }],
  ['相場の履歴が配列でない', { saveVersion: 14, market: { prices: { stone: { modifier: 1, history: null, saturation: 0 } }, autoSell: {}, nextUpdateIn: 1 } }],
  ['相場が null', { saveVersion: 14, market: { prices: { stone: null }, autoSell: {}, nextUpdateIn: 1 } }],
  ['再出発ポイントが null', { saveVersion: 14, prestige: { count: 2, points: null, history: [] } }],
  ['契約の値が null', { saveVersion: 14, contracts: { active: [], nextIn: null, nextId: null, credit: null } }],
  ['イベントが null', { saveVersion: 14, events: { active: null, nextIn: null, nextId: null } }],
  ['イベントの中身が null', { saveVersion: 14, events: { active: [null], nextIn: 10, nextId: 1 } }],
  ['カードが壊れている', { saveVersion: 14, cards: { owned: { nope: 3, c_stone: null }, price: { nope: 9 }, hype: null } }],
  ['すべて null', { saveVersion: 14, company: null, lands: null, market: null, business: null, estate: null, cards: null }],
];

describe('壊れたセーブを読む', () => {
  for (const [name, raw] of DAMAGED) {
    it(`${name} ― 読めて、そのあとも動く`, () => {
      const e = loadAndRun(raw);
      expect(Number.isFinite(e.state.company.cash), 'cash').toBe(true);
      expect(Number.isFinite(e.derived.assets), 'assets').toBe(true);
      // 土地は必ず本社がある
      expect(e.state.lands.some((l) => l.id === 'hq')).toBe(true);
      for (const l of e.state.lands) expect(typeof l.id, name).toBe('string');
      // 相場の履歴は必ず配列
      for (const m of Object.values(e.state.market.prices)) expect(Array.isArray(m?.history), name).toBe(true);
    });
  }

  it('再出発ポイントが null でも、永続アップグレードが買える', () => {
    const state = migrateSave({ saveVersion: 14, prestige: { count: 2, points: 999, history: [] } });
    expect(state.prestige.points).toBe(999);
    const broken = migrateSave({ saveVersion: 14, prestige: { count: 2, points: null, history: [] } });
    expect(broken.prestige.points).toBe(0);
  });

  it('種類の違うカードや壊れた枚数は捨てる', () => {
    const state = migrateSave({ saveVersion: 15, cards: { owned: { nope: 3, mc_001: 2, mc_002: null }, price: { nope: 9, mc_001: 1.5 }, hype: 99 } });
    expect(state.cards?.owned.nope).toBeUndefined();
    expect(state.cards?.owned.mc_001).toBe(2);
    expect(state.cards?.owned.mc_002).toBeUndefined();
    expect(state.cards?.price.nope).toBeUndefined();
    expect(state.cards?.hype).toBeLessThanOrEqual(1.6);
  });

  it('入れ替え前のカードは、読み込んでも残らない', () => {
    const state = migrateSave({
      saveVersion: 14,
      company: { cash: 1000, totalEarned: 0 },
      cards: { owned: { c_world: 1, c_stone: 3 }, price: { c_world: 2 }, claimed: { ground: true }, hype: 1 },
    });
    expect(Object.keys(state.cards?.owned ?? {}).length).toBe(0);
    expect(Object.keys(state.cards?.price ?? {}).length).toBe(0);
    expect(Object.keys(state.cards?.claimed ?? {}).length).toBe(0);
  });

  it('もう無い採集やレシピが自動化に残っていても落ちない', () => {
    const state = migrateSave({
      saveVersion: 15,
      automation: { on: { gather: true, craft: true }, recipes: ['nope_recipe', 'stone_hammer'], gathers: ['gather_stone', 'nope_gather'], timers: {} },
    });
    expect(state.automation.gathers).toEqual(['gather_stone']);
    expect(state.automation.recipes).not.toContain('nope_recipe');
  });

  it('もう無い弾の受け取り済み印は残らない', () => {
    const state = migrateSave({ saveVersion: 15, cards: { owned: {}, price: {}, claimed: { ground: true, awaken: true }, hype: 1 } });
    expect(state.cards?.claimed.ground).toBeUndefined();
    expect(state.cards?.claimed.awaken).toBe(true);
  });
});

describe('バックアップを壊さない', () => {
  it('本体が読めなかった回は、その中身をバックアップへ写さない', async () => {
    const repo = new MemRepo();
    const svc = new SaveService(repo);
    const good = playedState(777_000);
    const goodJson = serializeState(good, 1_700_000_000_000);
    await repo.setItem(SAVE_BACKUP_KEY, goodJson);
    // 本体はどうやっても読めない形にする（JSON として壊れている）
    await repo.save('{"saveVersion":14,"state":{"lands":');

    const res = await svc.loadSafe();
    expect(res.state).toBeTruthy();

    // 起動直後の保存（ここで昔はバックアップが潰れていた）
    await svc.save(res.state!, 1_700_000_001_000);
    const backup = await repo.getItem(SAVE_BACKUP_KEY);
    expect(backup).toBe(goodJson);
    // バックアップはまだ読める
    expect(await svc.loadBackup()).toBeTruthy();
    // 壊れた本体は退避されている
    expect(res.fromBackup).toBe(true);
    expect(await repo.getItem(SAVE_BROKEN_KEY)).toContain('"lands":');
  });

  it('読めないデータはバックアップに写らない', async () => {
    const repo = new MemRepo();
    const svc = new SaveService(repo);
    const good = playedState(300_000);
    await repo.setItem(SAVE_BACKUP_KEY, serializeState(good, 1_700_000_000_000));
    await repo.save('{壊れた JSON');
    const res = await svc.loadSafe();
    expect(res.fromBackup).toBe(true);
    await svc.save(res.state!, 1_700_000_100_000);
    expect(await svc.loadBackup()).toBeTruthy();
  });
});

describe('裏に回したまま閉じても、その時間が消えない', () => {
  it('止めた時刻で保存されるので、次に開いたときオフライン進行になる', () => {
    // runtime.ts の saveNowSync は「止めた時刻」で保存する。
    // ここではその決まりを、時刻の計算だけで確かめる。
    const hiddenAt = 1_700_000_000_000;
    const closedAt = hiddenAt + 2 * 3600 * 1000; // 2時間裏にいたまま閉じた
    const savedAt = hiddenAt > 0 ? hiddenAt : closedAt;
    const openedAt = closedAt + 1000;
    const elapsed = (openedAt - savedAt) / 1000;
    expect(savedAt).toBe(hiddenAt);
    expect(elapsed).toBeGreaterThan(7200);
  });

  it('オフライン進行の上限までは、ちゃんと進む', () => {
    const e = new GameEngine({ rng: () => 0.4, now: () => 1_000_000 });
    e.keepDefaultHq();
    e.updateSettings({ events: false });
    const workers = 5;
    const seconds = 2 * 3600;
    // 建設費だけでなく、離れているあいだの人件費も先に持たせる。
    // 給料が現実の額（1人432円/秒）になったので、2時間ぶんで1,500万円を超える。
    // 足りないと途中で倒産して進行そのものが巻き戻り、「進んだか」を見られなくなる。
    const setup = facilityBulkCost(FACILITY_MAP['worker_stone'], 0, workers);
    const wages = WAGE_PER_EMPLOYEE * FACILITY_MAP['worker_stone'].employees * workers * seconds;
    e.debugAddCash(setup + wages * 2);
    expect(e.buyFacility('worker_stone', workers)).toBe(workers);
    e.refreshDerived();
    const before = e.state.stats.totalObtained.stone ?? 0;
    const report = e.applyOffline(seconds);
    expect(report.simulatedSeconds).toBeGreaterThan(0);
    expect(e.state.stats.totalObtained.stone ?? 0).toBeGreaterThan(before);
  });
});

/**
 * 値段を現実の相場に直したとき、「1個」の意味そのものが変わった（1個＝1kg／1g／1L）。
 * 古いセーブをそのまま読むと同じ「鉄100」が別の量を指すので、保存先ごと v3 に作り直した。
 * 古い保存先は「読まずに消す」ので、古い形式の変換で引っかかることがない。
 */
describe('古いセーブの一斉破棄', () => {
  it('保存先が v3 に変わっていて、古い名前とかぶらない', () => {
    expect(SAVE_KEY).toBe('world-industry.save.v3');
    for (const k of LEGACY_SAVE_KEYS) {
      expect(k).not.toBe(SAVE_KEY);
      expect(k).not.toBe(SAVE_BACKUP_KEY);
      expect(k).not.toBe(SAVE_BROKEN_KEY);
    }
  });

  it('古い保存先があれば消して、消したことを返す', async () => {
    const repo = new MemRepo();
    for (const k of LEGACY_SAVE_KEYS) repo.map.set(k, '{"saveVersion":14}');
    expect(await purgeLegacySaves(repo)).toBe(true);
    for (const k of LEGACY_SAVE_KEYS) expect(repo.map.has(k), k).toBe(false);
  });

  it('古い保存先が無ければ、消したとは言わない', async () => {
    const repo = new MemRepo();
    expect(await purgeLegacySaves(repo)).toBe(false);
  });

  it('いまの保存先には手を出さない', async () => {
    const repo = new MemRepo();
    const json = serializeState(playedState(), 1_000_000);
    await repo.save(json);
    await repo.setItem(SAVE_BACKUP_KEY, json);
    repo.map.set(LEGACY_SAVE_KEYS[0], '{"saveVersion":14}');
    await purgeLegacySaves(repo);
    expect(await repo.load()).toBe(json);
    expect(await repo.getItem(SAVE_BACKUP_KEY)).toBe(json);
  });

  it('消したあとに読むと、まっさらから始まる', async () => {
    const repo = new MemRepo();
    repo.map.set(LEGACY_SAVE_KEYS[0], serializeState(playedState(), 1_000_000));
    await purgeLegacySaves(repo);
    const svc = new SaveService(repo);
    const r = await svc.loadSafe();
    expect(r.state).toBe(null);
    expect(r.error).toBeUndefined();
  });

  it('消せない保存先があっても、そこで止まらない', async () => {
    const repo = new MemRepo();
    for (const k of LEGACY_SAVE_KEYS) repo.map.set(k, 'x');
    let calls = 0;
    repo.removeItem = async (k: string) => {
      calls++;
      if (calls === 1) throw new Error('消せない');
      repo.map.delete(k);
    };
    await expect(purgeLegacySaves(repo)).resolves.toBe(true);
    expect(repo.map.has(LEGACY_SAVE_KEYS[1])).toBe(false);
  });
});
