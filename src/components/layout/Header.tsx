import { GAME_META } from '@/game/data/meta';
import { useGame } from '@/stores/gameStore';
import { formatMoney, formatMoneyRate } from '@/utils/format';
import { Stat } from '@/components/ui/Stat';
import { useUiStore } from '@/stores/uiStore';

export function Header() {
  const { state, derived } = useGame();
  const tab = useUiStore((s) => s.tab);
  const mode = state.settings.numberFormat;
  return (
    <header className="app__header">
      <div className="header">
        <div className="header__brand">
          <span className="header__title">{GAME_META.title}</span>
          <span className="header__company">{state.company.name}</span>
        </div>
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
