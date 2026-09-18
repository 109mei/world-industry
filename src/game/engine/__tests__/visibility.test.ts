/**
 * 「まだ使えない機能は出さない」の見張り。
 *
 * 出しっぱなしだと、押しても何もできない画面に行き当たる。
 * 逆に隠しすぎると、解放されたのに入口が無い、という詰みになる。その両方を見る。
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../GameEngine';
import { visibleHomeSubs, visibleMapSubs, visibleTabs } from '../systems/visibility';
import { CONFIG } from '@/game/data/config';

function fresh(): GameEngine {
  const e = new GameEngine({ rng: () => 0.5, now: () => 1_000_000 });
  e.updateSettings({ themeChosen: true, nameChosen: true, hqChosen: true, events: false });
  e.keepDefaultHq();
  e.refreshDerived();
  return e;
}

describe('始めたばかりの画面', () => {
  it('下のタブは、ホーム・クラフト・施設・設定だけ', () => {
    const e = fresh();
    expect(visibleTabs(e.state, e.derived)).toEqual(['home', 'craft', 'factory', 'settings']);
  });

  it('ホームの切替は、ホームと資源だけ', () => {
    const e = fresh();
    expect(visibleHomeSubs(e.state)).toEqual(['home', 'resources']);
  });

  it('地図の切替は、地図だけ', () => {
    const e = fresh();
    expect(visibleMapSubs(e.state, e.derived)).toEqual(['map']);
  });
});

describe('解放されると入口が出る', () => {
  it('資産が増えると、地図と研究が出る', () => {
    const e = fresh();
    expect(visibleTabs(e.state, e.derived)).not.toContain('map');
    e.debugAddCash(CONFIG.landUnlockAssets + 1);
    e.refreshDerived();
    const tabs = visibleTabs(e.state, e.derived);
    expect(tabs).toContain('map');
    expect(tabs).toContain('research');
  });

  it('売上が立つと、会社の切替が出る', () => {
    const e = fresh();
    expect(visibleHomeSubs(e.state)).not.toContain('company');
    e.state.company.totalEarned = 1;
    expect(visibleHomeSubs(e.state)).toContain('company');
  });

  it('土地を買うと、地図に「所有地」が出る', () => {
    const e = fresh();
    e.debugAddCash(50_000_000);
    e.refreshDerived();
    e.state.unlocked['land:jp_hokkaido'] = true;
    expect(visibleMapSubs(e.state, e.derived)).not.toContain('owned');
    e.buyLand('jp_hokkaido');
    e.refreshDerived();
    expect(visibleMapSubs(e.state, e.derived)).toContain('owned');
  });

  it('貿易ができるようになると、取引が出る', () => {
    const e = fresh();
    expect(visibleHomeSubs(e.state)).not.toContain('sales');
    e.state.research.completed.overseas = true;
    expect(visibleHomeSubs(e.state)).toContain('sales');
  });

  it('業種を研究すると、事業が出る', () => {
    const e = fresh();
    expect(visibleHomeSubs(e.state)).not.toContain('business');
    e.state.research.completed.retail = true;
    expect(visibleHomeSubs(e.state)).toContain('business');
  });
});

describe('順番と重複', () => {
  it('タブの並びは常に同じ順で、重複しない', () => {
    const e = fresh();
    e.debugAddCash(1_000_000_000);
    e.refreshDerived();
    const tabs = visibleTabs(e.state, e.derived);
    expect(new Set(tabs).size).toBe(tabs.length);
    expect(tabs[0]).toBe('home');
    expect(tabs[tabs.length - 1]).toBe('settings');
  });

  it('全部そろうと6つになる', () => {
    const e = fresh();
    e.debugAddCash(1_000_000_000);
    e.refreshDerived();
    expect(visibleTabs(e.state, e.derived)).toEqual(['home', 'craft', 'factory', 'map', 'research', 'settings']);
  });

  it('ホームの切替も重複しない', () => {
    const e = fresh();
    e.state.company.totalEarned = 1;
    e.state.research.completed.overseas = true;
    e.state.research.completed.retail = true;
    const subs = visibleHomeSubs(e.state);
    expect(new Set(subs).size).toBe(subs.length);
    expect(subs).toEqual(['home', 'resources', 'sales', 'business', 'company']);
  });
});

describe('最近の出来事', () => {
  it('他社の動きには印が付き、自社の出来事とは分けられる', () => {
    const e = fresh();
    e.debugAddCash(1000);
    // 自社の出来事（施設を建てた、など）は印が付かない
    const own = e.state.eventLog.filter((ev) => ev.scope !== 'other');
    const other = e.state.eventLog.filter((ev) => ev.scope === 'other');
    expect(own.length + other.length).toBe(e.state.eventLog.length);
    // 他社の動きを1件混ぜても、自社ぶんの数は変わらない
    const before = own.length;
    e.state.eventLog.push({ id: 9999, time: 0, type: 'info', message: '架空商事が物件を取得しました', scope: 'other' });
    expect(e.state.eventLog.filter((ev) => ev.scope !== 'other').length).toBe(before);
  });
});

describe('気になる場所の印', () => {
  it('印を付けると一覧に出て、もう一度押すと外れる', () => {
    const e = fresh();
    const entry = { kind: 'feature' as const, id: 'w123', label: 'かすみ製作所', sub: '工場', lat: 35.1, lon: 139.2 };
    expect(e.hasBookmark('feature', 'w123')).toBe(false);
    expect(e.toggleBookmark(entry)).toBe(true);
    expect(e.hasBookmark('feature', 'w123')).toBe(true);
    expect(e.state.bookmarks?.length).toBe(1);
    expect(e.toggleBookmark(entry)).toBe(false);
    expect(e.state.bookmarks?.length).toBe(0);
  });

  it('同じものを二重に登録しない', () => {
    const e = fresh();
    const entry = { kind: 'land' as const, id: 'jp_hokkaido', label: '十勝', lat: 42.9, lon: 143.2 };
    e.toggleBookmark(entry);
    e.toggleBookmark(entry); // 外れる
    e.toggleBookmark(entry); // また付く
    expect(e.state.bookmarks?.filter((b) => b.id === 'jp_hokkaido').length).toBe(1);
  });

  it('メモを書ける', () => {
    const e = fresh();
    e.toggleBookmark({ kind: 'feature', id: 'w9', label: '角の店', lat: 1, lon: 2 });
    e.setBookmarkNote('feature', 'w9', '値下がりを待つ');
    expect(e.state.bookmarks?.[0].note).toBe('値下がりを待つ');
  });

  it('印があるときだけ、地図に「気になる」が出る', () => {
    const e = fresh();
    expect(visibleMapSubs(e.state, e.derived)).not.toContain('marks');
    e.toggleBookmark({ kind: 'feature', id: 'w1', label: 'どこか', lat: 0, lon: 0 });
    expect(visibleMapSubs(e.state, e.derived)).toContain('marks');
  });

  it('増えすぎても一覧が壊れない（上限で古いものから落ちる）', () => {
    const e = fresh();
    for (let i = 0; i < 260; i++) e.toggleBookmark({ kind: 'feature', id: `w${i}`, label: `場所${i}`, lat: 0, lon: 0 });
    expect(e.state.bookmarks!.length).toBeLessThanOrEqual(200);
  });
});

describe('転生しても、一度開いた画面は消えない', () => {
  it('転生すると「会社」が消えて永続ポイントに触れなくなる、が起きない', () => {
    const e = fresh();
    // 一度でも売上が立てば「会社」が出る
    e.debugAddCash(1);
    e.state.company.totalEarned = 1_000;
    e.tick(1);
    expect(visibleHomeSubs(e.state)).toContain('company');

    // 転生すると売上は0に戻る。それでも入口は残っていなければならない
    e.state.company.totalEarned = 0;
    e.state.prestige.count = 1;
    e.state.prestige.points = 5;
    e.tick(1);
    expect(visibleHomeSubs(e.state), '転生後に「会社」が消えた（貯めたポイントに触れなくなる）').toContain('company');
  });

  it('一度開いたタブは、条件を満たさなくなっても出したまま', () => {
    const e = fresh();
    // 地図が開くところまで資産を積む
    e.debugAddCash(CONFIG.landUnlockAssets + 1);
    e.tick(1);
    expect(visibleTabs(e.state, e.derived)).toContain('map');
    expect(e.state.settings.seenTabs).toContain('map');

    // 資産が無くなっても（転生直後がこれ）、入口は残る
    e.state.company.cash = 0;
    delete e.state.unlocked['system:land'];
    e.tick(1);
    expect(visibleTabs(e.state, e.derived), '一度開いた地図が消えた').toContain('map');
  });

  it('覚えた記録が壊れていても落ちない', () => {
    const e = fresh();
    (e.state.settings as unknown as Record<string, unknown>).seenTabs = ['map', 'no_such_tab'];
    const tabs = visibleTabs(e.state, e.derived);
    expect(tabs).toContain('map');
    expect(tabs).not.toContain('no_such_tab');
  });

  it('並びは決まった順のまま（覚えた順に混ざらない）', () => {
    const e = fresh();
    e.state.settings.seenTabs = ['settings', 'map', 'home'];
    const tabs = visibleTabs(e.state, e.derived);
    expect(tabs.indexOf('home')).toBeLessThan(tabs.indexOf('map'));
    expect(tabs.indexOf('map')).toBeLessThan(tabs.indexOf('settings'));
  });
});
