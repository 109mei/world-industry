import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { COUNTRIES, COUNTRY_MAP, SHIP_MODES, SHIP_MODE_MAP, canUseMode, type ShipMode } from '@/game/data/trade';
import { countryEventMods } from '@/game/engine/systems/trade';
import type { CountryCode } from '@/game/data/lands';
import { RESOURCES, RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { bestMarkets, countryUnitPrice, isTradeUnlocked, pitchChance, quote, tradeState } from '@/game/engine/systems/trade';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatPercent } from '@/utils/format';
import { formatQty, formatUnitPrice, unitOf } from '@/utils/names';
import { sfx } from '@/utils/sfx';

type Sub = 'board' | 'deal' | 'ship';

const LOTS = [10, 100, 1_000];

/**
 * 貿易。
 *
 * 同じ品でも、産地では安く、足りない国では高い。
 * 安いところで仕入れ、運び、高いところで売る——それがこの画面の全部。
 * 運賃・関税・為替は押す前に全部見えるようにしてある（押してから驚かないように）。
 */
export function TradeBoard() {
  const { state, engine } = useGame();
  const mode = state.settings.numberFormat;
  const setTab = useUiStore((s) => s.setTab);
  const [sub, setSub] = useState<Sub>('board');
  const [resource, setResource] = useState<ResourceId>('iron');
  const [country, setCountry] = useState<CountryCode>('AU');
  const [ship, setShip] = useState<ShipMode>('ship');
  const [qty, setQty] = useState(100);
  const [ask, setAsk] = useState(0);
  const [message, setMessage] = useState('');

  /** 見たことのある品だけ扱う（知らない品の相場を見ても仕方がない） */
  const tradeables = useMemo(
    () => RESOURCES.filter((r) => r.sellable && (state.discovered[r.id as ResourceId] || (state.inventory[r.id as ResourceId] ?? 0) > 0)).map((r) => r.id as ResourceId),
    [state.discovered, state.inventory],
  );

  if (!isTradeUnlocked(state)) {
    return (
      <Card>
        <div className="card__head">
          <Icon name="icon_logistics_ship" size={34} fallback="貿" />
          <div className="row__grow">
            <div className="card__title">まだ海外とは取引できません</div>
            <div className="card__sub">土地をひとつ買うか、研究「物流」を終えると、国をまたいだ商売ができるようになります。</div>
          </div>
        </div>
        <div className="card__body">
          <Button size="sm" onClick={() => setTab('map')}>
            地図へ ›
          </Button>
        </div>
      </Card>
    );
  }

  const ts = tradeState(state);
  const list = tradeables.length > 0 ? tradeables : (['iron'] as ResourceId[]);
  const pick = list.includes(resource) ? resource : list[0];
  const best = bestMarkets(state, pick);
  const have = Math.floor(state.inventory[pick] ?? 0);
  const buyQ = quote(state, country, pick, qty, ship, 'import');
  const sellQ = quote(state, country, pick, Math.min(qty, have), ship, 'export');
  const localPrice = countryUnitPrice(state, country, pick);
  const askPrice = ask > 0 ? ask : Math.round(localPrice);
  const chance = pitchChance(localPrice, askPrice);

  const act = (fn: () => { ok: boolean; reason?: string }, okSound: 'buy' | 'sell') => {
    const r = fn();
    setMessage(r.ok ? '' : (r.reason ?? ''));
    if (r.ok) sfx(okSound);
    bumpGame();
  };

  return (
    <div className="list">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="輸送中の荷" value={`${ts.shipments.length}件`} extra={ts.shipments.length > 0 ? '着いたら知らせます' : undefined} />
          <Stat label="届いている商談" value={`${ts.offers.length}件`} tone={ts.offers.length > 0 ? 'profit' : 'default'} />
          <Stat label="貿易の売上" value={formatMoney(ts.earned, mode)} tone="profit" />
          <Stat label="運賃と関税" value={formatMoney(ts.freight + ts.duty, mode)} tone="loss" extra={`関税 ${formatMoney(ts.duty, mode)}`} />
        </div>
        <p className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
          同じ品でも、<strong>産地では安く、足りない国では高い</strong>。安いところで仕入れ、運び、高いところで売るのが商売です。
          運ぶには時間と運賃がかかり、輸入には関税もかかります。<strong>押す前に、かかる額は全部ここに出します。</strong>
        </p>
      </Card>

      <Segmented
        ariaLabel="貿易の表示"
        items={[
          { id: 'board', label: '相場' },
          { id: 'deal', label: '商談', badge: ts.offers.length },
          { id: 'ship', label: '輸送中', badge: ts.shipments.length },
        ]}
        value={sub}
        onChange={(v) => setSub(v as Sub)}
      />

      {sub === 'board' && (
        <>
          <Card>
            <div className="field__label">どの品を扱うか</div>
            <div className="cardfilter">
              {list.slice(0, 24).map((id) => (
                <button key={id} type="button" className={`cardfilter__btn${id === pick ? ' cardfilter__btn--on' : ''}`} onClick={() => setResource(id)}>
                  {RESOURCE_MAP[id].name}
                </button>
              ))}
            </div>
            <div className="row row--between" style={{ marginTop: 8 }}>
              <span className="text-sub" style={{ fontSize: 12 }}>
                いちばん安い <strong>{COUNTRY_MAP[best.cheapest].name}</strong> {formatUnitPrice(pick, best.low, mode)}
              </span>
              <span className="text-sub" style={{ fontSize: 12 }}>
                いちばん高い <strong>{COUNTRY_MAP[best.dearest].name}</strong> {formatUnitPrice(pick, best.high, mode)}
              </span>
            </div>
            <ProgressBar ratio={best.high > 0 ? best.low / best.high : 0} tone="profit" label={`差は ${(best.high / Math.max(1, best.low)).toFixed(2)}倍`} />
          </Card>

          <Card>
            <div className="field__label">どの国と取引するか</div>
            <div className="list" style={{ gap: 6 }}>
              {COUNTRIES.map((c) => {
                const p = countryUnitPrice(state, c.id, pick);
                const rel = p / Math.max(1, RESOURCE_MAP[pick].basePrice);
                return (
                  <button key={c.id} type="button" className={`packpick${c.id === country ? ' packpick--on' : ''}`} onClick={() => setCountry(c.id)}>
                    <div className="row__grow">
                      <div className="packpick__name">
                        {c.name}
                        <span className="text-sub num" style={{ fontSize: 11, marginLeft: 6 }}>
                          {formatUnitPrice(pick, p, mode)}
                        </span>
                      </div>
                      <div className="text-dim" style={{ fontSize: 11 }}>
                        {c.distanceKm.toLocaleString('ja-JP')}km・関税 {formatPercent(c.tariff * countryEventMods(state, c.id).tariff, 0)}・為替 ×{((ts.fx[c.id] ?? 1) * countryEventMods(state, c.id).fx).toFixed(2)}
                      </div>
                      {/* いまその国で起きていること（関税の引き上げ・通貨高・港の停滞） */}
                      {countryEventMods(state, c.id).labels.length > 0 && (
                        <div className="text-warn" style={{ fontSize: 11 }}>
                          {countryEventMods(state, c.id).labels.join('・')}
                        </div>
                      )}
                    </div>
                    <Badge tone={rel < 0.85 ? 'profit' : rel > 1.15 ? 'loss' : 'default'}>{rel < 0.85 ? '安い' : rel > 1.15 ? '高い' : 'ふつう'}</Badge>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="field__label">運ぶ手段</div>
            <div className="cardfilter">
              {SHIP_MODES.map((m) => {
                const use = canUseMode(m.id, COUNTRY_MAP[country].distanceKm, (RESOURCE_MAP[pick].weight ?? 0.01) * qty);
                return (
                  <button key={m.id} type="button" disabled={!use.ok} className={`cardfilter__btn${m.id === ship ? ' cardfilter__btn--on' : ''}`} onClick={() => setShip(m.id)}>
                    {m.name}
                  </button>
                );
              })}
            </div>
            <div className="text-dim" style={{ fontSize: 11, marginTop: 4 }}>{SHIP_MODE_MAP[ship].note}</div>

            <div className="field__label" style={{ marginTop: 10 }}>数量</div>
            <div className="cardfilter">
              {LOTS.map((n) => (
                <button key={n} type="button" className={`cardfilter__btn${qty === n ? ' cardfilter__btn--on' : ''}`} onClick={() => setQty(n)}>
                  {formatQty(pick, n, mode)}
                </button>
              ))}
              {have > 0 && (
                <button type="button" className={`cardfilter__btn${qty === have ? ' cardfilter__btn--on' : ''}`} onClick={() => setQty(have)}>
                  手持ち全部（{formatQty(pick, have, mode)}）
                </button>
              )}
            </div>

            <div className="tradequote">
              <div className="tradequote__col">
                <div className="tradequote__head">仕入れる（{COUNTRY_MAP[country].name}から買う）</div>
                {buyQ.ok ? (
                  <>
                    <div className="tradequote__row"><span>品物</span><span className="num">{formatMoney(buyQ.goods, mode)}</span></div>
                    <div className="tradequote__row"><span>運賃（{buyQ.tons.toFixed(2)}t）</span><span className="num">{formatMoney(buyQ.freight, mode)}</span></div>
                    <div className="tradequote__row"><span>関税 {formatPercent(COUNTRY_MAP[country].tariff * countryEventMods(state, country).tariff, 0)}{countryEventMods(state, country).tariff !== 1 ? `（いま ×${countryEventMods(state, country).tariff.toFixed(2)}）` : ''}</span><span className="num">{formatMoney(buyQ.duty, mode)}</span></div>
                    <div className="tradequote__row"><span>手数料</span><span className="num">{formatMoney(buyQ.fee, mode)}</span></div>
                    <div className="tradequote__row tradequote__row--total"><span>支払い</span><span className="num">{formatMoney(buyQ.total, mode)}</span></div>
                    <div className="text-dim num" style={{ fontSize: 11 }}>着くまで {buyQ.seconds}秒</div>
                  </>
                ) : (
                  <div className="text-sub" style={{ fontSize: 12 }}>{buyQ.reason}</div>
                )}
                <Button
                  size="sm"
                  block
                  variant="primary"
                  style={{ marginTop: 6 }}
                  disabled={!buyQ.ok || state.company.cash < buyQ.total}
                  onClick={() => act(() => engine.tradeImport(country, pick, qty, ship), 'buy')}
                >
                  仕入れる
                </Button>
              </div>

              <div className="tradequote__col">
                <div className="tradequote__head">売り渡す（{COUNTRY_MAP[country].name}へ売る）</div>
                {have <= 0 ? (
                  <div className="text-sub" style={{ fontSize: 12 }}>手持ちがありません</div>
                ) : sellQ.ok ? (
                  <>
                    <div className="tradequote__row"><span>品物（{formatQty(pick, Math.min(qty, have), mode)}）</span><span className="num">{formatMoney(sellQ.goods, mode)}</span></div>
                    <div className="tradequote__row"><span>運賃（{sellQ.tons.toFixed(2)}t）</span><span className="num">-{formatMoney(sellQ.freight, mode)}</span></div>
                    <div className="tradequote__row"><span>手数料</span><span className="num">-{formatMoney(sellQ.fee, mode)}</span></div>
                    <div className="tradequote__row tradequote__row--total"><span>受け取り</span><span className="num">{formatMoney(sellQ.total, mode)}</span></div>
                    <div className="text-dim num" style={{ fontSize: 11 }}>着くまで {sellQ.seconds}秒</div>
                  </>
                ) : (
                  <div className="text-sub" style={{ fontSize: 12 }}>{sellQ.reason}</div>
                )}
                <Button
                  size="sm"
                  block
                  variant="sell"
                  style={{ marginTop: 6 }}
                  disabled={have <= 0 || !sellQ.ok}
                  onClick={() => act(() => engine.tradeExport(country, pick, Math.min(qty, have), ship), 'sell')}
                >
                  売り渡す
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="card__title">値段を決めて売り込む</div>
            <p className="text-sub" style={{ fontSize: 12, marginTop: 4 }}>
              こちらから値段を提示します。<strong>相場より安く出すほど通りやすく、高く出すほど断られます。</strong>
              断られても品は減りませんが、その国はしばらく渋くなります。
            </p>
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
              <span className="text-sub" style={{ fontSize: 12 }}>1{unitOf(pick)}あたり</span>
              <input
                className="input num"
                type="number"
                min={1}
                value={askPrice}
                onChange={(e) => setAsk(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
                style={{ width: 120 }}
              />
              <span className="text-sub" style={{ fontSize: 12 }}>円（相場 {formatUnitPrice(pick, localPrice, mode)}）</span>
            </div>
            <ProgressBar ratio={chance} tone={chance > 0.6 ? 'profit' : chance > 0.3 ? 'research' : 'loss'} label={`通る見込み ${formatPercent(chance, 0)}`} />
            <Button
              size="sm"
              block
              style={{ marginTop: 8 }}
              disabled={have <= 0}
              onClick={() => {
                const r = engine.tradePitch(country, pick, Math.min(qty, have), askPrice, ship);
                setMessage(r.ok ? (r.accepted ? '' : '断られました。もう少し安くすると通ります') : (r.reason ?? ''));
                if (r.accepted) sfx('sell');
                bumpGame();
              }}
            >
              {formatQty(pick, Math.min(qty, have), mode)}を {formatUnitPrice(pick, askPrice, mode)}で売り込む
            </Button>
          </Card>
        </>
      )}

      {sub === 'deal' && (
        <Card>
          {ts.offers.length === 0 ? (
            <div className="text-sub" style={{ fontSize: 12 }}>
              いまは商談が届いていません。
              <strong>話を持ってくるのは、地図で見つけた実在の会社だけ</strong>です。
              地図へ出て建物を見つけ、営業しておくと、そのうち向こうから声がかかるようになります。
            </div>
          ) : (
            <div className="list" style={{ gap: 8 }}>
              {ts.offers.map((o) => {
                const def = RESOURCE_MAP[o.resource as ResourceId];
                const total = o.unitPrice * o.qty;
                const localP = countryUnitPrice(state, o.country as CountryCode, o.resource as ResourceId);
                const good = o.kind === 'buy' ? o.unitPrice > localP : o.unitPrice < localP;
                const haveIt = Math.floor(state.inventory[o.resource as ResourceId] ?? 0);
                return (
                  <div key={o.id} className="cardrow">
                    <Icon name={def?.icon ?? 'icon_ui_company'} size={30} fallback={def?.name.slice(0, 2) ?? ''} />
                    <div className="row__grow">
                      <div className="cardrow__name">
                        {o.company}
                        <Badge tone={good ? 'profit' : 'default'}>{good ? '条件が良い' : 'ふつう'}</Badge>
                      </div>
                      <div className="text-dim" style={{ fontSize: 11 }}>
                        {o.reason ? `${o.reason}、` : ''}{def?.name}を{o.kind === 'buy' ? '買いたい' : '売りたい'}
                      </div>
                      <div className="text-dim" style={{ fontSize: 11 }}>
                        {o.place}{o.distanceKm !== undefined ? `・本社から${o.distanceKm.toLocaleString('ja-JP')}km` : ''}
                      </div>
                      <div className="cardrow__prices num">
                        {formatQty(o.resource, o.qty, mode)} × {formatUnitPrice(o.resource, o.unitPrice, mode)} = {formatMoney(total, mode)}
                        <span className="text-dim">（相場 {formatUnitPrice(o.resource, localP, mode)}／残り {Math.ceil(o.expiresIn)}秒）</span>
                      </div>
                      {o.kind === 'buy' && haveIt < o.qty && (
                        <div className="text-loss" style={{ fontSize: 11 }}>在庫が {formatQty(o.resource, o.qty - haveIt, mode)} 足りません</div>
                      )}
                    </div>
                    <div className="cardrow__btns">
                      <Button size="sm" variant="primary" disabled={o.kind === 'buy' && haveIt < o.qty} onClick={() => act(() => engine.tradeAccept(o.id, ship), 'sell')}>
                        受ける
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { engine.tradeDecline(o.id); bumpGame(); }}>
                        断る
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {sub === 'ship' && (
        <Card>
          {ts.shipments.length === 0 ? (
            <div className="text-sub" style={{ fontSize: 12 }}>いま運んでいる荷はありません。</div>
          ) : (
            <div className="list" style={{ gap: 8 }}>
              {ts.shipments.map((s) => {
                const def = RESOURCE_MAP[s.resource as ResourceId];
                const c = COUNTRY_MAP[s.country as CountryCode];
                const m = SHIP_MODE_MAP[s.mode as ShipMode];
                const done = 1 - s.remaining / Math.max(1, s.totalSeconds);
                return (
                  <div key={s.id}>
                    <div className="row row--between">
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                        {s.kind === 'import' ? `${c?.name} → 本社` : `本社 → ${c?.name}`}
                        <span className="text-sub" style={{ fontWeight: 400, marginLeft: 6 }}>
                          {def?.name} {formatQty(s.resource, s.qty, mode)}・{m?.name}
                        </span>
                      </span>
                      <span className="num text-sub" style={{ fontSize: 12 }}>あと {Math.ceil(s.remaining)}秒</span>
                    </div>
                    <ProgressBar
                      ratio={done}
                      tone={s.kind === 'import' ? 'research' : 'profit'}
                      label={s.kind === 'import' ? `届いたら在庫 +${formatQty(s.resource, s.qty, mode)}` : `届いたら ${formatMoney(s.amount, mode)}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {message && (
        <Card flat>
          <div className="card__body text-sub">{message}</div>
        </Card>
      )}
    </div>
  );
}
