import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Stat } from '@/components/ui/Stat';
import { PROPERTY_KIND } from '@/game/data/properties';
import { customLandId, customPrice, customRentPerSec } from '@/game/engine/systems/customEstate';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate } from '@/utils/format';

/** 地図から買った「実在の場所」の一覧 */
export function CustomPropertyList() {
  const { state } = useGame();
  const openFeature = useUiStore((s) => s.openFeature);
  const setMapSubTab = useUiStore((s) => s.setMapSubTab);
  const flyTo = useUiStore((s) => s.flyTo);
  const setFactoryLand = useUiStore((s) => s.setFactoryLand);
  const setTab = useUiStore((s) => s.setTab);
  const mode = state.settings.numberFormat;
  const list = Object.values(state.estate.custom ?? {});
  if (list.length === 0) return null;
  return (
    <div>
      <div className="section-title">地図で買った場所（{list.length}件）</div>
      <div className="grid grid--2">
        {list.map((cp) => {
          const kind = PROPERTY_KIND[cp.kind];
          const built = state.facilities.filter((f) => f.landId === customLandId(cp.id)).reduce((a, f) => a + f.count, 0);
          return (
            <Card key={cp.id} flat>
              <div className="card__head">
                <Icon name={kind.icon} size={30} fallback={kind.label.slice(0, 2)} />
                <div className="row__grow">
                  <div className="card__title">{cp.name}</div>
                  <div className="card__sub">
                    {cp.label}・{cp.regionLabel}・{Math.round(cp.areaSqm).toLocaleString('ja-JP')}㎡
                  </div>
                </div>
              </div>
              <div className="card__body">
                <div className="stat-grid">
                  <Stat label="評価額" value={formatMoney(customPrice(state, cp), mode)} />
                  <Stat label="賃料" value={formatMoneyRate(customRentPerSec(state, cp), mode)} tone="profit" />
                  <Stat label="施設" value={`${built}件`} />
                </div>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <Button
                    size="sm"
                    onClick={() => {
                      setMapSubTab('map');
                      flyTo(cp.lat, cp.lon, 17);
                    }}
                  >
                    地図で見る
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      openFeature({ id: cp.id, kind: cp.kind, label: cp.label, name: cp.name, named: false, lat: cp.lat, lon: cp.lon, areaSqm: cp.areaSqm, levels: cp.levels, polygon: [] })
                    }
                  >
                    詳細
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setFactoryLand(customLandId(cp.id));
                      setTab('factory');
                    }}
                  >
                    施設 ›
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
