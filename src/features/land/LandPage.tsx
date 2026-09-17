import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { CONFIG } from '@/game/data/config';
import { COUNTRY_NAME, COUNTRY_ORDER, LANDS, type LandDef } from '@/game/data/lands';
import { isLandSystemUnlocked } from '@/game/engine/systems/unlocks';
import { bumpGame, useGame } from '@/stores/gameStore';
import { formatMoney, formatNumber } from '@/utils/format';
import { LandCard } from './LandCard';
import { LandDetailSheet } from './LandDetailSheet';
import { WorldMap } from './WorldMap';

const GUIDE = [
  { icon: 'icon_marker_survey', title: '調査', text: '未調査 → 簡易調査 → 地質調査 → 試掘 → 確定。地質調査で鉱山を建てられ、試掘で採掘 +20%。' },
  { icon: 'icon_facility_iron_mine', title: '採掘と農園', text: '鉱脈は有限。掘り尽くすと止まる。農園は地形で効率が変わる。' },
  { icon: 'icon_logistics_truck', title: '物流', text: '土地にトラックなどを配備すると、生産物が本社へ運ばれ、工場の材料は本社から届く。' },
];

export function LandPage() {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const view = state.settings.landView ?? 'map';
  const unlocked = isLandSystemUnlocked(state, derived.assets);
  const target = CONFIG.landUnlockAssets;
  const ratio = derived.assets / target;

  if (!unlocked) {
    return (
      <div className="page">
        <h1 className="page__title">
          土地<small>世界へ展開する</small>
        </h1>
        <Card>
          <div className="card__head">
            <Icon name="icon_ui_lock" size={36} fallback="LK" />
            <div className="row__grow">
              <div className="card__title">土地システムは未解放</div>
              <div className="card__sub">総資産が {formatMoney(target, 'full')} に達すると解放されます。</div>
            </div>
          </div>
          <div className="card__body">
            <div className="stat-grid" style={{ marginBottom: 8 }}>
              <Stat label="現在の総資産" value={formatMoney(derived.assets, mode)} />
              <Stat label="必要な資産" value={formatMoney(target, mode)} />
            </div>
            <ProgressBar ratio={ratio} tone="research" size="lg" />
            <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
              {Math.min(100, ratio * 100).toFixed(1)}%
            </div>
          </div>
        </Card>
        <div className="section-title">解放後にできること</div>
        <div className="grid grid--2">
          {GUIDE.map((p) => (
            <Card key={p.title} flat>
              <div className="card__head">
                <Icon name={p.icon} size={32} fallback={p.title.slice(0, 2)} />
                <div className="row__grow">
                  <div className="card__title">{p.title}</div>
                  <div className="card__sub">{p.text}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const owned = state.lands.length - 1;
  const countries = new Set(state.lands.map((l) => l.country)).size;
  const transportCost = derived.transportCost;
  const defs = LANDS as readonly LandDef[];
  const byCountry = COUNTRY_ORDER.map((c) => ({ c, lands: defs.filter((l) => l.country === c) })).filter((g) => g.lands.length > 0);

  return (
    <div className="page">
      <h1 className="page__title">
        土地<small>世界地図</small>
      </h1>
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="所有する土地" value={`${formatNumber(owned, mode)}か所`} />
          <Stat label="進出国" value={`${countries}か国`} />
          <Stat label="輸送費" value={`${formatMoney(transportCost, mode)}/秒`} tone={transportCost > 0 ? 'loss' : 'default'} />
          <Stat label="所持金" value={formatMoney(state.company.cash, mode)} />
        </div>
      </Card>
      <Segmented
        ariaLabel="土地の表示"
        items={[
          { id: 'map', label: '地図' },
          { id: 'list', label: 'リスト' },
        ]}
        value={view}
        onChange={(v) => {
          engine.updateSettings({ landView: v });
          bumpGame();
        }}
      />
      {view === 'map' ? (
        <>
          <WorldMap />
          <p className="text-sub" style={{ fontSize: 12 }}>
            マーカーをタップすると詳細が開きます。本社（日本）と所有地は線で結ばれ、点滅しているのは「購入できる土地」か「停止中の施設がある土地」です。
          </p>
        </>
      ) : (
        byCountry.map(({ c, lands }) => (
          <div key={c}>
            <div className="section-title">{COUNTRY_NAME[c]}</div>
            <div className="grid grid--2">
              {lands.map((l) => (
                <LandCard key={l.id} def={l} />
              ))}
            </div>
          </div>
        ))
      )}
      <p className="text-dim" style={{ fontSize: 12 }}>
        土地データは実在地域を参考にしたゲーム用の値です。現実の数値そのものではありません。
      </p>
      <LandDetailSheet />
    </div>
  );
}
