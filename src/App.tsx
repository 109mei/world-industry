import { useEffect, type ReactElement } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { SideNav } from '@/components/layout/SideNav';
import { AchievementPopup } from '@/components/ui/AchievementPopup';
import { Toasts } from '@/components/ui/Toasts';
import { CraftPage } from '@/features/craft/CraftPage';
import { DebugPanel } from '@/features/debug/DebugPanel';
import { FactoryPage } from '@/features/factory/FactoryPage';
import { HomePage } from '@/features/home/HomePage';
import { OfflineReportModal } from '@/features/offline/OfflineReportModal';
import { MapPage } from '@/features/map/MapPage';
import { ResearchPage } from '@/features/research/ResearchPage';
import { ResourceDetailSheet } from '@/features/resources/ResourceDetailSheet';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { RESEARCH } from '@/game/data/research';
import { isLandSystemUnlocked, isUnlocked } from '@/game/engine/systems/unlocks';
import { LANDS } from '@/game/data/lands';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import type { NavTab } from '@/types/ui';
import { applyTheme, useResolvedTheme } from '@/utils/theme';

const PAGES: Record<NavTab, () => ReactElement> = {
  home: HomePage,
  craft: CraftPage,
  factory: FactoryPage,
  map: MapPage,
  research: ResearchPage,
  settings: SettingsPage,
};

export function App() {
  const tab = useUiStore((s) => s.tab);
  const { state, derived } = useGame();
  const theme = useResolvedTheme();
  useEffect(() => applyTheme(theme), [theme]);
  // 本社を決めるまではホームから動かさない（最初に1回だけ決める）
  const Page = state.settings.hqChosen ? PAGES[tab] : PAGES.home;
  const stopped = Object.values(derived.facilityRuntime).some((r) => r.status === 'no_input' || r.status === 'storage_full' || r.status === 'no_power' || r.status === 'depleted');
  // LAND: 買える土地があるのにまだ1つも持っていない／輸送手段がなく在庫が溜まっている土地がある
  const landSystem = isLandSystemUnlocked(state, derived.assets);
  const noLandYet = landSystem && state.lands.length === 1 && LANDS.some((l) => isUnlocked(state, 'land', l.id) && state.company.cash >= l.price);
  const noRoute = Object.values(derived.lands).some((l) => l.noRoute);
  // COMPANY: 研究できるものがある
  const researchReady = RESEARCH.some((r) => !state.research.completed[r.id] && r.requires.every((q) => state.research.completed[q]) && state.research.points >= r.cost);
  const attention = { factory: stopped, map: noLandYet || noRoute, research: researchReady };
  return (
    <div className="app">
      <SideNav attention={attention} />
      <div className="app__body">
        <Header />
        <main className="app__main">
          <Page />
        </main>
      </div>
      <BottomNav attention={attention} />
      <ResourceDetailSheet />
      <OfflineReportModal />
      <Toasts />
      <AchievementPopup />
      <DebugPanel />
    </div>
  );
}
