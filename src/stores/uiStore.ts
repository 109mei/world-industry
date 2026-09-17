import { create } from 'zustand';
import type { RecipeCategory } from '@/game/data/recipes';
import type { ResourceId } from '@/game/data/resources';
import type { GameEventType, OfflineReport } from '@/types/state';
import type { NavTab } from '@/types/ui';

/** クラフト一覧のカテゴリ（すべてを含む） */
export type CraftCategoryFilter = 'all' | RecipeCategory;

export type CompanySubTab = 'info' | 'achievements' | 'prestige';
/** ホーム画面の中の切替（資源・会社をここに統合した） */
export type HomeSubTab = 'home' | 'resources' | 'company';
/** 地図画面の中の切替（土地・物件・株をここに統合した） */
export type MapSubTab = 'map' | 'lands' | 'properties' | 'stocks';

export interface Toast {
  id: number;
  type: GameEventType;
  message: string;
}

/** 実績解除の演出（順番に表示する） */
export interface AchievementPopup {
  id: number;
  achievementId: string;
}

interface UiStore {
  tab: NavTab;
  setTab: (tab: NavTab) => void;
  resourceSubTab: 'inventory' | 'market';
  setResourceSubTab: (t: 'inventory' | 'market') => void;
  craftCategory: CraftCategoryFilter;
  setCraftCategory: (c: CraftCategoryFilter) => void;
  selectedResource: ResourceId | null;
  openResource: (id: ResourceId | null) => void;
  toasts: Toast[];
  pushToast: (type: GameEventType, message: string) => void;
  dismissToast: (id: number) => void;
  offlineReport: OfflineReport | null;
  setOfflineReport: (r: OfflineReport | null) => void;
  debugOpen: boolean;
  setDebugOpen: (v: boolean) => void;
  /** LAND 画面で開いている土地（詳細シート） */
  selectedLand: string | null;
  openLand: (id: string | null) => void;
  /** FACTORY 画面で表示中の土地 */
  factoryLand: string;
  setFactoryLand: (id: string) => void;
  companySubTab: CompanySubTab;
  setCompanySubTab: (t: CompanySubTab) => void;
  homeSubTab: HomeSubTab;
  setHomeSubTab: (t: HomeSubTab) => void;
  mapSubTab: MapSubTab;
  setMapSubTab: (t: MapSubTab) => void;
  achievementQueue: AchievementPopup[];
  pushAchievement: (achievementId: string) => void;
  shiftAchievement: () => void;
  /** ESTATE 画面で開いている物件 */
  selectedProperty: string | null;
  openProperty: (id: string | null) => void;
  /** ESTATE 画面で開いている会社 */
  selectedCompany: string | null;
  openCompany: (id: string | null) => void;
  /** 物件一覧の絞り込み */
  estateFilter: 'all' | 'owned' | 'affordable';
  setEstateFilter: (f: 'all' | 'owned' | 'affordable') => void;
  /** 地図で移動したい場所（設定すると地図がそこへ飛ぶ） */
  mapTarget: { lat: number; lon: number; zoom: number; seq: number } | null;
  flyTo: (lat: number, lon: number, zoom: number) => void;
}

let toastSeq = 1;

export const useUiStore = create<UiStore>((set) => ({
  tab: 'home',
  setTab: (tab) => set({ tab }),
  resourceSubTab: 'inventory',
  setResourceSubTab: (resourceSubTab) => set({ resourceSubTab }),
  craftCategory: 'all',
  setCraftCategory: (craftCategory) => set({ craftCategory }),
  selectedResource: null,
  openResource: (selectedResource) => set({ selectedResource }),
  toasts: [],
  pushToast: (type, message) =>
    set((s) => {
      // 同じ文言が既に出ていれば増やさない
      if (s.toasts.some((t) => t.message === message)) return s;
      const toasts = [...s.toasts, { id: toastSeq++, type, message }].slice(-3);
      return { toasts };
    }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  offlineReport: null,
  setOfflineReport: (offlineReport) => set({ offlineReport }),
  debugOpen: false,
  setDebugOpen: (debugOpen) => set({ debugOpen }),
  selectedLand: null,
  openLand: (selectedLand) => set({ selectedLand }),
  factoryLand: 'hq',
  setFactoryLand: (factoryLand) => set({ factoryLand }),
  companySubTab: 'info',
  setCompanySubTab: (companySubTab) => set({ companySubTab }),
  homeSubTab: 'home',
  setHomeSubTab: (homeSubTab) => set({ homeSubTab }),
  mapSubTab: 'map',
  setMapSubTab: (mapSubTab) => set({ mapSubTab }),
  achievementQueue: [],
  pushAchievement: (achievementId) => set((s) => ({ achievementQueue: [...s.achievementQueue, { id: toastSeq++, achievementId }] })),
  shiftAchievement: () => set((s) => ({ achievementQueue: s.achievementQueue.slice(1) })),
  selectedProperty: null,
  openProperty: (selectedProperty) => set({ selectedProperty }),
  selectedCompany: null,
  openCompany: (selectedCompany) => set({ selectedCompany }),
  estateFilter: 'all',
  setEstateFilter: (estateFilter) => set({ estateFilter }),
  mapTarget: null,
  flyTo: (lat, lon, zoom) => set((s) => ({ mapTarget: { lat, lon, zoom, seq: (s.mapTarget?.seq ?? 0) + 1 } })),
}));
