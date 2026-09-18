import { Icon } from '@/components/ui/Icon';
import { useUiStore } from '@/stores/uiStore';
import { NAV_ITEMS, type NavTab } from '@/types/ui';

interface NavProps {
  attention?: Partial<Record<NavTab, boolean>>;
  /** いま出すタブ。まだ使えない機能は渡さない（＝画面に出ない） */
  tabs?: NavTab[];
}

export function BottomNav({ attention = {}, tabs }: NavProps) {
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);
  const items = tabs ? NAV_ITEMS.filter((it) => tabs.includes(it.id)) : NAV_ITEMS;
  return (
    <nav className="app__nav" aria-label="メインナビゲーション">
      <div className="nav">
        {items.map((it) => (
          <button key={it.id} className="nav__item" aria-current={tab === it.id ? 'page' : undefined} aria-label={it.labelJa} title={attention[it.id] ? '確認してください' : undefined} onClick={() => setTab(it.id)}>
            <Icon name={it.icon} size={22} fallback={it.labelJa.slice(0, 2)} />
            <span aria-hidden="true">{it.labelJa}</span>
            {attention[it.id] && <span className="nav__dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
