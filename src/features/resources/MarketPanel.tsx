import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { RESOURCES, type ResourceId } from '@/game/data/resources';
import { currentPrice, demandFactor, eventPriceMultiplier, getMarketState } from '@/game/engine/systems/market';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatMoney, formatPercent } from '@/utils/format';
import { sfx } from '@/utils/sfx';

/** 市場の一覧（価格・変動・所持量・売却） */
export function MarketPanel() {
  const { state, engine } = useGame();
  const openResource = useUiStore((s) => s.openResource);
  const mode = state.settings.numberFormat;
  const rows = RESOURCES.filter((r) => r.sellable && state.discovered[r.id as ResourceId]);
  return (
    <Card>
      <p className="text-sub" style={{ fontSize: 12, marginBottom: 8 }}>
        価格はふだん基準価格の 0.70〜1.40 倍で変動します（{Math.round(state.market.nextUpdateIn)}秒後に更新）。
        <strong>GPU と暗号資産は値動きが荒く</strong>、これよりずっと広く（おおよそ 0.4〜4.8 倍まで）動きます。
        売るほど需要が飽和して価格が下がり、時間で回復します。相場高騰などのイベント中は価格が大きく変わります。
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>資源</th>
              <th>価格</th>
              <th className="hide-sm">相場</th>
              <th>需要</th>
              <th>所持</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const id = r.id as ResourceId;
              const price = currentPrice(state, id);
              const m = getMarketState(state, id).modifier * eventPriceMultiplier(state, id);
              const demand = demandFactor(state, id);
              const amount = Math.floor(state.inventory[id] ?? 0);
              const diff = m - 1;
              return (
                <tr key={id}>
                  <td>
                    <button className="row" onClick={() => openResource(id)} style={{ minHeight: 36 }}>
                      <Icon name={r.icon} size={22} fallback={r.name.slice(0, 2)} />
                      <span style={{ fontWeight: 700 }}>{r.name}</span>
                    </button>
                  </td>
                  <td>{formatMoney(price, 'full')}</td>
                  <td className={`hide-sm ${diff > 0.02 ? 'text-profit' : diff < -0.02 ? 'text-loss' : 'text-sub'}`}>
                    {diff >= 0 ? '+' : ''}
                    {(diff * 100).toFixed(0)}%
                  </td>
                  <td className={demand >= 0.9 ? 'text-profit' : demand >= 0.6 ? 'text-warn' : 'text-loss'}>{formatPercent(demand)}</td>
                  <td>{formatAmount(amount, mode)}</td>
                  <td>
                    <Button
                      variant="sell"
                      size="sm"
                      disabled={amount < 1}
                      onClick={() => {
                        if (engine.sell(id, 'all') > 0) sfx('sell');
                        bumpGame();
                      }}
                    >
                      全部売る
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
