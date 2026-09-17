import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { recommend } from '@/game/engine/analysis/recommend';
import { runAction } from '@/features/common/runAction';
import { useGame } from '@/stores/gameStore';
import { formatMoney } from '@/utils/format';

/** おすすめの次の一手（回収の早い投資・困りごとの解決） */
export function RecommendCard() {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const recs = recommend(state, derived, 3);
  if (recs.length === 0) return null;
  return (
    <Card>
      <div className="list">
        {recs.map((r, i) => (
          <div key={r.id} className="row" style={{ alignItems: 'flex-start' }}>
            <span className={`rec__rank ${i === 0 ? 'rec__rank--top' : ''}`} aria-hidden="true">
              {i + 1}
            </span>
            <Icon name={r.icon} size={30} fallback={r.title.slice(0, 2)} />
            <div className="row__grow">
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</div>
              <div className="text-sub" style={{ fontSize: 12 }}>
                {r.reason}
              </div>
            </div>
            <Button size="sm" variant={i === 0 ? 'primary' : 'secondary'} disabled={!r.enabled} onClick={() => runAction(engine, r.action)}>
              {r.action.kind === 'buyFacility' || r.action.kind === 'buyLand' ? (r.cost !== undefined ? formatMoney(r.cost, mode) : '実行') : r.action.kind === 'research' ? '研究' : '見る'}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
