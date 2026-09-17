import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Stat } from '@/components/ui/Stat';
import { LAND_MAP, isLandDefId } from '@/game/data/lands';
import { PROPERTY_KIND, PROPERTY_MAP, isPropertyId } from '@/game/data/properties';
import { RESOURCE_MAP } from '@/game/data/resources';
import { SURVEY_LEVEL_LABEL } from '@/game/data/survey';
import { TERRAINS } from '@/game/data/terrain';
import { facilitiesOn, isHq } from '@/game/engine/land';
import { customPrice, customRentPerSec, getCustom, landCustomId } from '@/game/engine/systems/customEstate';
import { hqLocation } from '@/game/engine/hq';
import { landPropertyId, propertyPrice, propertyRentPerSec } from '@/game/engine/systems/estate';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import type { LandState } from '@/types/state';
import { formatAmount, formatMoney, formatMoneyRate } from '@/utils/format';

interface Place {
  land: LandState;
  kindLabel: string;
  icon: string;
  value: number;
  rent: number;
  lat: number | null;
  lon: number | null;
}

/** 所有している場所（本社・買った土地や建物）の一覧 */
export function OwnedPlaces() {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
  const setFactoryLand = useUiStore((s) => s.setFactoryLand);
  const setTab = useUiStore((s) => s.setTab);
  const setMapSubTab = useUiStore((s) => s.setMapSubTab);
  const flyTo = useUiStore((s) => s.flyTo);
  const openFeature = useUiStore((s) => s.openFeature);
  const openProperty = useUiStore((s) => s.openProperty);
  const openLand = useUiStore((s) => s.openLand);

  const places: Place[] = state.lands.map((land) => {
    if (isHq(land.id)) {
      const at = hqLocation(state);
      return { land, kindLabel: '本社', icon: 'icon_ui_company', value: 0, rent: 0, lat: at.lat, lon: at.lon };
    }
    const osmId = landCustomId(land.id);
    if (osmId) {
      const cp = getCustom(state, osmId);
      if (cp) {
        return {
          land,
          kindLabel: cp.label,
          icon: PROPERTY_KIND[cp.kind].icon,
          value: customPrice(state, cp),
          rent: customRentPerSec(state, cp),
          lat: cp.lat,
          lon: cp.lon,
        };
      }
    }
    const propId = landPropertyId(land.id);
    if (propId && isPropertyId(propId)) {
      const def = PROPERTY_MAP[propId];
      return {
        land,
        kindLabel: PROPERTY_KIND[def.kind].label,
        icon: PROPERTY_KIND[def.kind].icon,
        value: propertyPrice(state, propId),
        rent: propertyRentPerSec(state, propId),
        lat: def.lat,
        lon: def.lon,
      };
    }
    if (isLandDefId(land.id)) {
      const def = LAND_MAP[land.id];
      return { land, kindLabel: '産業用地', icon: TERRAINS[def.terrain].icon, value: def.price, rent: 0, lat: def.lat, lon: def.lon };
    }
    return { land, kindLabel: '土地', icon: TERRAINS[land.terrain].icon, value: land.value ?? 0, rent: 0, lat: null, lon: null };
  });

  const totalValue = places.reduce((a, p) => a + p.value, 0);
  const totalRent = places.reduce((a, p) => a + p.rent, 0);

  return (
    <div className="list">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="持っている場所" value={`${places.length}か所`} extra={`${new Set(places.map((p) => p.land.country)).size}か国`} />
          <Stat label="評価額の合計" value={formatMoney(totalValue, mode)} />
          <Stat label="賃料の合計" value={formatMoneyRate(totalRent, mode)} tone={totalRent > 0 ? 'profit' : 'default'} />
          <Stat label="建っている施設" value={`${state.facilities.reduce((a, f) => a + f.count, 0)}件`} />
        </div>
      </Card>
      {places.map((p) => {
        const list = facilitiesOn(state, p.land.id).filter((f) => f.count > 0);
        const out: Record<string, number> = {};
        for (const f of list) {
          const rt = derived.facilityRuntime[f.id];
          if (!rt) continue;
          for (const [r, v] of Object.entries(rt.outputRates ?? {})) out[r] = (out[r] ?? 0) + (v ?? 0);
        }
        const top = Object.entries(out)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4);
        const deposits = p.land.survey >= 1 ? Object.entries(p.land.deposits ?? {}).filter(([, d]) => (d?.remaining ?? 0) > 0) : [];
        const stock = Object.entries(p.land.stock ?? {}).filter(([, v]) => (v ?? 0) > 0.01);
        return (
          <Card key={p.land.id}>
            <div className="card__head">
              <Icon name={p.icon} size={34} fallback={p.kindLabel.slice(0, 2)} />
              <div className="row__grow">
                <div className="card__title">{p.land.name}</div>
                <div className="card__sub">
                  {p.kindLabel}・{TERRAINS[p.land.terrain].name}・{p.land.region}
                </div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                {p.land.survey < 4 && <Badge tone="warn">{SURVEY_LEVEL_LABEL[p.land.survey]}</Badge>}
                {list.length > 0 && <Badge tone="power">施設 {list.reduce((a, f) => a + f.count, 0)}</Badge>}
              </div>
            </div>
            <div className="card__body">
              <div className="stat-grid">
                {p.value > 0 && <Stat label="評価額" value={formatMoney(p.value, mode)} />}
                {p.rent > 0 && <Stat label="賃料" value={formatMoneyRate(p.rent, mode)} tone="profit" />}
                {top.length > 0 && (
                  <Stat
                    label="生産 /秒"
                    value={top
                      .map(([r, v]) => `${RESOURCE_MAP[r as keyof typeof RESOURCE_MAP]?.name ?? r} ${formatAmount(v, mode)}`)
                      .slice(0, 2)
                      .join('・')}
                    tone="profit"
                    extra={top.length > 2 ? top.slice(2).map(([r, v]) => `${RESOURCE_MAP[r as keyof typeof RESOURCE_MAP]?.name ?? r} ${formatAmount(v, mode)}`).join('・') : undefined}
                  />
                )}
                {deposits.length > 0 && (
                  <Stat
                    label={p.land.survey >= 2 ? '残りの埋蔵' : '埋まっているもの'}
                    value={deposits
                      .map(([r, d]) => (p.land.survey >= 2 ? `${RESOURCE_MAP[r as keyof typeof RESOURCE_MAP]?.name ?? r} ${formatAmount(d?.remaining ?? 0, mode)}` : (RESOURCE_MAP[r as keyof typeof RESOURCE_MAP]?.name ?? r)))
                      .slice(0, 3)
                      .join('・')}
                  />
                )}
                {stock.length > 0 && (
                  <Stat
                    label="現地の在庫"
                    value={stock
                      .map(([r, v]) => `${RESOURCE_MAP[r as keyof typeof RESOURCE_MAP]?.name ?? r} ${formatAmount(v ?? 0, mode)}`)
                      .slice(0, 2)
                      .join('・')}
                  />
                )}
              </div>
              <div className="btn-row" style={{ marginTop: 8 }}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setFactoryLand(p.land.id);
                    setTab('factory');
                  }}
                >
                  施設 ›
                </Button>
                {p.lat !== null && p.lon !== null && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setMapSubTab('map');
                      flyTo(p.lat as number, p.lon as number, isHq(p.land.id) ? 15 : 17);
                    }}
                  >
                    地図で見る
                  </Button>
                )}
                {landCustomId(p.land.id) && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const cp = getCustom(state, landCustomId(p.land.id) as string);
                      if (cp) openFeature({ id: cp.id, kind: cp.kind, label: cp.label, name: cp.name, named: false, lat: cp.lat, lon: cp.lon, areaSqm: cp.areaSqm, levels: cp.levels, polygon: [] });
                    }}
                  >
                    詳細・売却
                  </Button>
                )}
                {landPropertyId(p.land.id) && (
                  <Button size="sm" onClick={() => openProperty(landPropertyId(p.land.id) as string)}>
                    詳細・売却
                  </Button>
                )}
                {isLandDefId(p.land.id) && (
                  <Button size="sm" onClick={() => openLand(p.land.id)}>
                    調査・詳細
                  </Button>
                )}
                {!isHq(p.land.id) && !isLandDefId(p.land.id) && !landPropertyId(p.land.id) && p.land.survey < 4 && (
                  <Button size="sm" onClick={() => openLand(p.land.id)}>
                    調査
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
