import { Card } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { RESEARCH } from '@/game/data/research';
import { useGame } from '@/stores/gameStore';
import { formatNumber } from '@/utils/format';
import { ResearchPanel } from './ResearchPanel';

/** 研究ツリー */
export function ResearchPage() {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
  const done = Object.keys(state.research.completed).length;
  return (
    <div className="page">
      <h1 className="page__title">
        研究<small>研究ポイントで生産と解放を進める</small>
      </h1>
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="研究ポイント" value={`${formatNumber(Math.floor(state.research.points), mode)} RP`} size="lg" tone="research" />
          <Stat label="RP /秒" value={`${derived.researchRate.toFixed(2)} RP`} tone={derived.researchRate > 0 ? 'research' : 'default'} />
          <Stat label="完了した研究" value={`${done} / ${RESEARCH.length}`} />
          <Stat label="累計 RP" value={`${formatNumber(Math.floor(state.research.totalPoints), mode)} RP`} />
        </div>
      </Card>
      <ResearchPanel />
    </div>
  );
}
