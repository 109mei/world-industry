import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { FACILITIES, FACILITY_CATEGORY_LABEL, type FacilityCategory, type FacilityDef } from '@/game/data/facilities';
import { isUnlocked } from '@/game/engine/systems/unlocks';
import { useGame } from '@/stores/gameStore';
import { formatAmount, formatNumber } from '@/utils/format';
import { FacilityCard } from './FacilityCard';

type Filter = 'all' | FacilityCategory;

export function FactoryPage() {
  const { state, derived } = useGame();
  const [filter, setFilter] = useState<Filter>('all');
  const mode = state.settings.numberFormat;
  const defs = FACILITIES as readonly FacilityDef[];
  // 未解放で hidden のものは出さない
  const visible = defs.filter((d) => isUnlocked(state, 'facility', d.id) || !d.hiddenUntilUnlocked);
  const categories = Array.from(new Set(visible.map((d) => d.category)));
  const list = filter === 'all' ? visible : visible.filter((d) => d.category === filter);
  const facilityCount = state.facilities.reduce((a, f) => a + f.count, 0);
  const running = Object.values(derived.facilityRuntime).filter((r) => r.status === 'running' || r.status === 'partial').length;
  const stopped = Object.values(derived.facilityRuntime).filter((r) => r.status === 'no_input' || r.status === 'storage_full').length;

  return (
    <div className="page">
      <h1 className="page__title">
        施設<small>作業員・工場・倉庫</small>
      </h1>
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="施設数" value={formatNumber(facilityCount, mode)} />
          <Stat label="従業員" value={`${formatNumber(derived.employees, mode)}人`} />
          <Stat label="稼働 / 停止" value={`${running} / ${stopped}`} tone={stopped > 0 ? 'warn' : 'default'} />
          <Stat label="倉庫容量" value={formatAmount(derived.capacity, mode)} />
        </div>
      </Card>
      <Segmented
        items={[{ id: 'all' as Filter, label: 'すべて' }, ...categories.map((c) => ({ id: c as Filter, label: FACILITY_CATEGORY_LABEL[c] }))]}
        value={filter}
        onChange={setFilter}
        ariaLabel="施設カテゴリ"
      />
      <div className="grid grid--2">
        {list.map((d) => (
          <FacilityCard key={d.id} def={d} />
        ))}
      </div>
    </div>
  );
}
