import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { useGame } from '@/stores/gameStore';
import { formatAmount } from '@/utils/format';
import { Icon } from './Icon';

interface IngredientsProps {
  needs: Partial<Record<ResourceId, number>>;
  times?: number;
}

/** 材料一覧。足りないものは赤で表示 */
export function Ingredients({ needs, times = 1 }: IngredientsProps) {
  const { state } = useGame();
  return (
    <div className="ingredients">
      {(Object.entries(needs) as [ResourceId, number][]).map(([id, n]) => {
        const have = state.inventory[id] ?? 0;
        const need = n * times;
        const ok = have + 1e-9 >= need;
        return (
          <span key={id} className={`ingredient ${ok ? 'ingredient--ok' : 'ingredient--short'}`} title={RESOURCE_MAP[id].name}>
            <Icon name={RESOURCE_MAP[id].icon} size={16} />
            {RESOURCE_MAP[id].name} {formatAmount(have, state.settings.numberFormat)}/{need}
          </span>
        );
      })}
    </div>
  );
}
