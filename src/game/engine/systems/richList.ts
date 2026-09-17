/**
 * 長者番付。架空の富豪一覧に、自分の総資産を差し込んで順位を出す。
 * 上の人たちも時間とともに資産が増えるので、止まっていると抜かれていく。
 */
import { RICH_LIST, type RichPerson } from '@/game/data/richList';
import type { GameState } from '@/types/state';

export interface RankedPerson extends RichPerson {
  rank: number;
  isPlayer: boolean;
}

/** プレイしている時間に応じて、ほかの富豪の資産も増やす */
function worthAt(p: RichPerson, hours: number): number {
  return p.worth * Math.pow(1 + p.growthPerHour, Math.min(hours, 2_000));
}

/** 自分を含めた番付。上から順に並ぶ */
export function ranking(state: GameState, assets: number, companyName: string): RankedPerson[] {
  const hours = (state.stats.playtimeSeconds ?? 0) / 3600;
  const list: RankedPerson[] = RICH_LIST.map((p) => ({ ...p, worth: worthAt(p, hours), rank: 0, isPlayer: false }));
  list.push({ name: 'あなた', company: companyName, country: '—', worth: assets, growthPerHour: 0, rank: 0, isPlayer: true });
  list.sort((a, b) => b.worth - a.worth);
  list.forEach((p, i) => (p.rank = i + 1));
  return list;
}

/** 自分の順位（1位がいちばん上） */
export function myRank(state: GameState, assets: number): number {
  const hours = (state.stats.playtimeSeconds ?? 0) / 3600;
  let above = 0;
  for (const p of RICH_LIST) if (worthAt(p, hours) > assets) above += 1;
  return above + 1;
}

/** 番付に載るための最低ライン（いちばん下の人の資産） */
export function entryLine(state: GameState): number {
  const hours = (state.stats.playtimeSeconds ?? 0) / 3600;
  return Math.min(...RICH_LIST.map((p) => worthAt(p, hours)));
}

/** 次に抜かせる相手 */
export function nextTarget(state: GameState, assets: number): RichPerson | null {
  const hours = (state.stats.playtimeSeconds ?? 0) / 3600;
  let best: { p: RichPerson; w: number } | null = null;
  for (const p of RICH_LIST) {
    const w = worthAt(p, hours);
    if (w <= assets) continue;
    if (!best || w < best.w) best = { p, w };
  }
  return best ? { ...best.p, worth: best.w } : null;
}
