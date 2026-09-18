import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { MINIGAMES, SKILL_MAP, rewardMultiplier, type MinigameId } from '@/game/data/minigames';
import { RESOURCE_MAP } from '@/game/data/resources';
import { isMinigameUnlocked, skillOf, skillProgress } from '@/game/engine/systems/minigame';
import { useGame } from '@/stores/gameStore';
import { formatQty } from '@/utils/names';
import { MinigameSheet } from './MinigameSheet';

/**
 * ホームの「手仕事」欄。
 *
 * 遊ぶたびに腕が上がり、その腕は施設の生産にそのまま効き続ける。
 * 4種とも最初から遊べる（待たせる意味がないため）。
 * それでも解放の判定を通しているのは、あとで条件付きの遊びを足したときに
 * ここだけ直し忘れる、ということが起きないようにするため。
 */
export function MinigamePanel() {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
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
              {/* 何がもらえるかを、開く前に一目で分かるようにする */}
              <span className="mg-card__reward">
                <Icon name={RESOURCE_MAP[g.reward].icon} size={16} fallback={RESOURCE_MAP[g.reward].name.slice(0, 1)} />
                <span className="num">{formatQty(g.reward, g.rewardMax * rewardMultiplier(st.level), mode)}</span>
                {g.bonus && g.bonusMax && (
                  <>
                    <span className="mg-card__plus">＋</span>
                    <Icon name={RESOURCE_MAP[g.bonus].icon} size={16} fallback={RESOURCE_MAP[g.bonus].name.slice(0, 1)} />
                    <span className="num">{formatQty(g.bonus, g.bonusMax * rewardMultiplier(st.level), mode)}</span>
                  </>
                )}
              </span>
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
        数字は満点を取ったときの量です。右側のものは出来が良かったときだけ出ます。
        腕は下がらず、上がるほど手に入る量も増え、施設の生産や採集量にも効き続けます。
      </div>
      {/* key を付けて、別の遊びを開いたときに前の結果が残らないようにする */}
      <MinigameSheet key={open ?? 'none'} gameId={open} onClose={() => setOpen(null)} />
    </div>
  );
}
