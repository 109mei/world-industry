import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { useGame } from '@/stores/gameStore';
import { formatAmount, formatRate } from '@/utils/format';

interface Props {
  id: ResourceId;
  onOpen: (id: ResourceId) => void;
}

export function ResourceCard({ id, onOpen }: Props) {
  const { state, derived } = useGame();
  const def = RESOURCE_MAP[id];
  const mode = state.settings.numberFormat;
  const amount = state.inventory[id] ?? 0;
  const prod = derived.production[id] ?? 0;
  const cons = derived.consumption[id] ?? 0;
  const net = prod - cons;
  const auto = state.market.autoSell[id];
  return (
    <Card role="button" tabIndex={0} onClick={() => onOpen(id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(id)} style={{ cursor: 'pointer' }}>
      <div className="card__head">
        <Icon name={def.icon} size={36} fallback={def.name.slice(0, 2)} />
        <div className="row__grow">
          <div className="card__title">{def.name}</div>
          <div className="card__sub">
            {formatAmount(amount, mode)} / {formatAmount(derived.capacity, mode)}
            {auto?.enabled && <span className="badge badge--profit" style={{ marginLeft: 6 }}>自動売却</span>}
          </div>
        </div>
        <div className="stat" style={{ textAlign: 'right' }}>
          <span className={`stat__value num ${net > 0 ? 'text-profit' : net < 0 ? 'text-loss' : ''}`}>{formatRate(net, mode)}</span>
          <span className="stat__label">純増 /秒</span>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <ProgressBar ratio={amount / derived.capacity} tone="auto" />
      </div>
      <div className="row row--between text-sub num" style={{ fontSize: 12, marginTop: 6 }}>
        <span>生産 {formatRate(prod, mode)}/秒</span>
        <span>消費 {formatRate(-cons, mode)}/秒</span>
        <span className="text-dim">{def.sellable ? '詳細・売却 ›' : '詳細 ›'}</span>
      </div>
    </Card>
  );
}
