import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { COUNTRY_NAME, type LandDef } from '@/game/data/lands';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { SURVEY_LEVEL_LABEL } from '@/game/data/survey';
import { TERRAINS } from '@/game/data/terrain';
import { getLand } from '@/game/engine/land';
import { describeCondition, isUnlocked } from '@/game/engine/systems/unlocks';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney } from '@/utils/format';
import { NAMES } from '@/utils/names';

/** 土地1件のカード。所有していれば状態、未所有なら価格と解放条件 */
export function LandCard({ def }: { def: LandDef }) {
  const { state, derived } = useGame();
  const openLand = useUiStore((s) => s.openLand);
  const mode = state.settings.numberFormat;
  const land = getLand(state, def.id);
  const unlocked = isUnlocked(state, 'land', def.id);
  const terrain = TERRAINS[def.terrain];

  if (!land && !unlocked) {
    return (
      <Card locked>
        <div className="card__head">
          <Icon name="icon_ui_lock" size={32} fallback="LK" />
          <div className="row__grow">
            <div className="card__title">{def.name}</div>
            <div className="card__sub">
              {COUNTRY_NAME[def.country]}・{terrain.name}　解放条件: {describeCondition(def.unlock, NAMES) || '—'}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const facilities = land ? state.facilities.filter((f) => f.landId === land.id).reduce((a, f) => a + f.count, 0) : 0;
  const rt = land ? derived.lands[land.id] : undefined;
  const stopped = land ? state.facilities.some((f) => f.landId === land.id && ['no_input', 'storage_full', 'no_power', 'depleted'].includes(derived.facilityRuntime[f.id]?.status ?? '')) : false;
  const depositIds = Object.keys(def.deposits) as ResourceId[];
  return (
    <Card role="button" tabIndex={0} onClick={() => openLand(def.id)} onKeyDown={(e) => e.key === 'Enter' && openLand(def.id)} style={{ cursor: 'pointer' }}>
      <div className="card__head">
        <Icon name={terrain.icon} size={40} fallback={terrain.name.slice(0, 2)} />
        <div className="row__grow">
          <div className="card__title">
            {def.name} {land && <Badge tone="profit">所有</Badge>}
          </div>
          <div className="card__sub">
            {COUNTRY_NAME[def.country]}・{terrain.name}・人口係数 ×{def.population}
          </div>
        </div>
        <span className="text-dim" aria-hidden="true">
          ›
        </span>
      </div>
      <p className="card__sub" style={{ marginTop: 8 }}>
        {def.description}
      </p>
      {land ? (
        <div className="card__body" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Badge tone={land.survey >= 2 ? 'research' : 'default'}>{land.surveyProgress ? `${SURVEY_LEVEL_LABEL[land.surveyProgress.targetLevel].replace('済み', '')}中` : SURVEY_LEVEL_LABEL[land.survey]}</Badge>
          <Badge>施設 {facilities}</Badge>
          {rt && rt.transportCapacity > 0 && <Badge tone="power">輸送 {rt.transportCapacity.toFixed(1)}t/秒</Badge>}
          {rt?.noRoute && <Badge tone="warn">輸送手段なし</Badge>}
          {stopped && <Badge tone="loss">停止中の施設</Badge>}
          {land.survey >= 1 &&
            depositIds.map((rid) => (
              <span key={rid} className="badge num" style={{ gap: 4, display: 'inline-flex', alignItems: 'center' }}>
                <Icon name={RESOURCE_MAP[rid].icon} size={14} /> {RESOURCE_MAP[rid].name}
              </span>
            ))}
        </div>
      ) : (
        <div className="card__body row row--between">
          <span>
            <span className="stat__value num">{formatMoney(def.price, mode)}</span>
            <span className="stat__label num" style={{ display: 'block' }}>
              {def.areaSqm.toLocaleString('ja-JP')}㎡ × {def.unitPrice.toLocaleString('ja-JP')}円/㎡
            </span>
          </span>
          <Badge tone={state.company.cash >= def.price ? 'profit' : 'warn'}>{state.company.cash >= def.price ? '購入できます' : '資金不足'}</Badge>
        </div>
      )}
    </Card>
  );
}
