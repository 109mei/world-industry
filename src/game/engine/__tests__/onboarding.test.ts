/**
 * 最初に決めること（配色 → 本社）と、画面まわりの作りを見張るテスト。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { NAV_ITEMS } from '@/types/ui';

const COMPONENTS_CSS = readFileSync(resolve(__dirname, '../../../styles/components.css'), 'utf8');
const GLOBAL_CSS = readFileSync(resolve(__dirname, '../../../styles/global.css'), 'utf8');
const HQ_CARD = readFileSync(resolve(__dirname, '../../../features/home/HqSetupCard.tsx'), 'utf8');

function makeEngine() {
  return new GameEngine({ rng: () => 0.42, now: () => 1_000_000 });
}

describe('最初に決めること', () => {
  it('新しく始めると、配色も本社もまだ決まっていない', () => {
    const e = makeEngine();
    expect(e.state.settings.themeChosen).toBe(false);
    expect(e.state.settings.hqChosen).toBe(false);
  });

  it('配色を選ぶと、その色が入って印が立つ', () => {
    const e = makeEngine();
    e.chooseTheme('light');
    expect(e.state.settings.theme).toBe('light');
    expect(e.state.settings.themeChosen).toBe(true);
  });

  it('配色はあとから何度でも変えられる（本社と違って1回きりではない）', () => {
    const e = makeEngine();
    e.chooseTheme('light');
    e.chooseTheme('dark');
    expect(e.state.settings.theme).toBe('dark');
    e.updateSettings({ theme: 'system' });
    expect(e.state.settings.theme).toBe('system');
  });

  it('知らない配色は受け付けない', () => {
    const e = makeEngine();
    e.chooseTheme('rainbow' as never);
    expect(e.state.settings.themeChosen).toBe(false);
  });

  it('本社は1回だけしか決められない', () => {
    const e = makeEngine();
    e.setHqLocation(35.68, 139.76, '東京');
    expect(e.state.settings.hqChosen).toBe(true);
    e.setHqLocation(43.06, 141.35, '札幌');
    expect(e.state.settings.hqLocation?.label).toBe('東京');
  });

  it('本社を決める画面に「大阪のままにする」は出さない', () => {
    expect(HQ_CARD).not.toContain('大阪のままにする');
    // 現在地と地図の2つで必ず決められる
    expect(HQ_CARD).toContain('現在地から決める');
    expect(HQ_CARD).toContain('マップから選ぶ');
  });
});

describe('画面まわりの作り', () => {
  /**
   * 下のタブは列数を数字で書かない。
   * 7列に6個並べていたせいで、右に1つぶんの空きができて左に寄って見えていた。
   */
  it('下のタブは、数にかかわらず均等幅になる書き方をしている', () => {
    const nav = COMPONENTS_CSS.slice(COMPONENTS_CSS.indexOf('\n.nav {'), COMPONENTS_CSS.indexOf('\n.nav {') + 260);
    expect(nav).toContain('grid-auto-columns: 1fr');
    expect(nav).not.toMatch(/grid-template-columns:\s*repeat\(\s*\d+/);
    expect(NAV_ITEMS.length).toBeGreaterThan(0);
  });

  it('下のタブの名前とアイコンが、すべて埋まっている', () => {
    for (const it of NAV_ITEMS) {
      expect(it.labelJa.length, it.id).toBeGreaterThan(0);
      expect(it.icon.startsWith('icon_'), it.id).toBe(true);
    }
    expect(new Set(NAV_ITEMS.map((n) => n.id)).size).toBe(NAV_ITEMS.length);
  });

  /** 長押しで「コピー」「選択」の吹き出しが出ないようにしてある */
  it('文字は既定で選べず、入力欄だけ選べる', () => {
    const body = GLOBAL_CSS.slice(GLOBAL_CSS.indexOf('body {'), GLOBAL_CSS.indexOf('#root'));
    expect(body).toContain('user-select: none');
    expect(body).toContain('-webkit-touch-callout: none');
    expect(GLOBAL_CSS).toMatch(/input,\s*\n\s*textarea,[\s\S]{0,120}user-select: text/);
  });
});
