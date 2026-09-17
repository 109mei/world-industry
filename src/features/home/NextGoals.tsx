import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FACILITIES, type FacilityDef } from '@/game/data/facilities';
import { LANDS, type LandDef } from '@/game/data/lands';
import { RECIPES, type RecipeDef } from '@/game/data/recipes';
import { TERRAINS } from '@/game/data/terrain';
import type { UnlockCondition } from '@/game/data/unlockTypes';
import { conditionProgress, describeCondition, envOf, isLandSystemUnlocked, isUnlocked } from '@/game/engine/systems/unlocks';
import { useGame } from '@/stores/gameStore';
import { formatNumber } from '@/utils/format';
import { NAMES } from '@/utils/names';

interface Goal {
  key: string;
  icon: string;
  name: string;
  kind: string;
  cond: UnlockCondition;
}

/** まだ解放されていない施設・レシピのうち、近いものを「次の目標」として見せる */
export function NextGoals() {
  const { state, derived } = useGame();
  const goals: Goal[] = [];
  for (const f of FACILITIES as readonly FacilityDef[]) {
    if (isUnlocked(state, 'facility', f.id) || f.hiddenUntilUnlocked) continue;
    goals.push({ key: `f:${f.id}`, icon: f.icon, name: f.name, kind: '施設', cond: f.unlock });
  }
  for (const r of RECIPES as readonly RecipeDef[]) {
    if (isUnlocked(state, 'recipe', r.id) || r.hiddenUntilUnlocked) continue;
    goals.push({ key: `r:${r.id}`, icon: r.icon, name: r.name, kind: 'レシピ', cond: r.unlock });
  }
  if (isLandSystemUnlocked(state, derived.assets)) {
    for (const l of LANDS as readonly LandDef[]) {
      if (isUnlocked(state, 'land', l.id) || l.unlock.type === 'always') continue;
      goals.push({ key: `l:${l.id}`, icon: TERRAINS[l.terrain].icon, name: l.name, kind: '土地', cond: l.unlock });
    }
  }
  if (goals.length === 0) return null;
  const env = envOf(derived);
  // 進捗率が高い順に3つ
  const scored = goals
    .map((g) => {
      const p = conditionProgress(g.cond, state, env);
      return { g, p, ratio: p ? p.current / p.target : 0 };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);
  const mode = state.settings.numberFormat;
  return (
    <Card>
      <div className="list">
        {scored.map(({ g, p, ratio }) => (
          <div key={g.key}>
            <div className="row">
              <Icon name={g.icon} size={28} fallback={g.name.slice(0, 2)} />
              <div className="row__grow">
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {g.name} <span className="badge">{g.kind}</span>
                </div>
                <div className="text-sub" style={{ fontSize: 12 }}>
                  {describeCondition(g.cond, NAMES)}
                </div>
              </div>
              {p && (
                <span className="text-sub num" style={{ fontSize: 12 }}>
                  {formatNumber(Math.floor(p.current), mode)} / {formatNumber(p.target, mode)}
                </span>
              )}
            </div>
            {p && (
              <div style={{ marginTop: 6 }}>
                <ProgressBar ratio={ratio} tone="research" />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
