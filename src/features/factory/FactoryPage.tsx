import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { FACILITIES, FACILITY_CATEGORY_LABEL, facilityCost, type FacilityCategory, type FacilityDef, type FacilityId } from '@/game/data/facilities';
import { facilityCount } from '@/game/engine/actions/facility';
import { canBuildOn, getLand, isHq } from '@/game/engine/land';
import { isUnlocked } from '@/game/engine/systems/unlocks';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatMoney, formatNumber } from '@/utils/format';
import { sfx } from '@/utils/sfx';
import { FacilityCard } from './FacilityCard';
import { PowerSummary } from './PowerSummary';

type Filter = 'all' | FacilityCategory;

export function FactoryPage() {
  const { state, derived, engine } = useGame();
  const factoryLand = useUiStore((s) => s.factoryLand);
  const setFactoryLand = useUiStore((s) => s.setFactoryLand);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const onlyBuildable = state.settings.factoryOnlyBuildable ?? false;
  const setOnlyBuildable = (v: boolean) => {
    engine.updateSettings({ factoryOnlyBuildable: v });
    bumpGame();
  };
  const mode = state.settings.numberFormat;
  const landId = getLand(state, factoryLand) ? factoryLand : 'hq';
  const land = getLand(state, landId)!;
  const defs = FACILITIES as readonly FacilityDef[];
  // この土地に建てられるもの（本社なら本社用、土地なら土地用＋どこでも）。未解放で hidden のものは出さない
  const visible = defs.filter((d) => {
    if (!(isUnlocked(state, 'facility', d.id) || !d.hiddenUntilUnlocked)) return false;
    if (isHq(landId)) return d.site !== 'land';
    if (d.site === 'hq') return false;
    return true;
  });
  const categories = Array.from(new Set(visible.map((d) => d.category)));
  const q = query.trim().toLowerCase();
  const matches = (d: FacilityDef) => !q || d.name.toLowerCase().includes(q) || d.nameEn.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || FACILITY_CATEGORY_LABEL[d.category].includes(q);
  const buildableNow = (d: FacilityDef) => isUnlocked(state, 'facility', d.id) && canBuildOn(d, land).ok && state.company.cash >= facilityCost(d, facilityCount(state, d.id as FacilityId, landId));
  const rank = (d: FacilityDef) => {
    const owned = facilityCount(state, d.id as FacilityId, landId) > 0;
    const unlocked = isUnlocked(state, 'facility', d.id);
    // 解放済み（持っているものが先）→ 未解放 の順
    if (owned) return 0;
    if (unlocked && canBuildOn(d, land).ok) return 1;
    if (unlocked) return 2;
    return 3;
  };
  const list = (filter === 'all' ? visible : visible.filter((d) => d.category === filter))
    .filter((d) => filter !== 'all' || canBuildOn(d, land).ok || state.facilities.some((f) => f.typeId === d.id && f.landId === landId))
    .filter(matches)
    .filter((d) => !onlyBuildable || buildableNow(d))
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.baseCost - b.baseCost);
  const onLand = state.facilities.filter((f) => f.landId === landId);
  const facilityCountAll = onLand.reduce((a, f) => a + f.count, 0);
  const running = onLand.filter((f) => ['running', 'partial'].includes(derived.facilityRuntime[f.id]?.status ?? '')).length;
  const stopped = onLand.filter((f) => ['no_input', 'storage_full', 'no_power', 'depleted'].includes(derived.facilityRuntime[f.id]?.status ?? '')).length;
  const capacity = isHq(landId) ? derived.capacity : derived.lands[landId]?.capacity ?? 0;
  // 「全部 +1」の費用
  const plusOneCost = onLand.filter((f) => f.count > 0).reduce((a, f) => {
    const def = defs.find((d) => d.id === f.typeId);
    return a + (def ? facilityCost(def, f.count) : 0);
  }, 0);
  const plusOne = () => {
    if (engine.buyAllOnLand(landId) > 0) sfx('buy');
    bumpGame();
  };

  return (
    <div className="page">
      <h1 className="page__title">
        施設<small>{isHq(landId) ? '本社の作業員・工場・倉庫' : `${land.name}の施設`}</small>
      </h1>
      {state.lands.length > 1 && (
        <Segmented items={state.lands.map((l) => ({ id: l.id, label: l.name }))} value={landId} onChange={setFactoryLand} ariaLabel="土地の選択" />
      )}
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label={`${land.name}の施設`} value={formatNumber(facilityCountAll, mode)} />
          <Stat label="従業員（全体）" value={`${formatNumber(derived.employees, mode)}人`} />
          <Stat label="稼働 / 停止" value={`${running} / ${stopped}`} tone={stopped > 0 ? 'warn' : 'default'} />
          <Stat label="倉庫容量" value={formatAmount(capacity, mode)} />
        </div>
        {onLand.some((f) => f.count > 0) && (
          <div className="row row--between" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <span className="text-sub" style={{ fontSize: 12 }}>
              まとめ操作: この土地の施設をすべて1個ずつ増やす
            </span>
            <Button size="sm" variant="secondary" disabled={plusOneCost > state.company.cash} onClick={plusOne}>
              全部 +1（{formatMoney(plusOneCost, mode)}）
            </Button>
          </div>
        )}
      </Card>
      <PowerSummary />
      <Segmented
        items={[{ id: 'all' as Filter, label: 'すべて' }, ...categories.map((c) => ({ id: c as Filter, label: FACILITY_CATEGORY_LABEL[c] }))]}
        value={filter}
        onChange={setFilter}
        ariaLabel="施設カテゴリ"
      />
      <div className="row toolbar">
        <input className="input input--sm" type="search" placeholder="施設を検索（名前・説明）" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="施設の検索" />
        <label className="switch">
          <input type="checkbox" checked={onlyBuildable} onChange={(e) => setOnlyBuildable(e.target.checked)} />
          <span className="text-sub" style={{ fontSize: 12 }}>
            今建てられるものだけ
          </span>
        </label>
      </div>
      <div className="grid grid--2">
        {list.map((d) => (
          <FacilityCard key={`${landId}:${d.id}`} def={d} landId={landId} />
        ))}
      </div>
      {list.length === 0 && <div className="empty">{q || onlyBuildable ? '条件に合う施設がありません。' : 'この土地に建てられる施設はまだありません。'}</div>}
    </div>
  );
}
