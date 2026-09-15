import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { GATHER_ACTIONS } from '@/game/data/gathering';
import { RESOURCE_MAP } from '@/game/data/resources';
import { TOOL_MAP } from '@/game/data/tools';
import { previewGather } from '@/game/engine/actions/gather';
import { bumpGame, useGame } from '@/stores/gameStore';

/** 手作業の採集ボタン一覧 */
export function GatherPanel() {
  const { state, engine, derived } = useGame();
  return (
    <div className="grid grid--auto grid--tight">
      {GATHER_ACTIONS.map((g) => {
        const p = previewGather(state, g.id);
        if (!p.unlocked) return null;
        const res = RESOURCE_MAP[g.resource];
        const full = (state.inventory[g.resource] ?? 0) >= derived.capacity - 1e-9;
        const tool = p.toolId ? TOOL_MAP[p.toolId] : null;
        const stack = p.toolId ? state.tools[p.toolId] : undefined;
        return (
          <Button
            key={g.id}
            className="btn--gather"
            variant="secondary"
            disabled={!p.available || full}
            onClick={() => {
              engine.gather(g.id);
              bumpGame();
            }}
            aria-label={`${g.label}（${res.name}）`}
          >
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
          </Button>
        );
      })}
    </div>
  );
}
