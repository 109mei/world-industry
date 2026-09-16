import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { RESOURCES, type ResourceId } from '@/game/data/resources';
import { currentPrice, getMarketState } from '@/game/engine/systems/market';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatMoney } from '@/utils/format';

/** 市場の一覧（価格・変動・所持量・売却） */
export function MarketPanel() {
  const { state, engine } = useGame();
  const openResource = useUiStore((s) => s.openResource);
  const mode = state.settings.numberFormat;
  const rows = RESOURCES.filter((r) => r.sellable && state.discovered[r.id as ResourceId]);
  return (
    <Card>
      <p className="text-sub" style={{ fontSize: 12, marginBottom: 8 }}>
        価格は基準価格の 0.70〜1.40 倍で変動します（{Math.round(state.market.nextUpdateIn)}秒後に更新）。売るほど価格は下がり、時間で戻ります。
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>資源</th>
              <th>価格</th>
              <th>変動</th>
              <th>所持</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const id = r.id as ResourceId;
              const price = currentPrice(state, id);
              const m = getMarketState(state, id).modifier;
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
                  <td className={diff > 0.02 ? 'text-profit' : diff < -0.02 ? 'text-loss' : 'text-sub'}>
                    {diff >= 0 ? '+' : ''}
                    {(diff * 100).toFixed(0)}%
                  </td>
                  <td>{formatAmount(amount, mode)}</td>
                  <td>
                    <Button
                      variant="sell"
                      size="sm"
                      disabled={amount < 1}
                      onClick={() => {
                        engine.sell(id, 'all');
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
