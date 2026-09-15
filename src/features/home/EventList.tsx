import { useGame } from '@/stores/gameStore';
import { formatClock } from '@/utils/format';

export function EventList({ limit = 8 }: { limit?: number }) {
  const { state } = useGame();
  const events = state.eventLog.slice(-limit).reverse();
  if (events.length === 0) return <div className="empty">まだ出来事はありません。石を拾うところから始めましょう。</div>;
  return (
    <div className="event-list">
      {events.map((ev) => (
        <div key={ev.id} className={`event event--${ev.type}`}>
          <span className="event__time">{formatClock(ev.time)}</span>
          <span>{ev.message}</span>
        </div>
      ))}
    </div>
  );
}
