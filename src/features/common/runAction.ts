import type { FixAction } from '@/game/engine/analysis/diagnose';
import type { Recommendation } from '@/game/engine/analysis/recommend';
import type { GameEngine } from '@/game/engine/GameEngine';
import type { RecipeId } from '@/game/data/recipes';
import type { ResearchId } from '@/game/data/research';
import type { LandDefId } from '@/game/data/lands';
import { bumpGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { sfx } from '@/utils/sfx';

type AnyAction = FixAction | Recommendation['action'];

/** 診断・おすすめの「操作」をエンジンと画面の操作に対応づける */
export function runAction(engine: GameEngine, action: AnyAction): void {
  const ui = useUiStore.getState();
  switch (action.kind) {
    case 'buyFacility':
      if (engine.buyFacility(action.typeId, 1, action.landId) > 0) sfx('buy');
      break;
    case 'goTab':
      if (action.landId) ui.setFactoryLand(action.landId);
      ui.setTab(action.tab);
      break;
    case 'openResource':
      ui.openResource(action.resource);
      break;
    case 'craft':
      ui.setTab('craft');
      if (engine.craft(action.recipeId as RecipeId, 1) > 0) sfx('craft');
      break;
    case 'research':
      if (engine.research(action.researchId as ResearchId)) sfx('research');
      else {
        ui.setCompanySubTab('research');
        ui.setTab('company');
      }
      break;
    case 'buyLand':
      if (engine.buyLand(action.landId as LandDefId)) sfx('land');
      else ui.setTab('land');
      break;
    default:
      break;
  }
  bumpGame();
}
