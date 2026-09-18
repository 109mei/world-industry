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

  // 離席中に倒産していたら、資源の増減を並べても意味がない（会社ごと入れ替わっているため）
  if (report.bankrupted) {
    return (
      <Sheet open onClose={() => setReport(null)} title="倒産しました" icon={<Icon name="icon_ui_warning" size={36} fallback="!" />}>
        <p style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
          離席中の {formatDuration(report.simulatedSeconds)} のあいだに資金が尽きて、会社を畳みました。
          <br />
          いまは<strong>新しい会社</strong>で、もう一度やり直しているところです。
        </p>
        <p className="text-sub" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.6 }}>
          <strong>永続ポイントと実績は残っています。</strong>
          「会社」の再出発から強化を買えます。
          <br />
          赤字が続くと倒産します。人を雇いすぎたときは、資源を売るか、事業の従業員を減らして立て直してください。
        </p>
        <div className="card__actions">
          <Button variant="primary" block onClick={() => setReport(null)}>
            やり直す
          </Button>
        </div>
      </Sheet>
    );
  }

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
