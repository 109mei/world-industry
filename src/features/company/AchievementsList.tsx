import { Icon } from '@/components/ui/Icon';
import { ACHIEVEMENTS } from '@/game/data/achievements';
import { useGame } from '@/stores/gameStore';
import { formatClock } from '@/utils/format';

export function AchievementsList() {
  const { state } = useGame();
  const done = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
  return (
    <div>
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <span className="text-sub" style={{ fontSize: 12 }}>
          解除 {done} / {ACHIEVEMENTS.length}
        </span>
      </div>
      <div className="list">
        {ACHIEVEMENTS.map((a) => {
          const at = state.achievements[a.id];
          const unlocked = !!at;
          return (
            <div key={a.id} className={`achievement-row${unlocked ? ' achievement-row--done' : ''}`}>
              <div className={`achievement-row__icon${unlocked ? ' achievement-row__icon--done' : ''}`}>
                <Icon name={unlocked ? a.icon : 'icon_ui_lock'} size={28} fallback={a.name.slice(0, 2)} />
              </div>
              <div className="row__grow">
                <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                <div className="text-sub" style={{ fontSize: 12 }}>
                  {a.description}
                </div>
              </div>
              {unlocked ? (
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge--research">達成</span>
                  <div className="text-dim num" style={{ fontSize: 10, marginTop: 2 }}>
                    {formatClock(at)}
                  </div>
                </div>
              ) : (
                <span className="badge">未達成</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
