import type { FacilityCategory } from './facilities';

export type ResearchEffect =
  | { type: 'production'; category: FacilityCategory | 'all'; mult: number }
  | { type: 'powerGeneration'; mult: number }
  | { type: 'renewableGeneration'; mult: number }
  | { type: 'transportCapacity'; mult: number }
  | { type: 'transportCost'; mult: number }
  | { type: 'survey'; costMult: number; timeMult: number }
  | { type: 'storage'; mult: number }
  | { type: 'commercialIncome'; mult: number }
  /** 説明だけの効果（解放は各定義の unlock 条件で参照する） */
  | { type: 'unlock'; text: string };

export interface ResearchDef {
  id: string;
  name: string;
  icon: string;
  /** 必要な研究ポイント */
  cost: number;
  /** 前提となる研究 */
  requires: string[];
  effects: ResearchEffect[];
  description: string;
}

export const RESEARCH = [
  { id: 'geology', name: '地質学', icon: 'icon_marker_survey', cost: 40, requires: [], effects: [{ type: 'survey', costMult: 0.7, timeMult: 0.6 }], description: '地下資源調査の費用 -30%、時間 -40%。' },
  { id: 'automation', name: '自動化', icon: 'icon_part_robot_arm', cost: 120, requires: [], effects: [{ type: 'production', category: 'RESOURCE', mult: 1.25 }], description: '採集・採掘施設の生産 +25%。' },
  { id: 'overseas', name: '海外進出', icon: 'icon_logistics_ship', cost: 150, requires: ['geology'], effects: [{ type: 'unlock', text: '海外の土地を購入できる' }], description: '海外の土地を購入できるようになる。' },
  { id: 'railway', name: '鉄道輸送', icon: 'icon_logistics_train', cost: 120, requires: [], effects: [{ type: 'unlock', text: '貨物列車' }], description: '土地に貨物列車を配備できる。トラックの10倍の輸送力。' },
  { id: 'grid', name: '送電網', icon: 'icon_power_transmission_tower', cost: 100, requires: [], effects: [{ type: 'powerGeneration', mult: 1.15 }], description: 'すべての発電所の出力 +15%。' },
  { id: 'renewables', name: '再生可能エネルギー', icon: 'icon_power_wind', cost: 250, requires: ['grid'], effects: [{ type: 'unlock', text: '太陽光・風力・水力発電' }, { type: 'renewableGeneration', mult: 1.3 }], description: '太陽光・風力・水力発電所を建てられる。再生可能エネルギーの出力 +30%。' },
  { id: 'mass_storage', name: '大規模保管', icon: 'icon_logistics_storage_rack', cost: 200, requires: [], effects: [{ type: 'storage', mult: 1.5 }], description: 'すべての倉庫容量 +50%。' },
  { id: 'pipeline', name: 'パイプライン', icon: 'icon_logistics_pipeline', cost: 250, requires: ['railway'], effects: [{ type: 'unlock', text: 'パイプライン' }], description: '原油・燃料・水を安く大量に運ぶパイプラインを敷ける。' },
  { id: 'logistics_ai', name: '物流最適化', icon: 'icon_office_dashboard', cost: 400, requires: ['railway'], effects: [{ type: 'transportCapacity', mult: 1.3 }, { type: 'transportCost', mult: 0.75 }], description: '輸送能力 +30%、輸送費 -25%。' },
  { id: 'commerce', name: '商業開発', icon: 'icon_commercial_office', cost: 300, requires: ['overseas'], effects: [{ type: 'unlock', text: 'オフィス・データセンター' }, { type: 'commercialIncome', mult: 1.5 }], description: 'オフィスとデータセンターを建てられる。商業施設の収益 +50%。' },
  { id: 'advanced_materials', name: '先端素材', icon: 'icon_material_semiconductor', cost: 500, requires: ['automation'], effects: [{ type: 'unlock', text: '電子部品工場' }, { type: 'production', category: 'MANUFACTURING', mult: 1.2 }], description: '電子部品工場を建てられる。製造施設の生産 +20%。' },
  { id: 'nuclear', name: '原子力工学', icon: 'icon_power_nuclear', cost: 2000, requires: ['advanced_materials', 'renewables'], effects: [{ type: 'unlock', text: 'ウラン鉱山・濃縮工場・原子力発電所' }], description: 'ウラン鉱山・核燃料濃縮工場・原子力発電所を建てられる。' },
] as const satisfies readonly ResearchDef[];

export type ResearchId = (typeof RESEARCH)[number]['id'];
export const RESEARCH_MAP: Record<ResearchId, ResearchDef> = Object.fromEntries(RESEARCH.map((r) => [r.id, r])) as unknown as Record<ResearchId, ResearchDef>;

export function isResearchId(id: string): id is ResearchId {
  return id in RESEARCH_MAP;
}
