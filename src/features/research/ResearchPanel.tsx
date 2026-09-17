import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Stat } from '@/components/ui/Stat';
import { RESEARCH, RESEARCH_MAP, isResearchId, type ResearchDef, type ResearchId } from '@/game/data/research';
import { canResearch } from '@/game/engine/systems/research';
import { bumpGame, useGame } from '@/stores/gameStore';
import { formatNumber, formatRate } from '@/utils/format';

/** 研究ツリー。研究所が生む研究ポイントを使って研究する */
export function ResearchPanel() {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const points = state.research.points;
  const labs = state.facilities.filter((f) => f.typeId === 'research_lab').reduce((a, f) => a + f.count, 0);
  const defs = RESEARCH as readonly ResearchDef[];
  const done = defs.filter((r) => state.research.completed[r.id]);
  const available = defs.filter((r) => !state.research.completed[r.id] && r.requires.every((q) => state.research.completed[q]));
  const locked = defs.filter((r) => !state.research.completed[r.id] && !r.requires.every((q) => state.research.completed[q]));

  const render = (r: ResearchDef, kind: 'available' | 'locked' | 'done') => {
    const check = canResearch(state, r.id as ResearchId);
    const ratio = Math.min(1, points / r.cost);
    return (
      <Card key={r.id} flat locked={kind === 'locked'}>
        <div className="card__head">
          <Icon name={r.icon} size={32} fallback={r.name.slice(0, 2)} />
          <div className="row__grow">
            <div className="card__title">
              {r.name} {kind === 'done' && <Badge tone="profit">完了</Badge>}
            </div>
            <div className="card__sub">{r.description}</div>
            {r.requires.length > 0 && kind !== 'done' && (
              <div className="text-sub" style={{ fontSize: 12 }}>
                前提: {r.requires.map((q) => (isResearchId(q) ? RESEARCH_MAP[q].name : q)).join('・')}
              </div>
            )}
          </div>
          {kind !== 'done' && <span className="num text-research" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatNumber(r.cost, 'full')} RP</span>}
        </div>
        {kind === 'available' && (
          <div style={{ marginTop: 8 }}>
            <ProgressBar ratio={ratio} tone="research" />
            <div className="card__actions">
              <Button
                variant="primary"
                size="sm"
                disabled={!check.ok}
                onClick={() => {
                  if (engine.research(r.id as ResearchId)) bumpGame();
                }}
              >
                {check.ok ? '研究する' : `あと ${formatNumber(Math.ceil(r.cost - points), mode)} RP`}
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="list">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="研究ポイント" value={`${formatNumber(Math.floor(points), mode)} RP`} size="lg" tone="research" />
          <Stat label="増加 /秒" value={`${formatRate(derived.researchRate, mode)} RP`} tone={derived.researchRate > 0 ? 'profit' : 'default'} />
          <Stat label="研究所" value={`${labs}か所`} extra={labs === 0 ? 'FACTORY で研究所を建てよう' : undefined} />
          <Stat label="完了した研究" value={`${done.length} / ${defs.length}`} />
        </div>
      </Card>
      {available.length > 0 && <div className="section-title">研究できる</div>}
      <div className="grid grid--2">{available.map((r) => render(r, 'available'))}</div>
      {locked.length > 0 && <div className="section-title">前提が必要</div>}
      <div className="grid grid--2">{locked.map((r) => render(r, 'locked'))}</div>
      {done.length > 0 && <div className="section-title">完了</div>}
      <div className="grid grid--2">{done.map((r) => render(r, 'done'))}</div>
    </div>
  );
}
