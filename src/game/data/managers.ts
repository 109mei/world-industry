import type { ManagerId } from '@/types/state';
import type { UnlockCondition } from './unlockTypes';

/**
 * マネージャー（自動化の担当者）。雇うと担当分野が自動で回る。
 * 費用は採用費（1回）と給料（毎秒。基本額 + 総資産 × CONFIG.automation.salaryAssetRate）。
 */
export interface ManagerDef {
  id: ManagerId;
  name: string;
  icon: string;
  /** 採用費（円） */
  hireCost: number;
  /** 給料の基本額（円/秒） */
  salaryBase: number;
  unlock: UnlockCondition;
  description: string;
  /** 具体的に何をするか（箇条書き） */
  duties: string[];
}

export const MANAGERS: readonly ManagerDef[] = [
  {
    id: 'gather', name: '採集係', icon: 'icon_facility_worker', hireCost: 300, salaryBase: 0.5,
    unlock: { type: 'tutorialStep', min: 2 },
    description: '解放済みの手作業の採集を、あなたの代わりに毎秒1回ずつ行う。道具があれば使う。',
    duties: ['解放済みの採集を毎秒1回ずつ（倉庫が満杯のものは飛ばす）', '道具を使う採集は道具も消費する'],
  },
  {
    id: 'craft', name: 'クラフト係', icon: 'icon_ui_craft', hireCost: 2_000, salaryBase: 2,
    unlock: { type: 'crafted', recipe: 'fire_brick', min: 1 },
    description: '資源ごとに決めた「キープする量」を下回ったらクラフトで補充する。道具も各1本切らさない。',
    duties: ['資源の詳細で設定した「キープ」量まで自動クラフト', '解放済みの道具を常に1本ずつ用意（材料があるとき）'],
  },
  {
    id: 'sales', name: '販売係', icon: 'icon_ui_sell', hireCost: 5_000, salaryBase: 5,
    unlock: { type: 'sold', resource: 'tool', min: 10 },
    description: '自動売却に「下限価格」を付けられる。注文の納品と、消費されない資源の余剰の販売もまかせられる。',
    duties: ['自動売却の下限価格（相場が安いときは売らない）', '注文の自動納品', '「おまかせ販売」: どの施設も使わない資源の余剰を、需要を見ながら売る'],
  },
  {
    id: 'logistics', name: '物流係', icon: 'icon_logistics_truck', hireCost: 200_000, salaryBase: 20,
    unlock: { type: 'landOwned', min: 1 },
    description: '輸送手段がない土地や輸送が追いつかない土地に、一番安い輸送手段を追加する。倉庫が満杯なら現地倉庫を建てる。',
    duties: ['輸送手段がない・使用率 90% 超の土地に、その土地で使える一番安い輸送手段を配備', '倉庫満杯で止まっている土地に現地倉庫を追加', '所持金の 20% までを1回の費用の上限にする'],
  },
  {
    id: 'invest', name: '投資係', icon: 'icon_ui_chart_trend', hireCost: 1_000_000, salaryBase: 25,
    unlock: { type: 'assets', min: 3_000_000 },
    description: '手元に残す現金を超えた分で、回収が最も早い施設を建てる。配当の株への再投資や、利回りの良い物件の購入もまかせられる。',
    duties: ['「残す現金」を超えた分だけ投資に使う', '回収が最も早い施設を建てる（回収時間の上限つき）', '配当を利回りの高い会社の株に再投資', '利回りが高く買える物件を買う'],
  },
];

export const MANAGER_MAP: Record<ManagerId, ManagerDef> = Object.fromEntries(MANAGERS.map((m) => [m.id, m])) as Record<ManagerId, ManagerDef>;
