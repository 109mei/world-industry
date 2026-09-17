import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Stat } from '@/components/ui/Stat';
import { useGame } from '@/stores/gameStore';
import { formatPercent } from '@/utils/format';
import { formatMW } from '@/utils/names';

/** 電力の需給。発電所か電力を使う施設が1つでもあれば表示する */
export function PowerSummary() {
  const { derived } = useGame();
  const p = derived.power;
  if (p.capacity <= 0 && p.demand <= 0) return null;
  const tone = p.demand <= 0 ? 'default' : p.ratio >= 0.999 ? 'profit' : p.ratio > 0 ? 'warn' : 'loss';
  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_power" size={32} fallback="⚡" />
        <div className="row__grow">
          <div className="card__title">電力</div>
          <div className="card__sub">需要ぶんだけ発電し、燃料を使います。足りないと電力を使う施設の稼働率が下がります。</div>
        </div>
      </div>
      <div className="stat-grid stat-grid--4" style={{ marginTop: 8 }}>
        <Stat label="発電能力" value={formatMW(p.capacity)} tone="power" />
        <Stat label="需要" value={formatMW(p.demand)} />
        <Stat label="発電中" value={formatMW(p.generation)} />
        <Stat label="供給率" value={formatPercent(p.ratio)} tone={tone} />
      </div>
      <div style={{ marginTop: 8 }}>
        <ProgressBar ratio={p.capacity > 0 ? p.demand / p.capacity : 1} tone={p.demand > p.capacity ? 'loss' : p.demand > p.capacity * 0.85 ? 'warn' : 'accent'} label="発電能力に対する需要" />
        <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
          発電能力の {formatPercent(p.capacity > 0 ? p.demand / p.capacity : 0)} を使用
        </div>
      </div>
    </Card>
  );
}
