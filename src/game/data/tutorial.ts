import type { GameState } from '@/types/state';
import type { NavTab } from '@/types/ui';

/**
 * 最初の道案内。
 *
 * 「石を拾う」から「自分の店を持つ」までを、ひと続きの流れとして並べている。
 * 押す場所を指すだけでなく、なぜそれをするのかを一行で添えるようにした。
 */
export interface TutorialStepDef {
  id: string;
  title: string;
  text: string;
  /** なぜそれをするのか（一行） */
  why?: string;
  /** 誘導先のタブ */
  tab: NavTab;
  /** そのタブの中の場所（ホームの切替） */
  homeSub?: 'home' | 'resources' | 'sales' | 'business' | 'company';
  /** 完了条件 */
  check: (state: GameState) => boolean;
  /** 進捗表示（任意） */
  progress?: (state: GameState) => { current: number; target: number };
}

const obtained = (state: GameState, id: string) => state.stats.totalObtained[id] ?? 0;
const facilityCount = (state: GameState) => state.facilities.reduce((a, f) => a + f.count, 0);

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 'stone3',
    title: '石を3個ひろう',
    text: 'ホームの「石を拾う」を3回タップします。',
    why: '最初の資源です。ここから全部がつながっています。',
    tab: 'home',
    homeSub: 'home',
    check: (s) => obtained(s, 'stone') >= 3,
    progress: (s) => ({ current: Math.min(3, obtained(s, 'stone')), target: 3 }),
  },
  {
    id: 'wood2',
    title: '木を2個あつめる',
    text: '「木を集める」を2回タップします。',
    why: '道具の柄になります。石と木がそろえば道具が作れます。',
    tab: 'home',
    homeSub: 'home',
    check: (s) => obtained(s, 'wood') >= 2,
    progress: (s) => ({ current: Math.min(2, obtained(s, 'wood')), target: 2 }),
  },
  {
    id: 'hammer',
    title: '石のハンマーを作る',
    text: 'クラフトの画面で「石のハンマー」を作ります（石3・木2）。',
    why: '道具があると、手では採れないものが採れるようになります。使うと減り、耐久0で壊れます。',
    tab: 'craft',
    check: (s) => (s.stats.toolsCrafted['stone_hammer'] ?? 0) >= 1,
  },
  {
    id: 'scrap',
    title: '鉄くずを手に入れる',
    text: 'ホームに戻って「鉄くずを回収」をタップします。',
    why: '石や木よりずっと高く売れます。1回ごとにハンマーの耐久が1減ります。',
    tab: 'home',
    homeSub: 'home',
    check: (s) => obtained(s, 'scrap_metal') >= 1,
  },
  {
    id: 'sell',
    title: 'はじめて売る',
    text: 'ホームの「資源」から、集めたものをタップして売ります。',
    why: 'お金がないと何も始まりません。まずは現金を作ります。',
    tab: 'home',
    homeSub: 'resources',
    check: (s) => s.company.totalEarned > 0,
  },
  {
    id: 'hire',
    title: '人を雇う',
    text: '施設の画面で「採石作業員」を雇います。',
    why: 'タップしなくても資源が増えはじめます。ただし毎秒 人件費がかかります。',
    tab: 'factory',
    check: (s) => facilityCount(s) > 0,
  },
  {
    id: 'auto',
    title: '自動で増えるのを見る',
    text: '少し待ってから、ホームの「資源」を見てみます。',
    why: '「+◯/秒」が自動生産の速さです。ここを増やしていくのがこのゲームの軸です。',
    tab: 'home',
    homeSub: 'resources',
    check: (s) => Object.values(s.stats.totalProduced).some((v) => (v ?? 0) >= 1),
  },
  {
    id: 'autosell',
    title: '自動で売る',
    text: 'ホームの「資源」で品物をタップし、自動売却を入れます。',
    why: '溜まったぶんが勝手に売れて、現金が途切れなくなります。残す個数も決められます。',
    tab: 'home',
    homeSub: 'resources',
    check: (s) => Object.values(s.market?.autoSell ?? {}).some((c) => c?.enabled),
  },
  {
    id: 'research',
    title: 'はじめての研究',
    text: '研究の画面で、いちばん安いものをひとつ研究します。',
    why: '研究ツリーの先に、土地・事業・自動化などほとんどの要素がぶら下がっています。',
    tab: 'research',
    check: (s) => Object.keys(s.research.completed).length >= 1,
  },
  {
    id: 'land',
    title: '地図で場所を買う',
    text: '地図の画面を開いて、実際に建っている建物や区画をひとつ買ってみます。',
    why: '買った場所には施設を建てられ、家賃も入ります。事業を構えるのもこの土地の上です。',
    tab: 'map',
    check: (s) => Object.keys(s.estate?.custom ?? {}).length >= 1 || s.lands.length > 1,
  },
  {
    id: 'sales',
    title: '営業してみる',
    text: '地図で工場や店をタップして「この会社に営業する」を押します。',
    why: '契約が取れると、市場に流すより高く、決まった量を売り続けられます。',
    tab: 'map',
    check: (s) => (s.sales?.deals.length ?? 0) >= 1 || s.stats.contractsCompleted >= 1,
  },
  {
    id: 'business',
    title: '自分の事業をはじめる',
    text: 'ホームの「事業」から、研究で解放した業種をひとつ始めます。',
    why: 'ここから先は、掘って売るだけでなく、店や会社を育てて稼ぐ道が開きます。',
    tab: 'home',
    homeSub: 'business',
    check: (s) => (s.business?.divisions.length ?? 0) >= 1,
  },
];
