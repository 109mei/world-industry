import { useCallback, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { GATHER_ACTIONS, type GatherActionId } from '@/game/data/gathering';
import { RESOURCE_MAP } from '@/game/data/resources';
import { TOOL_MAP } from '@/game/data/tools';
import { previewGather } from '@/game/engine/actions/gather';
import { isManagerHired } from '@/game/engine/systems/automation';
import { bumpGame, useGame } from '@/stores/gameStore';
import { sfx } from '@/utils/sfx';
import { useRepeat } from '@/utils/useRepeat';

interface Pop {
  id: number;
  text: string;
  x: number;
}

let popSeq = 1;

/** 採集ボタン1つ（数字ポップと長押し連打つき） */
function GatherButton({ id, pops, addPop }: { id: GatherActionId; pops: Pop[]; addPop: (id: GatherActionId, text: string, x: number) => void }) {
  const { state, engine, derived } = useGame();
  const g = GATHER_ACTIONS.find((a) => a.id === id)!;
  const p = previewGather(state, id);
  const res = RESOURCE_MAP[g.resource];
  const full = (state.inventory[g.resource] ?? 0) >= derived.capacity - 1e-9;
  const tool = p.toolId ? TOOL_MAP[p.toolId] : null;
  const stack = p.toolId ? state.tools[p.toolId] : undefined;
  const ref = useRef<HTMLButtonElement>(null);
  const doGather = useCallback(
    (clientX?: number) => {
      const got = engine.gather(id);
      if (got > 0) {
        sfx('tap');
        const rect = ref.current?.getBoundingClientRect();
        const x = rect && clientX !== undefined ? Math.max(8, Math.min(rect.width - 8, clientX - rect.left)) : (rect?.width ?? 60) / 2;
        addPop(id, `+${got}`, x);
      }
      bumpGame();
    },
    [engine, id, addPop],
  );
  const hold = useRepeat(() => doGather(), { delay: 350, interval: 120 });
  const disabled = !p.available || full;
  return (
    <button
      ref={ref}
      type="button"
      className="btn btn--secondary btn--gather"
      disabled={disabled}
      onClick={(e) => doGather(e.clientX)}
      aria-label={`${g.label}（${res.name}）`}
      title="長押しで連続"
      {...(disabled ? {} : hold)}
    >
      <span className="pops" aria-hidden="true">
        {pops.map((pp) => (
          <span key={pp.id} className="pop" style={{ left: pp.x }}>
            {pp.text}
          </span>
        ))}
      </span>
      <Icon name={res.icon} size={30} fallback={res.name.slice(0, 2)} />
      <span className="btn__label">{g.label}</span>
      {p.available ? (
        <span className="btn__amount">
          +{p.amount} {res.name}
        </span>
      ) : (
        <span className="btn__hint">{p.reason}</span>
      )}
      {tool && stack && (
        <span className="btn__hint">
          {tool.name} 耐久{stack.durability}/{tool.durability}
        </span>
      )}
      {p.available && !tool && g.hint && <span className="btn__hint">{g.hint}</span>}
      {full && <span className="btn__hint text-loss">倉庫が満杯</span>}
    </button>
  );
}

/** 手作業の採集ボタン一覧 */
export function GatherPanel() {
  const { state } = useGame();
  const [pops, setPops] = useState<Record<string, Pop[]>>({});
  const addPop = useCallback((id: GatherActionId, text: string, x: number) => {
    const pop: Pop = { id: popSeq++, text, x };
    setPops((prev) => ({ ...prev, [id]: [...(prev[id] ?? []).slice(-4), pop] }));
    window.setTimeout(() => setPops((prev) => ({ ...prev, [id]: (prev[id] ?? []).filter((q) => q.id !== pop.id) })), 700);
  }, []);
  const gatherManager = isManagerHired(state, 'gather');
  return (
    <div>
      {gatherManager && (
        <div className="text-profit" style={{ fontSize: 12, marginBottom: 6 }}>
          採集係が毎秒あなたの代わりに採集しています（自分でタップしてもOK）。
        </div>
      )}
      <div className="grid grid--auto grid--tight">
        {GATHER_ACTIONS.map((g) => {
          const p = previewGather(state, g.id);
          if (!p.unlocked) return null;
          return <GatherButton key={g.id} id={g.id} pops={pops[g.id] ?? []} addPop={addPop} />;
        })}
      </div>
    </div>
  );
}
