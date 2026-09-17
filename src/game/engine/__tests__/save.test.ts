import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { MemorySaveRepository } from '@/game/services/save/SaveRepository';
import { SAVE_BACKUP_KEY, SAVE_BROKEN_KEY, SaveService, hasProgress, serializeState } from '@/game/services/save/SaveService';

function playedEngine(): GameEngine {
  const e = new GameEngine();
  for (let i = 0; i < 30; i++) e.gather('gather_stone');
  e.craft('craft_stone_hammer');
  e.state.company.cash = 50_000;
  e.buyFacility('worker_stone', 1);
  e.advance(3);
  return e;
}

describe('セーブ', () => {
  it('保存して読み込むと進行状況が戻る', async () => {
    const repo = new MemorySaveRepository();
    const svc = new SaveService(repo);
    const e = playedEngine();
    await svc.save(e.state);
    const back = await svc.load();
    expect(back).not.toBeNull();
    expect(back!.facilities.length).toBe(e.state.facilities.length);
    expect(back!.inventory.stone).toBeCloseTo(e.state.inventory.stone ?? 0, 6);
    expect(Object.keys(back!.unlocked).length).toBe(Object.keys(e.state.unlocked).length);
  });

  it('遊んだ跡があるかを見分けられる', () => {
    expect(hasProgress(new GameEngine().state)).toBe(false);
    expect(hasProgress(playedEngine().state)).toBe(true);
  });

  it('保存するたびに直前のセーブがバックアップに残る', async () => {
    const repo = new MemorySaveRepository();
    const svc = new SaveService(repo);
    const e = playedEngine();
    const cashBefore = e.state.company.cash;
    await svc.save(e.state);
    e.state.company.cash = 999;
    await svc.save(e.state);
    const backup = await repo.getItem(SAVE_BACKUP_KEY);
    expect(backup).toBeTruthy();
    expect(JSON.parse(backup!).state.company.cash).toBeCloseTo(cashBefore, 6);
    expect((await svc.load())!.company.cash).toBe(999);
    expect(await svc.hasBackup()).toBe(true);
  });

  it('セーブが壊れていてもバックアップから復元し、壊れたデータは残す', async () => {
    const repo = new MemorySaveRepository();
    const svc = new SaveService(repo);
    const e = playedEngine();
    await repo.setItem(SAVE_BACKUP_KEY, serializeState(e.state, Date.now()));
    await repo.save('{壊れた JSON');
    const result = await svc.loadSafe();
    expect(result.fromBackup).toBe(true);
    expect(result.state!.facilities.length).toBe(e.state.facilities.length);
    expect(await repo.getItem(SAVE_BROKEN_KEY)).toBe('{壊れた JSON');
  });

  it('新しすぎるセーブでも元データを消さない', async () => {
    const repo = new MemorySaveRepository();
    const svc = new SaveService(repo);
    const future = JSON.stringify({ saveVersion: 99, app: 'WORLD INDUSTRY', savedAt: Date.now(), state: { saveVersion: 99 } });
    await repo.save(future);
    const result = await svc.loadSafe();
    expect(result.state).toBeNull();
    expect(result.error).toBeTruthy();
    expect(await repo.getItem(SAVE_BROKEN_KEY)).toBe(future);
  });
});

describe('セーブの上書き防止', () => {
  it('進行中のセーブを初期状態で上書きしない', async () => {
    const repo = new MemorySaveRepository();
    const svc = new SaveService(repo);
    const played = playedEngine();
    await svc.save(played.state);
    const fresh = new GameEngine();
    await expect(svc.save(fresh.state)).rejects.toThrow();
    const back = await svc.load();
    expect(back!.facilities.length).toBe(played.state.facilities.length);
  });

  it('リセット後は初期状態でも保存できる', async () => {
    const repo = new MemorySaveRepository();
    const svc = new SaveService(repo);
    await svc.save(playedEngine().state);
    await svc.clearAll();
    const fresh = new GameEngine();
    await svc.save(fresh.state);
    expect((await svc.load())!.facilities.length).toBe(0);
  });
});
