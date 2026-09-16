import type { GameState } from '@/types/state';
import type { NavTab } from '@/types/ui';

export interface TutorialStepDef {
  id: string;
  title: string;
  text: string;
  /** 誘導先のタブ */
  tab: NavTab;
  /** 完了条件 */
  check: (state: GameState) => boolean;
  /** 進捗表示（任意） */
  progress?: (state: GameState) => { current: number; target: number };
}

const obtained = (state: GameState, id: string) => state.stats.totalObtained[id] ?? 0;

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 'stone3', title: '石を3個集める', text: 'HOMEの「石を拾う」を3回タップしよう。', tab: 'home',
    check: (s) => obtained(s, 'stone') >= 3,
    progress: (s) => ({ current: Math.min(3, obtained(s, 'stone')), target: 3 }),
  },
  {
    id: 'wood2', title: '木を2個集める', text: '「木を集める」を2回タップしよう。', tab: 'home',
    check: (s) => obtained(s, 'wood') >= 2,
    progress: (s) => ({ current: Math.min(2, obtained(s, 'wood')), target: 2 }),
  },
  {
    id: 'hammer', title: '石のハンマーを作る', text: 'CRAFT画面で「石のハンマー」を作ろう（石3・木2）。道具は使うと減り、耐久0で消えます。', tab: 'craft',
    check: (s) => (s.stats.toolsCrafted['stone_hammer'] ?? 0) >= 1,
  },
  {
    id: 'scrap', title: '鉄くずを入手する', text: 'ハンマーを持って「鉄くずを回収」をタップ。1回ごとにハンマーの耐久が1減ります。', tab: 'home',
    check: (s) => obtained(s, 'scrap_metal') >= 1,
  },
  {
    id: 'sell', title: '最初の商品を販売する', text: 'RESOURCES画面で資源をタップして売却しよう。鉄くずは1個8円前後で売れます。', tab: 'resources',
    check: (s) => s.company.totalEarned > 0,
  },
  {
    id: 'hire', title: '作業員を雇う', text: 'FACTORY画面で「採石作業員」を雇うと、タップしなくても資源が増え始めます。', tab: 'factory',
    check: (s) => s.facilities.some((f) => f.count > 0),
  },
  {
    id: 'auto', title: '初めての自動生産', text: '作業員が資源を生産するのを待とう。RESOURCES画面の「+/秒」が生産速度です。', tab: 'resources',
    check: (s) => Object.values(s.stats.totalProduced).some((v) => (v ?? 0) >= 1),
  },
];
