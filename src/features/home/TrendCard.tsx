import { AreaChart, BarChart, DonutChart } from '@/components/ui/Chart';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Stat } from '@/components/ui/Stat';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { resourceValue } from '@/game/engine/analysis/roi';
import { SAMPLE_SECONDS } from '@/game/engine/systems/history';
import { useGame } from '@/stores/gameStore';
import { formatDuration, formatMoney, formatMoneyRate, formatNumber } from '@/utils/format';

/** 会社の推移と内訳を図で見せる */
export function TrendCard() {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
  const h = state.history;
  const assets = h?.assets ?? [];
  const income = h?.income ?? [];
  const span = formatDuration(Math.max(0, (assets.length - 1) * SAMPLE_SECONDS));

  // 入ってくるお金と出ていくお金の内訳（1秒あたり）
  const inflow = [
    { label: '賃料', value: derived.rentPerSec, tone: 'profit' as const },
    { label: '配当', value: derived.dividendPerSec, tone: 'profit' as const },
    { label: '商業施設', value: derived.commercialIncome, tone: 'profit' as const },
    { label: '事業', value: derived.businessIncome, tone: 'profit' as const },
  ].filter((d) => d.value > 0);
  const outflow = [
    { label: '輸送費', value: derived.transportCost, tone: 'loss' as const },
    { label: '人件費', value: derived.wageCost, tone: 'loss' as const },
    { label: '広告費', value: derived.adCost, tone: 'loss' as const },
  ].filter((d) => d.value > 0);

  // 生産の内訳（価値の高い順に5つ）
  const production = (Object.entries(derived.production) as [ResourceId, number][])
    .map(([id, rate]) => ({ label: RESOURCE_MAP[id]?.name ?? id, value: (rate ?? 0) * resourceValue(state, id) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  if (assets.length < 2 && inflow.length === 0 && production.length === 0) return null;

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_chart_trend" size={30} fallback="推移" />
        <div className="row__grow">
          <div className="card__title">会社の動き</div>
          <div className="card__sub">直近 {span} の推移と、いまの内訳です。</div>
        </div>
      </div>
      <div className="card__body">
        <AreaChart
          values={assets}
          tone="profit"
          zeroBased
          label="総資産の推移"
          topLabel={assets.length > 0 ? formatMoney(Math.max(...assets), mode) : ''}
          bottomLabel={assets.length > 0 ? formatMoney(Math.min(...assets), mode) : ''}
        />
        <AreaChart
          values={income}
          tone={derived.incomePerSec >= 0 ? 'accent' : 'loss'}
          label="収支の推移（円/秒）"
          height={72}
          topLabel={income.length > 0 ? formatMoneyRate(Math.max(...income), mode) : ''}
          bottomLabel={income.length > 0 ? formatMoneyRate(Math.min(...income), mode) : ''}
        />

        <div className="stat-grid" style={{ marginTop: 8 }}>
          <Stat label="いまの収支 /秒" value={formatMoneyRate(derived.incomePerSec, mode)} tone={derived.incomePerSec >= 0 ? 'profit' : 'loss'} />
          <Stat label="従業員" value={`${formatNumber(derived.employees, mode)}人`} />
        </div>

        {(inflow.length > 0 || outflow.length > 0) && (
          <BarChart
            label="入ってくるお金・出ていくお金（円/秒）"
            data={[...inflow, ...outflow]}
            format={(v) => formatMoney(v, mode)}
          />
        )}

        {production.length > 0 && <DonutChart label="生産の内訳（価値 /秒）" data={production} format={(v) => formatMoney(v, mode)} />}
      </div>
    </Card>
  );
}
