import type { TransportKind } from './facilities';

/**
 * ランダムイベントの定義。発生条件と効果の種類だけをデータとして持ち、
 * 実際の効果の計算は engine/systems/events.ts で行う。
 */
export type EventKind =
  /** 相場高騰: ある資源の価格が上がる */
  | 'boom'
  /** 相場暴落: ある資源の価格が下がる */
  | 'crash'
  /** 需要増: ある資源の需要が回復し、需要容量が増える */
  | 'demand'
  /** 地震: ある土地の生産と陸路・鉄道の輸送が落ちる */
  | 'quake'
  /** 嵐: 海路・空路の輸送が落ちる */
  | 'storm'
  /** 猛暑: 発電能力が落ちる */
  | 'heatwave'
  /** 祭り: 商業施設の収入が増える */
  | 'festival'
  /** 鉱脈発見: ある土地の鉱脈が増える（即時） */
  | 'discovery'
  /** 補助金: 所持金が増える（即時） */
  | 'subsidy'
  /** 株高: すべての株価が上がる */
  | 'bull'
  /** 株安: すべての株価が下がる */
  | 'bear'
  /** 地価上昇: ある都市の地価が上がる（即時） */
  | 'land_boom'
  /** 地価下落: ある都市の地価が下がる（即時） */
  | 'land_slump'
  /** 臨時の出費: 所持金が減る（即時） */
  | 'tax'
  /** 技術補助: 研究ポイントが増える（即時） */
  | 'research_grant'
  /** 燃料の値動き: 輸送費が上下する */
  | 'fuel'
  /** 景気: すべての資源の売値が上下する */
  | 'market_wave'
  /** 特需: 契約の単価が上がる */
  | 'order_rush'
  /** 操業の停滞: すべての土地の生産が落ちる */
  | 'slowdown';

export interface EventDef {
  id: string;
  kind: EventKind;
  name: string;
  icon: string;
  /** 継続時間（秒）。0 なら即時効果 */
  duration: number;
  /** 発生確率の重み */
  weight: number;
  /** 効果の強さ（種類ごとの意味は events.ts を参照） */
  magnitude: number;
  /** 災害として数える（実績用） */
  disaster?: boolean;
  /** 影響を受ける輸送手段 */
  transport?: TransportKind[];
  /** 対象をこの資源に限る（指定しなければ持っている資源のどれか） */
  targets?: string[];
  description: string;
}

