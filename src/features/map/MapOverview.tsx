import { BarChart, DonutChart, type BarDatum } from '@/components/ui/Chart';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Stat } from '@/components/ui/Stat';
import { PROPERTY_KIND, PROPERTY_MAP, isPropertyId } from '@/game/data/properties';
import { CITY_MAP } from '@/game/data/cities';
import { propertyPrice, propertyRentPerSec } from '@/game/engine/systems/estate';
import type { ResourceId } from '@/game/data/resources';
import { resourceValue } from '@/game/engine/analysis/roi';
import { customPrice, customProperties, customRentPerSec, customLandId } from '@/game/engine/systems/customEstate';
import { useGame } from '@/stores/gameStore';
import { formatAmount, formatMoney, formatMoneyRate, formatNumber } from '@/utils/format';

/** 地図で持っているものの全体像。どこに・何を・いくらぶん持っているか */
export function MapOverview() {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
  const props = customProperties(state);
  // カタログの物件（一覧から買ったもの）も同じ内訳に入れる。
  // ここを地図で買った場所だけにすると、上の「評価額」と下のグラフの合計が食い違う
  const ownedIds = Object.keys(state.estate?.owned ?? {}).filter((id) => isPropertyId(id));
  const lands = state.lands.filter((l) => l.id !== 'hq');
  if (props.length === 0 && ownedIds.length === 0 && lands.length === 0) return null;
  const placeCount = props.length + ownedIds.length;

  // 用途ごとの評価額
  const byKind = new Map<string, number>();
  const byCountry = new Map<string, number>();
  const add = (kind: string, country: string, price: number) => {
    byKind.set(kind, (byKind.get(kind) ?? 0) + price);
    byCountry.set(country || '—', (byCountry.get(country || '—') ?? 0) + price);
  };
  for (const cp of props) add(PROPERTY_KIND[cp.kind]?.label ?? cp.label, cp.country, customPrice(state, cp));
  for (const id of ownedIds) {
    const def = PROPERTY_MAP[id];
    if (!def) continue;
    add(PROPERTY_KIND[def.kind]?.label ?? def.kind, CITY_MAP[def.city]?.country ?? '—', propertyPrice(state, id));
  }
  const kindRows = [...byKind.entries()].map<BarDatum>(([label, value]) => ({ label, value }));
  const countryRows = [...byCountry.entries()].map<BarDatum>(([label, value]) => ({ label, value }));

  // 賃料の多い場所（地図で買った場所と、一覧から買った物件の両方）
  const rentRows: { name: string; rent: number }[] = [
    ...props.map((cp) => ({ name: cp.name, rent: customRentPerSec(state, cp) })),
    ...ownedIds.map((id) => ({ name: PROPERTY_MAP[id]?.name ?? id, rent: propertyRentPerSec(state, id) })),
  ];
  const topRent = rentRows
    .filter((r) => r.rent > 0)
    .sort((a, b) => b.rent - a.rent)
    .slice(0, 6)
    .map<BarDatum>((r) => ({ label: r.name, value: r.rent, tone: 'profit' }));

  // 生産している土地
  const topProduce = lands
    .map((l) => {
      let v = 0;
      for (const f of state.facilities) {
        if (f.landId !== l.id || f.count <= 0) continue;
        const rt = derived.facilityRuntime[f.id];
        if (!rt) continue;
        for (const [id, rate] of Object.entries(rt.outputRates ?? {}) as [ResourceId, number][]) {
          v += (rate ?? 0) * resourceValue(state, id);
        }
      }
      return { name: l.name, value: v };
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map<BarDatum>((r) => ({ label: r.name, value: r.value, tone: 'accent' }));

  // まだ調べていない土地（調べると何が埋まっているか分かる）
  const unsurveyed = lands.filter((l) => l.survey < 2).length;
  const withFacilities = new Set(state.facilities.filter((f) => f.count > 0).map((f) => f.landId));
  const idle = lands.filter((l) => !withFacilities.has(l.id) && !props.some((cp) => customLandId(cp.id) === l.id && PROPERTY_KIND[cp.kind]?.yield)).length;

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_location" size={30} fallback="地図" />
        <div className="row__grow">
          <div className="card__title">持っているものの全体像</div>
          <div className="card__sub">
            {unsurveyed > 0 ? `${unsurveyed}ヵ所がまだ調査前です。調べると何が埋まっているか分かります。` : '買った場所の内訳です。'}
          </div>
        </div>
      </div>
      <div className="card__body">
        <div className="stat-grid stat-grid--4">
          <Stat label="場所" value={`${formatNumber(placeCount, mode)}ヵ所`} extra={`${byCountry.size}ヵ国`} />
          <Stat label="評価額" value={formatMoney(derived.estateValue, mode)} />
          <Stat label="賃料 /秒" value={formatMoneyRate(derived.rentPerSec, mode)} tone="profit" />
          <Stat label="施設のない土地" value={`${formatNumber(idle, mode)}ヵ所`} tone={idle > 0 ? 'warn' : 'default'} extra={idle > 0 ? '使い道を決めましょう' : undefined} />
        </div>

        {kindRows.length > 0 && <DonutChart label="用途ごとの評価額" data={kindRows} format={(v) => formatMoney(v, mode)} />}
        {countryRows.length > 1 && <BarChart label="国ごとの評価額" data={countryRows} format={(v) => formatMoney(v, mode)} />}
        {topRent.length > 0 && <BarChart label="賃料の多い場所（毎秒）" data={topRent} format={(v) => formatMoney(v, mode)} />}
        {topProduce.length > 0 && <BarChart label="生産の多い土地（値打ち /秒）" data={topProduce} format={(v) => formatMoney(v, mode)} />}

        {lands.length > 0 && (
          <BarChart
            label="調査の進み具合（ヵ所）"
            data={[
              { label: '調査ずみ', value: lands.filter((l) => l.survey >= 2).length, tone: 'profit' },
              { label: '調査前', value: unsurveyed, tone: 'warn' },
            ]}
            max={lands.length}
            format={(v) => `${formatAmount(v, mode)}ヵ所`}
          />
        )}
      </div>
    </Card>
  );
}
