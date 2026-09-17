import { Icon } from '@/components/ui/Icon';
import { useUiStore } from '@/stores/uiStore';
import { NAV_ITEMS, type NavTab } from '@/types/ui';

interface NavProps {
  attention?: Partial<Record<NavTab, boolean>>;
}

export function BottomNav({ attention = {} }: NavProps) {
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);
  return (
    <nav className="app__nav" aria-label="メインナビゲーション">
      <div className="nav">
        {NAV_ITEMS.map((it) => (
          <button key={it.id} className="nav__item" aria-current={tab === it.id ? 'page' : undefined} aria-label={it.label} title={attention[it.id] ? '確認してください' : undefined} onClick={() => setTab(it.id)}>
            <Icon name={it.icon} size={22} fallback={it.label.slice(0, 2)} />
            <span aria-hidden="true">{it.label}</span>
            {attention[it.id] && <span className="nav__dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
