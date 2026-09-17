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
  | 'land_slump';

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
  description: string;
}

export const EVENTS = [
  { id: 'boom', kind: 'boom', name: '相場高騰', icon: 'icon_ui_profit', duration: 150, weight: 5, magnitude: 1.8, description: '{target}の価格が1.8倍に。売り時。' },
  { id: 'crash', kind: 'crash', name: '相場暴落', icon: 'icon_ui_loss', duration: 150, weight: 4, magnitude: 0.5, description: '{target}の価格が半分に。しばらく売らずに貯めるのも手。' },
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
] as const satisfies readonly EventDef[];

export type EventDefId = (typeof EVENTS)[number]['id'];
export const EVENT_MAP: Record<EventDefId, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e])) as unknown as Record<EventDefId, EventDef>;

export function isEventDefId(id: string): id is EventDefId {
  return id in EVENT_MAP;
}
