import { Suspense, lazy } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { CONFIG } from '@/game/data/config';
import { COUNTRY_NAME, COUNTRY_ORDER, LANDS, type LandDef } from '@/game/data/lands';
import { isEstateSystemUnlocked, isLandSystemUnlocked } from '@/game/engine/systems/unlocks';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate, formatNumber } from '@/utils/format';
import { CompanySheet } from '@/features/estate/CompanySheet';
import { PropertyList } from '@/features/estate/PropertyList';
import { PropertySheet } from '@/features/estate/PropertySheet';
import { StockList } from '@/features/estate/StockList';
import { LandCard } from '@/features/land/LandCard';
import { LandDetailSheet } from '@/features/land/LandDetailSheet';

// Leaflet は大きいので、地図を開いたときだけ読み込む
const RealMap = lazy(() => import('@/features/estate/RealMap').then((m) => ({ default: m.RealMap })));

const GUIDE = [
  { icon: 'icon_ui_location', title: '実在の地図で土地を買う', text: '産業用地（鉱山や農園を建てる土地）も、銀座のビルや北海道の原野も、同じ地図から買える。価格はその場所の実勢に近い水準。' },
  { icon: 'icon_facility_iron_mine', title: '買った土地に建てる', text: '土地を調査して鉱山・農園・発電所・研究所・商業施設を建てる。輸送手段を置くと生産物が本社へ届く。' },
  { icon: 'icon_ui_chart', title: '賃料と株', text: '住宅やビルは賃料が毎秒入る。架空の28社の株を売買して配当も得られ、3分の2を持つと経営権を握れる。' },
];

/** 地図。土地（産業用地）・不動産・株をここにまとめている */
export function MapPage() {
  const { state, derived } = useGame();
  const sub = useUiStore((s) => s.mapSubTab);
  const setSub = useUiStore((s) => s.setMapSubTab);
  const mode = state.settings.numberFormat;
  const landUnlocked = isLandSystemUnlocked(state, derived.assets);
  const estateUnlocked = isEstateSystemUnlocked(state, derived.assets);

  if (!landUnlocked) {
    const target = CONFIG.landUnlockAssets;
    const ratio = derived.assets / target;
    return (
      <div className="page">
        <h1 className="page__title">
          地図<small>土地と不動産</small>
        </h1>
        <Card>
          <div className="card__head">
            <Icon name="icon_ui_lock" size={36} fallback="LK" />
            <div className="row__grow">
              <div className="card__title">地図はまだ使えません</div>
              <div className="card__sub">総資産が {formatMoney(target, 'full')} に達すると、土地を買えるようになります。</div>
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
        <div className="section-title">できるようになること</div>
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
  const ownedProps = Object.keys(state.estate.owned).length;
  const holdings = Object.values(state.stocks.companies).filter((c) => c.playerShares > 0).length;
  const defs = LANDS as readonly LandDef[];
  const byCountry = COUNTRY_ORDER.map((c) => ({ c, lands: defs.filter((l) => l.country === c) })).filter((g) => g.lands.length > 0);

  return (
    <div className="page">
      <h1 className="page__title">
        地図<small>土地・不動産・株</small>
      </h1>
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="所有する土地" value={`${formatNumber(owned, mode)}か所`} extra={`${new Set(state.lands.map((l) => l.country)).size}か国`} />
          <Stat label="輸送費 /秒" value={formatMoneyRate(-derived.transportCost, mode)} tone={derived.transportCost > 0 ? 'loss' : 'default'} />
          <Stat label="不動産" value={formatMoney(derived.estateValue, mode)} extra={`${ownedProps}件・賃料 ${formatMoneyRate(derived.rentPerSec, mode)}`} />
          <Stat label="株式" value={formatMoney(derived.stockValue, mode)} extra={`${holdings}社・配当 ${formatMoneyRate(derived.dividendPerSec, mode)}`} />
          <Stat label="所持金" value={formatMoney(state.company.cash, mode)} />
          <Stat label="総資産" value={formatMoney(derived.assets, mode)} />
        </div>
      </Card>
      <Segmented
        ariaLabel="地図の表示"
        items={[
          { id: 'map', label: '地図' },
          { id: 'lands', label: '産業用地' },
          ...(estateUnlocked
            ? [
                { id: 'properties' as const, label: '物件' },
                { id: 'stocks' as const, label: '株式' },
              ]
            : []),
        ]}
        value={sub}
        onChange={setSub}
      />
      {sub === 'map' && (
        <>
          <Suspense
            fallback={
              <Card>
                <div className="card__body text-sub">地図を読み込み中…</div>
              </Card>
            }
          >
            <RealMap />
          </Suspense>
          <p className="text-sub" style={{ fontSize: 12 }}>
            ピンをタップすると詳細が開きます。産業用地は施設を建てられる土地、そのほかは賃料が入る物件です。
          </p>
        </>
      )}
      {sub === 'lands' &&
        byCountry.map(({ c, lands }) => (
          <div key={c}>
            <div className="section-title">{COUNTRY_NAME[c]}</div>
            <div className="grid grid--2">
              {lands.map((l) => (
                <LandCard key={l.id} def={l} />
              ))}
            </div>
          </div>
        ))}
      {sub === 'properties' && estateUnlocked && <PropertyList />}
      {sub === 'stocks' && estateUnlocked && <StockList />}
      <p className="text-dim" style={{ fontSize: 12 }}>
        物件・会社は架空です。場所と価格の水準だけ実在を参考にしています。
      </p>
      <LandDetailSheet />
      <PropertySheet />
      <CompanySheet />
    </div>
  );
}
