import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FACILITY_CATEGORY_LABEL, FACILITY_MAP, facilityCost, facilityMaxAffordable, isFacilityId, type FacilityDef, type FacilityId } from '@/game/data/facilities';
import { RECIPE_MAP, isRecipeId } from '@/game/data/recipes';
import { RESOURCE_MAP, isResourceId, type ResourceId } from '@/game/data/resources';
import { TOOL_MAP, isToolId } from '@/game/data/tools';
import { findFacility } from '@/game/engine/actions/facility';
import { describeCondition, isUnlocked } from '@/game/engine/systems/unlocks';
import { bumpGame, useGame } from '@/stores/gameStore';
import type { FacilityStatus } from '@/types/state';
import { formatMoney, formatNumber, formatPercent, formatRate } from '@/utils/format';

const NAMES = {
  resource: (id: string) => (isResourceId(id) ? RESOURCE_MAP[id].name : id),
  tool: (id: string) => (isToolId(id) ? TOOL_MAP[id].name : id),
  recipe: (id: string) => (isRecipeId(id) ? RECIPE_MAP[id].name : id),
  facility: (id: string) => (isFacilityId(id) ? FACILITY_MAP[id].name : id),
};

const STATUS_LABEL: Record<FacilityStatus, { label: string; tone: 'profit' | 'warn' | 'loss' | 'default' }> = {
  running: { label: '稼働中', tone: 'profit' },
  partial: { label: '一部稼働', tone: 'warn' },
  no_input: { label: '停止: 材料不足', tone: 'loss' },
  storage_full: { label: '停止: 倉庫満杯', tone: 'loss' },
  disabled: { label: '停止中 (OFF)', tone: 'default' },
  idle: { label: '待機', tone: 'default' },
};

export function FacilityCard({ def }: { def: FacilityDef }) {
  const { state, derived, engine } = useGame();
  const id = def.id as FacilityId;
  const mode = state.settings.numberFormat;
  const unlocked = isUnlocked(state, 'facility', id);
  const inst = findFacility(state, id);
  const count = inst?.count ?? 0;
  const nextCost = facilityCost(def, count);
  const affordable = facilityMaxAffordable(def, count, state.company.cash);
  const runtime = inst ? derived.facilityRuntime[inst.id] : undefined;
  const status = runtime ? STATUS_LABEL[runtime.status] : null;
  const atMax = def.maxCount !== undefined && count >= def.maxCount;

  const buy = (n: number | 'max') => {
    engine.buyFacility(id, n);
    bumpGame();
  };

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
  return (
    <Card>
      <div className="card__head">
        <Icon name={def.icon} size={40} fallback={def.name.slice(0, 2)} />
        <div className="row__grow">
          <div className="card__title">
            {def.name} <span className="text-sub num">×{count}</span>
          </div>
          <div className="card__sub">
            <Badge>{FACILITY_CATEGORY_LABEL[def.category]}</Badge> <span>本社</span>
            {status && count > 0 && (
              <span style={{ marginLeft: 6 }}>
                <Badge tone={status.tone}>{status.label}</Badge>
              </span>
            )}
          </div>
        </div>
        {inst && count > 0 && io && (
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
      {io && (
        <div className="card__body" style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div className="stat__label">入力 /秒{count > 0 ? `（×${count}）` : ''}</div>
            {io.inputs ? (
              (Object.entries(io.inputs) as [ResourceId, number][]).map(([rid, rate]) => (
                <div key={rid} className={`row num ${runtime?.missingInputs.includes(rid) ? 'text-loss' : ''}`} style={{ fontSize: 13, gap: 4 }}>
                  <Icon name={RESOURCE_MAP[rid].icon} size={16} />
                  {RESOURCE_MAP[rid].name} {formatRate(-rate * Math.max(1, count), mode)}
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
                <div key={rid} className={`row num ${runtime?.blockedOutputs.includes(rid) ? 'text-loss' : 'text-profit'}`} style={{ fontSize: 13, gap: 4 }}>
                  <Icon name={RESOURCE_MAP[rid].icon} size={16} />
                  {RESOURCE_MAP[rid].name} {formatRate(rate * Math.max(1, count), mode)}
                </div>
              ))}
          </div>
        </div>
      )}
      {def.storageBonus && (
        <div className="card__body num" style={{ fontSize: 13 }}>
          倉庫容量 <span className="text-profit">+{formatNumber(def.storageBonus, 'full')}</span> / 個
          {count > 0 && <span className="text-sub">（合計 +{formatNumber(def.storageBonus * count, 'full')}）</span>}
        </div>
      )}
      {runtime && count > 0 && io && (
        <div style={{ marginTop: 8 }}>
          <div className="row row--between text-sub" style={{ fontSize: 12, marginBottom: 4 }}>
            <span>生産効率</span>
            <span className="num">{formatPercent(runtime.efficiency)}</span>
          </div>
          <ProgressBar ratio={runtime.efficiency} tone={runtime.efficiency >= 0.999 ? 'profit' : runtime.efficiency > 0 ? 'warn' : 'loss'} />
        </div>
      )}
      <div className="card__actions btn-row">
        <Button variant="primary" size="sm" disabled={affordable < 1 || atMax} onClick={() => buy(1)}>
          {def.isWorker ? '雇う' : '建設'} {formatMoney(nextCost, mode)}
        </Button>
        <Button variant="secondary" size="sm" disabled={affordable < 10 || atMax} onClick={() => buy(10)}>
          ×10
        </Button>
        <Button variant="secondary" size="sm" disabled={affordable < 1 || atMax} onClick={() => buy('max')}>
          MAX ({affordable})
        </Button>
      </div>
    </Card>
  );
}