export const EVENTS = [
  { id: 'boom', kind: 'boom', name: '相場高騰', icon: 'icon_ui_profit', duration: 150, weight: 5, magnitude: 1.8, description: '{target}の価格が1.8倍に。売り時。' },
  { id: 'crash', kind: 'crash', name: '相場暴落', icon: 'icon_ui_loss', duration: 150, weight: 4, magnitude: 0.5, description: '{target}の価格が半分に。しばらく売らずに貯めるのも手。' },
  { id: 'gpu_shortage', kind: 'boom', name: 'GPU品薄', icon: 'icon_part_gpu', duration: 240, weight: 3, magnitude: 2.6, targets: ['gpu'], description: 'GPUが手に入らなくなり、値段が2.6倍に。持っていれば転売の好機。' },
  { id: 'gpu_glut', kind: 'crash', name: 'GPUだぶつき', icon: 'icon_part_gpu', duration: 200, weight: 2, magnitude: 0.45, targets: ['gpu'], description: '在庫があふれてGPUの値段が半分以下に。仕入れ時。' },
  { id: 'crypto_bubble', kind: 'boom', name: '暗号資産バブル', icon: 'icon_product_crypto', duration: 210, weight: 3, magnitude: 3.2, targets: ['crypto'], description: '暗号資産が3.2倍に跳ね上がる。掘った分を売るなら今。' },
  { id: 'crypto_burst', kind: 'crash', name: '暗号資産の暴落', icon: 'icon_product_crypto', duration: 210, weight: 3, magnitude: 0.3, targets: ['crypto'], description: '暗号資産が3割の値段に。マイニングは電気代が出なくなる。' },
  { id: 'demand', kind: 'demand', name: '需要急増', icon: 'icon_ui_chart_trend', duration: 180, weight: 4, magnitude: 3, description: '{target}の需要が急増。値崩れせずに大量に売れる。' },
  { id: 'quake', kind: 'quake', name: '地震', icon: 'icon_ui_warning', duration: 120, weight: 3, magnitude: 0.5, disaster: true, transport: ['road', 'rail'], description: '{target}で地震。生産と陸路・鉄道の輸送が半減。貨物機は影響を受けない。' },
  { id: 'storm', kind: 'storm', name: '嵐', icon: 'icon_weather_storm', duration: 90, weight: 3, magnitude: 0.2, disaster: true, transport: ['sea', 'air'], description: '嵐で船と飛行機が止まる。海路・空路の輸送が 20% に。' },
  { id: 'heatwave', kind: 'heatwave', name: '猛暑', icon: 'icon_weather_hot', duration: 90, weight: 3, magnitude: 0.7, disaster: true, description: '猛暑で発電能力が 70% に。電力を使う工場が減速する。' },
  { id: 'festival', kind: 'festival', name: '祭り', icon: 'icon_ui_star', duration: 120, weight: 3, magnitude: 2, description: '祭りで人出が増え、商業施設の収入が2倍。' },
  { id: 'discovery', kind: 'discovery', name: '鉱脈発見', icon: 'icon_marker_mine', duration: 0, weight: 2, magnitude: 0.25, description: '{target}で新しい鉱脈が見つかり、埋蔵量が増えた。' },
  { id: 'subsidy', kind: 'subsidy', name: '補助金', icon: 'icon_office_coins', duration: 0, weight: 2, magnitude: 90, description: '産業振興の補助金を受け取った。' },
  { id: 'bull', kind: 'bull', name: '株高', icon: 'icon_ui_chart_trend', duration: 180, weight: 3, magnitude: 1.3, description: '株式相場が活況。すべての株価が1.3倍。売り時。' },
  { id: 'bear', kind: 'bear', name: '株安', icon: 'icon_ui_loss', duration: 150, weight: 3, magnitude: 0.7, description: '株式相場が急落。すべての株価が70%に。買い時。' },
  { id: 'land_boom', kind: 'land_boom', name: '地価上昇', icon: 'icon_terrain_city', duration: 0, weight: 3, magnitude: 1.15, description: '{target}の地価が15%上がった。' },
  { id: 'land_slump', kind: 'land_slump', name: '地価下落', icon: 'icon_ui_warning', duration: 0, weight: 2, magnitude: 0.88, description: '{target}の地価が12%下がった。' },

  // ---- 災害・事故 ----
  { id: 'flood', kind: 'quake', name: '洪水', icon: 'icon_weather_storm', duration: 150, weight: 3, magnitude: 0.55, disaster: true, transport: ['road', 'rail', 'sea'], description: '{target}が浸水。生産が落ち、陸路・鉄道・海路が止まりがちに。' },
  { id: 'blackout', kind: 'heatwave', name: '大規模停電', icon: 'icon_ui_warning', duration: 70, weight: 2, magnitude: 0.3, disaster: true, description: '送電網の事故で発電能力が30%に。電気を食う設備から止まる。' },
  { id: 'cold_wave', kind: 'heatwave', name: '寒波', icon: 'icon_weather_hot', duration: 120, weight: 3, magnitude: 0.8, disaster: true, description: '寒波で発電能力が80%に。暖房需要で電気が足りない。' },
  { id: 'strike', kind: 'slowdown', name: 'ストライキ', icon: 'icon_facility_worker', duration: 150, weight: 3, magnitude: 0.6, disaster: true, description: '労働争議で全社の生産が60%に落ちた。' },
  { id: 'epidemic', kind: 'slowdown', name: '感染症の流行', icon: 'icon_ui_warning', duration: 240, weight: 2, magnitude: 0.75, disaster: true, description: '感染症の流行で人手が減り、全社の生産が75%に。' },
  { id: 'accident', kind: 'quake', name: '設備事故', icon: 'icon_ui_warning', duration: 90, weight: 3, magnitude: 0.45, disaster: true, transport: ['road'], description: '{target}で設備事故。生産と搬出が半分以下に。' },

  // ---- 景気・相場 ----
  { id: 'expansion', kind: 'market_wave', name: '好景気', icon: 'icon_ui_chart_trend', duration: 300, weight: 3, magnitude: 1.25, description: '景気が良くなり、すべての資源が25%高く売れる。' },
  { id: 'recession', kind: 'market_wave', name: '不況', icon: 'icon_ui_loss', duration: 300, weight: 3, magnitude: 0.8, description: '不況で買い手が減り、すべての資源の売値が80%に。' },
  { id: 'fuel_spike', kind: 'fuel', name: '燃料高騰', icon: 'icon_material_fuel', duration: 210, weight: 3, magnitude: 1.8, description: '燃料が高騰。輸送費が1.8倍になった。' },
  { id: 'fuel_drop', kind: 'fuel', name: '燃料安', icon: 'icon_material_fuel', duration: 210, weight: 2, magnitude: 0.6, description: '燃料が値下がり。輸送費が60%に下がった。' },

  // ---- 取引・研究 ----
  { id: 'order_rush', kind: 'order_rush', name: '特需', icon: 'icon_office_contract', duration: 240, weight: 3, magnitude: 1.5, description: '急な引き合いが続き、契約の納品単価が1.5倍に。' },
  { id: 'order_slump', kind: 'order_rush', name: '発注減', icon: 'icon_ui_loss', duration: 180, weight: 2, magnitude: 0.75, description: '取引先の発注が細り、契約の納品単価が75%に。' },
  { id: 'research_grant', kind: 'research_grant', name: '技術補助金', icon: 'icon_ui_research', duration: 0, weight: 3, magnitude: 120, description: '技術開発の補助金が出て、研究が一気に進んだ。' },
  { id: 'tax', kind: 'tax', name: '臨時の出費', icon: 'icon_ui_loss', duration: 0, weight: 3, magnitude: 45, description: '設備の修繕と追徴で、まとまった出費が出た。' },
  { id: 'inspection', kind: 'tax', name: '立入検査', icon: 'icon_ui_warning', duration: 0, weight: 2, magnitude: 25, description: '当局の立入検査。是正の費用がかかった。' },
] as const satisfies readonly EventDef[];

export type EventDefId = (typeof EVENTS)[number]['id'];
export const EVENT_MAP: Record<EventDefId, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e])) as unknown as Record<EventDefId, EventDef>;

export function isEventDefId(id: string): id is EventDefId {
  return id in EVENT_MAP;
}
