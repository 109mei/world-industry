/**
 * 再出発（プレステージ）で得たポイントで買う永続アップグレード。
 * 会社を売っても残り、次の会社にそのまま効く。
 */

export interface PrestigeUpgradeDef {
  id: string;
  name: string;
  icon: string;
  /** 1段階あたりの効果の説明（表示用） */
  perLevel: string;
  maxLevel: number;
  /** 1段階あたりのポイント（段階が上がるほど高くなる） */
  cost: (level: number) => number;
  description: string;
}

const flat = (n: number) => () => n;
const rising = (base: number) => (level: number) => base + Math.floor(level / 3);

/** 自動化のアップグレード（買うと ON/OFF のスイッチが出る） */
export const AUTOMATION_UPGRADES: readonly PrestigeUpgradeDef[] = [
  { id: 'auto_gather', name: '自動採集', icon: 'icon_facility_worker', perLevel: '毎秒 1回ぶんの手作業が自動で進む', maxLevel: 5, cost: flat(3), description: '解放している採集を、自分でタップしなくても続けてくれる。段階を上げるほど速くなる。' },
  { id: 'auto_craft', name: '自動クラフト', icon: 'icon_ui_craft', perLevel: '自動で作るレシピを 2つ増やせる', maxLevel: 5, cost: flat(3), description: 'クラフト画面でスイッチを入れたレシピを、材料がある限り自動で作り続ける。' },
  { id: 'auto_deliver', name: '自動納品', icon: 'icon_logistics_truck', perLevel: '納期が近づいた契約を自動で納品', maxLevel: 1, cost: flat(5), description: '在庫が足りていれば、期限前に自動で納品してくれる。落として関係が下がることがなくなる。' },
  { id: 'auto_pitch', name: '自動営業', icon: 'icon_office_contract', perLevel: '関係のある取引先へ自動で営業', maxLevel: 1, cost: flat(5), description: '営業のクールダウンが明けるたび、関係の深い相手から順に自動で営業する（費用はかかる）。' },
  { id: 'auto_survey', name: '自動調査', icon: 'icon_machine_drilling_rig', perLevel: '買った土地を自動で調査', maxLevel: 1, cost: flat(4), description: '買った土地の調査を、お金に余裕があるときに自動で進める。' },
  { id: 'auto_sell', name: '自動売却の一括設定', icon: 'icon_ui_sell', perLevel: 'すべての資源にまとめて設定できる', maxLevel: 1, cost: flat(3), description: '資源ごとに設定しなくても、まとめて自動売却を入れられるボタンが出る。' },
  { id: 'bulk_buy', name: '一括買収', icon: 'icon_ui_location', perLevel: '地図でまとめて買える件数が増える（5 → 15 → 40 → 100件）', maxLevel: 4, cost: flat(4), description: '地図に出ている物件を、安い順にまとめて買い取るボタンが出る。所持金の半分までしか使わないので、押しても破産しない。買い占めるほど業界への影響も大きくなる。' },
  { id: 'auto_build', name: '自動増設', icon: 'icon_ui_factory', perLevel: '止まっていない施設を自動で1台ずつ増設', maxLevel: 3, cost: flat(4), description: '所持金に余裕があるとき、回収の早い施設を自動で増やす。段階を上げるほど頻繁に増える。' },
];

/** 「一括買収」の段階ごとに、一度に買える件数 */
export const BULK_BUY_LIMIT: readonly number[] = [5, 15, 40, 100];

