import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { RESOURCES, type ResourceId } from '@/game/data/resources';
import { TOOLS, type ToolId } from '@/game/data/tools';
import { formatCapacity } from '@/utils/names';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { EventBanner } from '@/features/home/EventBanner';
import { MarketPanel } from './MarketPanel';
import { ResourceCard } from './ResourceCard';
import { ResourceOverview } from './ResourceOverview';

/** 資源の在庫と市場（ホームの「資源」タブの中身） */
export function ResourcesPanel() {
  const { state, derived } = useGame();
  const sub = useUiStore((s) => s.resourceSubTab);
  const setSub = useUiStore((s) => s.setResourceSubTab);
  const openResource = useUiStore((s) => s.openResource);
  const mode = state.settings.numberFormat;
  const ids = RESOURCES.filter((r) => state.discovered[r.id as ResourceId]).map((r) => r.id as ResourceId);
  const tools = TOOLS.filter((t) => (state.tools[t.id as ToolId]?.count ?? 0) > 0);

  return (
    <>
      <div className="row row--between">
        <div className="section-title" style={{ marginTop: 4 }}>
          資源 <span className="text-sub" style={{ fontWeight: 400, fontSize: 12 }}>倉庫容量 {formatCapacity(derived.capacity, mode)}</span>
        </div>
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
          <ResourceOverview ids={ids} />
          <div className="section-title">ひとつずつ見る</div>
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
    </>
  );
}
