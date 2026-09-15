import type { ReactElement } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { SideNav } from '@/components/layout/SideNav';
import { Toasts } from '@/components/ui/Toasts';
import { CompanyPage } from '@/features/company/CompanyPage';
import { CraftPage } from '@/features/craft/CraftPage';
import { DebugPanel } from '@/features/debug/DebugPanel';
import { FactoryPage } from '@/features/factory/FactoryPage';
import { HomePage } from '@/features/home/HomePage';
import { LandPage } from '@/features/land/LandPage';
import { OfflineReportModal } from '@/features/offline/OfflineReportModal';
import { ResourceDetailSheet } from '@/features/resources/ResourceDetailSheet';
import { ResourcesPage } from '@/features/resources/ResourcesPage';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import type { NavTab } from '@/types/ui';

const PAGES: Record<NavTab, () => ReactElement> = {
  home: HomePage,
  resources: ResourcesPage,
  craft: CraftPage,
  land: LandPage,
  factory: FactoryPage,
  company: CompanyPage,
};

export function App() {
  const tab = useUiStore((s) => s.tab);
  const { derived } = useGame();
  const Page = PAGES[tab];
  const stopped = Object.values(derived.facilityRuntime).some((r) => r.status === 'no_input' || r.status === 'storage_full');
  const attention = { factory: stopped };
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
      <DebugPanel />
    </div>
  );
}
