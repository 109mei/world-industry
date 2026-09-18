import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { GRACE_SECONDS, debtLimit } from '@/game/engine/systems/finance';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatDuration, formatMoney } from '@/utils/format';

/** 資金がマイナスのときだけ出る、倒産までの警告 */
export function DebtWarning() {
  const { state, derived } = useGame();
  const setTab = useUiStore((s) => s.setTab);
  const setHomeSubTab = useUiStore((s) => s.setHomeSubTab);
  const mode = state.settings.numberFormat;
  if (state.company.cash >= 0) return null;
  const debt = -state.company.cash;
  const limit = debtLimit(derived.assets);
  const left = Math.max(0, GRACE_SECONDS - (state.company.debtSeconds ?? 0));
  const byTime = (state.company.debtSeconds ?? 0) / GRACE_SECONDS;
  const byDebt = debt / limit;
  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_warning" size={34} fallback="警告" />
        <div className="row__grow">
          <div className="card__title text-loss">資金がマイナスです（倒産まであと {formatDuration(left)}）</div>
          <div className="card__sub">
            借金 {formatMoney(debt, mode)}（利息が付きます）。{formatMoney(limit, mode)} を超えるか、猶予が切れると倒産します。
          </div>
        </div>
      </div>
      <div className="card__body">
        <ProgressBar ratio={Math.max(byTime, byDebt)} tone="loss" size="lg" label="倒産までの進み具合" />
        <p className="text-sub" style={{ fontSize: 12, margin: '6px 0' }}>
          立て直す方法: <strong>資源を売る</strong>／<strong>土地や物件を売る</strong>（その土地の施設と事業もなくなり、人件費が減ります）／
          <strong>事業の従業員を減らす</strong>（いまの人件費は {formatMoney(derived.wageCost, mode)}/秒）。
          倒産しても永続ポイントと実績は残りますが、施設・土地・研究はすべて失われます。
        </p>
        <div className="btn-row">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setHomeSubTab('resources');
              setTab('home');
            }}
          >
            資源を売りに行く ›
          </Button>
          <Button size="sm" onClick={() => setTab('map')}>
            土地・物件を売りに行く ›
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setHomeSubTab('business');
              setTab('home');
            }}
          >
            事業の人数を見直す ›
          </Button>
        </div>
      </div>
    </Card>
  );
}
