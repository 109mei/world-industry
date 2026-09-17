import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { CONFIG } from '@/game/data/config';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate, formatNumber, formatPercent } from '@/utils/format';
import { formatMW } from '@/utils/names';
import { CompanyPanel } from '@/features/company/CompanyPanel';
import { ResourcesPanel } from '@/features/resources/ResourcesPanel';
import { SalesPanel } from '@/features/sales/SalesPanel';
import { EventBanner } from './EventBanner';
import { EventList } from './EventList';
import { GatherPanel } from './GatherPanel';
import { HighlightsCard } from './HighlightsCard';
import { KeyResources } from './KeyResources';
import { NextGoals } from './NextGoals';
import { TutorialCard } from './TutorialCard';

/** ホーム。資源と会社もこの中にまとめている */
export function HomePage() {
  const { state, derived } = useGame();
  const sub = useUiStore((s) => s.homeSubTab);
  const setSub = useUiStore((s) => s.setHomeSubTab);
  const mode = state.settings.numberFormat;
  return (
    <div className="page">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="所持金" value={formatMoney(state.company.cash, mode)} size="lg" />
          <Stat label="自動収益 /秒" value={formatMoneyRate(derived.incomePerSec, mode)} tone={derived.incomePerSec > 0 ? 'profit' : 'default'} />
          <Stat label="総資産" value={formatMoney(derived.assets, mode)} />
          <Stat label="従業員" value={`${formatNumber(derived.employees, mode)}人`} />
          {(derived.power.capacity > 0 || derived.power.demand > 0) && (
            <Stat label="電力" value={`${formatMW(derived.power.generation)} / ${formatMW(derived.power.capacity)}`} tone={derived.power.ratio >= 0.999 ? 'power' : 'loss'} extra={`供給率 ${formatPercent(derived.power.ratio)}`} />
          )}
          {state.lands.length > 1 && <Stat label="土地" value={`${state.lands.length - 1}か所`} extra={derived.transportCost > 0 ? `輸送費 ${formatMoney(derived.transportCost, mode)}/秒` : undefined} />}
          {state.contracts.credit > 0 && <Stat label="信用ランク" value={derived.creditRank} tone="research" extra={`信用 ${formatNumber(state.contracts.credit, mode)}`} />}
          {state.prestige.points > 0 && <Stat label="再出発ボーナス" value={`${state.prestige.points}pt`} tone="research" extra={`生産 ×${(1 + CONFIG.prestige.productionPerPoint * state.prestige.points).toFixed(2)}`} />}
        </div>
      </Card>

      <Segmented
        ariaLabel="ホームの切替"
        items={[
          { id: 'home', label: 'ホーム' },
          { id: 'resources', label: '資源' },
          { id: 'sales', label: '取引' },
          { id: 'company', label: '会社' },
        ]}
        value={sub}
        onChange={setSub}
      />

      {sub === 'home' && (
        <>
          <EventBanner />
          <TutorialCard />

          <div className="section-title">手作業で採集</div>
          <GatherPanel />

          <div className="section-title">主要資源</div>
          <KeyResources />

          <div className="section-title">ハイライト</div>
          <HighlightsCard />

          <div className="section-title">次の目標（解放条件）</div>
          <NextGoals />

          <div className="section-title">最近の出来事</div>
          <Card>
            <EventList limit={8} />
          </Card>
        </>
      )}

      {sub === 'resources' && <ResourcesPanel />}
      {sub === 'sales' && <SalesPanel />}
      {sub === 'company' && <CompanyPanel />}
    </div>
  );
}
