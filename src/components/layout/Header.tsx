import { GAME_META } from '@/game/data/meta';
import { useGame } from '@/stores/gameStore';
import { formatMoney, formatMoneyRate } from '@/utils/format';
import { Stat } from '@/components/ui/Stat';
import { useUiStore } from '@/stores/uiStore';
import { SEASONS, formatGameDateShort } from '@/game/data/calendar';
import { gameDate } from '@/game/engine/systems/calendar';
import { hasStarted } from '@/game/engine/hq';

export function Header() {
  const { state, derived } = useGame();
  const tab = useUiStore((s) => s.tab);
  const mode = state.settings.numberFormat;
  const started = hasStarted(state);
  const d = gameDate(state);
  return (
    <header className="app__header">
      <div className="header">
        <div className="header__brand">
          <span className="header__title">{GAME_META.title}</span>
          <span className="header__company">{state.company.name}</span>
        </div>
        {started && (
          <div className="header__date" title={`${d.year}年${d.month}月${d.day}日（${SEASONS[d.season].label}）`}>
            <span className="header__date-ymd">{d.year}年</span>
            <span className="header__date-md">{formatGameDateShort(d)}</span>
            <span className={`header__date-season header__date-season--${d.season}`}>{SEASONS[d.season].label}</span>
          </div>
        )}
        {tab !== 'home' && (
        <div className="header__stats">
          <div className="header__cash">
            <Stat label="所持金" value={formatMoney(state.company.cash, mode)} extra={formatMoneyRate(derived.incomePerSec, mode)} align="right" />
          </div>
        </div>
        )}
      </div>
    </header>
  );
}
