import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TUTORIAL_STEPS } from '@/game/data/tutorial';
import { NAV_ITEMS } from '@/types/ui';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';

/** ホームの中のタブの名前（案内のボタンに出す） */
const HOME_SUB_LABEL: Record<string, string> = {
  home: 'ホーム',
  resources: '資源',
  sales: '取引',
  business: '事業',
  company: '会社',
};

/**
 * 最初の道案内。いまやること・なぜやるのか・そこへ行くボタン。
 *
 * compact を付けると、1行の細い帯になる。
 * 「クラフトの画面で作ります」と案内した先で案内そのものが消えてしまわないように、
 * ホーム以外の画面ではこの帯を出している。
 */
export function TutorialCard({ compact = false }: { compact?: boolean } = {}) {
  const { state, engine } = useGame();
  const setTab = useUiStore((s) => s.setTab);
  const setHomeSubTab = useUiStore((s) => s.setHomeSubTab);
  const tab = useUiStore((s) => s.tab);
  const homeSub = useUiStore((s) => s.homeSubTab);
  if (state.tutorial.completed || !state.settings.showTutorial) return null;
  const step = TUTORIAL_STEPS[state.tutorial.step];
  if (!step) return null;
  const progress = step.progress?.(state);
  const navName = NAV_ITEMS.find((n) => n.id === step.tab)?.labelJa ?? step.tab;
  // ホームの中のどのタブへ行くかまで出す（「ホームにいるのにホームへ行く」を避ける）
  const subName = step.homeSub ? HOME_SUB_LABEL[step.homeSub] : null;
  const goLabel = tab !== step.tab ? `${navName}へ行く` : subName ? `「${subName}」へ` : `${navName}へ行く`;
  const here = tab === step.tab && (!step.homeSub || step.homeSub === homeSub);
  const done = state.tutorial.step;
  const goThere = () => {
    if (step.homeSub) setHomeSubTab(step.homeSub);
    setTab(step.tab);
  };

  if (compact) {
    return (
      <button type="button" className="tutobar" onClick={goThere}>
        <span className="tutobar__step num">
          {done + 1}/{TUTORIAL_STEPS.length}
        </span>
        <span className="tutobar__body">
          <span className="tutobar__title">{step.title}</span>
          {step.where && <span className="tutobar__where">{step.where}</span>}
        </span>
        {!here && <span className="tutobar__go">{goLabel} ›</span>}
      </button>
    );
  }

  return (
    <Card className="tutorial">
      <div className="row row--between">
        <div className="tutorial__step">
          はじめかた {done + 1} / {TUTORIAL_STEPS.length}
        </div>
        <button
          type="button"
          className="tutorial__skip"
          onClick={() => {
            engine.updateSettings({ showTutorial: false });
            bumpGame();
          }}
        >
          あとで自分でやる
        </button>
      </div>
      <ProgressBar ratio={done / TUTORIAL_STEPS.length} tone="research" />
      <div className="tutorial__title" style={{ marginTop: 8 }}>
        {step.title}
      </div>
      <p className="tutorial__text">{step.text}</p>
      {step.where && (
        <div className="tutorial__where">
          <span className="tutorial__where-label">押す場所</span>
          <span className="tutorial__where-path">{step.where}</span>
        </div>
      )}
      {step.why && (
        <p className="tutorial__why">
          <Icon name="icon_ui_star" size={16} /> {step.why}
        </p>
      )}
      {progress && (
        <div style={{ marginTop: 10 }}>
          <ProgressBar ratio={progress.current / progress.target} tone="profit" />
          <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
            {progress.current} / {progress.target}
          </div>
        </div>
      )}
      {!here && (
        <div className="card__actions">
          <Button variant="primary" size="sm" onClick={goThere}>
            {goLabel} ›
          </Button>
        </div>
      )}
    </Card>
  );
}
