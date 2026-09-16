import { Icon } from '@/components/ui/Icon';
import { ACHIEVEMENTS } from '@/game/data/achievements';
import { useGame } from '@/stores/gameStore';

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
          const unlocked = !!state.achievements[a.id];
          return (
            <div key={a.id} className="row" style={{ opacity: unlocked ? 1 : 0.55 }}>
              <Icon name={unlocked ? a.icon : 'icon_ui_lock'} size={28} fallback={a.name.slice(0, 2)} />
              <div className="row__grow">
                <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                <div className="text-sub" style={{ fontSize: 12 }}>
                  {a.description}
                </div>
              </div>
              {unlocked && <span className="badge badge--research">達成</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
