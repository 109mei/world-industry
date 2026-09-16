import { Card } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { GAME_META } from '@/game/data/meta';
import { useGame } from '@/stores/gameStore';
import { formatDuration, formatMoney, formatMoneyRate, formatNumber } from '@/utils/format';
import { EventList } from '../home/EventList';
import { AchievementsList } from './AchievementsList';
import { SettingsPanel } from './SettingsPanel';

export function CompanyPage() {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
  const facilityCount = state.facilities.reduce((a, f) => a + f.count, 0);
  return (
    <div className="page">
      <h1 className="page__title">
        {state.company.name}
        <small>会社情報</small>
      </h1>
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="企業価値" value={formatMoney(derived.companyValue, mode)} size="lg" tone="research" />
          <Stat label="総資産" value={formatMoney(derived.assets, mode)} />
          <Stat label="現金" value={formatMoney(state.company.cash, mode)} />
          <Stat label="在庫の評価額" value={formatMoney(derived.inventoryValue, mode)} />
          <Stat label="収益 /秒（自動）" value={formatMoneyRate(derived.incomePerSec, mode)} tone={derived.incomePerSec > 0 ? 'profit' : 'default'} />
          <Stat label="累計売上" value={formatMoney(state.company.totalEarned, mode)} tone="profit" />
          <Stat label="累計支出" value={formatMoney(state.company.totalSpent, mode)} tone="loss" />
          <Stat label="純利益（累計）" value={formatMoney(state.company.totalEarned - state.company.totalSpent, mode)} tone={state.company.totalEarned - state.company.totalSpent >= 0 ? 'profit' : 'loss'} />
          <Stat label="土地" value={`${state.lands.length}か所`} />
          <Stat label="施設" value={formatNumber(facilityCount, mode)} />
          <Stat label="従業員" value={`${formatNumber(derived.employees, mode)}人`} />
          <Stat label="発電能力" value="—" extra="電力は今後解放" />
          <Stat label="プレイ時間" value={formatDuration(state.stats.playtimeSeconds)} />
          <Stat label="タップ回数" value={formatNumber(state.stats.taps, mode)} />
          <Stat label="壊れた道具" value={formatNumber(state.stats.toolsBroken, mode)} />
          <Stat label="研究レベル" value="0" extra="研究は今後解放" />
        </div>
      </Card>

      <div className="section-title">実績</div>
      <Card>
        <AchievementsList />
      </Card>

      <div className="section-title">出来事の履歴</div>
      <Card>
        <EventList limit={30} />
      </Card>

      <div className="section-title">設定</div>
      <Card>
        <SettingsPanel />
      </Card>
      <p className="text-dim" style={{ fontSize: 12, textAlign: 'center' }}>
        {GAME_META.title} v{GAME_META.version}
      </p>
    </div>
  );
}
