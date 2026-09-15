import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Sheet } from '@/components/ui/Sheet';
import { Sparkline } from '@/components/ui/Sparkline';
import { Stat } from '@/components/ui/Stat';
import { RESOURCE_CATEGORY_LABEL, RESOURCE_MAP } from '@/game/data/resources';
import { currentPrice, getMarketState } from '@/game/engine/systems/market';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatMoney, formatNumber, formatRate } from '@/utils/format';

/** 資源の詳細と売却操作 */
export function ResourceDetailSheet() {
  const id = useUiStore((s) => s.selectedResource);
  const close = useUiStore((s) => s.openResource);
  const { state, derived, engine } = useGame();
  const [keep, setKeep] = useState('0');
  const [qty, setQty] = useState('10');

  useEffect(() => {
    if (id) setKeep(String(state.market.autoSell[id]?.keep ?? 0));
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

  const sell = (n: number | 'all') => {
    engine.sell(id, n);
    bumpGame();
  };
  const applyAuto = (enabled: boolean) => {
    engine.setAutoSell(id, enabled, Number(keep) || 0);
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
      </div>

      {def.sellable && (
        <div className="sheet__section">
          <div className="section-title">市場</div>
          <div className="stat-grid stat-grid--3" style={{ marginTop: 8 }}>
            <Stat label="現在価格" value={formatMoney(price, 'full')} extra={`基準 ${formatMoney(def.basePrice, 'full')}`} />
            <Stat label="価格係数" value={`×${modifier.toFixed(2)}`} tone={modifier >= 1.05 ? 'profit' : modifier <= 0.95 ? 'loss' : 'default'} extra={`${modifier - 1 >= 0 ? '+' : ''}${((modifier - 1) * 100).toFixed(0)}%`} />
            <Stat label="全部売ると" value={formatMoney(price * Math.floor(amount), mode)} />
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
          <div className="row" style={{ marginTop: 8 }}>
            <label className="field" style={{ flex: 1 }}>
              <span className="field__label">残す量</span>
              <input className="input input--sm num" type="number" inputMode="numeric" min={0} value={keep} onChange={(e) => setKeep(e.target.value)} />
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
              自動売却中: {formatNumber(auto.keep, 'full')} を超えた分を売却
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
