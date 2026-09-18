import { useMemo, useState } from 'react';
import { BarChart } from '@/components/ui/Chart';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { BUSINESSES, BUSINESS_MAP } from '@/game/data/business';
import { SYNERGIES, SYNERGY_KEYS } from '@/game/data/synergies';
import { divisions, isBusinessUnlocked } from '@/game/engine/systems/business';
import { synergyReport } from '@/game/engine/systems/synergy';
import { useGame } from '@/stores/gameStore';

/** 「−32%」「+18%」のように読める形にする */
function pct(mult: number, lowerIsBetter: boolean): string {
  const diff = Math.round(Math.abs(mult - 1) * 1000) / 10;
  if (diff < 0.05) return '±0%';
  const down = mult < 1;
  const good = lowerIsBetter ? down : !down;
  return `${down ? '−' : '+'}${diff}%${good ? '' : ''}`;
}

/**
 * 事業どうしの連携。
 * 「いま何が効いているか」と「どの業種を持つと何が効くか」を並べて見せる。
 */
export function SynergyCard() {
  const { state } = useGame();
  const [showAll, setShowAll] = useState(false);
  const mine = divisions(state);
  const lines = useMemo(() => synergyReport(state), [state]);
  const haveKinds = useMemo(() => new Set(mine.map((d) => d.kind)), [mine]);

  const bars = lines.slice(0, 8).map((l) => ({
    label: l.label,
    value: Math.abs(l.mult - 1) * 100,
    tone: (l.lowerIsBetter ? (l.mult < 1 ? 'profit' : 'loss') : l.mult > 1 ? 'profit' : 'loss') as 'profit' | 'loss',
    note: pct(l.mult, l.lowerIsBetter),
  }));

  // まだ持っていない業種のうち、持つと効くもの
  const suggestions = SYNERGIES.filter((s) => !haveKinds.has(s.from))
    .filter((s) => isBusinessUnlocked(state, s.from) || showAll)
    .slice(0, showAll ? 40 : 4);

  return (
    <Card>
      <div className="card__head">
        <div className="row__grow">
          <div className="card__title">事業どうしの連携</div>
          <div className="card__sub">持っている業種が、会社ぜんたいに効いています</div>
        </div>
      </div>
      <div className="card__body">
        {bars.length > 0 ? (
          <>
            <BarChart data={bars} label="いま効いていること" format={() => ''} max={Math.max(10, ...bars.map((b) => b.value))} />
            <div className="synergy__why">
              {lines.slice(0, 4).map((l) => (
                <div key={l.key} className="synergy__whyrow">
                  <span className="synergy__whykey">{l.label}</span>
                  <span className="text-sub">
                    {l.from
                      .slice(0, 3)
                      .map((f) => f.name)
                      .join('・')}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sub" style={{ fontSize: 12 }}>
            まだ連携はありません。運送・広告代理・人材サービスなどを始めると、ほかの事業の費用が下がります。
          </p>
        )}

        {suggestions.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 10 }}>
              始めると効くもの
            </div>
            <div className="list">
              {suggestions.map((s) => {
                const def = BUSINESS_MAP[s.from];
                if (!def) return null;
                const locked = !isBusinessUnlocked(state, s.from);
                return (
                  <div key={s.from} className={`synergy__row${locked ? ' synergy__row--locked' : ''}`}>
                    <Icon name={def.icon} size={26} fallback={def.name.slice(0, 2)} />
                    <div className="row__grow">
                      <div className="synergy__name">
                        {def.name}
                        {locked && <span className="text-dim" style={{ fontSize: 11 }}>（研究がまだ）</span>}
                      </div>
                      <div className="synergy__effects">
                        {s.effects.map((e) => (
                          <span key={e.key} className="synergy__chip">
                            {SYNERGY_KEYS[e.key].label} {SYNERGY_KEYS[e.key].lowerIsBetter ? '−' : '+'}
                            {Math.round(e.max * 100)}%
                          </span>
                        ))}
                      </div>
                      <div className="synergy__note text-sub">{s.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" className="synergy__more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? '閉じる' : `ぜんぶ見る（${BUSINESSES.length}業種）`}
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
