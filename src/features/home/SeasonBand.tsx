import { SEASONS } from '@/game/data/calendar';
import { formatGameDate } from '@/game/data/calendar';
import { gameDate } from '@/game/engine/systems/calendar';
import { useGame } from '@/stores/gameStore';
import { artUrl } from '@/utils/assets';

/**
 * 季節の帯。
 * いまがゲームの中でいつなのかを、数字ではなく景色で分かるようにする。
 * 絵は季節ごとに1枚だけ読み込む（4枚まとめては読まない）。
 */
export function SeasonBand() {
  const { state } = useGame();
  const d = gameDate(state);
  const season = SEASONS[d.season];
  return (
    <div className="seasonband" style={{ backgroundImage: `url(${artUrl(season.art)})` }}>
      <div className="seasonband__veil">
        <div className="seasonband__date">
          <span className="seasonband__ymd">{formatGameDate(d)}</span>
          <span className="seasonband__season">{season.label}</span>
        </div>
        <div className="seasonband__note">{season.note}</div>
      </div>
    </div>
  );
}
