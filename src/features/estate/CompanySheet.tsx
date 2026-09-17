import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Sheet } from '@/components/ui/Sheet';
import { Sparkline } from '@/components/ui/Sparkline';
import { Stat } from '@/components/ui/Stat';
import { COMPANY_MAP, CONTROL_RATIO, POLICY_DEF, SECTOR_LABEL, isCompanyId, type CompanyPolicy } from '@/game/data/companies';
import { CONFIG } from '@/game/data/config';
import { PROPERTY_MAP, isPropertyId } from '@/game/data/properties';
import { companyProperties, propertyPrice } from '@/game/engine/systems/estate';
import { acquireCost, buyQuote, expandCost, liquidationValue, maxAffordableShares, sellQuote, sharesToControl } from '@/game/engine/systems/stocks';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate, formatNumber, formatPercent, formatRate } from '@/utils/format';
import { sfx } from '@/utils/sfx';

const PRESETS = [100, 1_000, 10_000, 100_000, 1_000_000];

/** 会社の詳細（株の売買・経営権の操作） */
export function CompanySheet() {
  const selected = useUiStore((s) => s.selectedCompany);
  const openCompany = useUiStore((s) => s.openCompany);
  const openProperty = useUiStore((s) => s.openProperty);
  const flyTo = useUiStore((s) => s.flyTo);
  const setMapSubTab = useUiStore((s) => s.setMapSubTab);
  const setTab = useUiStore((s) => s.setTab);
  const { state, derived, engine } = useGame();
  const [qty, setQty] = useState(100);
  const [confirmDissolve, setConfirmDissolve] = useState(false);
  const [confirmAcquire, setConfirmAcquire] = useState(false);
  const mode = state.settings.numberFormat;
  const id = selected && isCompanyId(selected) ? selected : null;
  if (!id) return null;
  const def = COMPANY_MAP[id];
  const s = state.stocks.companies[id];
  const rt = derived.companies[id];
  if (!s || !rt) return null;
  const close = () => {
    openCompany(null);
    setConfirmDissolve(false);
    setConfirmAcquire(false);
  };
  const evMult = derived.eventMods.stock;
  const control = rt.ownership + 1e-9 >= CONTROL_RATIO;
  const full = s.playerShares >= def.shares;
  const toControl = sharesToControl(state, id);
  const maxBuy = maxAffordableShares(state, id, evMult);
  const buyQ = Math.min(qty, def.shares - s.playerShares);
  const buy = buyQuote(state, id, buyQ, evMult);
  const sellQ = Math.min(qty, s.playerShares);
  const sell = sellQuote(state, id, sellQ, evMult);
  const canBuy = buyQ > 0 && state.company.cash >= buy.total && !s.dissolved;
  const props = companyProperties(state, id);
  const unrealized = s.playerShares > 0 ? (rt.price - s.avgCost) * s.playerShares : 0;
  const expand = expandCost(state, id);
  const acquire = acquireCost(state, id, evMult);
  const liquidation = liquidationValue(state, id);

  const title = (
    <span>
      {def.name}{' '}
      <span className="text-sub" style={{ fontSize: 12, fontWeight: 400 }}>
        {SECTOR_LABEL[def.sector].label}・{def.hq}
      </span>
    </span>
  );

  const act = (ok: boolean, sound: 'buy' | 'sell' | 'research' | 'land' = 'buy') => {
    if (ok) {
      sfx(sound);
      bumpGame();
    }
  };

  return (
    <Sheet open onClose={close} title={title} icon={<Icon name={SECTOR_LABEL[def.sector].icon} size={32} fallback={def.name.slice(0, 2)} />}>
      <div className="sheet__section">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <Badge tone="power">{SECTOR_LABEL[def.sector].label}</Badge>
          {s.dissolved && <Badge>解体済み</Badge>}
          {!s.dissolved && full && <Badge tone="profit">完全子会社</Badge>}
          {!s.dissolved && control && !full && <Badge tone="profit">経営権あり</Badge>}
          {!s.dissolved && !control && s.playerShares > 0 && <Badge tone="research">株主</Badge>}
          {evMult !== 1 && <Badge tone={evMult > 1 ? 'profit' : 'loss'}>相場 ×{evMult.toFixed(2)}</Badge>}
        </div>
        <p className="card__sub">{def.description}</p>
        {s.history.length >= 2 && !s.dissolved && (
          <div style={{ marginTop: 8 }}>
            <Sparkline values={s.history.slice(-120)} tone={rt.price >= (s.history[0] ?? rt.price) ? 'profit' : 'loss'} />
          </div>
        )}
        <div className="stat-grid" style={{ marginTop: 8 }}>
          <Stat label="株価" value={s.dissolved ? '-' : formatMoney(rt.price, rt.price >= 1_000_000 ? mode : 'full')} size="lg" extra={`理論値 ${formatMoney(rt.fundamental, mode)}・需給 ×${s.sentiment.toFixed(2)}`} />
          <Stat label="時価総額" value={formatMoney(rt.marketCap, mode)} extra={`発行 ${formatNumber(def.shares, mode)}株`} />
          <Stat label="利益 /時" value={formatMoney(rt.earningsPerHour, mode)} tone="profit" extra={`方針: ${POLICY_DEF[s.policy].label}（配当 ${formatPercent(POLICY_DEF[s.policy].payout, 0)}）`} />
          <Stat label="事業規模" value={`×${s.growth.toFixed(2)}`} extra={`内部留保 ${formatMoney(s.cash, mode)}・増設 ${s.expansions}回`} />
          <Stat label="あなたの持株" value={`${formatNumber(s.playerShares, mode)}株`} extra={`${formatPercent(rt.ownership, 2)}・評価額 ${formatMoney(rt.price * s.playerShares, mode)}`} />
          <Stat label="配当 /秒" value={formatMoneyRate(rt.dividendPerSec, mode)} tone={rt.dividendPerSec > 0 ? 'profit' : 'default'} extra={s.playerShares > 0 ? `平均取得 ${formatMoney(s.avgCost, 'full')}・評価損益 ${formatRate(unrealized, mode)}円` : '株を持つと配当が入る'} />
        </div>
        {!s.dissolved && !control && (
          <div style={{ marginTop: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
              <span className="text-sub">経営権（3分の2）まで</span>
              <span className="num">あと {formatNumber(toControl, mode)}株</span>
            </div>
            <ProgressBar ratio={rt.ownership / CONTROL_RATIO} tone="research" />
          </div>
        )}
      </div>

      {!s.dissolved && (
        <div className="sheet__section">
          <div className="section-title" style={{ margin: '0 0 6px' }}>
            株の売買
          </div>
          <div className="btn-row" style={{ flexWrap: 'wrap' }}>
            {PRESETS.map((n) => (
              <Button key={n} size="sm" variant={qty === n ? 'primary' : 'secondary'} onClick={() => setQty(n)}>
                {formatNumber(n, 'full')}
              </Button>
            ))}
            <Button size="sm" variant="secondary" disabled={toControl <= 0} onClick={() => setQty(toControl)}>
              経営権まで
            </Button>
            <Button size="sm" variant="secondary" disabled={maxBuy <= 0} onClick={() => setQty(maxBuy)}>
              買える最大
            </Button>
            {s.playerShares > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setQty(s.playerShares)}>
                全部売る
              </Button>
            )}
          </div>
          <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
            <span className="text-sub" style={{ fontSize: 12, minWidth: 40 }}>
              株数
            </span>
            <input className="input input--sm" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} aria-label="株数" />
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <Button variant="primary" disabled={!canBuy} onClick={() => act(engine.buyShares(id, buyQ) > 0)}>
              買う {buyQ > 0 ? `${formatNumber(buyQ, mode)}株 ${formatMoney(buy.total, mode)}` : ''}
            </Button>
            <Button variant="sell" disabled={sellQ <= 0} onClick={() => act(engine.sellShares(id, sellQ) > 0, 'sell')}>
              売る {sellQ > 0 ? `${formatNumber(sellQ, mode)}株 ${formatMoney(sell.total, mode)}` : ''}
            </Button>
          </div>
          <div className="text-dim" style={{ fontSize: 11, marginTop: 6 }}>
            買値 @{formatMoney(buy.unit, 'full')}・売値 @{formatMoney(sell.unit, 'full')}。大量に買うと株価が上がり、売ると下がる（時間で戻る）。所持金 {formatMoney(state.company.cash, mode)}。
          </div>
        </div>
      )}

      {!s.dissolved && control && (
        <div className="sheet__section">
          <div className="section-title" style={{ margin: '0 0 6px' }}>
            経営（持株 {formatPercent(rt.ownership, 1)}）
          </div>
          <div className="field">
            <span className="field__label">方針</span>
            <div className="btn-row" style={{ flexWrap: 'wrap' }}>
              {(Object.keys(POLICY_DEF) as CompanyPolicy[]).map((p) => (
                <Button key={p} size="sm" variant={s.policy === p ? 'primary' : 'secondary'} onClick={() => act(engine.setCompanyPolicy(id, p), 'research')} title={POLICY_DEF[p].description}>
                  {POLICY_DEF[p].label}
                </Button>
              ))}
            </div>
            <div className="text-sub" style={{ fontSize: 12, marginTop: 4 }}>
              {POLICY_DEF[s.policy].description}
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <Button disabled={state.company.cash < expand} onClick={() => act(engine.expandCompany(id), 'land')} title="事業規模 +10%。利益と株価が増える">
              増設 {formatMoney(expand, mode)}
            </Button>
            {!full && !confirmAcquire && (
              <Button variant="primary" disabled={state.company.cash < acquire} onClick={() => setConfirmAcquire(true)}>
                完全買収 {formatMoney(acquire, mode)}
              </Button>
            )}
            {!full && confirmAcquire && (
              <>
                <Button
                  variant="primary"
                  onClick={() => {
                    act(engine.acquireCompany(id), 'land');
                    setConfirmAcquire(false);
                  }}
                >
                  本当に買収する（残り {formatNumber(def.shares - s.playerShares, mode)}株、プレミアム {formatPercent(CONFIG.stocks.acquirePremium, 0)}）
                </Button>
                <Button size="sm" onClick={() => setConfirmAcquire(false)}>
                  やめる
                </Button>
              </>
            )}
            {!confirmDissolve && (
              <Button variant="danger" onClick={() => setConfirmDissolve(true)}>
                解体 {formatMoney(liquidation, mode)}
              </Button>
            )}
            {confirmDissolve && (
              <>
                <Button
                  variant="danger"
                  onClick={() => {
                    act(engine.dissolveCompany(id), 'sell');
                    setConfirmDissolve(false);
                  }}
                >
                  本当に解体する（{formatMoney(liquidation, mode)} を受け取り、会社は消える）
                </Button>
                <Button size="sm" onClick={() => setConfirmDissolve(false)}>
                  やめる
                </Button>
              </>
            )}
          </div>
          <div className="text-dim" style={{ fontSize: 11, marginTop: 6 }}>
            完全買収すると会社の物件をすべて受け取り、利益は全額あなたのものに。解体は資産を売り払って持株比率ぶんを受け取る（物件は市場に戻る）。
          </div>
        </div>
      )}

      {props.length > 0 && (
        <div className="sheet__section">
          <div className="section-title" style={{ margin: '0 0 6px' }}>
            所有している物件（{props.length}件・{formatMoney(rt.propertyValue, mode)}）
          </div>
          <div className="list">
            {props.map((p) =>
              isPropertyId(p) ? (
                <button
                  key={p}
                  type="button"
                  className="row"
                  style={{ justifyContent: 'space-between', textAlign: 'left', padding: '6px 0', borderBottom: '1px solid var(--border)' }}
                  onClick={() => {
                    close();
                    openProperty(p);
                  }}
                >
                  <span>{PROPERTY_MAP[p].name}</span>
                  <span className="num text-sub">{formatMoney(propertyPrice(state, p), mode)}</span>
                </button>
              ) : null,
            )}
          </div>
        </div>
      )}

      <div className="sheet__section">
        <Button
          size="sm"
          onClick={() => {
            close();
            setMapSubTab('map');
            setTab('map');
            bumpGame();
            flyTo(def.lat, def.lon, 11);
          }}
        >
          本社を地図で見る
        </Button>
      </div>
    </Sheet>
  );
}
