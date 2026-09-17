import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Sheet } from '@/components/ui/Sheet';
import { Sparkline } from '@/components/ui/Sparkline';
import { Stat } from '@/components/ui/Stat';
import { RESOURCE_CATEGORY_LABEL, RESOURCE_MAP } from '@/game/data/resources';
import { resourceFlows } from '@/game/engine/analysis/flows';
import { isManagerHired } from '@/game/engine/systems/automation';
import { currentPrice, demandFactor, eventPriceMultiplier, getMarketState, sellRevenue } from '@/game/engine/systems/market';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatDuration, formatMoney, formatNumber, formatPercent, formatRate } from '@/utils/format';
import { sfx } from '@/utils/sfx';

/** 資源の詳細と売却操作 */
export function ResourceDetailSheet() {
  const id = useUiStore((s) => s.selectedResource);
  const close = useUiStore((s) => s.openResource);
  const { state, derived, engine } = useGame();
  const [keep, setKeep] = useState('0');
  const [qty, setQty] = useState('10');
  const [target, setTarget] = useState('0');
  const [minPrice, setMinPrice] = useState('');

  useEffect(() => {
    if (id) {
      setKeep(String(state.market.autoSell[id]?.keep ?? 0));
      setTarget(String(state.automation.craftTargets[id] ?? 0));
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
  const craftManager = isManagerHired(state, 'craft');
  const salesManager = isManagerHired(state, 'sales');
  const craftTarget = state.automation.craftTargets[id] ?? 0;

  const sell = (n: number | 'all') => {
    if (engine.sell(id, n) > 0) sfx('sell');
    bumpGame();
  };
  const applyAuto = (enabled: boolean) => {
    engine.setAutoSell(id, enabled, Number(keep) || 0);
    const r = Number(minPrice);
    engine.setAutoSellMinPrice(id, salesManager && r > 0 ? r / 100 : null);
    bumpGame();
  };
  const applyTarget = () => {
    engine.setCraftTarget(id, Number(target) || 0);
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
        <Stat label="所持量" value={formatAmount(amount, mode)} extra={`容量 ${formatAmount(derived.capacity, mode)}`} />
        <Stat label="生産 /秒" value={formatRate(prod, mode)} tone={prod > 0 ? 'profit' : 'default'} />
        <Stat label="消費 /秒" value={formatRate(-cons, mode)} tone={cons > 0 ? 'loss' : 'default'} />
        <Stat label="純増 /秒" value={formatRate(prod - cons, mode)} tone={prod - cons > 0 ? 'profit' : prod - cons < 0 ? 'loss' : 'default'} />
      </div>
      <div style={{ marginTop: 8 }}>
        <ProgressBar ratio={amount / derived.capacity} tone="auto" size="lg" />
        <div className="row row--between text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
          {untilEmpty !== null ? <span className="text-loss">このままだと約 {formatDuration(untilEmpty)} で枯渇</span> : untilFull !== null ? <span>約 {formatDuration(untilFull)} で満杯</span> : <span>在庫は横ばい</span>}
          {(flows.imports > 0 || flows.exports > 0) && (
            <span>
              輸送 {flows.imports > 0 ? `本社へ +${formatRate(flows.imports, mode)}/秒` : ''} {flows.exports > 0 ? `土地へ -${formatRate(flows.exports, mode)}/秒` : ''}
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
            <div className="stat__label">作っている（個/秒）</div>
            {flows.producers.length === 0 && flows.recipesMaking.length === 0 && !flows.gather && <div className="text-dim" style={{ fontSize: 12 }}>作る手段がまだありません</div>}
            {flows.producers.slice(0, 6).map((f) => (
              <div key={`p:${f.landId}:${f.typeId}`} className="row num" style={{ fontSize: 12, gap: 6 }}>
                <Icon name={f.icon} size={16} />
                <span className="row__grow">{f.label}</span>
                <span className={f.rate > 0 ? 'text-profit' : 'text-dim'}>{formatRate(f.rate, mode)}</span>
              </div>
            ))}
            {flows.gather && <div className="text-sub" style={{ fontSize: 12 }}>手作業: {flows.gather.label}（HOME）</div>}
            {flows.recipesMaking.map((r) => (
              <div key={r.id} className="text-sub" style={{ fontSize: 12 }}>
                クラフト: {r.name}（{Object.entries(r.inputs).map(([k, v]) => `${RESOURCE_MAP[k as keyof typeof RESOURCE_MAP].name}×${v}`).join('・')}）
              </div>
            ))}
            {flows.producers.length === 0 && flows.facilitiesMaking.slice(0, 3).map((f) => (
              <div key={f.id} className="text-sub" style={{ fontSize: 12 }}>
                施設: {f.name}（FACTORY）
              </div>
            ))}
          </div>
          <div>
            <div className="stat__label">使っている（個/秒）</div>
            {flows.consumers.length === 0 && flows.recipesUsing.length === 0 && <div className="text-dim" style={{ fontSize: 12 }}>どこでも使っていません{def.sellable ? '（売って現金に）' : ''}</div>}
            {flows.consumers.slice(0, 6).map((f) => (
              <div key={`c:${f.landId}:${f.typeId}`} className="row num" style={{ fontSize: 12, gap: 6 }}>
                <Icon name={f.icon} size={16} />
                <span className="row__grow">{f.label}</span>
                <span className={f.rate > 0 ? 'text-loss' : 'text-dim'}>{formatRate(-f.rate, mode)}</span>
              </div>
            ))}
            {flows.recipesUsing.slice(0, 4).map((r) => (
              <div key={r.id} className="text-sub" style={{ fontSize: 12 }}>
                クラフト: {r.name}
              </div>
            ))}
          </div>
        </div>
        {(craftManager || craftTarget > 0) && flows.recipesMaking.length > 0 && (
          <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 1 }}>
              <span className="field__label">クラフト係がキープする量（0 で解除）</span>
              <input className="input input--sm num" type="number" inputMode="numeric" min={0} value={target} onChange={(e) => setTarget(e.target.value)} />
            </label>
            <Button variant="primary" size="sm" onClick={applyTarget}>
              設定
            </Button>
          </div>
        )}
      </div>

      {def.sellable && (
        <div className="sheet__section">
          <div className="section-title">市場</div>
          <div className="stat-grid stat-grid--4" style={{ marginTop: 8 }}>
            <Stat label="現在価格" value={formatMoney(price, 'full')} extra={`基準 ${formatMoney(def.basePrice, 'full')}`} />
            <Stat label="相場" value={`×${(modifier * eventMult).toFixed(2)}`} tone={modifier * eventMult >= 1.05 ? 'profit' : modifier * eventMult <= 0.95 ? 'loss' : 'default'} extra={eventMult !== 1 ? `イベント ×${eventMult.toFixed(1)}` : `${modifier - 1 >= 0 ? '+' : ''}${((modifier - 1) * 100).toFixed(0)}%`} />
            <Stat label="需要" value={formatPercent(demand)} tone={demand >= 0.9 ? 'profit' : demand >= 0.6 ? 'warn' : 'loss'} extra={demand >= 0.9 ? '値崩れなし' : demand >= 0.6 ? 'やや飽和' : '飽和中'} />
            <Stat label="全部売ると" value={formatMoney(allRevenue, mode)} extra={amount >= 1 ? `平均 ${formatMoney(allRevenue / Math.floor(amount), 'full')}/個` : undefined} />
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
            <input className="input input--sm num" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} aria-label="売却数" style={{ maxWidth: 140 }} />
            <Button variant="secondary" size="sm" disabled={amount < 1 || !(Number(qty) > 0)} onClick={() => sell(Math.floor(Number(qty)))}>
              指定数を売る
            </Button>
          </div>

          <div className="section-title" style={{ marginTop: 14 }}>
            自動売却
          </div>
          <p className="text-sub" style={{ fontSize: 12, marginTop: 4 }}>
            在庫が「残す量」を超えた分を自動で売ります。大量に売ると価格が下がるので注意。
          </p>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: 1, minWidth: 120 }}>
              <span className="field__label">残す量</span>
              <input className="input input--sm num" type="number" inputMode="numeric" min={0} value={keep} onChange={(e) => setKeep(e.target.value)} />
            </label>
            {salesManager && (
              <label className="field" style={{ flex: 1, minWidth: 120 }}>
                <span className="field__label">下限価格（基準の %）</span>
                <input className="input input--sm num" type="number" inputMode="numeric" min={0} placeholder="なし" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              </label>
            )}
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
              自動売却中: {formatNumber(auto.keep, 'full')} を超えた分を売却
              {salesManager && auto.minPriceRatio ? `（相場が基準の ${Math.round(auto.minPriceRatio * 100)}% 未満なら待つ）` : ''}
            </div>
          )}
          {!salesManager && (
            <div className="text-dim" style={{ fontSize: 11, marginTop: 4 }}>
              販売係を雇うと「下限価格」と注文の自動納品が使えます（COMPANY → 自動化）。
            </div>
          )}
        </div>
      )}
      <div className="sheet__section text-dim" style={{ fontSize: 12 }}>
        累計入手 {formatAmount(state.stats.totalObtained[id] ?? 0, mode)} ／ 累計売却 {formatAmount(state.stats.totalSold[id] ?? 0, mode)}
      </div>
    </Sheet>
  );
}
