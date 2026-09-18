import { BarChart, DonutChart, StatusBar, type BarDatum } from '@/components/ui/Chart';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Stat } from '@/components/ui/Stat';
import { FACILITY_CATEGORY_LABEL, FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { resourceValue } from '@/game/engine/analysis/roi';
import { facilitiesOn } from '@/game/engine/land';
import { useGame } from '@/stores/gameStore';
import { formatAmount, formatMoney, formatMoneyRate, formatPercent } from '@/utils/format';
import { formatMW } from '@/utils/names';
import type { FacilityStatus } from '@/types/state';

/** 止まっている理由ごとの色（状態の色は内訳の色と混ぜない） */
const STOPPED: { status: FacilityStatus; label: string; tone: 'loss' | 'warn' | 'neutral' }[] = [
  { status: 'no_input', label: '材料不足', tone: 'loss' },
  { status: 'storage_full', label: '倉庫満杯', tone: 'loss' },
  { status: 'no_power', label: '電力不足', tone: 'loss' },
  { status: 'depleted', label: '鉱脈枯渇', tone: 'loss' },
];

/** 施設の全体像。動いているか、何を作っているか、電力は足りているか */
export function FactoryOverview({ landId }: { landId: string }) {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
  const here = facilitiesOn(state, landId).filter((f) => f.count > 0);
  if (here.length === 0) return null;

  const total = here.reduce((a, f) => a + f.count, 0);
  const statusOf = (id: string) => derived.facilityRuntime[id]?.status ?? 'idle';
  const count = (s: FacilityStatus) => here.filter((f) => statusOf(f.id) === s).reduce((a, f) => a + f.count, 0);
  const running = count('running');
  const partial = count('partial');
  const off = count('disabled') + count('idle');
  const stoppedRows = STOPPED.map((s) => ({ label: s.label, value: count(s.status), tone: s.tone }));
  const stopped = stoppedRows.reduce((a, r) => a + r.value, 0);

  // ここで作っているものの値打ち（毎秒）
  const output = new Map<ResourceId, number>();
  for (const f of here) {
    const rt = derived.facilityRuntime[f.id];
    if (!rt) continue;
    for (const [id, rate] of Object.entries(rt.outputRates ?? {}) as [ResourceId, number][]) {
      if (!rate) continue;
      output.set(id, (output.get(id) ?? 0) + rate);
    }
  }
  const outputMix = [...output.entries()].map<BarDatum>(([id, rate]) => ({
    label: RESOURCE_MAP[id]?.name ?? id,
    value: rate * resourceValue(state, id),
  }));

  // 種類ごとの台数
  const byCategory = new Map<string, number>();
  for (const f of here) {
    if (!isFacilityId(f.typeId)) continue;
    const c = FACILITY_CATEGORY_LABEL[FACILITY_MAP[f.typeId].category];
    byCategory.set(c, (byCategory.get(c) ?? 0) + f.count);
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).map<BarDatum>(([label, value]) => ({ label, value }));

  const power = derived.power;
  const short = power.demand > power.capacity + 1e-6;

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_factory" size={30} fallback="施設" />
        <div className="row__grow">
          <div className="card__title">この土地の様子</div>
          <div className="card__sub">
            {stopped > 0 ? `${stopped}台が止まっています。理由を下で確かめられます。` : 'いまは全部うまく動いています。'}
          </div>
        </div>
      </div>
      <div className="card__body">
        <div className="stat-grid stat-grid--4">
          <Stat label="施設" value={`${formatAmount(total, mode)}台`} extra={`${here.length}種類`} />
          <Stat label="動いている" value={formatPercent((running + partial) / Math.max(1, total), 0)} tone={stopped > 0 ? 'loss' : 'profit'} />
          <Stat label="生産の値打ち /秒" value={formatMoneyRate(outputMix.reduce((a, d) => a + d.value, 0), mode)} tone="profit" />
          <Stat label="電力" value={`${formatMW(power.demand)} / ${formatMW(power.capacity)}`} tone={short ? 'loss' : 'power'} extra={short ? '足りていません' : '足りています'} />
        </div>

        <StatusBar
          label="稼働の内訳（台数）"
          total={total}
          data={[
            { label: '稼働中', value: running, tone: 'profit' },
            { label: '一部稼働', value: partial, tone: 'warn' },
            ...stoppedRows.filter((r) => r.value > 0),
            { label: '停止中(OFF)・待機', value: off, tone: 'neutral' },
          ]}
        />

        {outputMix.length > 0 && <DonutChart label="ここで作っているもの（値打ち /秒）" data={outputMix} format={(v) => formatMoney(v, mode)} />}
        {categoryRows.length > 1 && <BarChart label="種類ごとの台数" data={categoryRows} format={(v) => `${formatAmount(v, mode)}台`} />}
      </div>
    </Card>
  );
}
