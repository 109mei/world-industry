import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CONFIG } from '@/game/data/config';
import { nextCreditRank } from '@/game/data/contracts';
import { RESOURCE_MAP } from '@/game/data/resources';
import { isManagerHired } from '@/game/engine/systems/automation';
import { creditRankDef, isContractsUnlocked } from '@/game/engine/systems/contracts';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatDuration, formatMoney, formatNumber } from '@/utils/format';
import { sfx } from '@/utils/sfx';

/** 注文（期限つきの納品依頼）と信用ランク */
export function ContractsCard() {
  const { state, engine } = useGame();
  const openResource = useUiStore((s) => s.openResource);
  const mode = state.settings.numberFormat;
  if (!isContractsUnlocked(state)) {
    return (
      <Card flat>
        <div className="text-sub" style={{ fontSize: 12 }}>
          累計売上 {formatMoney(CONFIG.contracts.unlockEarned, 'full')} で取引先からの注文が届くようになります（現在 {formatMoney(state.company.totalEarned, mode)}）。
        </div>
      </Card>
    );
  }
  const rank = creditRankDef(state);
  const next = nextCreditRank(state.contracts.credit);
  const sales = isManagerHired(state, 'sales');
  const active = state.contracts.active;
  const deliver = (id: number) => {
    if (engine.deliverContract(id) > 0) sfx('sell');
    bumpGame();
  };
  return (
    <Card>
      <div className="row row--between" style={{ flexWrap: 'wrap', gap: 6 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className={`rank rank--${rank.rank}`}>{rank.rank}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>信用ランク {rank.rank}（{rank.label}）</div>
            <div className="text-sub num" style={{ fontSize: 12 }}>
              信用 {formatNumber(state.contracts.credit, 'full')}
              {next ? ` / 次のランク ${next.rank} まで ${formatNumber(next.min - state.contracts.credit, 'full')}` : '（最高ランク）'}・達成 {state.stats.contractsCompleted}・期限切れ {state.stats.contractsFailed}
            </div>
          </div>
        </div>
        <div className="text-sub" style={{ fontSize: 11 }}>
          不動産手数料 {(rank.estateFee * 100).toFixed(1)}%・輸送費 ×{rank.transportCost.toFixed(2)}・報酬 ×{rank.rewardMult.toFixed(2)}
        </div>
      </div>
      {next && (
        <div style={{ marginTop: 6 }}>
          <ProgressBar ratio={(state.contracts.credit - rank.min) / Math.max(1, next.min - rank.min)} tone="research" />
        </div>
      )}
      <div className="list" style={{ marginTop: 10 }}>
        {active.length === 0 && (
          <div className="text-sub" style={{ fontSize: 12 }}>
            いまは注文がありません。次の注文まで約 {formatDuration(Math.max(0, state.contracts.nextIn))}。
          </div>
        )}
        {active.map((c) => {
          const res = RESOURCE_MAP[c.resource];
          const have = Math.floor(state.inventory[c.resource] ?? 0);
          const remain = c.amount - c.delivered;
          const urgent = c.remaining < 120;
          return (
            <div key={c.id} className="contract">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <Icon name={res.icon} size={32} fallback={res.name.slice(0, 2)} />
                <div className="row__grow">
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {c.client} <span className="text-sub" style={{ fontWeight: 400 }}>から</span> {res.name}×{formatNumber(c.amount, 'full')}
                  </div>
                  <div className="text-sub num" style={{ fontSize: 12 }}>
                    報酬 <span className="text-profit">{formatMoney(c.reward, mode)}</span>・信用 +{c.credit}・残り {remain.toLocaleString('ja-JP')}（在庫 {have.toLocaleString('ja-JP')}）
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <ProgressBar ratio={c.delivered / c.amount} tone="profit" />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Badge tone={urgent ? 'loss' : 'default'}>{formatDuration(c.remaining)}</Badge>
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: 6 }}>
                <Button size="sm" variant="primary" disabled={have < 1} onClick={() => deliver(c.id)}>
                  納品する{have >= remain ? '（完了）' : have > 0 ? `（${Math.min(have, remain).toLocaleString('ja-JP')}個）` : ''}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openResource(c.resource)}>
                  {res.name}の入手方法
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    engine.declineContract(c.id);
                    bumpGame();
                  }}
                >
                  断る
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {sales && active.length > 0 && (
        <div className="text-profit" style={{ fontSize: 11, marginTop: 6 }}>
          販売係が在庫から自動で納品します。
        </div>
      )}
    </Card>
  );
}
