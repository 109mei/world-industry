import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Sheet } from '@/components/ui/Sheet';
import { Sparkline } from '@/components/ui/Sparkline';
import { Stat } from '@/components/ui/Stat';
import { RESOURCE_CATEGORY_LABEL, RESOURCE_MAP } from '@/game/data/resources';
import { resourceFlows } from '@/game/engine/analysis/flows';
import { currentPrice, demandFactor, eventPriceMultiplier, getMarketState, productionReserve, sellRevenue } from '@/game/engine/systems/market';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatDuration, formatMoney, formatPercent } from '@/utils/format';
import { formatQty, formatQtyRate, formatUnitPrice } from '@/utils/names';
import { sfx } from '@/utils/sfx';

/** 数字だけを残し、頭の 0 を落とす（「050」→「50」） */
function sanitize(v: string): string {
  const d = v.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  return d;
}

/** 入力欄の値を数値にする（空欄や不正な値は 0） */
function digits(v: string): number {
  const n = Number(sanitize(v));
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

/** 資源の詳細と売却操作 */
export function ResourceDetailSheet() {
  const id = useUiStore((s) => s.selectedResource);
  const close = useUiStore((s) => s.openResource);
  const { state, derived, engine } = useGame();
  const [keep, setKeep] = useState('0');
  const [qty, setQty] = useState('10');
  const [minPrice, setMinPrice] = useState('');

  useEffect(() => {
    if (id) {
      setKeep(String(state.market.autoSell[id]?.keep ?? 0));
      const r = state.market.autoSell[id]?.minPriceRatio;
      setMinPrice(r ? String(Math.round(r * 100)) : '');
    }
    // 選択が変わったときだけ初期化する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id) return null;
  const def = RESOURCE_MAP[id];
  const mode = state.settings.numberFormat;
  const amount = state.inventory[id] ?? 0;
  const price = currentPrice(state, id);
  const market = getMarketState(state, id);
  const auto = state.market.autoSell[id];
  // 本社の施設と自動クラフトが使うぶん（売るより先に取り置く）
  const reserved = productionReserve(state)[id] ?? 0;
  const prod = derived.production[id] ?? 0;
  const cons = derived.consumption[id] ?? 0;
  const modifier = market.modifier;
  const demand = demandFactor(state, id);
  const eventMult = eventPriceMultiplier(state, id);
  const allRevenue = sellRevenue(state, id, Math.floor(amount));

  const flows = resourceFlows(state, derived, id);
  const net = prod - cons;
  const untilEmpty = net < -1e-9 ? amount / -net : null;
  const untilFull = net > 1e-9 ? Math.max(0, derived.capacity - amount) / net : null;

  const sell = (n: number | 'all') => {
    if (engine.sell(id, n) > 0) sfx('sell');
    bumpGame();
  };
  const applyAuto = (enabled: boolean) => {
    engine.setAutoSell(id, enabled, digits(keep));
    const r = digits(minPrice);
    engine.setAutoSellMinPrice(id, r > 0 ? r / 100 : null);
    bumpGame();
  };

  return (
    <Sheet open onClose={() => close(null)} title={def.name} icon={<Icon name={def.icon} size={40} fallback={def.name.slice(0, 2)} />}>
      <p className="text-sub" style={{ fontSize: 13, marginTop: 6 }}>
        {def.description}
        <span className="badge" style={{ marginLeft: 6 }}>
          {RESOURCE_CATEGORY_LABEL[def.category]}
        </span>
      </p>

      <div className="sheet__section stat-grid stat-grid--4">
        <Stat label="所持量" value={formatQty(id, amount, mode)} extra={`容量 ${formatQty(id, derived.capacity, mode)}`} />
        <Stat label="生産 /秒" value={formatQtyRate(id, prod, mode)} tone={prod > 0 ? 'profit' : 'default'} />
        <Stat label="消費 /秒" value={formatQtyRate(id, -cons, mode)} tone={cons > 0 ? 'loss' : 'default'} />
        <Stat label="純増 /秒" value={formatQtyRate(id, prod - cons, mode)} tone={prod - cons > 0 ? 'profit' : prod - cons < 0 ? 'loss' : 'default'} />
      </div>
      <div style={{ marginTop: 8 }}>
        <ProgressBar ratio={amount / derived.capacity} tone="auto" size="lg" />
        <div className="row row--between text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
          {untilEmpty !== null ? <span className="text-loss">このままだと約 {formatDuration(untilEmpty)} で枯渇</span> : untilFull !== null ? <span>約 {formatDuration(untilFull)} で満杯</span> : <span>在庫は横ばい</span>}
          {(flows.imports > 0 || flows.exports > 0) && (
            <span>
              {/* formatQtyRate が符号を付けるので、ここで手書きの +/- を重ねない */}
              輸送 {flows.imports > 0 ? `本社へ ${formatQtyRate(id, flows.imports, mode)}/秒` : ''} {flows.exports > 0 ? `土地へ ${formatQtyRate(id, -flows.exports, mode)}/秒` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="sheet__section">
        <div className="section-title" style={{ marginTop: 0 }}>
          収支表
        </div>
        <div className="flows">
          <div>
            <div className="stat__label">作っている（毎秒）</div>
            {flows.producers.length === 0 && flows.recipesMaking.length === 0 && !flows.gather && <div className="text-dim" style={{ fontSize: 12 }}>作る手段がまだありません</div>}
            {flows.producers.slice(0, 6).map((f) => (
              <div key={`p:${f.landId}:${f.typeId}`} className="row num" style={{ fontSize: 12, gap: 6 }}>
                <Icon name={f.icon} size={16} />
                <span className="row__grow">{f.label}</span>
                <span className={f.rate > 0 ? 'text-profit' : 'text-dim'}>{formatQtyRate(id, f.rate, mode)}</span>
              </div>
            ))}
            {flows.gather && <div className="text-sub" style={{ fontSize: 12 }}>手作業: {flows.gather.label}（HOME）</div>}
            {flows.recipesMaking.map((r) => (
              <div key={r.id} className="text-sub" style={{ fontSize: 12 }}>
                クラフト: {r.name}（{Object.entries(r.inputs).map(([k, v]) => `${RESOURCE_MAP[k as keyof typeof RESOURCE_MAP].name}×${formatQty(k, v, mode)}`).join('・')}）
              </div>
            ))}
            {flows.producers.length === 0 && flows.facilitiesMaking.slice(0, 3).map((f) => (
              <div key={f.id} className="text-sub" style={{ fontSize: 12 }}>
                施設: {f.name}（FACTORY）
              </div>
            ))}
          </div>
          <div>
            <div className="stat__label">使っている（毎秒）</div>
            {flows.consumers.length === 0 && flows.recipesUsing.length === 0 && <div className="text-dim" style={{ fontSize: 12 }}>どこでも使っていません{def.sellable ? '（売って現金に）' : ''}</div>}
            {flows.consumers.slice(0, 6).map((f) => (
              <div key={`c:${f.landId}:${f.typeId}`} className="row num" style={{ fontSize: 12, gap: 6 }}>
                <Icon name={f.icon} size={16} />
                <span className="row__grow">{f.label}</span>
                <span className={f.rate > 0 ? 'text-loss' : 'text-dim'}>{formatQtyRate(id, -f.rate, mode)}</span>
              </div>
            ))}
            {flows.recipesUsing.slice(0, 4).map((r) => (
              <div key={r.id} className="text-sub" style={{ fontSize: 12 }}>
                クラフト: {r.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {def.sellable && (
        <div className="sheet__section">
          <div className="section-title">市場</div>
          <div className="stat-grid stat-grid--4" style={{ marginTop: 8 }}>
            <Stat label="現在価格" value={formatUnitPrice(id, price, 'full')} extra={`基準 ${formatUnitPrice(id, def.basePrice, 'full')}`} />
            <Stat label="相場" value={`×${(modifier * eventMult).toFixed(2)}`} tone={modifier * eventMult >= 1.05 ? 'profit' : modifier * eventMult <= 0.95 ? 'loss' : 'default'} extra={eventMult !== 1 ? `イベント ×${eventMult.toFixed(1)}` : `${modifier - 1 >= 0 ? '+' : ''}${((modifier - 1) * 100).toFixed(0)}%`} />
            <Stat label="需要" value={formatPercent(demand)} tone={demand >= 0.9 ? 'profit' : demand >= 0.6 ? 'warn' : 'loss'} extra={demand >= 0.9 ? '値崩れなし' : demand >= 0.6 ? 'やや飽和' : '飽和中'} />
            <Stat label="全部売ると" value={formatMoney(allRevenue, mode)} extra={amount >= 1 ? `平均 ${formatUnitPrice(id, allRevenue / Math.floor(amount), 'full')}` : undefined} />
          </div>
          <div style={{ marginTop: 6 }}>
            <ProgressBar ratio={demand} tone={demand >= 0.9 ? 'profit' : demand >= 0.6 ? 'warn' : 'loss'} label="需要" />
            <div className="text-sub" style={{ fontSize: 11, marginTop: 3 }}>
              売るほど需要が飽和して価格が下がり、時間で回復します（大量に売るときは分けて売ると有利）。
            </div>
          </div>
          <Sparkline values={market.history.slice(-40)} tone={modifier >= 1 ? 'profit' : 'loss'} />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <Button variant="sell" size="sm" disabled={amount < 1} onClick={() => sell(1)}>
              1個売る
            </Button>
            <Button variant="sell" size="sm" disabled={amount < 1} onClick={() => sell(10)}>
              10個
            </Button>
            <Button variant="sell" size="sm" disabled={amount < 1} onClick={() => sell(100)}>
              100個
            </Button>
            <Button variant="sell" size="sm" disabled={amount < 1} onClick={() => sell('all')}>
              全部売る
            </Button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input input--sm num" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(sanitize(e.target.value))} aria-label="売却数" style={{ maxWidth: 140 }} />
            <Button variant="secondary" size="sm" disabled={amount < 1 || digits(qty) < 1} onClick={() => sell(digits(qty))}>
              指定数を売る
            </Button>
          </div>

          <div className="section-title" style={{ marginTop: 14 }}>
            自動売却
          </div>
          <p className="text-sub" style={{ fontSize: 12, marginTop: 4 }}>
            在庫が「残す量」を超えた分を自動で売ります。大量に売ると価格が下がるので注意。
            <br />
            <strong>作るのに使うぶんは、売るより先に取り置かれます。</strong>
          </p>
          {reserved >= 1 && (
            <div className="text-warn" style={{ fontSize: 12, marginTop: 4 }}>
              いま本社で使っているぶんとして {formatQty(id, Math.ceil(reserved), 'full')} を取り置いています（残す量に上乗せ）。
            </div>
          )}
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: 1, minWidth: 120 }}>
              <span className="field__label">残す量</span>
              <input className="input input--sm num" type="number" inputMode="numeric" min={0} value={keep} onChange={(e) => setKeep(sanitize(e.target.value))} />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 140 }}>
              <span className="field__label">下限価格（基準の %・空欄でなし）</span>
              <div className="row" style={{ gap: 4 }}>
                <input className="input input--sm num" type="number" inputMode="numeric" min={0} placeholder="なし" value={minPrice} onChange={(e) => setMinPrice(sanitize(e.target.value))} style={{ flex: 1 }} />
                <button className="input__clear" type="button" aria-label="下限価格をなしにする" title="下限価格をなしにする" onClick={() => { setMinPrice(''); engine.setAutoSellMinPrice(id, null); bumpGame(); }}>
                  ×
                </button>
              </div>
            </label>
            <div style={{ alignSelf: 'flex-end' }}>
              {auto?.enabled ? (
                <Button variant="danger" size="sm" onClick={() => applyAuto(false)}>
                  自動売却を停止
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => applyAuto(true)}>
                  自動売却を開始
                </Button>
              )}
            </div>
          </div>
          {auto?.enabled && (
            <div className="text-profit" style={{ fontSize: 12, marginTop: 6 }}>
              自動売却中: {formatQty(id, auto.keep, 'full')} を超えた分を売却
              {auto.minPriceRatio ? `（相場が基準の ${Math.round(auto.minPriceRatio * 100)}% 未満なら待つ）` : ''}
            </div>
          )}
        </div>
      )}
      <div className="sheet__section text-dim" style={{ fontSize: 12 }}>
        累計入手 {formatQty(id, state.stats.totalObtained[id] ?? 0, mode)} ／ 累計売却 {formatQty(id, state.stats.totalSold[id] ?? 0, mode)}
      </div>
    </Sheet>
  );
}
