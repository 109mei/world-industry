import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TUTORIAL_STEPS } from '@/game/data/tutorial';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';

export function TutorialCard() {
  const { state } = useGame();
  const setTab = useUiStore((s) => s.setTab);
  const tab = useUiStore((s) => s.tab);
  if (state.tutorial.completed || !state.settings.showTutorial) return null;
  const step = TUTORIAL_STEPS[state.tutorial.step];
  if (!step) return null;
  const progress = step.progress?.(state);
  return (
    <Card className="tutorial">
      <div className="tutorial__step">
        チュートリアル {state.tutorial.step + 1} / {TUTORIAL_STEPS.length}
      </div>
      <div className="tutorial__title">{step.title}</div>
      <p className="tutorial__text">{step.text}</p>
      {progress && (
        <div style={{ marginTop: 10 }}>
          <ProgressBar ratio={progress.current / progress.target} tone="profit" />
          <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
            {progress.current} / {progress.target}
          </div>
        </div>
      )}
      {tab !== step.tab && (
        <div className="card__actions">
          <Button variant="primary" size="sm" onClick={() => setTab(step.tab)}>
            {step.tab.toUpperCase()} 画面へ
          </Button>
        </div>
      )}
    </Card>
  );
}
