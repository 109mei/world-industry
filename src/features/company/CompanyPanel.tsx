import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { RESEARCH } from '@/game/data/research';
import { canPrestige } from '@/game/engine/systems/prestige';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatDuration, formatMoney, formatMoneyRate, formatNumber } from '@/utils/format';
import { formatMW } from '@/utils/names';
import { EventList } from '../home/EventList';
import { AchievementsList } from './AchievementsList';
import { PrestigePanel } from './PrestigePanel';

/** 会社情報・実績・再出発（ホームの「会社」タブの中身） */
export function CompanyPanel() {
  const { state, derived } = useGame();
  const sub = useUiStore((s) => s.companySubTab);
  const setSub = useUiStore((s) => s.setCompanySubTab);
  const mode = state.settings.numberFormat;
  const facilityCount = state.facilities.reduce((a, f) => a + f.count, 0);
  const researchDone = Object.keys(state.research.completed).length;
  const achievementsDone = Object.keys(state.achievements).length;
  return (
    <>
      <div className="section-title" style={{ marginTop: 4 }}>
        {state.company.name}
      </div>
      <Segmented
        items={[
          { id: 'info', label: '会社情報' },
          { id: 'achievements', label: `実績 ${achievementsDone}` },
          { id: 'prestige', label: '再出発', badge: canPrestige(derived.assets) ? 1 : 0 },
        ]}
        value={sub}
        onChange={setSub}
        ariaLabel="会社の表示切替"
      />
      {sub === 'info' && (
        <>
          <Card>
            <div className="stat-grid stat-grid--4">
              <Stat label="企業価値" value={formatMoney(derived.companyValue, mode)} size="lg" tone="research" />
              <Stat label="総資産" value={formatMoney(derived.assets, mode)} />
              <Stat label="現金" value={formatMoney(state.company.cash, mode)} />
              <Stat label="在庫の評価額" value={formatMoney(derived.inventoryValue, mode)} />
              <Stat label="収益 /秒（自動）" value={formatMoneyRate(derived.incomePerSec, mode)} tone={derived.incomePerSec > 0 ? 'profit' : derived.incomePerSec < 0 ? 'loss' : 'default'} />
              <Stat label="商業収入 /秒" value={formatMoneyRate(derived.commercialIncome, mode)} tone={derived.commercialIncome > 0 ? 'profit' : 'default'} />
              <Stat label="輸送費 /秒" value={formatMoneyRate(-derived.transportCost, mode)} tone={derived.transportCost > 0 ? 'loss' : 'default'} />
              <Stat label="累計売上" value={formatMoney(state.company.totalEarned, mode)} tone="profit" />
              <Stat label="累計支出" value={formatMoney(state.company.totalSpent, mode)} tone="loss" />
              <Stat label="純利益（累計）" value={formatMoney(state.company.totalEarned - state.company.totalSpent, mode)} tone={state.company.totalEarned - state.company.totalSpent >= 0 ? 'profit' : 'loss'} />
              <Stat label="土地" value={`${state.lands.length}か所`} extra={`${new Set(state.lands.map((l) => l.country)).size}か国`} />
              <Stat label="施設" value={formatNumber(facilityCount, mode)} />
              <Stat label="従業員" value={`${formatNumber(derived.employees, mode)}人`} />
              <Stat label="発電能力" value={formatMW(derived.power.capacity)} tone="power" extra={`需要 ${formatMW(derived.power.demand)}`} />
              <Stat label="累計発電量" value={`${formatNumber(Math.floor(state.stats.totalGeneratedMWh), mode)}MWh`} />
              <Stat label="累計輸送量" value={`${formatNumber(Math.floor(state.stats.totalTransported), mode)}t`} />
              <Stat label="不動産の評価額" value={formatMoney(derived.estateValue, mode)} extra={`賃料 ${formatMoneyRate(derived.rentPerSec, mode)}`} />
              <Stat label="株式の評価額" value={formatMoney(derived.stockValue, mode)} extra={`配当 ${formatMoneyRate(derived.dividendPerSec, mode)}`} />
              <Stat label="研究" value={`${researchDone} / ${RESEARCH.length}`} extra={`${formatNumber(Math.floor(state.research.points), mode)} RP`} />
              <Stat label="プレイ時間" value={formatDuration(state.stats.playtimeSeconds)} />
              <Stat label="タップ回数" value={formatNumber(state.stats.taps, mode)} />
              <Stat label="壊れた道具" value={formatNumber(state.stats.toolsBroken, mode)} />
              <Stat label="信用ランク" value={derived.creditRank} tone="research" extra={`注文 達成 ${state.stats.contractsCompleted}・期限切れ ${state.stats.contractsFailed}`} />
              <Stat label="注文の報酬（累計）" value={formatMoney(state.stats.contractRewards, mode)} tone="profit" />
              <Stat label="再出発" value={`${state.prestige.count}回・${state.prestige.points}pt`} tone="research" />
            </div>
          </Card>
          <div className="section-title">出来事の履歴</div>
          <Card>
            <EventList limit={30} />
          </Card>
        </>
      )}
      {sub === 'achievements' && (
        <Card>
          <AchievementsList />
        </Card>
      )}
      {sub === 'prestige' && <PrestigePanel />}
    </>
  );
}
