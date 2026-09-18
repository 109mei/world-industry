import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { MINIGAMES, SKILL_MAP, type MinigameId } from '@/game/data/minigames';
import { isMinigameUnlocked, skillOf, skillProgress } from '@/game/engine/systems/minigame';
import { useGame } from '@/stores/gameStore';
import { MinigameSheet } from './MinigameSheet';

/**
 * ホームの「手仕事」欄。
 *
 * 遊ぶたびに腕が上がり、その腕は施設の生産にそのまま効き続ける。
 * まだ遊べないものは出さない（使えない機能は画面に出さない、という決めごと）。
 */
export function MinigamePanel() {
  const { state, derived } = useGame();
  const [open, setOpen] = useState<MinigameId | null>(null);
  const available = MINIGAMES.filter((g) => isMinigameUnlocked(state, g.id, derived.assets));
  if (available.length === 0) return null;

  return (
    <div>
      <div className="grid grid--auto grid--tight">
        {available.map((g) => {
          const skill = SKILL_MAP[g.skill];
          const st = skillOf(state, g.skill);
          const capped = st.level >= skill.maxLevel;
          return (
            <button key={g.id} type="button" className="btn btn--secondary mg-card" onClick={() => setOpen(g.id)}>
              <Icon name={g.icon} size={30} fallback={g.name.slice(0, 2)} />
              <span className="btn__label">{g.name}</span>
              <span className="mg-card__skill">
                {skill.name} <strong className="num">Lv.{st.level}</strong>
                {capped && <span className="text-profit"> 極</span>}
              </span>
              <span className="mg-card__bar">
                <ProgressBar ratio={capped ? 1 : skillProgress(state, g.skill)} tone={capped ? 'profit' : 'accent'} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="text-dim mg__foot">
        腕は下がりません。上がったぶんは施設の生産や採集量にそのまま効き続けます。
      </div>
      {/* key を付けて、別の遊びを開いたときに前の結果が残らないようにする */}
      <MinigameSheet key={open ?? 'none'} gameId={open} onClose={() => setOpen(null)} />
    </div>
  );
}
