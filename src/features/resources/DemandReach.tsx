import { ProgressBar } from '@/components/ui/ProgressBar';
import { DEMAND_SOURCES, demandPartOf } from '@/game/data/demand';
import { demandCounts, demandGrowth } from '@/game/engine/systems/market';
import { useGame } from '@/stores/gameStore';
import { formatNumber } from '@/utils/format';

/**
 * 「どこまで売れるか」の内訳。
 *
 * 市場は無限に買い取ってくれる場所ではない。
 * 本社のある町が受け止められる量には限りがあって、それを超えて出せば値が崩れる。
 * では増やすにはどうするか——を、ここで一目で分かるようにする。
 *
 * 数え方も効き方も data/demand.ts に置いてあり、実際に効く倍率と同じものを出している
 * （画面の説明と中身がずれる、ということが起きないように）。
 */
export function DemandReach() {
  const { state } = useGame();
  const mode = state.settings.numberFormat;
  const counts = demandCounts(state);
  const growth = demandGrowth(state);
  const max = 1 + DEMAND_SOURCES.reduce((a, s) => a + s.cap, 0);

  return (
    <div>
      <div className="reach__head" style={{ marginBottom: 4 }}>
        <span className="section-title">売れる量</span>
        <strong className="num">×{growth.toFixed(2)}</strong>
      </div>
      <ProgressBar ratio={Math.min(1, (growth - 1) / (max - 1))} tone={growth >= max * 0.8 ? 'profit' : 'accent'} />
      <p className="text-sub" style={{ fontSize: 12, margin: '6px 0 8px' }}>
        町の市場が受け止められる量には限りがあります。同じ品をおよそ<strong>25棟ぶん</strong>出したところで値が半分になり、
        そこから先はいくら作っても売り値が落ちるだけです。<strong>売り先を広げると、受け止められる量そのものが増えます</strong>
        （いまは {growth.toFixed(2)} 倍、目いっぱいで {max.toFixed(1)} 倍）。
      </p>
      <div className="reach">
        {DEMAND_SOURCES.map((s) => {
          const n = counts[s.id] ?? 0;
          const part = demandPartOf(s.id, n);
          const full = part >= s.cap - 1e-9;
          return (
            <div key={s.id} className="reach__item">
              <div className="reach__head">
                <span>{s.label}</span>
                <span className="num">
                  {formatNumber(n, mode)}
                  <span className="text-sub"> 件</span>
                </span>
              </div>
              <div className="reach__head">
                <span className="text-sub" style={{ fontSize: 11 }}>
                  1件につき +{Math.round(s.per * 100)}%
                </span>
                <strong className={full ? 'text-profit num' : 'num'}>
                  +{Math.round(part * 100)}%{full ? '（上限）' : ''}
                </strong>
              </div>
              <div className="reach__hint">{s.hint}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
