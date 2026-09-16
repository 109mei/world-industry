import { Card } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { useGame } from '@/stores/gameStore';
import { formatMoney, formatMoneyRate, formatNumber } from '@/utils/format';
import { EventList } from './EventList';
import { GatherPanel } from './GatherPanel';
import { KeyResources } from './KeyResources';
import { NextGoals } from './NextGoals';
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
        </div>
      </Card>

      <TutorialCard />

      <div className="section-title">手作業で採集</div>
      <GatherPanel />

      <div className="section-title">主要資源</div>
      <KeyResources />

      <div className="section-title">次の目標（解放条件）</div>
      <NextGoals />

      <div className="section-title">最近の出来事</div>
      <Card>
        <EventList limit={8} />
      </Card>
    </div>
  );
}
