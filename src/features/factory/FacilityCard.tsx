import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FACILITY_CATEGORY_LABEL, facilityCost, facilityMaxAffordable, type FacilityDef, type FacilityId } from '@/game/data/facilities';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { TERRAINS } from '@/game/data/terrain';
import { findFacility } from '@/game/engine/actions/facility';
import { diagnoseFacility } from '@/game/engine/analysis/diagnose';
import { canBuildOn, getLand, landPopulation, surveyMultiplier, terrainMultiplier } from '@/game/engine/land';
import { describeCondition, isUnlocked } from '@/game/engine/systems/unlocks';
import { bumpGame, useGame } from '@/stores/gameStore';
import type { FacilityStatus } from '@/types/state';
import { formatMoney, formatNumber, formatPercent, formatRate } from '@/utils/format';
import { NAMES, formatMW } from '@/utils/names';
import { sfx } from '@/utils/sfx';
import { useRepeat } from '@/utils/useRepeat';
import { FixPanel } from './FixPanel';

export const STATUS_LABEL: Record<FacilityStatus, { label: string; tone: 'profit' | 'warn' | 'loss' | 'default' }> = {
  running: { label: '稼働中', tone: 'profit' },
  partial: { label: '一部稼働', tone: 'warn' },
  no_input: { label: '停止: 材料不足', tone: 'loss' },
  storage_full: { label: '停止: 倉庫満杯', tone: 'loss' },
  no_power: { label: '停止: 電力不足', tone: 'loss' },
  depleted: { label: '停止: 鉱脈枯渇', tone: 'loss' },
  disabled: { label: '停止中 (OFF)', tone: 'default' },
  idle: { label: '待機', tone: 'default' },
};

interface Props {
  def: FacilityDef;
  landId?: string;
}

