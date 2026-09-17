import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Sheet } from '@/components/ui/Sheet';
import { Stat } from '@/components/ui/Stat';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { COUNTRY_NAME, LAND_MAP, isLandDefId } from '@/game/data/lands';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { SURVEY_LEVEL_LABEL, SURVEY_STAGES, nextSurveyStage } from '@/game/data/survey';
import { TERRAINS } from '@/game/data/terrain';
import { surveyCost } from '@/game/engine/actions/land';
import { getLand } from '@/game/engine/land';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { STATUS_LABEL } from '@/features/factory/FacilityCard';
import { formatAmount, formatDuration, formatMoney, formatNumber, formatRate } from '@/utils/format';
import { sfx } from '@/utils/sfx';

/** 土地の詳細（購入・調査・鉱脈・現地在庫・輸送・施設） */
export function LandDetailSheet() {
  const selected = useUiStore((s) => s.selectedLand);
  const openLand = useUiStore((s) => s.openLand);
  const setTab = useUiStore((s) => s.setTab);
  const setFactoryLand = useUiStore((s) => s.setFactoryLand);
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const id = selected && isLandDefId(selected) ? selected : null;
  const def = id ? LAND_MAP[id] : null;
  const land = id ? getLand(state, id) : undefined;
  const close = () => openLand(null);
  if (!def || !id) return null;
  const terrain = TERRAINS[def.terrain];
  const title = (
    <span>
      {def.name} <span className="text-sub" style={{ fontSize: 12, fontWeight: 400 }}>{COUNTRY_NAME[def.country]}・{def.region}</span>
    </span>
  );

  // ---- 未所有 ----
  if (!land) {
    const canBuy = state.company.cash >= def.price;
    return (
      <Sheet open onClose={close} title={title} icon={<Icon name={terrain.icon} size={32} fallback={terrain.name.slice(0, 2)} />}>
        <div className="sheet__section">
          <p className="card__sub">{def.description}</p>
          <div className="stat-grid" style={{ marginTop: 8 }}>
            <Stat label="価格" value={formatMoney(def.price, 'full')} size="lg" extra={`${def.areaSqm.toLocaleString('ja-JP')}㎡ × ${def.unitPrice.toLocaleString('ja-JP')}円/㎡（その地域の実勢に近い単価）`} />
            <Stat label="地形" value={terrain.name} extra={terrain.description} />
            <Stat label="人口係数" value={`×${def.population}`} extra="商業施設の収入に掛かる" />
            <Stat label="資源" value={Object.keys(def.deposits).length > 0 ? '調査で判明' : 'なし'} extra={Object.keys(def.deposits).length > 0 ? '購入後に地下資源調査ができる' : '農園・発電・商業向け'} />
          </div>
        </div>
        <div className="sheet__section">
          <Button
            variant="primary"
            block
            disabled={!canBuy}
            onClick={() => {
              if (engine.buyLand(id)) {
                sfx('land');
                bumpGame();
              }
            }}
          >
            {canBuy ? `購入する（${formatMoney(def.price, 'full')}）` : `資金不足（あと ${formatMoney(def.price - state.company.cash, mode)}）`}
          </Button>
        </div>
      </Sheet>
    );
  }

  // ---- 所有 ----
  const rt = derived.lands[land.id];
  const stage = nextSurveyStage(land.survey);
  const cost = stage ? surveyCost(state, land.id, land.survey, derived.modifiers.surveyCost) : 0;
  const duration = stage ? Math.round(stage.duration * derived.modifiers.surveyTime) : 0;
  const progress = land.surveyProgress;
  const depositIds = Object.keys(land.deposits) as ResourceId[];
  const facilities = state.facilities.filter((f) => f.landId === land.id && f.count > 0);
  const stock = (Object.entries(land.stock) as [ResourceId, number][]).filter(([, v]) => (v ?? 0) >= 0.5);

  const depositAmount = (rid: ResourceId): string => {
    const d = land.deposits[rid];
    if (!d) return '—';
    if (land.survey >= 3) return `${formatNumber(Math.floor(d.remaining), 'full')} / ${formatNumber(d.total, 'full')}`;
    if (land.survey >= 2) {
      // 地質調査: 1桁の概算（±）
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, d.remaining))));
      return `およそ ${formatNumber(Math.round(d.remaining / mag) * mag, 'full')} 前後`;
    }
    return '量は不明';
  };

  return (
    <Sheet open onClose={close} title={title} icon={<Icon name={terrain.icon} size={32} fallback={terrain.name.slice(0, 2)} />}>
      <div className="sheet__section">
        <div className="stat-grid stat-grid--4">
          <Stat label="地形" value={terrain.name} />
          <Stat label="調査" value={SURVEY_LEVEL_LABEL[land.survey]} tone={land.survey >= 2 ? 'research' : 'default'} />
          <Stat label="倉庫容量" value={formatAmount(rt?.capacity ?? 0, mode)} />
          <Stat label="輸送能力" value={rt ? `${rt.transportCapacity.toFixed(1)}t/秒` : '—'} tone={rt?.noRoute ? 'loss' : 'default'} extra={rt ? `使用 ${rt.transportUsed.toFixed(2)}t/秒・${formatMoney(rt.transportCost, mode)}/秒` : undefined} />
        </div>
      </div>

      <div className="sheet__section">
        <div className="section-title" style={{ marginTop: 0 }}>
          地下資源調査
        </div>
        {progress ? (
          <div>
            <div className="row row--between text-sub" style={{ fontSize: 12, marginBottom: 4 }}>
              <span>{SURVEY_LEVEL_LABEL[progress.targetLevel].replace('済み', '')}中</span>
              <span className="num">残り {formatDuration(progress.remaining)}</span>
            </div>
            <ProgressBar ratio={1 - progress.remaining / progress.total} tone="research" size="lg" />
          </div>
        ) : stage ? (
          <div>
            <p className="card__sub">
              次: <b>{stage.name}</b> — {stage.description}
            </p>
            <Button
              variant="primary"
              block
              disabled={state.company.cash < cost}
              onClick={() => {
                if (engine.startSurvey(land.id)) {
                  sfx('buy');
                  bumpGame();
                }
              }}
            >
              {stage.actionLabel}（{formatMoney(cost, 'full')}・{formatDuration(duration)}）
            </Button>
          </div>
        ) : (
          <p className="card__sub">{land.survey === 4 ? '埋蔵量は確定しています。' : '試掘まで完了。実際に採掘すると「確定」になります。'}</p>
        )}
        <div className="list" style={{ marginTop: 8 }}>
          {depositIds.length === 0 && <div className="text-dim" style={{ fontSize: 13 }}>{land.survey >= 1 ? 'この土地に鉱脈はありません。' : '未調査です。'}</div>}
          {land.survey >= 1 &&
            depositIds.map((rid) => {
              const d = land.deposits[rid]!;
              return (
                <div key={rid} className="row">
                  <Icon name={RESOURCE_MAP[rid].icon} size={24} />
                  <div className="row__grow">
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{RESOURCE_MAP[rid].name}の鉱脈</div>
                    <div className="text-sub num" style={{ fontSize: 12 }}>
                      {depositAmount(rid)}
                    </div>
                  </div>
                  {land.survey >= 3 && (
                    <div style={{ width: 80 }}>
                      <ProgressBar ratio={d.total > 0 ? d.remaining / d.total : 0} tone={d.remaining <= 0 ? 'loss' : 'accent'} />
                    </div>
                  )}
                </div>
              );
            })}
          {land.survey === 0 && depositIds.length > 0 && <div className="text-dim" style={{ fontSize: 13 }}>簡易調査で埋まっている資源が分かります。</div>}
        </div>
        {SURVEY_STAGES.length > 0 && land.survey < 2 && depositIds.length > 0 && (
          <div className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
            鉱山を建てるには地質調査が必要です。
          </div>
        )}
      </div>

      <div className="sheet__section">
        <div className="row row--between">
          <div className="section-title" style={{ marginTop: 0 }}>
            施設 {facilities.length > 0 && <span className="text-sub num">（{facilities.reduce((a, f) => a + f.count, 0)}）</span>}
          </div>
          <Button
            size="sm"
            onClick={() => {
              setFactoryLand(land.id);
              setTab('factory');
              close();
            }}
          >
            建設・管理 ›
          </Button>
        </div>
        {facilities.length === 0 ? (
          <div className="text-dim" style={{ fontSize: 13 }}>まだ施設がありません。「建設・管理」から鉱山・農園・輸送手段などを建てられます。</div>
        ) : (
          <div className="list">
            {facilities.map((f) => {
              const d = isFacilityId(f.typeId) ? FACILITY_MAP[f.typeId] : null;
              const st = derived.facilityRuntime[f.id];
              const label = st ? STATUS_LABEL[st.status] : null;
              return (
                <div key={f.id} className="row">
                  <Icon name={d?.icon ?? 'icon_ui_factory'} size={24} />
                  <div className="row__grow" style={{ fontSize: 13 }}>
                    {d?.name ?? f.typeId} <span className="text-sub num">×{f.count}</span>
                  </div>
                  {label && <Badge tone={label.tone}>{label.label}</Badge>}
                </div>
              );
            })}
            <div className="btn-row" style={{ marginTop: 6 }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (engine.buyAllOnLand(land.id) > 0) sfx('buy');
                  bumpGame();
                }}
              >
                全部 +1
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="sheet__section">
        <div className="section-title" style={{ marginTop: 0 }}>
          現地の在庫と輸送
        </div>
        {rt?.noRoute && <Badge tone="warn">輸送手段がありません。トラックなどを配備すると本社へ運ばれます。</Badge>}
        {stock.length === 0 ? (
          <div className="text-dim" style={{ fontSize: 13 }}>現地の在庫はありません。</div>
        ) : (
          <div className="list">
            {stock.map(([rid, v]) => (
              <div key={rid} className="row">
                <Icon name={RESOURCE_MAP[rid].icon} size={24} />
                <div className="row__grow" style={{ fontSize: 13 }}>
                  {RESOURCE_MAP[rid].name}
                </div>
                <span className="num">{formatAmount(v ?? 0, mode)}</span>
                {rt?.exports[rid] ? <Badge tone="profit">本社へ {formatRate(rt.exports[rid] ?? 0, mode)}/秒</Badge> : null}
                {rt?.imports[rid] ? <Badge tone="power">本社から {formatRate(rt.imports[rid] ?? 0, mode)}/秒</Badge> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
