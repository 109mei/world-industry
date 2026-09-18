/**
 * 使い方ガイドの見張り。
 *
 * 「読むだけで分かる」ことが目的なので、
 * 中身が空・同じものが二重・絵が無い・最初から全部出てしまう、を機械的に弾く。
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDES, GUIDE_GROUP_LABEL, nextGuide, type GuideContext } from '@/game/data/guides';
import { GameEngine } from '../GameEngine';

const ICON_DIR = join(process.cwd(), 'public', 'assets', 'icons');
const icons = new Set(readdirSync(ICON_DIR).map((f) => f.replace(/\.png$/, '')));

function ctx(e: GameEngine, over: Partial<GuideContext> = {}): GuideContext {
  return { state: e.state, derived: e.derived, tab: 'home', homeSub: 'home', mapSub: 'map', ...over };
}

/** 最初の選択（配色・会社名・本社）を済ませた状態 */
function started(): GameEngine {
  const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
  e.updateSettings({ themeChosen: true, nameChosen: true, hqChosen: true, events: false });
  e.keepDefaultHq();
  e.refreshDerived();
  return e;
}

describe('使い方ガイド', () => {
  it('id が重複していない', () => {
    const ids = GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('中身が空のガイドがない', () => {
    for (const g of GUIDES) {
      expect(g.title.length, g.id).toBeGreaterThan(1);
      expect(g.summary.length, g.id).toBeGreaterThan(4);
      expect(g.body.length, g.id).toBeGreaterThanOrEqual(2);
      expect(g.points.length, g.id).toBeGreaterThanOrEqual(2);
      for (const p of g.body) expect(p.length, `${g.id}: ${p}`).toBeGreaterThan(20);
      for (const p of g.points) {
        expect(p.label.length, g.id).toBeGreaterThan(1);
        expect(p.text.length, `${g.id}: ${p.label}`).toBeGreaterThan(10);
      }
    }
  });

  it('絵が用意されている', () => {
    const missing = GUIDES.filter((g) => !icons.has(g.icon)).map((g) => `${g.id}: ${g.icon}`);
    expect(missing).toEqual([]);
  });

  it('分類はすべて見出しのある分類', () => {
    for (const g of GUIDES) expect(GUIDE_GROUP_LABEL[g.group], g.id).toBeTruthy();
  });

  it('英語の id が本文に漏れていない', () => {
    const bad: string[] = [];
    for (const g of GUIDES) {
      for (const t of [g.title, g.summary, ...g.body, ...g.points.map((p) => `${p.label} ${p.text}`)]) {
        if (/[a-z]{3,}_[a-z]{3,}/.test(t)) bad.push(`${g.id}: ${t}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('最初の選択が終わるまでは出ない', () => {
    const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
    e.state.stats.playtimeSeconds = 600;
    expect(nextGuide(ctx(e))).toBeNull();
  });

  it('始めたばかりの本社では、まずホームの案内が出る', () => {
    const e = started();
    e.state.stats.playtimeSeconds = 60;
    expect(nextGuide(ctx(e))?.id).toBe('home');
  });

  it('読んだものは二度と出ない', () => {
    const e = started();
    e.state.stats.playtimeSeconds = 60;
    const first = nextGuide(ctx(e));
    expect(first).not.toBeNull();
    e.updateSettings({ guidesSeen: [first!.id] });
    expect(nextGuide(ctx(e))?.id).not.toBe(first!.id);
  });

  it('切ってあれば1つも出ない', () => {
    const e = started();
    e.state.stats.playtimeSeconds = 600;
    e.updateSettings({ guidesOff: true });
    for (const tab of ['home', 'craft', 'factory', 'map', 'research', 'settings'] as const) {
      expect(nextGuide(ctx(e, { tab })), tab).toBeNull();
    }
  });

  it('画面を開いたときにその画面の案内が出る', () => {
    const e = started();
    e.state.stats.playtimeSeconds = 600;
    // ホームの案内だけ読んだ状態から
    e.updateSettings({ guidesSeen: ['home'] });
    expect(nextGuide(ctx(e, { tab: 'craft' }))?.id).toBe('craft');
    expect(nextGuide(ctx(e, { tab: 'factory' }))?.id).toBe('factory');
    expect(nextGuide(ctx(e, { tab: 'research' }))?.id).toBe('research');
    expect(nextGuide(ctx(e, { tab: 'home', homeSub: 'resources' }))?.id).toBe('market');
  });

  it('解放されていない仕組みの案内は出ない', () => {
    const e = started();
    e.state.stats.playtimeSeconds = 600;
    e.updateSettings({ guidesSeen: [] });
    // 土地も貿易も不動産もまだ
    const seen: string[] = [];
    for (let i = 0; i < GUIDES.length + 2; i++) {
      const g = nextGuide(ctx(e, { tab: 'map', homeSub: 'home', mapSub: 'map' }));
      if (!g) break;
      seen.push(g.id);
      e.updateSettings({ guidesSeen: [...seen] });
    }
    expect(seen).not.toContain('trade');
    expect(seen).not.toContain('estate');
    expect(seen).not.toContain('map');
    expect(seen).not.toContain('land_build');
  });

  it('全部読み終われば、どの画面でも何も出ない（毎フレームの空回りを避ける）', () => {
    const e = started();
    e.state.stats.playtimeSeconds = 600;
    e.updateSettings({ guidesSeen: GUIDES.map((g) => g.id) });
    for (const tab of ['home', 'craft', 'factory', 'map', 'research', 'settings'] as const) {
      expect(nextGuide(ctx(e, { tab })), tab).toBeNull();
    }
  });
});
