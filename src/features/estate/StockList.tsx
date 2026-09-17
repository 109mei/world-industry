import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Sparkline } from '@/components/ui/Sparkline';
import { COMPANIES, POLICY_DEF, SECTOR_LABEL, type CompanyDef } from '@/game/data/companies';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate, formatPercent } from '@/utils/format';

/** 株価の直近の変化率（履歴の最初と最後） */
function change(history: number[], current: number): number | null {
  if (history.length < 2) return null;
  const base = history[Math.max(0, history.length - 30)];
  if (!base) return null;
  return current / base - 1;
}

/** 会社の一覧（株価・持株・配当） */
export function StockList() {
  const { state, derived } = useGame();
  const openCompany = useUiStore((s) => s.openCompany);
  const mode = state.settings.numberFormat;
  const list = (COMPANIES as readonly CompanyDef[]).map((c) => ({ def: c, s: state.stocks.companies[c.id], rt: derived.companies[c.id] })).filter((x) => x.s && x.rt);
  const held = list.filter((x) => x.s.playerShares > 0 && !x.s.dissolved);
  const others = list.filter((x) => !(x.s.playerShares > 0 && !x.s.dissolved));

  const render = (x: (typeof list)[number]) => {
    const { def, s, rt } = x;
    const ch = change(s.history, rt.price);
    const control = rt.ownership + 1e-9 >= 2 / 3;
    const cls = ['card', 'card--click', control ? 'card--owned' : '', s.dissolved ? 'card--locked' : ''].filter(Boolean).join(' ');
    return (
      <button key={def.id} type="button" className={cls} onClick={() => openCompany(def.id)} style={{ textAlign: 'left' }}>
        <div className="card__head">
          <Icon name={SECTOR_LABEL[def.sector].icon} size={36} fallback={def.name.slice(0, 2)} />
          <div className="row__grow">
            <div className="card__title">
              {def.name}
              {control && <span className="badge badge--profit" style={{ marginLeft: 6 }}>{rt.ownership >= 1 - 1e-9 ? '完全子会社' : '経営権'}</span>}
              {s.dissolved && <span className="badge" style={{ marginLeft: 6 }}>解体済み</span>}
            </div>
            <div className="card__sub">
              {SECTOR_LABEL[def.sector].label}・{def.hq}・時価総額 {formatMoney(rt.marketCap, mode)}
              {s.playerShares > 0 && <> ・持株 {formatPercent(rt.ownership, 1)}（{POLICY_DEF[s.policy].label}）</>}
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 96 }}>
            <div className="num" style={{ fontWeight: 700 }}>
              {s.dissolved ? '-' : `${formatMoney(rt.price, 'full')}`}
            </div>
            {ch !== null && !s.dissolved && (
              <div className={`num ${ch >= 0 ? 'text-profit' : 'text-loss'}`} style={{ fontSize: 12 }}>
                {ch >= 0 ? '+' : ''}
                {(ch * 100).toFixed(1)}%
              </div>
            )}
            {s.playerShares > 0 && !s.dissolved && (
              <div className="num text-profit" style={{ fontSize: 12 }}>
                配当 {formatMoneyRate(rt.dividendPerSec, mode)}
              </div>
            )}
          </div>
        </div>
        {s.history.length >= 2 && !s.dissolved && (
          <div className="card__body" style={{ paddingTop: 0 }}>
            <Sparkline values={s.history.slice(-60)} tone={ch === null ? 'accent' : ch >= 0 ? 'profit' : 'loss'} />
          </div>
        )}
      </button>
    );
  };

  return (
    <>
      {held.length > 0 && (
        <>
          <div className="section-title">保有している株</div>
          <div className="grid grid--2">{held.map(render)}</div>
        </>
      )}
      <div className="section-title">上場企業（{others.length}社）</div>
      <div className="grid grid--2">{others.map(render)}</div>
      <Card flat>
        <div className="card__body text-sub" style={{ fontSize: 12 }}>
          株価 = 事業価値 ＋ 内部留保 ＋ 所有物件 を発行株数で割ったものに、需給（買うと上がり、売ると下がる。時間で戻る）と相場イベントを掛けたもの。配当は方針で決まり、残りは再投資されて株価が育ちます。発行株の3分の2を持つと経営権を得ます。
        </div>
      </Card>
    </>
  );
}