export function FacilityCard({ def, landId = 'hq' }: Props) {
  const { state, derived, engine } = useGame();
  const id = def.id as FacilityId;
  const mode = state.settings.numberFormat;
  const land = getLand(state, landId);
  const unlocked = isUnlocked(state, 'facility', id);
  const inst = findFacility(state, id, landId);
  const count = inst?.count ?? 0;
  const nextCost = facilityCost(def, count);
  const affordable = facilityMaxAffordable(def, count, state.company.cash);
  const runtime = inst ? derived.facilityRuntime[inst.id] : undefined;
  const status = runtime ? STATUS_LABEL[runtime.status] : null;
  const atMax = def.maxCount !== undefined && count >= def.maxCount;
  const build = land ? canBuildOn(def, land) : { ok: false as const, reason: '土地がありません' };
  const eventMult = land ? derived.eventMods.landProduction[land.id] ?? 1 : 1;
  const mult = land ? terrainMultiplier(def, land) * surveyMultiplier(def, land) * (derived.modifiers.production[def.category] ?? 1) * (def.production ? eventMult : 1) : 1;

  const buy = (n: number | 'max') => {
    if (engine.buyFacility(id, n, landId) > 0) sfx('buy');
    bumpGame();
  };
  const hold = useRepeat(() => buy(1));
  const diagnosis = inst && count > 0 && runtime ? diagnoseFacility(state, derived, inst) : null;

  if (!unlocked) {
    return (
      <Card locked>
        <div className="card__head">
          <Icon name="icon_ui_lock" size={32} fallback="LK" />
          <div className="row__grow">
            <div className="card__title">{def.name}</div>
            <div className="card__sub">解放条件: {describeCondition(def.unlock, NAMES) || '—'}</div>
          </div>
        </div>
      </Card>
    );
  }

  const io = def.production;
  const powerOut = inst ? derived.power.byFacility[inst.id] ?? 0 : 0;
  const terrainMult = land ? terrainMultiplier(def, land) : 1;
  return (
    <Card>
      <div className="card__head">
        <Icon name={def.icon} size={40} fallback={def.name.slice(0, 2)} />
        <div className="row__grow">
          <div className="card__title">
            {def.name} <span className="text-sub num">×{count}</span>
          </div>
          <div className="card__sub">
            <Badge>{FACILITY_CATEGORY_LABEL[def.category]}</Badge> <span>{land?.name ?? '本社'}</span>
            {status && count > 0 && (
              <span style={{ marginLeft: 6 }}>
                <Badge tone={status.tone}>{status.label}</Badge>
              </span>
            )}
          </div>
        </div>
        {inst && count > 0 && (io || def.powerGen || def.income || def.transport) && (
          <label className="switch" title="ON/OFF">
            <input
              type="checkbox"
              checked={inst.enabled}
              onChange={(e) => {
                engine.setFacilityEnabled(inst.id, e.target.checked);
                bumpGame();
              }}
            />
            <span className="text-sub" style={{ fontSize: 12 }}>
              {inst.enabled ? 'ON' : 'OFF'}
            </span>
          </label>
        )}
      </div>
      <p className="card__sub" style={{ marginTop: 8 }}>
        {def.description}
      </p>
      {land && terrainMult !== 1 && (
        <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
          {TERRAINS[land.terrain].name}の補正 ×{terrainMult}
        </div>
      )}
      {land && def.production && eventMult !== 1 && (
        <div className="text-warn num" style={{ fontSize: 12, marginTop: 4 }}>
          イベント（地震）の影響 ×{eventMult}
        </div>
      )}
      {io && (
        <div className="card__body" style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div className="stat__label">入力 /秒{count > 0 ? `（×${count}）` : ''}</div>
            {io.inputs ? (
              (Object.entries(io.inputs) as [ResourceId, number][]).map(([rid, rate]) => (
                <div key={rid} className={`row num ${runtime?.missingInputs.includes(rid) ? 'text-loss' : ''}`} style={{ fontSize: 13, gap: 4 }}>
                  <Icon name={RESOURCE_MAP[rid].icon} size={16} />
                  {RESOURCE_MAP[rid].name} {formatRate(-rate * Math.max(1, count) * mult, mode)}
                </div>
              ))
            ) : (
              <div className="text-dim" style={{ fontSize: 13 }}>
                なし
              </div>
            )}
          </div>
          <div>
            <div className="stat__label">出力 /秒{count > 0 ? `（×${count}）` : ''}</div>
            {io.outputs &&
              (Object.entries(io.outputs) as [ResourceId, number][]).map(([rid, rate]) => (
                <div key={rid} className={`row num ${runtime?.blockedOutputs.includes(rid) || runtime?.depleted.includes(rid) ? 'text-loss' : 'text-profit'}`} style={{ fontSize: 13, gap: 4 }}>
                  <Icon name={RESOURCE_MAP[rid].icon} size={16} />
                  {RESOURCE_MAP[rid].name} {formatRate(rate * Math.max(1, count) * mult, mode)}
                  {def.extractsDeposit && land && <span className="text-sub">（残り {formatNumber(Math.floor(land.deposits[rid]?.remaining ?? 0), mode)}）</span>}
                </div>
              ))}
          </div>
        </div>
      )}
      {def.powerGen && (
        <div className="card__body num" style={{ fontSize: 13 }}>
          発電 <span className="text-power">{formatMW(def.powerGen * terrainMult)}</span> / 個
          {count > 0 && (
            <span className="text-sub">
              （現在 {formatMW(powerOut)} / 最大 {formatMW(def.powerGen * terrainMult * count)}）
            </span>
          )}
          {def.fuel && (
            <div className="text-sub" style={{ fontSize: 12 }}>
              燃料: {(Object.entries(def.fuel) as [ResourceId, number][]).map(([rid, r]) => `${RESOURCE_MAP[rid].name} ${formatRate(-r, mode)}/秒`).join('、')}（最大出力時、1個あたり）
            </div>
          )}
        </div>
      )}
      {def.powerUse && (
        <div className="text-sub num" style={{ fontSize: 12 }}>
          電力 {formatMW(def.powerUse)} / 個{count > 0 ? `（合計 ${formatMW(def.powerUse * count)}）` : ''}
        </div>
      )}
      {def.storageBonus && (
        <div className="card__body num" style={{ fontSize: 13 }}>
          倉庫容量 <span className="text-profit">+{formatNumber(def.storageBonus, 'full')}</span> / 個
          {count > 0 && <span className="text-sub">（合計 +{formatNumber(def.storageBonus * count, 'full')}）</span>}
        </div>
      )}
      {def.transport && (
        <div className="card__body num" style={{ fontSize: 13 }}>
          輸送 <span className="text-profit">{(def.transport.capacity * derived.modifiers.transportCapacity).toFixed(2)}t/秒</span> / 台、費用 {(def.transport.costPerTon * derived.modifiers.transportCost).toFixed(1)}円/t
          {def.transport.liquidOnly && <span className="text-sub">（液体のみ）</span>}
        </div>
      )}
      {def.income !== undefined && land && (
        <div className="card__body num" style={{ fontSize: 13 }}>
          収入 <span className="text-profit">{formatMoney(def.income * derived.modifiers.commercialIncome * landPopulation(land), mode)}/秒</span> / 個
          <span className="text-sub">（人口係数 ×{landPopulation(land)}）</span>
          {count > 0 && runtime && <span className="text-sub">　合計 {formatMoney(def.income * count * derived.modifiers.commercialIncome * runtime.efficiency * landPopulation(land), mode)}/秒</span>}
        </div>
      )}
      {def.researchRate && (
        <div className="card__body num" style={{ fontSize: 13 }}>
          研究ポイント <span className="text-research">+{def.researchRate}/秒</span> / 個
        </div>
      )}
      {runtime && count > 0 && (io || def.income) && (
        <div style={{ marginTop: 8 }} className={runtime.efficiency > 0 ? 'gauge gauge--live' : 'gauge'}>
          <div className="row row--between text-sub" style={{ fontSize: 12, marginBottom: 4 }}>
            <span>稼働率</span>
            <span className="num">{formatPercent(runtime.efficiency)}</span>
          </div>
          <ProgressBar ratio={runtime.efficiency} tone={runtime.efficiency >= 0.999 ? 'profit' : runtime.efficiency > 0 ? 'warn' : 'loss'} />
        </div>
      )}
      {diagnosis && <FixPanel diagnosis={diagnosis} />}
      {!build.ok ? (
        <div className="card__actions">
          <Badge tone="warn">{build.reason}</Badge>
        </div>
      ) : (
        <div className="card__actions btn-row">
          <Button variant="primary" size="sm" disabled={affordable < 1 || atMax} onClick={() => buy(1)} title="長押しで連続" {...hold}>
            {def.isWorker ? '雇う' : def.transport ? '配備' : '建設'} {formatMoney(nextCost, mode)}
          </Button>
          <Button variant="secondary" size="sm" disabled={affordable < 10 || atMax} onClick={() => buy(10)}>
            ×10
          </Button>
          <Button variant="secondary" size="sm" disabled={affordable < 1 || atMax} onClick={() => buy('max')}>
            MAX ({affordable})
          </Button>
        </div>
      )}
    </Card>
  );
}
