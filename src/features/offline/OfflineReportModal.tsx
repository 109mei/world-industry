import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatDuration, formatMoney } from '@/utils/format';
import { formatQtyRate } from '@/utils/names';

export function OfflineReportModal() {
  const report = useUiStore((s) => s.offlineReport);
  const setReport = useUiStore((s) => s.setOfflineReport);
  const { state } = useGame();
  if (!report) return null;
  const mode = state.settings.numberFormat;
  /**
   * 増えたものと減ったものに分けて、大きいものから並べる。
   * 全部並べると何十行にもなって、何が起きたのか読めなくなるので、
   * 小数点以下しか動いていないものは出さず、多いときは下位をまとめる。
   */
  const all = (Object.entries(report.resourceDelta) as [ResourceId, number][])
    .filter(([, d]) => Math.abs(d) >= 1)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const gained = all.filter(([, d]) => d > 0);
  const lost = all.filter(([, d]) => d < 0);
  const TOP = 6;

  const rows = (list: [ResourceId, number][]) => (
    <>
      {list.slice(0, TOP).map(([id, d]) => (
        <div key={id} className="row row--between">
          <div className="row">
            <Icon name={RESOURCE_MAP[id].icon} size={24} fallback={RESOURCE_MAP[id].name.slice(0, 2)} />
            <span>{RESOURCE_MAP[id].name}</span>
          </div>
          <span className={`num ${d >= 0 ? 'text-profit' : 'text-loss'}`} style={{ fontWeight: 700 }}>
            {formatQtyRate(id, Math.round(d), mode)}
          </span>
        </div>
      ))}
      {list.length > TOP && (
        <div className="text-dim" style={{ fontSize: 12 }}>
          ほか {list.length - TOP}種類
        </div>
      )}
    </>
  );

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
          「会社」の転生から強化を買えます。
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

      {/*
        帰ってきて最初に知りたいのは「いくら増えたか」なので、そこだけ大きく出す。
        素材の増減はその根拠にあたるので、下にまわしてある。
      */}
      <div className="offline__hero">
        <div className="offline__hero-label">{report.cashDelta >= 0 ? '離席中に増えたお金' : '離席中に減ったお金'}</div>
        <div className={`offline__hero-value num ${report.cashDelta >= 0 ? 'text-profit' : 'text-loss'}`}>
          {report.cashDelta >= 0 ? '+' : '−'}
          {formatMoney(Math.abs(report.cashDelta), mode)}
        </div>
        <div className="offline__hero-sub text-sub num">
          1時間あたり {formatMoney((report.cashDelta / Math.max(1, report.simulatedSeconds)) * 3600, mode)}
        </div>
      </div>

      <div className="sheet__section list">
        {all.length === 0 && report.cashDelta === 0 && <div className="empty">変化はありませんでした。作業員を雇うと離席中も生産されます。</div>}
        {gained.length > 0 && (
          <>
            <div className="field__label">増えた素材</div>
            {rows(gained)}
          </>
        )}
        {lost.length > 0 && (
          <>
            <div className="field__label" style={{ marginTop: 6 }}>減った素材</div>
            {rows(lost)}
          </>
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
