import { Card } from '@/components/ui/Card';
import { CONFIG } from '@/game/data/config';
import { Stat } from '@/components/ui/Stat';
import { useGame } from '@/stores/gameStore';
import { formatMoney, formatMoneyRate, formatNumber, formatPercent } from '@/utils/format';
import { formatMW } from '@/utils/names';
import { ContractsCard } from './ContractsCard';
import { EventBanner } from './EventBanner';
import { EventList } from './EventList';
import { GatherPanel } from './GatherPanel';
import { HighlightsCard } from './HighlightsCard';
import { KeyResources } from './KeyResources';
import { NextGoals } from './NextGoals';
import { RecommendCard } from './RecommendCard';
import { TutorialCard } from './TutorialCard';

export function HomePage() {
  const { state, derived } = useGame();
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
          {derived.salaryPerSec > 0 && <Stat label="給料 /秒" value={formatMoneyRate(-derived.salaryPerSec, mode)} tone="loss" extra="マネージャー" />}
          {state.contracts.credit > 0 && <Stat label="信用ランク" value={derived.creditRank} tone="research" extra={`信用 ${formatNumber(state.contracts.credit, mode)}`} />}
          {state.prestige.points > 0 && <Stat label="再出発ボーナス" value={`${state.prestige.points}pt`} tone="research" extra={`生産 ×${(1 + CONFIG.prestige.productionPerPoint * state.prestige.points).toFixed(2)}`} />}
        </div>
      </Card>

      <EventBanner />

      <TutorialCard />

      {state.tutorial.completed && (
        <>
          <div className="section-title">おすすめの次の一手</div>
          <RecommendCard />
        </>
      )}

      <div className="section-title">手作業で採集</div>
      <GatherPanel />

      <div className="section-title">注文</div>
      <ContractsCard />

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
    </div>
  );
}
