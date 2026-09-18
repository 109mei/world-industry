import { useGame } from '@/stores/gameStore';
import { formatClock } from '@/utils/format';

/**
 * 出来事の一覧。
 * 既定では「自分の会社で起きたこと」だけを出す。他社の動きは株式の画面で見る
 * （ホームに混ざると、自分が何をしたのかが読み取れなくなるため）。
 */
export function EventList({ limit = 8, scope = 'own' }: { limit?: number; scope?: 'own' | 'other' }) {
  const { state } = useGame();
  const events = state.eventLog
    .filter((ev) => (scope === 'other' ? ev.scope === 'other' : ev.scope !== 'other'))
    .slice(-limit)
    .reverse();
  if (events.length === 0) {
    return <div className="empty">{scope === 'other' ? 'まだ他社の動きはありません。' : 'まだ出来事はありません。石を拾うところから始めましょう。'}</div>;
  }
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
