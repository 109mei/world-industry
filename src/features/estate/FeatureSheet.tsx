import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Stat } from '@/components/ui/Stat';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { PROPERTY_KIND, PROPERTY_POPULATION, PROPERTY_TERRAIN } from '@/game/data/properties';
import { TERRAINS } from '@/game/data/terrain';
import { customBuyCost, customLandId, customPrice, customRentPerSec, customSellProceeds, getCustom, quoteFeature } from '@/game/engine/systems/customEstate';
import { estateFee } from '@/game/engine/systems/estate';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate, formatNumber, formatPercent, formatRate } from '@/utils/format';
import { sfx } from '@/utils/sfx';

function areaLabel(area: number): string {
  if (area >= 10_000) return `${(area / 10_000).toLocaleString('ja-JP', { maximumFractionDigits: 2 })}ha`;
  return `${Math.round(area).toLocaleString('ja-JP')}㎡`;
}

/** 地図で選んだ「実在の場所」の詳細（購入・売却） */
export function FeatureSheet() {
  const feature = useUiStore((s) => s.selectedFeature);
  const openFeature = useUiStore((s) => s.openFeature);
  const setFactoryLand = useUiStore((s) => s.setFactoryLand);
  const setTab = useUiStore((s) => s.setTab);
  const { state, engine } = useGame();
  const mode = state.settings.numberFormat;
  if (!feature) return null;
  const close = () => openFeature(null);
  const owned = getCustom(state, feature.id);
  const kind = PROPERTY_KIND[owned?.kind ?? feature.kind];
  const quote = quoteFeature(feature);
  const cost = customBuyCost(state, quote);
  const canBuy = !owned && state.company.cash >= cost;
  const landId = customLandId(feature.id);
  const builtHere = state.facilities.filter((f) => f.landId === landId && f.count > 0);
  const price = owned ? customPrice(state, owned) : quote.basePrice;
  const rent = owned ? customRentPerSec(state, owned) : (quote.basePrice * kind.yield) / 3600;
  const proceeds = owned ? customSellProceeds(state, owned) : 0;
  const floorArea = feature.areaSqm * Math.max(1, feature.levels);
  const title = (
    <span>
      {owned?.name ?? feature.name}{' '}
      <span className="text-sub" style={{ fontSize: 12, fontWeight: 400 }}>
        {quote.regionLabel}
      </span>
    </span>
  );
  return (
    <Sheet open onClose={close} title={title} icon={<Icon name={kind.icon} size={32} fallback={kind.label.slice(0, 2)} />}>
      <div className="sheet__section">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <Badge tone="power">{owned?.label ?? feature.label}</Badge>
          {owned ? <Badge tone="profit">所有中</Badge> : <Badge tone={canBuy ? 'profit' : 'default'}>{canBuy ? '購入できる' : '資金不足'}</Badge>}
          {feature.named && <Badge tone="default">名前は架空</Badge>}
        </div>
        <p className="card__sub">
          実在する建物の位置と大きさ（OpenStreetMap）をもとにした物件です。名前は実在の施設をもじった架空のもので、実際の所有者・営業とは関係ありません。
        </p>
        <div className="stat-grid" style={{ marginTop: 8 }}>
          <Stat label={owned ? '現在の価格' : '売り出し価格'} value={formatMoney(price, mode)} size="lg" extra={formatMoney(price, 'full')} />
          <Stat label="賃料" value={formatMoneyRate(rent, mode)} tone="profit" extra={`${formatMoney(rent * 3600, mode)}/時（利回り ${formatPercent(kind.yield, 0)}/時）`} />
          <Stat label="敷地" value={areaLabel(feature.areaSqm)} extra={`${formatMoney(quote.unitPrice, mode)}/㎡`} />
          <Stat label="延床" value={areaLabel(floorArea)} extra={`${formatNumber(feature.levels, mode)}階建て`} />
          <Stat label="土地の分" value={formatMoney(quote.landPart, mode)} />
          <Stat label="建物の分" value={formatMoney(quote.buildingPart, mode)} />
        </div>
      </div>
      <div className="sheet__section">
        {!owned && (
          <>
            <Button
              variant="primary"
              block
              disabled={!canBuy}
              onClick={() => {
                if (engine.buyCustomProperty(feature)) {
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
        {owned && (
          <>
            <div className="stat-grid" style={{ marginBottom: 8 }}>
              <Stat label="買値" value={formatMoney(owned.boughtPrice, mode)} extra={`評価損益 ${formatRate(price - owned.boughtPrice, mode)}円`} tone={price >= owned.boughtPrice ? 'profit' : 'loss'} />
              <Stat label="地形" value={TERRAINS[PROPERTY_TERRAIN[owned.kind]].name} extra="建てられる施設が変わる" />
              <Stat label="人口係数" value={`×${PROPERTY_POPULATION[owned.kind]}`} extra="商業施設の収入に掛かる" />
              <Stat label="建っている施設" value={`${builtHere.reduce((a, f) => a + f.count, 0)}件`} />
            </div>
            {builtHere.length > 0 && (
              <div className="list" style={{ marginBottom: 8 }}>
                {builtHere.map((f) => (
                  <div key={f.id} className="row" style={{ fontSize: 13 }}>
                    <Icon name={isFacilityId(f.typeId) ? FACILITY_MAP[f.typeId].icon : 'icon_ui_factory'} size={22} />
                    <span className="row__grow">{isFacilityId(f.typeId) ? FACILITY_MAP[f.typeId].name : f.typeId}</span>
                    <span className="num text-sub">×{f.count}</span>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="primary"
              block
              onClick={() => {
                close();
                setFactoryLand(landId);
                setTab('factory');
              }}
            >
              この土地に施設を建てる・管理する ›
            </Button>
            <Button
              variant="sell"
              block
              style={{ marginTop: 8 }}
              onClick={() => {
                if (engine.sellCustomProperty(feature.id) > 0) {
                  sfx('sell');
                  bumpGame();
                  close();
                }
              }}
            >
              売却する（{formatMoney(proceeds, mode)}）
            </Button>
            <p className="text-sub" style={{ fontSize: 12, margin: '6px 0 0' }}>
              売却すると、ここに建てた施設も失われます。
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}
