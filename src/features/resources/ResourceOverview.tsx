import { AreaChart, BarChart, DonutChart, type BarDatum } from '@/components/ui/Chart';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Stat } from '@/components/ui/Stat';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { resourceValue } from '@/game/engine/analysis/roi';
import { SAMPLE_SECONDS } from '@/game/engine/systems/history';
import { capacityNote, formatCapacity } from '@/utils/names';
import { useGame } from '@/stores/gameStore';
import { formatAmount, formatDuration, formatMoney, formatMoneyRate, formatPercent } from '@/utils/format';

/** 資源の全体像を図で見せる（在庫の埋まり具合・増減・値打ちの内訳） */
export function ResourceOverview({ ids }: { ids: ResourceId[] }) {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
  const cap = derived.capacity;

  const rows = ids.map((id) => {
    const have = state.inventory[id] ?? 0;
    const net = (derived.production[id] ?? 0) - (derived.consumption[id] ?? 0);
    return { id, have, net, value: have * resourceValue(state, id) };
  });

  // 倉庫が埋まっているものから（満杯だと生産が止まるので、いちばん先に知りたい）
  const fullest = rows
    .filter((r) => r.have > 0)
    .sort((a, b) => b.have - a.have)
    .slice(0, 8)
    .map<BarDatum>((r) => ({
      label: RESOURCE_MAP[r.id].name,
      value: r.have,
      tone: r.have >= cap - 1e-6 ? 'loss' : r.have >= cap * 0.9 ? 'warn' : 'accent',
      note: r.have >= cap - 1e-6 ? '満杯' : undefined,
    }));

  // 増えているもの・減っているもの
  const moving = rows.filter((r) => Math.abs(r.net) > 1e-6).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const growing = moving.filter((r) => r.net > 0).slice(0, 5).map<BarDatum>((r) => ({ label: RESOURCE_MAP[r.id].name, value: r.net, tone: 'profit' }));
  const shrinking = moving.filter((r) => r.net < 0).slice(0, 5).map<BarDatum>((r) => ({
    label: RESOURCE_MAP[r.id].name,
    value: -r.net,
    tone: 'loss',
    note: r.have > 0 ? `あと${formatDuration(r.have / -r.net)}` : '在庫なし',
  }));

  const valueMix = rows.map<BarDatum>((r) => ({ label: RESOURCE_MAP[r.id].name, value: r.value }));
  const full = rows.filter((r) => r.have >= cap - 1e-6).length;
  const income = state.history?.income ?? [];

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_chart" size={30} fallback="資源" />
        <div className="row__grow">
          <div className="card__title">資源の全体像</div>
          <div className="card__sub">倉庫の埋まり具合と、増えているもの・減っているものです。</div>
        </div>
      </div>
      <div className="card__body">
        <div className="stat-grid stat-grid--4">
          <Stat label="種類" value={`${ids.length}種`} />
          <Stat label="満杯のもの" value={`${full}種`} tone={full > 0 ? 'loss' : 'default'} extra={full > 0 ? '生産が止まります' : undefined} />
          <Stat label="在庫の値打ち" value={formatMoney(rows.reduce((a, r) => a + r.value, 0), mode)} />
          <Stat label="倉庫の上限" value={formatCapacity(cap, mode)} extra={capacityNote(cap, mode)} />
        </div>

        {fullest.length > 0 && (
          <BarChart
            label={`在庫の多いもの（上限 ${formatAmount(cap, mode)} に対して）`}
            data={fullest}
            max={cap}
            format={(v) => `${formatAmount(v, mode)}（${formatPercent(v / Math.max(1, cap), 0)}）`}
          />
        )}

        {growing.length > 0 && <BarChart label="増えているもの（毎秒）" data={growing} format={(v) => `+${formatAmount(v, mode)}`} />}
        {shrinking.length > 0 && <BarChart label="減っているもの（毎秒）" data={shrinking} format={(v) => `-${formatAmount(v, mode)}`} />}

        <DonutChart label="在庫の値打ちの内訳" data={valueMix} format={(v) => formatMoney(v, mode)} />

        {income.length >= 2 && (
          <AreaChart
            values={income}
            tone={derived.incomePerSec >= 0 ? 'accent' : 'loss'}
            label={`収支の推移（直近 ${formatDuration((income.length - 1) * SAMPLE_SECONDS)}）`}
            height={72}
            topLabel={formatMoneyRate(Math.max(...income), mode)}
            bottomLabel={formatMoneyRate(Math.min(...income), mode)}
            format={(v) => formatMoneyRate(v, mode)}
          />
        )}
      </div>
    </Card>
  );
}
