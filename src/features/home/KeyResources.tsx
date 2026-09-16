import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatRate } from '@/utils/format';

const KEY_IDS: ResourceId[] = ['stone', 'wood', 'scrap_metal', 'iron_ore', 'iron', 'tool'];

/** HOME に出す主要資源のミニカード */
export function KeyResources() {
  const { state, derived } = useGame();
  const openResource = useUiStore((s) => s.openResource);
  const mode = state.settings.numberFormat;
  const ids = KEY_IDS.filter((id) => state.discovered[id]);
  return (
    <div className="grid grid--auto grid--tight">
      {ids.map((id) => {
        const def = RESOURCE_MAP[id];
        const amount = state.inventory[id] ?? 0;
        const net = (derived.production[id] ?? 0) - (derived.consumption[id] ?? 0);
        return (
          <Card key={id} flat role="button" tabIndex={0} onClick={() => openResource(id)} onKeyDown={(e) => e.key === 'Enter' && openResource(id)} style={{ cursor: 'pointer' }}>
            <div className="card__head">
              <Icon name={def.icon} size={28} fallback={def.name.slice(0, 2)} />
              <div className="row__grow">
                <div className="card__sub">{def.name}</div>
                <div className="stat__value num">{formatAmount(amount, mode)}</div>
              </div>
              <span className={`badge num ${net > 0 ? 'badge--profit' : net < 0 ? 'badge--loss' : ''}`}>{formatRate(net, mode)}/秒</span>
              <span className="text-dim" aria-hidden="true">›</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar ratio={amount / derived.capacity} tone="auto" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
