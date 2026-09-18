import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AreaChart } from '@/components/ui/Chart';
import { Icon } from '@/components/ui/Icon';
import { Stat } from '@/components/ui/Stat';
import { BUYABLE_RESOURCES, RESOURCE_MAP } from '@/game/data/resources';
import { buyCost, buyPrice, currentPrice, getMarketState, referencePrice, sellRevenue } from '@/game/engine/systems/market';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatMoney, formatPercent } from '@/utils/format';
import { sfx } from '@/utils/sfx';

const LOTS = [1, 10, 100, 1000];

/**
 * 転売。
 * 市場から仕入れて、相場が上がったところで売る。
 * 買うときは売値より2割高いので、そのまま売り返すと必ず損をする。
 */
export function TradePanel() {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const setTab = useUiStore((s) => s.setTab);
  const [message, setMessage] = useState('');
  const ids = BUYABLE_RESOURCES;
  const unlocked = ids.filter((id) => state.discovered[id] || state.research.completed.gpu_fab);

  if (unlocked.length === 0) {
    return (
      <Card>
        <div className="card__head">
          <Icon name="icon_ui_chart_trend" size={34} fallback="転" />
          <div className="row__grow">
            <div className="card__title">転売はまだできません</div>
            <div className="card__sub">研究「GPU量産」を終えると、GPUや暗号資産を市場から仕入れて、値上がりしたところで売れるようになります。</div>
          </div>
        </div>
        <div className="card__body">
          <Button size="sm" onClick={() => setTab('research')}>
            研究へ ›
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="list">
      <Card>
        <p className="text-sub" style={{ fontSize: 12 }}>
          仕入れ値は<strong>基準価格の1.25倍</strong>で、まとめて買うほど単価も上がるので、買ってすぐ売ると必ず損をします。
          安いときに仕入れて、<strong>品薄やバブルで跳ねたとき</strong>に売るのが転売です。
          たくさん買えば相場は上がり、たくさん売れば下がります（売った直後は売値が下がっているので、少し待つと戻ります）。
        </p>
      </Card>

      {unlocked.map((id) => {
        const def = RESOURCE_MAP[id];
        const m = getMarketState(state, id);
        const have = state.inventory[id] ?? 0;
        const sell = currentPrice(state, id) * (derived.modifiers.sellPrice ?? 1);
        const buy = buyPrice(state, id, derived.modifiers.sellPrice ?? 1);
        const ref = referencePrice(state, id);
        const base = def.basePrice;
        const ratio = ref / base;
        // 「全部売るといくらか」は需要曲線を積分した実額（1個目の値段 × 個数ではない）
        const allSell = sellRevenue(state, id, Math.floor(have)) * (derived.modifiers.sellPrice ?? 1);
        return (
          <Card key={id}>
            <div className="card__head">
              <Icon name={def.icon} size={32} fallback={def.name.slice(0, 2)} />
              <div className="row__grow">
                <div className="card__title">{def.name}</div>
                <div className="card__sub">{def.description}</div>
              </div>
              <Badge tone={ratio >= 1.25 ? 'profit' : ratio <= 0.8 ? 'loss' : 'default'}>
                {ratio >= 1.25 ? '高騰中' : ratio <= 0.8 ? '安い' : '平常'}
              </Badge>
            </div>
            <div className="card__body">
              <AreaChart
                values={m.history.slice(-48)}
                tone={ratio >= 1 ? 'profit' : 'loss'}
                label="相場のうごき"
                format={(v) => formatMoney(v, mode)}
              />
              <div className="stat-grid stat-grid--4" style={{ marginTop: 6 }}>
                <Stat label="売値（1個）" value={formatMoney(sell, mode)} tone="profit" />
                <Stat label="仕入れ値（1個）" value={formatMoney(buy, mode)} tone="loss" extra="基準の1.25倍" />
                <Stat
                  label="持っている"
                  value={`${formatAmount(have, mode)}個`}
                  extra={have > 0 ? `全部売ると ${formatMoney(allSell, mode)}` : undefined}
                />
                <Stat
                  label="基準からの差"
                  value={`${ratio >= 1 ? '+' : ''}${formatPercent(ratio - 1, 0)}`}
                  tone={ratio >= 1 ? 'profit' : 'loss'}
                />
              </div>

              <div className="field__label" style={{ marginTop: 8 }}>
                仕入れる
              </div>
              <div className="btn-row">
                {LOTS.map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const r = engine.buyResource(id, n);
                      setMessage(r.amount > 0 ? `${formatAmount(r.amount, mode)}個 ${formatMoney(r.cost, mode)}で仕入れました` : (r.reason ?? ''));
                      if (r.amount > 0) sfx('buy');
                      bumpGame();
                    }}
                  >
                    {n}個
                    <small className="btn__sub">{formatMoney(buyCost(state, id, n, derived.modifiers.sellPrice ?? 1), mode)}</small>
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const room = Math.max(0, derived.capacity - have);
                    const n = Math.floor(Math.min(room, state.company.cash / Math.max(1, buy)));
                    const r = engine.buyResource(id, n);
                    setMessage(r.amount > 0 ? `${formatAmount(r.amount, mode)}個 仕入れました` : (r.reason ?? ''));
                    if (r.amount > 0) sfx('buy');
                    bumpGame();
                  }}
                >
                  買えるだけ
                </Button>
              </div>

              <div className="field__label" style={{ marginTop: 8 }}>
                売る
              </div>
              <div className="btn-row">
                {LOTS.map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant="secondary"
                    disabled={have < 1}
                    onClick={() => {
                      const got = engine.sell(id, Math.min(n, Math.floor(have)));
                      setMessage(got > 0 ? `${formatMoney(got, mode)} で売りました` : '売れませんでした');
                      if (got > 0) sfx('sell');
                      bumpGame();
                    }}
                  >
                    {n}個
                    {have >= 1 && (
                      <small className="btn__sub">
                        {formatMoney(sellRevenue(state, id, Math.min(n, Math.floor(have))) * (derived.modifiers.sellPrice ?? 1), mode)}
                      </small>
                    )}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="primary"
                  disabled={have < 1}
                  onClick={() => {
                    const got = engine.sell(id, 'all');
                    setMessage(got > 0 ? `${formatMoney(got, mode)} で全部売りました` : '売れませんでした');
                    if (got > 0) sfx('sell');
                    bumpGame();
                  }}
                >
                  全部売る
                </Button>
              </div>
            </div>
          </Card>
        );
      })}

      {message && (
        <Card flat>
          <div className="card__body text-sub">{message}</div>
        </Card>
      )}
    </div>
  );
}
