import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Stat } from '@/components/ui/Stat';
import { KIND_NEEDS, PITCH_COOLDOWN, pitchCost, relationTier } from '@/game/data/clients';
import { PROPERTY_KIND } from '@/game/data/properties';
import { RESOURCE_MAP } from '@/game/data/resources';
import { creditRankDef } from '@/game/engine/systems/contracts';
import { clientList, getClient, isSalesUnlocked, pitchCooldownLeft, salesState, wantedByKind } from '@/game/engine/systems/sales';
import { referencePrice } from '@/game/engine/systems/market';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatDuration, formatMoney, formatPercent } from '@/utils/format';
import { sfx } from '@/utils/sfx';

/** いまの相場と比べて何%か（符号も自分で付ける） */
function priceLabel(price: number, reference: number): string {
  const diff = price / Math.max(1, reference) - 1;
  return `相場比 ${diff >= 0 ? '+' : ''}${formatPercent(diff, 0)}`;
}

/** 営業・契約・納品。取引先は地図で見つけた実在の建物 */
export function SalesPanel() {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const [message, setMessage] = useState('');
  const [shownClients, setShownClients] = useState(30);
  const setTab = useUiStore((s) => s.setTab);
  const setMapSubTab = useUiStore((s) => s.setMapSubTab);
  const flyTo = useUiStore((s) => s.flyTo);
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
            <div className="card__sub">資源を売って累計売上が 5,000円 になると、地図で見つけた会社や工場に営業できるようになります。</div>
          </div>
        </div>
      </Card>
    );
  }

  const clients = clientList(state);
  const visibleClients = clients.slice(0, shownClients);
  const cost = pitchCost(derived.assets);

  return (
    <div className="list">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="信用ランク" value={rank.rank} extra={rank.label} tone="research" />
          <Stat label="契約" value={`${sales.deals.length}件`} extra={`商談 ${sales.offers.length}件`} />
          <Stat label="取引先" value={`${clients.length}社`} extra={`納品 ${clients.reduce((a, c) => a + c.deliveries, 0)}回`} />
          <Stat label="営業の費用" value={formatMoney(cost, mode)} extra={`1件 ${PITCH_COOLDOWN}秒に1回`} />
        </div>
        <div className="card__body text-sub" style={{ fontSize: 12 }}>
          取引先は地図にある実在の建物です。地図を拡大して工場・営業所・店・倉庫をタップし、「この会社に営業する」を押すと商談が始まります。
          期限までに納品すると代金・信用・関係が上がり、落とすと下がります。
        </div>
        <div className="card__body">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setMapSubTab('map');
              setTab('map');
            }}
          >
            地図で取引先を探す ›
          </Button>
        </div>
      </Card>

      {message && (
        <Card flat>
          <div className="card__body text-sub">{message}</div>
        </Card>
      )}

      {sales.offers.length > 0 && <div className="section-title">商談（受けるか断る）</div>}
      {sales.offers.map((o) => {
        const c = getClient(state, o.clientId);
        const res = RESOURCE_MAP[o.resource];
        const total = o.amountPer * o.unitPrice * o.deliveries;
        return (
          <Card key={o.id}>
            <div className="card__head">
              <Icon name={res.icon} size={32} fallback={res.name.slice(0, 2)} />
              <div className="row__grow">
                <div className="card__title">
                  {c?.name ?? o.clientId} — {res.name} {formatAmount(o.amountPer, mode)}個 × {o.deliveries}回
                </div>
                <div className="card__sub">
                  単価 {formatMoney(o.unitPrice, mode)}（{priceLabel(o.unitPrice, referencePrice(state, o.resource))}）・納期 {formatDuration(o.intervalSec)}ごと
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
        const c = getClient(state, d.clientId);
        const res = RESOURCE_MAP[d.resource];
        const have = state.inventory[d.resource] ?? 0;
        const canDeliver = have + 1e-9 >= d.amountPer;
        return (
          <Card key={d.id}>
            <div className="card__head">
              <Icon name={res.icon} size={32} fallback={res.name.slice(0, 2)} />
              <div className="row__grow">
                <div className="card__title">
                  {c?.name ?? d.clientId} — {res.name} {formatAmount(d.amountPer, mode)}個
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

      <div className="section-title">知っている取引先</div>
      {clients.length === 0 && (
        <Card flat>
          <div className="card__body text-sub">
            まだ取引先がありません。地図を拡大して、近くの工場・営業所・店・倉庫に営業してみましょう。
          </div>
        </Card>
      )}
      <div className="grid grid--2">
        {visibleClients.map((c) => {
          const tier = relationTier(c.relation);
          const wait = pitchCooldownLeft(state, c.id, now);
          const wants = wantedByKind(state, c.kind);
          const needs = KIND_NEEDS[c.kind] ?? [];
          return (
            <Card key={c.id} flat>
              <div className="card__head">
                <Icon name={PROPERTY_KIND[c.kind].icon} size={30} fallback={c.name.slice(0, 2)} />
                <div className="row__grow">
                  <div className="card__title">{c.name}</div>
                  <div className="card__sub">
                    {c.label}・{c.regionLabel}・{Math.round(c.areaSqm).toLocaleString('ja-JP')}㎡
                  </div>
                </div>
                <Badge tone={c.relation >= 45 ? 'profit' : 'default'}>{tier.label}</Badge>
              </div>
              <div className="card__body">
                <ProgressBar ratio={c.relation / 100} tone="profit" label={`関係 ${Math.round(c.relation)} / 100`} />
                <div className="text-sub" style={{ fontSize: 12, margin: '6px 0' }}>
                  欲しがるもの: {needs.map((r) => RESOURCE_MAP[r].name).join('・')}
                </div>
                <div className="btn-row">
                  <Button
                    size="sm"
                    variant={wants.length > 0 && wait <= 0 ? 'primary' : 'secondary'}
                    disabled={wait > 0 || wants.length === 0 || state.company.cash < cost}
                    onClick={() => {
                      const r = engine.pitchToClient(c.id);
                      setMessage(r.reason ?? '');
                      bumpGame();
                    }}
                  >
                    {wait > 0 ? `営業まで ${Math.ceil(wait)}秒` : `営業する（${formatMoney(cost, mode)}）`}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setMapSubTab('map');
                      setTab('map');
                      flyTo(c.lat, c.lon, 17);
                    }}
                  >
                    地図で見る
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {shownClients < clients.length && (
        <div className="btn-row" style={{ marginTop: 8 }}>
          <Button size="sm" onClick={() => setShownClients((n) => n + 30)}>
            もっと見る（あと {clients.length - shownClients} 社）
          </Button>
        </div>
      )}
    </div>
  );
}
