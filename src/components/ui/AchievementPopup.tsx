import { useEffect } from 'react';
import { ACHIEVEMENTS } from '@/game/data/achievements';
import { useUiStore } from '@/stores/uiStore';
import { Icon } from './Icon';

const SHOW_MS = 4200;

/** 実績解除の演出。キューの先頭を一定時間表示して次へ進む */
export function AchievementPopup() {
  const queue = useUiStore((s) => s.achievementQueue);
  const shift = useUiStore((s) => s.shiftAchievement);
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(shift, SHOW_MS);
    return () => clearTimeout(t);
  }, [current, shift]);

  if (!current) return null;
  const def = ACHIEVEMENTS.find((a) => a.id === current.achievementId);
  if (!def) return null;
  return (
    <div className="achievement-pop" role="status" aria-live="polite" onClick={shift} key={current.id}>
      <div className="achievement-pop__shine" aria-hidden="true" />
      <div className="achievement-pop__trophy">
        <Icon name="icon_ui_trophy" size={30} fallback="TR" />
      </div>
      <div className="achievement-pop__body">
        <div className="achievement-pop__label">実績解除</div>
        <div className="achievement-pop__name">{def.name}</div>
        <div className="achievement-pop__desc">{def.description}</div>
      </div>
      <div className="achievement-pop__icon">
        <Icon name={def.icon} size={40} fallback={def.name.slice(0, 2)} />
      </div>
    </div>
  );
}
