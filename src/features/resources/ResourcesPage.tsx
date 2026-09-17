import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { RESOURCES, type ResourceId } from '@/game/data/resources';
import { TOOLS, type ToolId } from '@/game/data/tools';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount } from '@/utils/format';
import { EventBanner } from '@/features/home/EventBanner';
import { MarketPanel } from './MarketPanel';
import { ResourceCard } from './ResourceCard';

export function ResourcesPage() {
  const { state, derived } = useGame();
  const sub = useUiStore((s) => s.resourceSubTab);
  const setSub = useUiStore((s) => s.setResourceSubTab);
  const openResource = useUiStore((s) => s.openResource);
  const mode = state.settings.numberFormat;
  const ids = RESOURCES.filter((r) => state.discovered[r.id as ResourceId]).map((r) => r.id as ResourceId);
  const tools = TOOLS.filter((t) => (state.tools[t.id as ToolId]?.count ?? 0) > 0);

  return (
    <div className="page">
      <div className="row row--between">
        <h1 className="page__title">
          資源<small>倉庫容量 {formatAmount(derived.capacity, mode)}</small>
        </h1>
      </div>
      <Segmented
        items={[
          { id: 'inventory', label: '在庫' },
          { id: 'market', label: '市場' },
        ]}
        value={sub}
        onChange={setSub}
        ariaLabel="資源の表示切替"
      />
      {sub === 'market' && <EventBanner compact />}
      {sub === 'inventory' ? (
        <>
          <div className="grid grid--2">
            {ids.map((id) => (
              <ResourceCard key={id} id={id} onOpen={openResource} />
            ))}
          </div>
          <div className="section-title">所持している道具</div>
          <Card>
            {tools.length === 0 ? (
              <div className="empty">道具はありません。CRAFT画面で作れます。</div>
            ) : (
              <div className="list">
                {tools.map((t) => {
                  const stack = state.tools[t.id as ToolId]!;
                  return (
                    <div key={t.id} className="row row--between">
                      <div className="row">
                        <Icon name={t.icon} size={28} fallback={t.name.slice(0, 2)} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{t.name}</div>
                          <div className="text-sub" style={{ fontSize: 12 }}>
                            {t.description}
                          </div>
                        </div>
                      </div>
                      <div className="stat" style={{ textAlign: 'right' }}>
                        <span className="stat__value num">×{stack.count}</span>
                        <span className="stat__label num">
                          耐久 {stack.durability}/{t.durability}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      ) : (
        <MarketPanel />
      )}
    </div>
  );
}
