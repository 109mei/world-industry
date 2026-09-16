import { Segmented } from '@/components/ui/Segmented';
import { RECIPES, RECIPE_CATEGORIES, RECIPE_CATEGORY_LABEL, type RecipeDef, type RecipeId } from '@/game/data/recipes';
import { craftableTimes } from '@/game/engine/actions/craft';
import { isUnlocked } from '@/game/engine/systems/unlocks';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { RecipeCard } from './RecipeCard';

export function CraftPage() {
  const { state } = useGame();
  const category = useUiStore((s) => s.craftCategory);
  const setCategory = useUiStore((s) => s.setCraftCategory);

  const visible = (RECIPES as readonly RecipeDef[]).filter((r) => isUnlocked(state, 'recipe', r.id) || !r.hiddenUntilUnlocked);
  const list = visible.filter((r) => r.category === category);
  const badges = Object.fromEntries(
    RECIPE_CATEGORIES.map((c) => [c, visible.filter((r) => r.category === c && craftableTimes(state, r.id as RecipeId) > 0).length]),
  ) as Record<string, number>;

  return (
    <div className="page">
      <h1 className="page__title">
        クラフト<small>材料を消費して道具・素材・製品を作る</small>
      </h1>
      <Segmented
        items={RECIPE_CATEGORIES.map((c) => ({ id: c, label: RECIPE_CATEGORY_LABEL[c], badge: badges[c] }))}
        value={category}
        onChange={setCategory}
        ariaLabel="クラフトのカテゴリ"
      />
      <div className="grid grid--2">
        {list.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
      {list.length === 0 && <div className="empty">このカテゴリのレシピはまだありません。</div>}
    </div>
  );
}
