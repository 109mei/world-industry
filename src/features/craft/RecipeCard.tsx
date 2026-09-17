import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Ingredients } from '@/components/ui/Ingredients';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { RECIPE_MAP, isRecipeId, type RecipeDef, type RecipeId } from '@/game/data/recipes';
import { RESOURCE_MAP, isResourceId, type ResourceId } from '@/game/data/resources';
import { TOOL_MAP, isToolId } from '@/game/data/tools';
import { craftableTimes } from '@/game/engine/actions/craft';
import { describeCondition, isUnlocked } from '@/game/engine/systems/unlocks';
import { bumpGame, useGame } from '@/stores/gameStore';
import { sfx } from '@/utils/sfx';
import { useRepeat } from '@/utils/useRepeat';

const NAMES = {
  resource: (id: string) => (isResourceId(id) ? RESOURCE_MAP[id].name : id),
  tool: (id: string) => (isToolId(id) ? TOOL_MAP[id].name : id),
  recipe: (id: string) => (isRecipeId(id) ? RECIPE_MAP[id].name : id),
  facility: (id: string) => (isFacilityId(id) ? FACILITY_MAP[id].name : id),
};

export function RecipeCard({ recipe }: { recipe: RecipeDef }) {
  const { state, engine } = useGame();
  const id = recipe.id as RecipeId;
  const unlocked = isUnlocked(state, 'recipe', id);
  const times = craftableTimes(state, id);
  const tool = recipe.outputTool ? TOOL_MAP[recipe.outputTool] : null;
  const stack = recipe.outputTool ? state.tools[recipe.outputTool] : undefined;

  const doCraft = (n: number | 'max') => {
    if (engine.craft(id, n) > 0) sfx('craft');
    bumpGame();
  };
  const hold = useRepeat(() => doCraft(1));

  if (!unlocked) {
    return (
      <Card locked>
        <div className="card__head">
          <Icon name="icon_ui_lock" size={32} fallback="LK" />
          <div className="row__grow">
            <div className="card__title">{recipe.name}</div>
            <div className="card__sub">解放条件: {describeCondition(recipe.unlock, NAMES) || '—'}</div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="card__head">
        <Icon name={recipe.icon} size={36} fallback={recipe.name.slice(0, 2)} />
        <div className="row__grow">
          <div className="card__title">{recipe.name}</div>
          <div className="card__sub">{recipe.description}</div>
        </div>
        {tool && (
          <div className="stat" style={{ textAlign: 'right' }}>
            <span className="stat__value stat__value--sm num">所持 {stack?.count ?? 0}</span>
            <span className="stat__label num">耐久 {tool.durability}</span>
          </div>
        )}
        {recipe.outputs && (
          <div className="stat" style={{ textAlign: 'right' }}>
            <span className="stat__value stat__value--sm num">
              {(Object.entries(recipe.outputs) as [ResourceId, number][]).map(([rid, n]) => `${RESOURCE_MAP[rid].name}×${n}`).join(' ')}
            </span>
            <span className="stat__label">出力</span>
          </div>
        )}
      </div>
      <div className="card__body">
        <Ingredients needs={recipe.inputs} />
      </div>
      <div className="card__actions btn-row">
        <Button variant="primary" size="sm" disabled={times < 1} onClick={() => doCraft(1)} title="長押しで連続" {...hold}>
          1個作る
        </Button>
        <Button variant="secondary" size="sm" disabled={times < 1} onClick={() => doCraft(10)}>
          10個
        </Button>
        <Button variant="secondary" size="sm" disabled={times < 1} onClick={() => doCraft('max')}>
          MAX ({times})
        </Button>
      </div>
    </Card>
  );
}
