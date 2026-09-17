import { useState } from 'react';
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
  const [query, setQuery] = useState('');
  const [onlyCraftable, setOnlyCraftable] = useState(false);

  const visible = (RECIPES as readonly RecipeDef[]).filter((r) => isUnlocked(state, 'recipe', r.id) || !r.hiddenUntilUnlocked);
  const q = query.trim().toLowerCase();
  const list = visible
    .filter((r) => (q ? true : r.category === category))
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
    .filter((r) => !onlyCraftable || craftableTimes(state, r.id as RecipeId) > 0);
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
      <div className="row toolbar">
        <input className="input input--sm" type="search" placeholder="レシピを検索（全カテゴリ）" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="レシピの検索" />
        <label className="switch">
          <input type="checkbox" checked={onlyCraftable} onChange={(e) => setOnlyCraftable(e.target.checked)} />
          <span className="text-sub" style={{ fontSize: 12 }}>
            作れるものだけ
          </span>
        </label>
      </div>
      <div className="grid grid--2">
        {list.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
      {list.length === 0 && <div className="empty">{q || onlyCraftable ? '条件に合うレシピがありません。' : 'このカテゴリのレシピはまだありません。'}</div>}
    </div>
  );
}
