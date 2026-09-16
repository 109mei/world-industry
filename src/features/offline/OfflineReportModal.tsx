import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatDuration, formatMoney, formatRate } from '@/utils/format';

export function OfflineReportModal() {
  const report = useUiStore((s) => s.offlineReport);
  const setReport = useUiStore((s) => s.setOfflineReport);
  const { state } = useGame();
  if (!report) return null;
  const mode = state.settings.numberFormat;
  const entries = Object.entries(report.resourceDelta) as [ResourceId, number][];
  return (
    <Sheet open onClose={() => setReport(null)} title="おかえりなさい" icon={<Icon name="icon_ui_time" size={36} fallback="T" />}>
      <p className="text-sub" style={{ fontSize: 13, marginTop: 6 }}>
        離席中の {formatDuration(report.simulatedSeconds)} ぶんを計算しました。
        {report.capped && <span className="text-warn">（上限 {formatDuration(state.settings.maxOfflineSeconds)} で打ち切り）</span>}
      </p>
      <div className="sheet__section list">
        {entries.length === 0 && report.cashDelta === 0 && <div className="empty">変化はありませんでした。作業員を雇うと離席中も生産されます。</div>}
        {entries.map(([id, d]) => (
          <div key={id} className="row row--between">
            <div className="row">
              <Icon name={RESOURCE_MAP[id].icon} size={24} fallback={RESOURCE_MAP[id].name.slice(0, 2)} />
              <span>{RESOURCE_MAP[id].name}</span>
            </div>
            <span className={`num ${d >= 0 ? 'text-profit' : 'text-loss'}`} style={{ fontWeight: 700 }}>
              {formatRate(Math.round(d), mode)}
            </span>
          </div>
        ))}
        {report.cashDelta !== 0 && (
          <div className="row row--between">
            <div className="row">
              <Icon name="icon_ui_money" size={24} fallback="¥" />
              <span>所持金</span>
            </div>
            <span className={`num ${report.cashDelta >= 0 ? 'text-profit' : 'text-loss'}`} style={{ fontWeight: 700 }}>
              {report.cashDelta >= 0 ? '+' : ''}
              {formatMoney(report.cashDelta, mode)}
            </span>
          </div>
        )}
      </div>
      <div className="card__actions">
        <Button variant="primary" block onClick={() => setReport(null)}>
          続ける
        </Button>
      </div>
    </Sheet>
  );
}
