import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate, formatNumber, formatPercent } from '@/utils/format';
import { formatMW } from '@/utils/names';
import { CompanyPanel } from '@/features/company/CompanyPanel';
import { ResourcesPanel } from '@/features/resources/ResourcesPanel';
import { SalesPanel } from '@/features/sales/SalesPanel';
import { TradeBoard } from '@/features/trade/TradeBoard';
import { BusinessPanel } from '@/features/business/BusinessPanel';
import { AutomationCard } from './AutomationCard';
import { DebtWarning } from './DebtWarning';
import { HqSetupCard } from './HqSetupCard';
import { EventBanner } from './EventBanner';
import { EventList } from './EventList';
import { MinigamePanel } from '@/features/minigame/MinigamePanel';
import { GatherPanel } from './GatherPanel';
import { HighlightsCard } from './HighlightsCard';
import { TrendCard } from './TrendCard';
import { KeyResources } from './KeyResources';
import { NextGoals } from './NextGoals';
import { NameSetupCard } from './NameSetupCard';
import { ThemeSetupCard } from './ThemeSetupCard';
import { SeasonBand } from './SeasonBand';
import { TutorialCard } from './TutorialCard';
import { InstallCard } from '@/features/settings/InstallCard';
import { visibleHomeSubs } from '@/game/engine/systems/visibility';

/** ホーム。資源と会社もこの中にまとめている */
export function HomePage() {
  const { state, derived } = useGame();
  const sub = useUiStore((s) => s.homeSubTab);
  // 最初に決めること（配色と本社）が終わるまでは、ゲーム本体を出さない
  const ready = state.settings.themeChosen === true && state.settings.nameChosen === true && state.settings.hqChosen === true;
  const setSub = useUiStore((s) => s.setHomeSubTab);
  const mode = state.settings.numberFormat;
  /*
   * まだ使えない切替は出さない（「取引」を押しても何もできない、を無くす）。
   * 出していない切替を選んだままになっていたら、ホームに戻す。
   */
  const subs = visibleHomeSubs(state);
  const active = subs.includes(sub) ? sub : 'home';
  const SUB_LABEL: Record<string, string> = { home: 'ホーム', resources: '資源', sales: '取引', business: '事業', company: '会社' };
  return (
    <div className="page">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="所持金" value={formatMoney(state.company.cash, mode)} size="lg" />
          <Stat label="自動収益 /秒" value={formatMoneyRate(derived.incomePerSec, mode)} tone={derived.incomePerSec > 0 ? 'profit' : 'default'} />
          <Stat label="総資産" value={formatMoney(derived.assets, mode)} />
          <Stat label="従業員" value={`${formatNumber(derived.employees, mode)}人`} />
          {(derived.power.capacity > 0 || derived.power.demand > 0) && (
            <Stat label="電力" value={`${formatMW(derived.power.demand)} / ${formatMW(derived.power.capacity)}`} tone={derived.power.ratio >= 0.999 ? 'power' : 'loss'} extra={`必要 / 設備・供給率 ${formatPercent(derived.power.ratio)}`} />
          )}
          {state.lands.length > 1 && <Stat label="土地" value={`${state.lands.length - 1}ヵ所`} extra={derived.transportCost > 0 ? `輸送費 ${formatMoney(derived.transportCost, mode)}/秒` : undefined} />}
          {state.contracts.credit > 0 && <Stat label="信用ランク" value={derived.creditRank} tone="research" extra={`信用 ${formatNumber(state.contracts.credit, mode)}`} />}
          {state.prestige.points > 0 && (
            <Stat label="永続ポイント" value={`${state.prestige.points}pt`} tone="research" extra={`会社の「転生」で使えます（${state.prestige.count}回目）`} />
          )}
        </div>
      </Card>

      {ready && subs.length > 1 && (
        <Segmented ariaLabel="ホームの切替" items={subs.map((id) => ({ id, label: SUB_LABEL[id] }))} value={active} onChange={setSub} />
      )}

      <DebtWarning />

      {/* 最初に決めることは1つずつ出す（色 → 会社名 → 本社）。決まるまでは先に進めない */}
      {!state.settings.themeChosen && <ThemeSetupCard />}
      {state.settings.themeChosen && !state.settings.nameChosen && <NameSetupCard />}
      {state.settings.themeChosen && state.settings.nameChosen && !state.settings.hqChosen && <HqSetupCard />}

      {ready && (
      <>
      {/* 案内は、ホームのどのタブにいても出す（誘導先へ行ったとたんに消えないように） */}
      <TutorialCard />
      {active === 'home' && (
        <>
          <SeasonBand />

          <EventBanner />

          <AutomationCard />

          <div className="section-title">手作業で採集</div>
          <GatherPanel />

          <div className="section-title">手仕事（腕を上げる）</div>
          <MinigamePanel />

          <div className="section-title">主要資源</div>
          <KeyResources />

          <div className="section-title">会社の動き</div>
          <TrendCard />

          <div className="section-title">ハイライト</div>
          <HighlightsCard />

          <div className="section-title">次の目標（解放条件）</div>
          <NextGoals />

          {/* 追加できる端末のときだけ出る（追加ずみなら消える） */}
          <InstallCard />

          <div className="section-title">最近の出来事</div>
          <Card>
            <EventList limit={8} />
          </Card>
        </>
      )}

      {active === 'resources' && <ResourcesPanel />}
      {active === 'sales' && (
        <>
          <div className="section-title">貿易</div>
          <TradeBoard />
          <div className="section-title">国内の営業</div>
          <SalesPanel />
        </>
      )}
      {active === 'business' && <BusinessPanel />}
      {active === 'company' && <CompanyPanel />}
      </>
      )}
    </div>
  );
}
