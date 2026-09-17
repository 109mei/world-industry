import { create } from 'zustand';
import type { RecipeCategory } from '@/game/data/recipes';
import type { ResourceId } from '@/game/data/resources';
import type { GameEventType, OfflineReport } from '@/types/state';
import type { NavTab } from '@/types/ui';

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
  craftCategory: RecipeCategory;
  setCraftCategory: (c: RecipeCategory) => void;
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
  companySubTab: 'info' | 'research' | 'achievements' | 'settings';
  setCompanySubTab: (t: 'info' | 'research' | 'achievements' | 'settings') => void;
  achievementQueue: AchievementPopup[];
  pushAchievement: (achievementId: string) => void;
  shiftAchievement: () => void;
}

let toastSeq = 1;

export const useUiStore = create<UiStore>((set) => ({
  tab: 'home',
  setTab: (tab) => set({ tab }),
  resourceSubTab: 'inventory',
  setResourceSubTab: (resourceSubTab) => set({ resourceSubTab }),
  craftCategory: 'tools',
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
  achievementQueue: [],
  pushAchievement: (achievementId) => set((s) => ({ achievementQueue: [...s.achievementQueue, { id: toastSeq++, achievementId }] })),
  shiftAchievement: () => set((s) => ({ achievementQueue: s.achievementQueue.slice(1) })),
}));
