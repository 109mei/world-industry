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
  /** どこを押すか（画面に出ているボタンの名前そのまま） */
  where?: string;
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
    where: 'ホーム › 石を拾う',
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
    where: 'ホーム › 木を集める',
    why: '道具の柄になります。石と木がそろえば道具が作れます。',
    tab: 'home',
    homeSub: 'home',
    check: (s) => obtained(s, 'wood') >= 2,
    progress: (s) => ({ current: Math.min(2, obtained(s, 'wood')), target: 2 }),
  },
  {
    id: 'hammer',
    title: '石のハンマーを作る',
    text: 'クラフトの画面で「石のハンマー」の「1個作る」を押します（石3・木2）。',
    where: 'クラフト › 石のハンマー › 1個作る',
    why: '道具があると、手では採れないものが採れるようになります。使うと減り、耐久0で壊れます。',
    tab: 'craft',
    check: (s) => (s.stats.toolsCrafted['stone_hammer'] ?? 0) >= 1,
  },
  {
    id: 'scrap',
    title: '鉄くずを手に入れる',
    text: 'ホームに戻って「鉄くずを回収」をタップします。',
    where: 'ホーム › 鉄くずを回収',
    why: '石や木よりずっと高く売れます。1回ごとにハンマーの耐久が1減ります。',
    tab: 'home',
    homeSub: 'home',
    check: (s) => obtained(s, 'scrap_metal') >= 1,
  },
  {
    id: 'sell',
    title: '集めた素材を売ってみる',
    text: 'ホームの「資源」を開き、売りたいものの行にある「詳細・売却」を押します。出てきた画面をいちばん下まで動かすと「1個売る」があり、押すと現金になります。まずは石か鉄くずを売ってみてください。',
    why: 'お金がないと何も始まりません。集めたものは、売ってはじめて会社のお金になります。',
    where: 'ホーム › 資源 › 詳細・売却 › 1個売る',
    tab: 'home',
    homeSub: 'resources',
    check: (s) => s.company.totalEarned > 0,
  },
  {
    id: 'sell_more',
    title: 'まとめて売る',
    text: '同じ画面の「1個売る」のとなりに「10個」「100個」「全部売る」があります。たくさん持っているものは、まとめて売ったほうが早いです。',
    why: 'ただし一度にたくさん売ると相場が下がります。下がった相場は時間がたつと戻ります。',
    where: 'ホーム › 資源 › 詳細・売却 › 10個 / 100個 / 全部売る',
    tab: 'home',
    homeSub: 'resources',
    check: (s) => s.company.totalEarned >= 60,
    progress: (s) => ({ current: Math.min(60, Math.floor(s.company.totalEarned)), target: 60 }),
  },
  {
    id: 'hire',
    title: '人を雇う',
    text: '施設の画面で「採石作業員」の「雇う」を押します。',
    where: '施設 › 採石作業員 › 雇う',
    why: 'タップしなくても資源が増えはじめます。ただし毎秒 人件費がかかります。',
    tab: 'factory',
    check: (s) => facilityCount(s) > 0,
  },
  {
    id: 'auto',
    title: '自動で増えるのを見る',
    text: '少し待ってから、ホームの「資源」を見てみます。',
    where: 'ホーム › 資源',
    why: '「+◯/秒」が自動生産の速さです。ここを増やしていくのがこのゲームの軸です。',
    tab: 'home',
    homeSub: 'resources',
    check: (s) => Object.values(s.stats.totalProduced).some((v) => (v ?? 0) >= 1),
  },
  {
    id: 'autosell',
    title: '自動で売る',
    text: 'ホームの「資源」で品物の「詳細・売却」を開き、「自動売却を開始」を押します。',
    where: 'ホーム › 資源 › 詳細・売却 › 自動売却を開始',
    why: '溜まったぶんが勝手に売れて、現金が途切れなくなります。残す個数も決められます。',
    tab: 'home',
    homeSub: 'resources',
    check: (s) => Object.values(s.market?.autoSell ?? {}).some((c) => c?.enabled),
  },
  {
    id: 'research',
    title: 'はじめての研究',
    text: '研究の画面で、いちばん安いものをタップして「研究する」を押します。',
    where: '研究 › 研究をタップ › 研究する',
    why: '研究ツリーの先に、土地・事業・自動化などほとんどの要素がぶら下がっています。',
    tab: 'research',
    check: (s) => Object.keys(s.research.completed).length >= 1,
  },
  {
    id: 'land',
    title: '地図で場所を買う',
    text: '地図の画面を拡大して、実際に建っている建物や区画をタップし、「購入する」を押します。',
    where: '地図 › 建物をタップ › 購入する',
    why: '買った場所には施設を建てられ、家賃も入ります。事業を構えるのもこの土地の上です。',
    tab: 'map',
    check: (s) => Object.keys(s.estate?.custom ?? {}).length >= 1 || s.lands.length > 1,
  },
  {
    id: 'sales',
    title: '営業してみる',
    text: '地図で工場や店をタップして、下のほうにある「この会社に営業する」を押します。',
    where: '地図 › 工場や店をタップ › この会社に営業する',
    why: '契約が取れると、市場に流すより高く、決まった量を売り続けられます。',
    tab: 'map',
    check: (s) => (s.sales?.deals.length ?? 0) >= 1 || s.stats.contractsCompleted >= 1,
  },
  {
    id: 'business',
    title: '自分の事業をはじめる',
    text: 'ホームの「事業」から、研究で解放した業種をひとつ選んで「この事業を始める」を押し、置く場所を決めて「ここに開業する」を押します。',
    where: 'ホーム › 事業 › この事業を始める › ここに開業する',
    why: 'ここから先は、掘って売るだけでなく、店や会社を育てて稼ぐ道が開きます。',
    tab: 'home',
    homeSub: 'business',
    check: (s) => (s.business?.divisions.length ?? 0) >= 1,
  },
];
