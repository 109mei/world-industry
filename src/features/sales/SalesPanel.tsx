import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Stat } from '@/components/ui/Stat';
import { PITCH_COOLDOWN, SECTOR_NEEDS, pitchCost, relationTier } from '@/game/data/clients';
import { COMPANY_MAP, SECTOR_LABEL, isCompanyId } from '@/game/data/companies';
import { RESOURCE_MAP } from '@/game/data/resources';
import { creditRankDef } from '@/game/engine/systems/contracts';
import { clientList, isSalesUnlocked, pitchCooldownLeft, salesState, wantedBy } from '@/game/engine/systems/sales';
import { bumpGame, useGame } from '@/stores/gameStore';
import { formatAmount, formatDuration, formatMoney, formatPercent } from '@/utils/format';
import { sfx } from '@/utils/sfx';

/** 営業・契約・納品 */
export function SalesPanel() {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const [message, setMessage] = useState('');
  const [showAll, setShowAll] = useState(false);
  const sales = salesState(state);
  const rank = creditRankDef(state);
  const now = Date.now();
  const unlocked = isSalesUnlocked(state);

  if (!unlocked) {
    return (
      <Card>
        <div className="card__head">
          <Icon name="icon_office_contract" size={34} fallback="営業" />
          <div className="row__grow">
            <div className="card__title">取引はまだできません</div>
            <div className="card__sub">資源を売って累計売上が 5,000円 になると、会社に営業できるようになります。</div>
          </div>
        </div>
      </Card>
    );
  }

  const list = clientList(state);
  const shown = showAll ? list : list.slice(0, 8);
  const cost = pitchCost(derived.assets);

  return (
    <div className="list">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="信用ランク" value={rank.rank} extra={rank.label} tone="research" />
          <Stat label="契約" value={`${sales.deals.length}件`} extra={`商談 ${sales.offers.length}件`} />
          <Stat label="納品した回数" value={`${Object.values(sales.clients).reduce((a, c) => a + c.deliveries, 0)}回`} />
          <Stat label="営業の費用" value={formatMoney(cost, mode)} extra={`1社 ${PITCH_COOLDOWN}秒に1回`} />
        </div>
        <div className="card__body text-sub" style={{ fontSize: 12 }}>
          会社に営業して商談をもらい、条件を受けると契約になります。期限までに納品すると代金・信用・関係が上がり、落とすと下がります。関係が深まるほど大口・高値の話が来ます。
        </div>
      </Card>

      {message && (
        <Card flat>
          <div className="card__body text-sub">{message}</div>
        </Card>
      )}

      {sales.offers.length > 0 && <div className="section-title">商談（受けるか断る）</div>}
      {sales.offers.map((o) => {
        const def = isCompanyId(o.companyId) ? COMPANY_MAP[o.companyId] : null;
        const res = RESOURCE_MAP[o.resource];
        const total = o.amountPer * o.unitPrice * o.deliveries;
        return (
          <Card key={o.id}>
            <div className="card__head">
              <Icon name={res.icon} size={32} fallback={res.name.slice(0, 2)} />
              <div className="row__grow">
                <div className="card__title">
                  {def?.name ?? o.companyId} — {res.name} {formatAmount(o.amountPer, mode)}個 × {o.deliveries}回
                </div>
                <div className="card__sub">
                  単価 {formatMoney(o.unitPrice, mode)}（相場比 +{formatPercent(o.unitPrice / Math.max(1, res.basePrice) - 1, 0)}）・納期 {formatDuration(o.intervalSec)}ごと
                </div>
              </div>
              <Badge tone="profit">合計 {formatMoney(total, mode)}</Badge>
            </div>
            <div className="card__body">
              <div className="btn-row">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (engine.acceptOffer(o.id)) {
                      sfx('buy');
                      bumpGame();
                    }
                  }}
                >
                  契約する
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    engine.declineOffer(o.id);
                    bumpGame();
                  }}
                >
                  断る
                </Button>
                <span className="text-dim" style={{ fontSize: 11 }}>
                  返事の期限 {formatDuration(Math.max(0, o.expiresIn))}
                </span>
              </div>
            </div>
          </Card>
        );
      })}

      {sales.deals.length > 0 && <div className="section-title">契約中</div>}
      {sales.deals.map((d) => {
        const def = isCompanyId(d.companyId) ? COMPANY_MAP[d.companyId] : null;
        const res = RESOURCE_MAP[d.resource];
        const have = state.inventory[d.resource] ?? 0;
        const canDeliver = have + 1e-9 >= d.amountPer;
        return (
          <Card key={d.id}>
            <div className="card__head">
              <Icon name={res.icon} size={32} fallback={res.name.slice(0, 2)} />
              <div className="row__grow">
                <div className="card__title">
                  {def?.name ?? d.companyId} — {res.name} {formatAmount(d.amountPer, mode)}個
                </div>
                <div className="card__sub">
                  単価 {formatMoney(d.unitPrice, mode)}・残り {d.deliveriesLeft}回・在庫 {formatAmount(have, mode)}
                </div>
              </div>
              {d.missed > 0 && <Badge tone="warn">落とした {d.missed}回</Badge>}
            </div>
            <div className="card__body">
              <ProgressBar
                ratio={1 - d.remaining / d.intervalSec}
                tone={d.remaining < d.intervalSec * 0.25 ? 'loss' : 'research'}
                label={`次の納期まで ${formatDuration(Math.max(0, d.remaining))}`}
              />
              <div className="btn-row" style={{ marginTop: 8 }}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canDeliver}
                  onClick={() => {
                    if (engine.deliverDeal(d.id)) {
                      sfx('sell');
                      bumpGame();
                    }
                  }}
                >
                  納品する（{formatMoney(d.amountPer * d.unitPrice, mode)}）
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (engine.cancelDeal(d.id)) bumpGame();
                  }}
                >
                  打ち切る
                </Button>
                {!canDeliver && (
                  <span className="text-sub" style={{ fontSize: 12 }}>
                    あと {formatAmount(d.amountPer - have, mode)}個 足りません
                  </span>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <div className="section-title">取引先</div>
      <div className="grid grid--2">
        {shown.map(({ def, client }) => {
          const tier = relationTier(client.relation);
          const wait = pitchCooldownLeft(state, def.id, now);
          const wants = wantedBy(state, def);
          const needs = SECTOR_NEEDS[def.sector] ?? [];
          return (
            <Card key={def.id} flat>
              <div className="card__head">
                <Icon name={SECTOR_LABEL[def.sector].icon} size={30} fallback={def.name.slice(0, 2)} />
                <div className="row__grow">
                  <div className="card__title">{def.name}</div>
                  <div className="card__sub">
                    {SECTOR_LABEL[def.sector].label}・{def.hq}
                  </div>
                </div>
                <Badge tone={client.relation >= 45 ? 'profit' : 'default'}>{tier.label}</Badge>
              </div>
              <div className="card__body">
                <ProgressBar ratio={client.relation / 100} tone="profit" label={`関係 ${Math.round(client.relation)} / 100`} />
                <div className="text-sub" style={{ fontSize: 12, margin: '6px 0' }}>
                  欲しがるもの: {needs.map((r) => RESOURCE_MAP[r].name).join('・')}
                </div>
                <div className="btn-row">
                  <Button
                    size="sm"
                    variant={wants.length > 0 && wait <= 0 ? 'primary' : 'secondary'}
                    disabled={wait > 0 || wants.length === 0 || state.company.cash < cost}
                    onClick={() => {
                      const r = engine.pitchTo(def.id);
                      setMessage(r.reason ?? '');
                      bumpGame();
                    }}
                  >
                    {wait > 0 ? `営業まで ${Math.ceil(wait)}秒` : `営業する（${formatMoney(cost, mode)}）`}
                  </Button>
                  {wants.length === 0 && (
                    <span className="text-dim" style={{ fontSize: 11 }}>
                      まだ納められるものがありません
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {list.length > shown.length && (
        <Button size="sm" onClick={() => setShowAll(true)}>
          すべての取引先を見る（{list.length}社）
        </Button>
      )}
    </div>
  );
}
