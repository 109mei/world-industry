import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { FACILITIES, FACILITY_CATEGORY_LABEL, type FacilityCategory, type FacilityDef } from '@/game/data/facilities';
import { canBuildOn, getLand, isHq } from '@/game/engine/land';
import { isUnlocked } from '@/game/engine/systems/unlocks';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatNumber } from '@/utils/format';
import { FacilityCard } from './FacilityCard';
import { PowerSummary } from './PowerSummary';

type Filter = 'all' | FacilityCategory;

export function FactoryPage() {
  const { state, derived } = useGame();
  const factoryLand = useUiStore((s) => s.factoryLand);
  const setFactoryLand = useUiStore((s) => s.setFactoryLand);
  const [filter, setFilter] = useState<Filter>('all');
  const mode = state.settings.numberFormat;
  const landId = getLand(state, factoryLand) ? factoryLand : 'hq';
  const land = getLand(state, landId)!;
  const defs = FACILITIES as readonly FacilityDef[];
  // この土地に建てられるもの（本社なら本社用、土地なら土地用＋どこでも）。未解放で hidden のものは出さない
  const visible = defs.filter((d) => {
    if (!(isUnlocked(state, 'facility', d.id) || !d.hiddenUntilUnlocked)) return false;
    if (isHq(landId)) return d.site !== 'land';
    if (d.site === 'hq') return false;
    // 地形で建てられないものも、鉱脈がないものも表示はする（理由を出す）が、本社専用は出さない
    return true;
  });
  const categories = Array.from(new Set(visible.map((d) => d.category)));
  const list = (filter === 'all' ? visible : visible.filter((d) => d.category === filter)).filter((d) => filter !== 'all' || canBuildOn(d, land).ok || state.facilities.some((f) => f.typeId === d.id && f.landId === landId));
  const onLand = state.facilities.filter((f) => f.landId === landId);
  const facilityCount = onLand.reduce((a, f) => a + f.count, 0);
  const running = onLand.filter((f) => ['running', 'partial'].includes(derived.facilityRuntime[f.id]?.status ?? '')).length;
  const stopped = onLand.filter((f) => ['no_input', 'storage_full', 'no_power', 'depleted'].includes(derived.facilityRuntime[f.id]?.status ?? '')).length;
  const capacity = isHq(landId) ? derived.capacity : derived.lands[landId]?.capacity ?? 0;

  return (
    <div className="page">
      <h1 className="page__title">
        施設<small>作業員・工場・発電・物流</small>
      </h1>
      {state.lands.length > 1 && (
        <Segmented items={state.lands.map((l) => ({ id: l.id, label: l.name }))} value={landId} onChange={setFactoryLand} ariaLabel="土地の選択" />
      )}
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label={`${land.name}の施設`} value={formatNumber(facilityCount, mode)} />
          <Stat label="従業員（全体）" value={`${formatNumber(derived.employees, mode)}人`} />
          <Stat label="稼働 / 停止" value={`${running} / ${stopped}`} tone={stopped > 0 ? 'warn' : 'default'} />
          <Stat label="倉庫容量" value={formatAmount(capacity, mode)} />
        </div>
      </Card>
      <PowerSummary />
      <Segmented
        items={[{ id: 'all' as Filter, label: 'すべて' }, ...categories.map((c) => ({ id: c as Filter, label: FACILITY_CATEGORY_LABEL[c] }))]}
        value={filter}
        onChange={setFilter}
        ariaLabel="施設カテゴリ"
      />
      <div className="grid grid--2">
        {list.map((d) => (
          <FacilityCard key={`${landId}:${d.id}`} def={d} landId={landId} />
        ))}
      </div>
      {list.length === 0 && <div className="empty">この土地に建てられる施設はまだありません。</div>}
    </div>
  );
}
