/**
 * お店ごとの「商売のしかた」。
 *
 * どの店も同じ、では面白くないので、業種ごとに効くものを変えている。
 *  - 飲食店は席数と回転、食材の傷み
 *  - コンビニ・スーパーは品ぞろえと欠品、廃棄ロス
 *  - アパレルは流行（季節が変わると売れ残りが値下がる）
 *  - 宝石店は客は少ないが1点が高く、成約率が勝負
 *  - ホテルは部屋数と稼働率
 *  - カジノは客が賭けた額とハウスエッジ
 */
import type { BusinessKindId } from './business';

export interface ShopModel {
  /** 客1人が買う点数 */
  itemsPerCustomer: number;
  /** 仕入れ値に対する上乗せ（1.5 なら 1.5倍で売る） */
  markup: number;
  /** 在庫が1時間で傷む割合（0 なら傷まない） */
  spoilPerHour: number;
  /** 面積1㎡あたりの席・部屋・台の数（0 なら面積の上限なし） */
  capacityPerSqm: number;
  /** 席・部屋・台1つを回すのに要る人数 */
  staffPerCapacity: number;
  /** 流行に左右されるか（売れ残りが値下がりする） */
  seasonal: boolean;
  /** 品ぞろえの幅が客足に効く度合い（0〜1） */
  varietyWeight: number;
  /** 客が入っても買わずに帰ることがある割合（成約率の裏返し） */
  browseRate: number;
  /** その店の商売を一言で */
  note: string;
  /** 経営のコツ（画面に出す） */
  tips: string[];
}

export const SHOP_MODELS: Partial<Record<BusinessKindId, ShopModel>> = {
  shop: {
    itemsPerCustomer: 1.4,
    markup: 1.5,
    spoilPerHour: 0,
    capacityPerSqm: 0,
    staffPerCapacity: 0,
    seasonal: false,
    varietyWeight: 0.5,
    browseRate: 0.15,
    note: '仕入れて並べて売る、いちばん基本の商売。',
    tips: ['品ぞろえを増やすと客足が伸びる', '欠品すると客は帰ってしまい、知名度も下がる'],
  },
  restaurant: {
    itemsPerCustomer: 1,
    markup: 3.2,
    spoilPerHour: 0.12,
    capacityPerSqm: 0.12,
    staffPerCapacity: 0.18,
    seasonal: false,
    varietyWeight: 0.25,
    browseRate: 0.03,
    note: '食材を料理にして出す。席の数と回転、人手がすべて。',
    tips: ['席は広さで決まる（1席あたり約8㎡）', '人手が足りないと席が空いていても回らない', '食材は毎時12%傷むので、抱えすぎない'],
  },
  convenience: {
    itemsPerCustomer: 2.2,
    markup: 1.35,
    spoilPerHour: 0.06,
    capacityPerSqm: 0,
    staffPerCapacity: 0,
    seasonal: false,
    varietyWeight: 0.9,
    browseRate: 0.08,
    note: '品数で勝負する。薄利多売で、欠品がいちばんの敵。',
    tips: ['扱う品を全部そろえるほど客が来る', '1点あたりの利益は薄いので、数をさばく', '生鮮は毎時6%傷む'],
  },
  apparel: {
    itemsPerCustomer: 1.2,
    markup: 2.6,
    spoilPerHour: 0,
    capacityPerSqm: 0,
    staffPerCapacity: 0,
    seasonal: true,
    varietyWeight: 0.4,
    browseRate: 0.45,
    note: '見て、迷って、買っていく。ブランドがそのまま値札になる。',
    tips: ['入った客の半分近くは買わずに帰る（ブランドが上がると買ってくれる）', '流行が変わると在庫が値下がりする。抱えすぎない'],
  },
  jewelry: {
    itemsPerCustomer: 1,
    markup: 2.2,
    spoilPerHour: 0,
    capacityPerSqm: 0,
    staffPerCapacity: 0,
    seasonal: false,
    varietyWeight: 0.2,
    browseRate: 0.82,
    note: '客は少ないが、1点の額が桁違い。決まるかどうかが勝負。',
    tips: ['ほとんどの客は見るだけ。ブランドが上がると成約率が上がる', '自分で掘った金や磨いた宝石をそのまま並べられる'],
  },
  hotel: {
    itemsPerCustomer: 1,
    markup: 4,
    spoilPerHour: 0.05,
    capacityPerSqm: 0.02,
    staffPerCapacity: 0.25,
    seasonal: true,
    varietyWeight: 0.15,
    browseRate: 0.05,
    note: '部屋を埋める商売。立地と評判で稼働率が決まる。',
    tips: ['部屋数は広さで決まる（1室あたり約50㎡）', '清掃と接客に人が要る', '観光の季節で客足が変わる'],
  },
  casino: {
    itemsPerCustomer: 1,
    markup: 1,
    spoilPerHour: 0,
    capacityPerSqm: 0.03,
    staffPerCapacity: 0.3,
    seasonal: false,
    varietyWeight: 0.1,
    browseRate: 0.1,
    note: '客が賭けた額の一部が、そのまま店の取り分になる。',
    tips: ['台数は広さで決まる', '客1人が賭ける額は知名度とブランドで増える', '取り分はゲームごとのハウスエッジぶんだけ'],
  },
};

/** 季節（流行）の周期。1周で1年ぶんのつもり */
export const SEASON_SECONDS = 1_800;
