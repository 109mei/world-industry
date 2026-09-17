import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Stat } from '@/components/ui/Stat';
import { CITY_MAP } from '@/game/data/cities';
import { COMPANY_MAP, isCompanyId } from '@/game/data/companies';
import { PROPERTY_KIND, PROPERTY_MAP, isPropertyId, propertyYield } from '@/game/data/properties';
import { cityMultiplier, estateFee, propertyBuyCost, propertyOwner, propertyPrice, propertyRentPerSec, propertySellProceeds } from '@/game/engine/systems/estate';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate, formatNumber, formatPercent, formatRate } from '@/utils/format';
import { sfx } from '@/utils/sfx';

function areaLabel(area: number): string {
  if (area >= 10_000) return `${(area / 10_000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}ha`;
  return `${area.toLocaleString('ja-JP')}㎡`;
}

/** 物件の詳細（購入・売却） */
export function PropertySheet() {
  const selected = useUiStore((s) => s.selectedProperty);
  const openProperty = useUiStore((s) => s.openProperty);
  const openCompany = useUiStore((s) => s.openCompany);
  const flyTo = useUiStore((s) => s.flyTo);
  const { state, engine } = useGame();
  const mode = state.settings.numberFormat;
  const id = selected && isPropertyId(selected) ? selected : null;
  if (!id) return null;
  const def = PROPERTY_MAP[id];
  const kind = PROPERTY_KIND[def.kind];
  const city = CITY_MAP[def.city];
  const owner = propertyOwner(state, id);
  const price = propertyPrice(state, id);
  const mult = cityMultiplier(state, def.city);
  const rent = propertyRentPerSec(state, id);
  const y = propertyYield(def);
  const cost = propertyBuyCost(state, id);
  const proceeds = propertySellProceeds(state, id);
  const canBuy = owner.type === 'market' && state.company.cash >= cost;
  const owned = owner.type === 'player' ? state.estate.owned[id] : null;
  const close = () => openProperty(null);
  const title = (
    <span>
      {def.name}{' '}
      <span className="text-sub" style={{ fontSize: 12, fontWeight: 400 }}>
        {city.country}・{city.name}
      </span>
    </span>
  );
  return (
    <Sheet open onClose={close} title={title} icon={<Icon name={kind.icon} size={32} fallback={kind.label.slice(0, 2)} />}>
      <div className="sheet__section">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <Badge tone="power">{kind.label}</Badge>
          {owner.type === 'player' && <Badge tone="profit">所有中</Badge>}
          {owner.type === 'company' && <Badge tone="warn">{isCompanyId(owner.companyId) ? COMPANY_MAP[owner.companyId].name : '他社'}が所有</Badge>}
          {owner.type === 'market' && <Badge tone={canBuy ? 'profit' : 'default'}>{canBuy ? '購入できる' : '売り出し中'}</Badge>}
        </div>
        <p className="card__sub">{def.description}</p>
        <div className="stat-grid" style={{ marginTop: 8 }}>
          <Stat label="現在の価格" value={formatMoney(price, mode)} size="lg" extra={`${formatMoney(price, 'full')}（基準 ${formatMoney(def.price, mode)} × 地価 ${mult.toFixed(2)}）`} />
          <Stat label="賃料" value={formatMoneyRate(rent, mode)} tone="profit" extra={`${formatMoney(rent * 3600, mode)}/時（利回り ${formatPercent(y, 0)}/時）`} />
          <Stat label="面積" value={areaLabel(def.area)} extra={`${formatMoney(price / def.area, mode)}/㎡`} />
          <Stat label={`${city.name}の地価トレンド`} value={`${city.trend >= 0 ? '+' : ''}${(city.trend * 100).toFixed(1)}%/時`} tone={city.trend > 0.008 ? 'profit' : city.trend < 0 ? 'loss' : 'default'} extra={`ぶれ ±${(city.volatility * 100).toFixed(1)}%`} />
          {owned && <Stat label="買値" value={formatMoney(owned.boughtPrice, mode)} extra={`評価損益 ${formatRate(price - owned.boughtPrice, mode)}円`} tone={price >= owned.boughtPrice ? 'profit' : 'loss'} />}
          {owned && <Stat label="売却額（手数料 3%）" value={formatMoney(proceeds, mode)} />}
        </div>
      </div>
      <div className="sheet__section">
        {owner.type === 'market' && (
          <>
            <Button
              variant="primary"
              block
              disabled={!canBuy}
              onClick={() => {
                if (engine.buyProperty(id)) {
                  sfx('buy');
                  bumpGame();
                }
              }}
            >
              購入する（{formatMoney(cost, mode)}、手数料 {formatPercent(estateFee(state), 1)} 込み）
            </Button>
            {!canBuy && (
              <div className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
                所持金 {formatMoney(state.company.cash, mode)}。あと {formatMoney(cost - state.company.cash, mode)} 必要。
              </div>
            )}
          </>
        )}
        {owner.type === 'player' && (
          <Button
            variant="sell"
            block
            onClick={() => {
              if (engine.sellProperty(id) > 0) {
                sfx('sell');
                bumpGame();
              }
            }}
          >
            売却する（{formatMoney(proceeds, mode)} を受け取る）
          </Button>
        )}
        {owner.type === 'company' && isCompanyId(owner.companyId) && (
          <>
            <p className="card__sub" style={{ marginBottom: 8 }}>
              この物件は {COMPANY_MAP[owner.companyId].name} が所有しています。株を3分の2以上集めて完全買収すると、この物件を受け取れます。
            </p>
            <Button
              block
              onClick={() => {
                close();
                openCompany(owner.companyId);
              }}
            >
              {COMPANY_MAP[owner.companyId].name} の株を見る
            </Button>
          </>
        )}
        <div className="btn-row" style={{ marginTop: 8 }}>
          <Button
            size="sm"
            onClick={() => {
              close();
              engine.updateSettings({ estateView: 'map' });
              bumpGame();
              flyTo(def.lat, def.lon, 14);
            }}
          >
            地図で見る
          </Button>
          <span className="text-dim" style={{ fontSize: 11 }}>
            {formatNumber(def.lat, 'full')}, {formatNumber(def.lon, 'full')}
          </span>
        </div>
      </div>
    </Sheet>
  );
}
