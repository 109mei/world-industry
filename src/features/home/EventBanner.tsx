import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EVENT_MAP, isEventDefId, type EventKind } from '@/game/data/events';
import { RESOURCE_MAP, isResourceId } from '@/game/data/resources';
import { getLand } from '@/game/engine/land';
import { useGame } from '@/stores/gameStore';
import { formatDuration } from '@/utils/format';

const TONE: Record<EventKind, 'profit' | 'loss' | 'warn' | 'power' | 'research'> = {
  boom: 'profit',
  crash: 'loss',
  demand: 'research',
  quake: 'warn',
  storm: 'warn',
  heatwave: 'warn',
  festival: 'profit',
  discovery: 'research',
  subsidy: 'profit',
};

/** 進行中のイベント（相場変動・災害など）。残り時間つきで表示する */
export function EventBanner({ compact = false }: { compact?: boolean }) {
  const { state } = useGame();
  const active = state.events.active.filter((a) => isEventDefId(a.defId));
  if (active.length === 0) return null;
  return (
    <div className={`event-banner${compact ? ' event-banner--compact' : ''}`}>
      {active.map((a) => {
        const def = EVENT_MAP[a.defId as keyof typeof EVENT_MAP];
        const targetName = a.target ? (isResourceId(a.target) ? RESOURCE_MAP[a.target].name : getLand(state, a.target)?.name ?? a.target) : '';
        const tone = TONE[def.kind];
        return (
          <div key={a.id} className={`event-card event-card--${tone}`}>
            <Icon name={def.icon} size={compact ? 24 : 32} fallback={def.name.slice(0, 2)} />
            <div className="row__grow">
              <div className="event-card__title">
                {def.name}
                {targetName && <span className="event-card__target">{targetName}</span>}
              </div>
              {!compact && <div className="event-card__desc">{def.description.replace('{target}', targetName)}</div>}
              <ProgressBar ratio={a.total > 0 ? a.remaining / a.total : 0} tone={tone === 'warn' || tone === 'loss' ? 'warn' : tone === 'research' ? 'research' : 'profit'} />
            </div>
            <div className="event-card__time num">{formatDuration(a.remaining)}</div>
          </div>
        );
      })}
    </div>
  );
}