export const PRESTIGE_UPGRADES: readonly PrestigeUpgradeDef[] = [
  { id: 'production', name: '生産の効率', icon: 'icon_ui_factory', perLevel: '全施設の生産 +6%', maxLevel: 20, cost: rising(1), description: 'すべての施設の生産量が上がる。' },
  { id: 'gather', name: '手作業の腕', icon: 'icon_ui_hand', perLevel: '採集の量 +12%', maxLevel: 10, cost: rising(1), description: '手で集める量が増える。序盤が軽くなる。' },
  { id: 'craft', name: '職人の手際', icon: 'icon_ui_craft', perLevel: 'クラフトの出来高 +10%', maxLevel: 10, cost: rising(1), description: 'クラフトでできる数が増える（端数は確率で上乗せ）。' },
  { id: 'research', name: '研究の資金', icon: 'icon_ui_research', perLevel: '研究ポイント +10%', maxLevel: 10, cost: rising(1), description: '研究が早く進む。' },
  { id: 'start_cash', name: '開業資金', icon: 'icon_ui_money', perLevel: '開始時の所持金 +50万円', maxLevel: 20, cost: flat(1), description: '次の会社を始めるときの所持金が増える。' },
  { id: 'sell_price', name: '交渉力', icon: 'icon_ui_sell', perLevel: '売値 +3%', maxLevel: 10, cost: flat(2), description: '市場で売るときの値段が上がる。' },
  { id: 'survey', name: '探査のノウハウ', icon: 'icon_machine_drilling_rig', perLevel: '調査の費用 -8%・時間 -5%', maxLevel: 8, cost: flat(1), description: '土地の調査が安く早くなる。' },
  { id: 'transport', name: '物流の効率', icon: 'icon_logistics_truck', perLevel: '輸送費 -8%・輸送量 +6%', maxLevel: 8, cost: flat(1), description: '運ぶのが安く多くなる。' },
  { id: 'deposit', name: '鉱脈を見る目', icon: 'icon_marker_mine', perLevel: '買った土地の埋蔵量 +15%', maxLevel: 8, cost: flat(2), description: 'これから買う土地の埋蔵量が増える。' },
  { id: 'sales', name: '営業力', icon: 'icon_office_contract', perLevel: '商談が通る確率 +8%・単価 +3%', maxLevel: 6, cost: flat(2), description: '営業が通りやすく、条件も良くなる。' },
  { id: 'relation', name: '信頼の積み重ね', icon: 'icon_ui_medal', perLevel: '納品で上がる関係 +25%', maxLevel: 5, cost: flat(2), description: '取引先との関係が早く深まる。' },
  { id: 'power', name: '発電の効率', icon: 'icon_power_transmission_tower', perLevel: '発電量 +10%', maxLevel: 8, cost: flat(2), description: 'すべての発電所の出力が上がる。' },
  { id: 'storage', name: '倉庫の使い方', icon: 'icon_commercial_warehouse', perLevel: '倉庫容量 +15%', maxLevel: 8, cost: flat(1), description: '本社と土地の保管量が増える。' },
  { id: 'offline', name: '夜間操業', icon: 'icon_ui_time', perLevel: 'オフライン進行の上限 +2時間', maxLevel: 8, cost: flat(1), description: '閉じている間に進む時間が延びる。' },
];

/** 自動化＋数値強化のすべて */
export const ALL_PRESTIGE_UPGRADES: readonly PrestigeUpgradeDef[] = [...AUTOMATION_UPGRADES, ...PRESTIGE_UPGRADES];

export const PRESTIGE_UPGRADE_MAP: Record<string, PrestigeUpgradeDef> = Object.fromEntries(ALL_PRESTIGE_UPGRADES.map((u) => [u.id, u]));

/** その段階を買うのに必要なポイント */
export function upgradeCost(id: string, level: number): number {
  const def = PRESTIGE_UPGRADE_MAP[id];
  if (!def) return 0;
  return def.cost(level);
}

/** いまの段階までに使ったポイント */
export function spentOn(id: string, level: number): number {
  let sum = 0;
  for (let i = 0; i < level; i++) sum += upgradeCost(id, i);
  return sum;
}

export function levelOf(upgrades: Record<string, number> | undefined, id: string): number {
  return upgrades?.[id] ?? 0;
}
