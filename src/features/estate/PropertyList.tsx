import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { CITIES, type CityDef } from '@/game/data/cities';
import { COMPANY_MAP, isCompanyId } from '@/game/data/companies';
import { PROPERTIES, PROPERTY_KIND, propertyYield, type PropertyDef } from '@/game/data/properties';
import { cityMultiplier, propertyBuyCost, propertyOwner, propertyPrice, propertyRentPerSec } from '@/game/engine/systems/estate';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate, formatPercent } from '@/utils/format';

/** 物件の一覧（都市ごと）。絞り込み: すべて / 所有 / 買える */
export function PropertyList() {
  const { state } = useGame();
  const filter = useUiStore((s) => s.estateFilter);
  const setFilter = useUiStore((s) => s.setEstateFilter);
  const openProperty = useUiStore((s) => s.openProperty);
  const mode = state.settings.numberFormat;
  const cash = state.company.cash;

  const matches = (p: PropertyDef): boolean => {
    const owner = propertyOwner(state, p.id).type;
    if (filter === 'owned') return owner === 'player';
    if (filter === 'affordable') return owner === 'market' && cash >= propertyBuyCost(state, p.id);
    return true;
  };
  const groups = (CITIES as readonly CityDef[])
    .map((c) => ({ city: c, props: (PROPERTIES as readonly PropertyDef[]).filter((p) => p.city === c.id && matches(p)) }))
    .filter((g) => g.props.length > 0);
  const ownedCount = Object.keys(state.estate.owned).length;
  const affordableCount = (PROPERTIES as readonly PropertyDef[]).filter((p) => propertyOwner(state, p.id).type === 'market' && cash >= propertyBuyCost(state, p.id)).length;

  return (
    <>
      <Segmented
        ariaLabel="物件の絞り込み"
        items={[
          { id: 'all', label: `すべて ${PROPERTIES.length}` },
          { id: 'owned', label: `所有 ${ownedCount}` },
          { id: 'affordable', label: `買える ${affordableCount}` },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {groups.length === 0 && (
        <Card flat>
          <div className="card__body text-sub">該当する物件はありません。</div>
        </Card>
      )}
      {groups.map(({ city, props }) => {
        const mult = cityMultiplier(state, city.id);
        return (
          <div key={city.id}>
            <div className="section-title">
              <span>
                {city.name}
                <span className="text-dim" style={{ marginLeft: 6, fontWeight: 500, textTransform: 'none' }}>
                  {city.country}
                </span>
              </span>
              <span className={`num ${mult >= 1 ? 'text-profit' : 'text-loss'}`} style={{ textTransform: 'none' }}>
                地価 ×{mult.toFixed(2)}
              </span>
            </div>
            <div className="grid grid--2">
              {props.map((p) => {
                const kind = PROPERTY_KIND[p.kind];
                const owner = propertyOwner(state, p.id);
                const price = propertyPrice(state, p.id);
                const rent = propertyRentPerSec(state, p.id);
                const canBuy = owner.type === 'market' && cash >= propertyBuyCost(state, p.id);
                const cls = ['card', 'card--click', owner.type === 'player' ? 'card--owned' : '', owner.type === 'company' ? 'card--locked' : ''].filter(Boolean).join(' ');
                return (
                  <button key={p.id} type="button" className={cls} onClick={() => openProperty(p.id)} style={{ textAlign: 'left' }}>
                    <div className="card__head">
                      <Icon name={kind.icon} size={36} fallback={kind.label.slice(0, 2)} />
                      <div className="row__grow">
                        <div className="card__title">{p.name}</div>
                        <div className="card__sub">
                          {kind.label}・利回り {formatPercent(propertyYield(p), 0)}/時
                          {owner.type === 'company' && isCompanyId(owner.companyId) && <> ・{COMPANY_MAP[owner.companyId].name}が所有</>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="num" style={{ fontWeight: 700 }}>
                          {formatMoney(price, mode)}
                        </div>
                        <div className={`num ${owner.type === 'player' ? 'text-profit' : canBuy ? 'text-power' : 'text-dim'}`} style={{ fontSize: 12 }}>
                          {owner.type === 'player' ? formatMoneyRate(rent, mode) : canBuy ? '購入できる' : owner.type === 'company' ? '他社所有' : '資金不足'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
