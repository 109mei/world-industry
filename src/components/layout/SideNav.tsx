import { Icon } from '@/components/ui/Icon';
import { GAME_META } from '@/game/data/meta';
import { useUiStore } from '@/stores/uiStore';
import { NAV_ITEMS, type NavTab } from '@/types/ui';

interface NavProps {
  attention?: Partial<Record<NavTab, boolean>>;
}

export function SideNav({ attention = {} }: NavProps) {
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);
  return (
    <aside className="app__sidebar">
      <div className="side-nav__brand">
        {GAME_META.title}
        <small>v{GAME_META.version}</small>
      </div>
      {NAV_ITEMS.map((it) => (
        <button key={it.id} className="side-nav__item" aria-current={tab === it.id ? 'page' : undefined} aria-label={it.labelJa} title={attention[it.id] ? '確認してください' : undefined} onClick={() => setTab(it.id)}>
          <Icon name={it.icon} size={22} fallback={it.label.slice(0, 2)} />
          {it.labelJa}
          <small>{it.label}</small>
          {attention[it.id] && <span className="badge badge--warn" aria-hidden="true">!</span>}
        </button>
      ))}
      <div className="side-nav__footer">石を拾うところから、世界規模の産業企業へ。</div>
    </aside>
  );
}
