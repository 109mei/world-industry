import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { RESOURCES, type ResourceId } from '@/game/data/resources';
import { getRuntime } from '@/game/runtime';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';

/** 開発用パネル。本番ビルドでは表示されない（VITE_ENABLE_DEBUG=1 で有効化できる） */
export const DEBUG_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === '1';

export function DebugPanel() {
  const open = useUiStore((s) => s.debugOpen);
  const setOpen = useUiStore((s) => s.setDebugOpen);
  const { engine } = useGame();
  if (!DEBUG_ENABLED) return null;
  const after = () => bumpGame();
  return (
    <>
      <button className="debug-fab" onClick={() => setOpen(true)} aria-label="デバッグパネル">
        DBG
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Debug Panel">
        <div className="sheet__section btn-row">
          <Button size="sm" onClick={() => (engine.debugAddCash(1000), after())}>
            +1,000円
          </Button>
          <Button size="sm" onClick={() => (engine.debugAddCash(100_000), after())}>
            +100K円
          </Button>
          <Button size="sm" onClick={() => (engine.debugAddCash(10_000_000), after())}>
            +10M円
          </Button>
        </div>
        <div className="sheet__section btn-row">
          {RESOURCES.map((r) => (
            <Button key={r.id} size="sm" onClick={() => (engine.debugAddResource(r.id as ResourceId, 100), after())}>
              +100 {r.name}
            </Button>
          ))}
        </div>
        <div className="sheet__section btn-row">
          <Button size="sm" onClick={() => (engine.advance(60), after())}>
            +1分経過
          </Button>
          <Button size="sm" onClick={() => (engine.advance(3600), after())}>
            +1時間経過
          </Button>
          <Button size="sm" onClick={() => (engine.debugUnlockAll(), after())}>
            全解放
          </Button>
          <Button size="sm" onClick={() => (engine.debugAddResearch(500), after())}>
            +500 RP
          </Button>
          <Button size="sm" onClick={() => (engine.advance(8 * 3600), after())}>
            +8時間経過
          </Button>
          <Button size="sm" onClick={() => (engine.debugTriggerEvent(), after())}>
            イベント発生
          </Button>
          <Button size="sm" onClick={() => (engine.debugTriggerEvent('quake'), after())}>
            地震
          </Button>
          <Button size="sm" onClick={() => (engine.debugTriggerEvent('boom'), after())}>
            相場高騰
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const s = engine.state;
              s.tutorial.completed = true;
              after();
            }}
          >
            チュートリアル完了
          </Button>
        </div>
        <div className="sheet__section btn-row">
          <Button size="sm" onClick={() => void getRuntime().save()}>
            保存
          </Button>
          <Button variant="danger" size="sm" onClick={() => void getRuntime().reset()}>
            セーブ削除
          </Button>
        </div>
      </Sheet>
    </>
  );
}
