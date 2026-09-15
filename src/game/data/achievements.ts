import type { GameState } from '@/types/state';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (state: GameState, assets: number) => boolean;
}

const sum = (rec: Record<string, number | undefined>) => Object.values(rec).reduce<number>((a, b) => a + (b ?? 0), 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_stone', name: '最初の石', description: '初めて石を拾う。', icon: 'icon_resource_stone', check: (s) => (s.stats.totalGathered['stone'] ?? 0) >= 1 },
  { id: 'toolsmith', name: '工具職人', description: '道具を100個作る。', icon: 'icon_tool_hammer_stone', check: (s) => sum(s.stats.toolsCrafted) >= 100 },
  { id: 'first_hire', name: '初めての雇用', description: '作業員を雇う。', icon: 'icon_facility_worker', check: (s) => s.facilities.some((f) => f.count > 0) },
  { id: 'industrial_revolution', name: '産業革命', description: '最初の工場（簡易製鉄所）を建設する。', icon: 'icon_facility_steel_mill', check: (s) => s.facilities.some((f) => f.typeId === 'simple_smelter' && f.count > 0) },
  { id: 'iron_age', name: '鉄の時代', description: '鉄を100個入手する。', icon: 'icon_material_iron', check: (s) => (s.stats.totalObtained['iron'] ?? 0) >= 100 },
  { id: 'merchant', name: '商人', description: '累計10,000円を売り上げる。', icon: 'icon_ui_sell', check: (s) => s.company.totalEarned >= 10_000 },
  { id: 'millionaire', name: '百万長者', description: '1,000,000円を所持する。', icon: 'icon_ui_money', check: (s) => s.company.cash >= 1_000_000 },
  { id: 'billionaire', name: '億万長者', description: '100,000,000円を所持する。', icon: 'icon_ui_crown', check: (s) => s.company.cash >= 100_000_000 },
  { id: 'landowner', name: '土地所有者', description: '初めて土地を購入する。', icon: 'icon_ui_land', check: (s) => s.lands.some((l) => l.id !== 'hq') },
  { id: 'power_king', name: '発電王', description: '1GWを発電する。', icon: 'icon_ui_power', check: (_s, _a) => false },
  { id: 'world_company', name: '世界企業', description: '5か国に施設を所有する。', icon: 'icon_ui_company', check: (s) => new Set(s.lands.map((l) => l.country)).size >= 5 },
];
