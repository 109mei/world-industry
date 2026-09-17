import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { RESOURCE_MAP, isResourceId, type ResourceId } from '@/game/data/resources';
import { resourceValue } from '@/game/engine/analysis/roi';
import { isManagerHired } from '@/game/engine/systems/automation';
import { useGame } from '@/stores/gameStore';
import { formatMoney, formatMoneyRate, formatNumber } from '@/utils/format';

/** ハイライト: 稼ぎ頭・最高の売却・止まっている施設・マネージャーの働き */
export function HighlightsCard() {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
  // 稼ぎ頭（生産の価値/秒）
  const top = (Object.entries(derived.production) as [ResourceId, number][])
    .map(([id, rate]) => ({ id, value: (rate ?? 0) * resourceValue(state, id) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const stopped = state.facilities.filter((f) => f.count > 0 && ['no_input', 'storage_full', 'no_power', 'depleted'].includes(derived.facilityRuntime[f.id]?.status ?? ''));
  const best = state.stats.bestSale;
  const hired = (['gather', 'craft', 'sales', 'logistics', 'invest'] as const).filter((m) => isManagerHired(state, m)).length;
  if (top.length === 0 && !best && stopped.length === 0) return null;
  return (
    <Card>
      <div className="highlights">
        {top.length > 0 && (
          <div className="highlight">
            <div className="stat__label">稼ぎ頭（生産の価値 /秒）</div>
            {top.map((t) => (
              <div key={t.id} className="row num" style={{ fontSize: 13, gap: 6 }}>
                <Icon name={RESOURCE_MAP[t.id].icon} size={18} />
                <span className="row__grow">{RESOURCE_MAP[t.id].name}</span>
                <span className="text-profit">{formatMoneyRate(t.value, mode)}</span>
              </div>
            ))}
          </div>
        )}
        {best && isResourceId(best.resource) && (
          <div className="highlight">
            <div className="stat__label">最高の売却</div>
            <div className="row num" style={{ fontSize: 13, gap: 6 }}>
              <Icon name={RESOURCE_MAP[best.resource].icon} size={18} />
              <span className="row__grow">
                {RESOURCE_MAP[best.resource].name}×{formatNumber(best.qty, 'full')}
              </span>
              <span className="text-profit">{formatMoney(best.revenue, mode)}</span>
            </div>
            {derived.rentPerSec + derived.dividendPerSec > 0 && (
              <div className="text-sub num" style={{ fontSize: 12 }}>
                賃料＋配当 {formatMoneyRate(derived.rentPerSec + derived.dividendPerSec, mode)}
              </div>
            )}
          </div>
        )}
        <div className="highlight">
          <div className="stat__label">状態</div>
          <div className={`num ${stopped.length > 0 ? 'text-loss' : 'text-profit'}`} style={{ fontSize: 13 }}>
            {stopped.length > 0 ? `停止中の施設 ${stopped.length}件: ${stopped.slice(0, 2).map((f) => (isFacilityId(f.typeId) ? FACILITY_MAP[f.typeId].name : f.typeId)).join('・')}${stopped.length > 2 ? ' ほか' : ''}` : '施設はすべて稼働中'}
          </div>
          {hired > 0 && (
            <div className="text-sub num" style={{ fontSize: 12 }}>
              マネージャー {hired}人（給料 {formatMoneyRate(-derived.salaryPerSec, mode)}）・代行 採集 {formatNumber(state.stats.autoGathered, mode)}回／クラフト {formatNumber(state.stats.autoCrafted, mode)}回
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
