import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Stat } from '@/components/ui/Stat';
import { BRANCH_LABEL, RESEARCH_MAP, isResearchId, type ResearchBranch, type ResearchDef, type ResearchId } from '@/game/data/research';
import { canResearch } from '@/game/engine/systems/research';
import { bumpGame, useGame } from '@/stores/gameStore';
import { formatDuration, formatNumber } from '@/utils/format';
import { sfx } from '@/utils/sfx';
import { NODE_H, NODE_W, buildTreeLayout } from './treeLayout';
import { FACILITY_CATEGORY_LABEL, type FacilityCategory } from '@/game/data/facilities';

type Filter = 'all' | ResearchBranch;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ぜんぶ' },
  { id: 'industry', label: BRANCH_LABEL.industry },
  { id: 'logistics', label: BRANCH_LABEL.logistics },
  { id: 'energy', label: BRANCH_LABEL.energy },
  { id: 'management', label: BRANCH_LABEL.management },
  { id: 'tech', label: BRANCH_LABEL.tech },
  { id: 'service', label: BRANCH_LABEL.service },
];

/** 研究ツリー。前提条件を線でつないだ図で見せる */
export function ResearchTree() {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const layout = useMemo(() => buildTreeLayout(filter === 'all' ? null : filter), [filter]);
  const points = state.research.points;
  const done = (id: string) => state.research.completed[id] === true;
  const ready = (def: ResearchDef) => !done(def.id) && def.requires.every((q) => done(q));

  const total = layout.nodes.length;
  const finished = layout.nodes.filter((n) => done(n.def.id)).length;
  const sel = selected && isResearchId(selected) ? RESEARCH_MAP[selected] : null;
  const selCheck = sel ? canResearch(state, sel.id as ResearchId) : null;
  const perSec = derived.researchRate;

  return (
    <div className="list">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="研究ポイント" value={`${formatNumber(points, mode)} RP`} size="lg" tone="research" extra={`+${formatNumber(perSec, mode)}/秒`} />
          <Stat label="進み具合" value={`${finished} / ${total}`} extra={`${Math.round((finished / Math.max(1, total)) * 100)}%`} />
          <Stat label="研究所" value={`${state.facilities.filter((f) => f.typeId === 'research_lab').reduce((a, f) => a + f.count, 0)}棟`} />
          <Stat label="次の1件まで" value={perSec > 0 ? nextEta(state, perSec) : '—'} />
        </div>
        <ProgressBar ratio={finished / Math.max(1, total)} tone="research" size="lg" />
      </Card>

      <Segmented ariaLabel="研究の系統" items={FILTERS} value={filter} onChange={(v) => setFilter(v as Filter)} />

      <div className="tree" role="group" aria-label="研究ツリー">
        <div className="tree__canvas" style={{ width: layout.width, height: layout.height }}>
          <svg className="tree__lines" width={layout.width} height={layout.height} aria-hidden="true">
            {layout.edges.map((e) => {
              const mid = (e.x1 + e.x2) / 2;
              const state2 = done(e.to) ? 'done' : done(e.from) ? 'open' : 'locked';
              return (
                <path
                  key={`${e.from}->${e.to}`}
                  d={`M ${e.x1} ${e.y1} C ${mid} ${e.y1}, ${mid} ${e.y2}, ${e.x2} ${e.y2}`}
                  className={`tree__line tree__line--${state2}`}
                  fill="none"
                />
              );
            })}
          </svg>
          {layout.bands.map((b) => (
            <div key={b.branch} className="tree__band" style={{ top: b.top, height: b.height, width: layout.width }}>
              <span className="tree__band-label">{BRANCH_LABEL[b.branch]}</span>
            </div>
          ))}
          {layout.nodes.map((n) => {
            const isDone = done(n.def.id);
            const isReady = ready(n.def);
            const affordable = isReady && points >= n.def.cost;
            return (
              <button
                key={n.def.id}
                type="button"
                className={`tree__node${isDone ? ' tree__node--done' : isReady ? ' tree__node--ready' : ' tree__node--locked'}${affordable ? ' tree__node--affordable' : ''}`}
                style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
                onClick={() => setSelected(n.def.id)}
                aria-label={`${n.def.name} ${isDone ? '完了' : isReady ? '研究できる' : '前提が未完了'}`}
              >
                <Icon name={n.def.icon} size={22} fallback={n.def.name.slice(0, 2)} />
                <span className="tree__node-body">
                  <span className="tree__node-name">{n.def.name}</span>
                  <span className="tree__node-cost num">{isDone ? '完了' : `${formatNumber(n.def.cost, 'short')} RP`}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-dim" style={{ fontSize: 12 }}>
        横にスクロールすると先の研究が見えます。線でつながっているのが前提条件です。四角をタップすると詳しい効果が出ます。
      </p>

      {sel && (
        <Sheet open onClose={() => setSelected(null)} title={sel.name} icon={<Icon name={sel.icon} size={32} fallback={sel.name.slice(0, 2)} />}>
          <div className="sheet__section">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <Badge tone="research">{BRANCH_LABEL[(sel.branch ?? 'industry') as ResearchBranch]}</Badge>
              {done(sel.id) ? <Badge tone="profit">完了</Badge> : ready(sel) ? <Badge tone="power">研究できる</Badge> : <Badge>前提が未完了</Badge>}
            </div>
            <p className="card__sub">{sel.description}</p>
            <div className="stat-grid" style={{ marginTop: 8 }}>
              <Stat label="必要な研究ポイント" value={`${formatNumber(sel.cost, 'full')} RP`} size="lg" tone="research" />
              <Stat label="いま持っている" value={`${formatNumber(points, mode)} RP`} />
            </div>
            {!done(sel.id) && (
              <div style={{ marginTop: 8 }}>
                <ProgressBar ratio={Math.min(1, points / sel.cost)} tone="research" />
                {perSec > 0 && points < sel.cost && (
                  <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
                    このペースであと {formatDuration((sel.cost - points) / perSec)}
                  </div>
                )}
              </div>
            )}
          </div>
          {sel.requires.length > 0 && (
            <div className="sheet__section">
              <div className="field__label">前提の研究</div>
              <div className="list" style={{ gap: 4 }}>
                {sel.requires.map((q) => {
                  const d = isResearchId(q) ? RESEARCH_MAP[q] : null;
                  return (
                    <button key={q} type="button" className="row row--between tree__req" onClick={() => setSelected(q)}>
                      <span>{d?.name ?? q}</span>
                      <Badge tone={done(q) ? 'profit' : 'warn'}>{done(q) ? '完了' : 'まだ'}</Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="sheet__section">
            <div className="field__label">この研究で変わること</div>
            <ul className="list" style={{ gap: 4, paddingLeft: 18, margin: '4px 0' }}>
              {sel.effects.map((e, i) => (
                <li key={i} style={{ fontSize: 13 }}>
                  {effectText(e)}
                </li>
              ))}
              {sel.effects.length === 0 && <li style={{ fontSize: 13 }}>新しい案件や設備が受けられるようになります。</li>}
            </ul>
          </div>
          {!done(sel.id) && (
            <div className="sheet__section">
              <Button
                variant="primary"
                block
                disabled={!selCheck?.ok}
                onClick={() => {
                  if (engine.research(sel.id as ResearchId)) {
                    sfx('research');
                    bumpGame();
                    setSelected(null);
                  }
                }}
              >
                {selCheck?.ok ? '研究する' : (selCheck?.reason ?? '研究できません')}
              </Button>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

/** 次に研究できるもののうち、いちばん早く届くものまでの時間 */
function nextEta(state: ReturnType<typeof useGame>['state'], perSec: number): string {
  let best = Infinity;
  for (const id of Object.keys(RESEARCH_MAP)) {
    const def = RESEARCH_MAP[id as keyof typeof RESEARCH_MAP] as ResearchDef;
    if (state.research.completed[def.id]) continue;
    if (!def.requires.every((q) => state.research.completed[q])) continue;
    const left = Math.max(0, def.cost - state.research.points);
    best = Math.min(best, left / perSec);
  }
  return Number.isFinite(best) ? formatDuration(best) : '—';
}

function effectText(e: ResearchDef['effects'][number]): string {
  const pct = (m: number) => `${m >= 1 ? '+' : '-'}${Math.round(Math.abs(m - 1) * 100)}%`;
  switch (e.type) {
    case 'production':
      return e.category === 'all'
        ? `すべての施設の生産 ${pct(e.mult)}`
        : `${FACILITY_CATEGORY_LABEL[e.category as FacilityCategory] ?? e.category}の施設の生産 ${pct(e.mult)}`;
    case 'powerGeneration':
      return `発電量 ${pct(e.mult)}`;
    case 'renewableGeneration':
      return `再生可能エネルギーの出力 ${pct(e.mult)}`;
    case 'transportCapacity':
      return `輸送能力 ${pct(e.mult)}`;
    case 'transportCost':
      return `輸送費 ${pct(e.mult)}`;
    case 'survey':
      return `調査の費用 ${pct(e.costMult)}・時間 ${pct(e.timeMult)}`;
    case 'storage':
      return `倉庫容量 ${pct(e.mult)}`;
    case 'commercialIncome':
      return `商業施設の収入 ${pct(e.mult)}`;
    case 'demandRecovery':
      return `需要の回復 ${pct(e.mult)}`;
    case 'wage':
      return `人件費 ${pct(e.mult)}`;
    case 'devSpeed':
      return `事業の仕事量 ${pct(e.mult)}`;
    case 'productRevenue':
      return `製品の収入 ${pct(e.mult)}`;
    case 'shopSales':
      return `お店の売値 ${pct(e.mult)}`;
    case 'adCost':
      return `広告費 ${pct(e.mult)}`;
    case 'awarenessGain':
      return `知名度の上がり方 ${pct(e.mult)}`;
    case 'brandGain':
      return `ブランドの上がり方 ${pct(e.mult)}`;
    case 'researchRate':
      return `研究ポイント ${pct(e.mult)}`;
    case 'unlock':
      return `${e.text} を使えるようになる`;
    default:
      return '';
  }
}
