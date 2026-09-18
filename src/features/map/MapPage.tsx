import { Suspense, lazy } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { CONFIG } from '@/game/data/config';
import { isEstateSystemUnlocked, isLandSystemUnlocked } from '@/game/engine/systems/unlocks';
import { visibleMapSubs } from '@/game/engine/systems/visibility';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate, formatNumber } from '@/utils/format';
import { CompanySheet } from '@/features/estate/CompanySheet';
import { BookmarkList } from './BookmarkList';
import { MapOverview } from './MapOverview';
import { OwnedPlaces } from './OwnedPlaces';
import { PropertySheet } from '@/features/estate/PropertySheet';
import { FeatureSheet } from '@/features/estate/FeatureSheet';
import { StockList } from '@/features/estate/StockList';
import { LandDetailSheet } from '@/features/land/LandDetailSheet';

// Leaflet は大きいので、地図を開いたときだけ読み込む
const RealMap = lazy(() => import('@/features/estate/RealMap').then((m) => ({ default: m.RealMap })));

const GUIDE = [
  { icon: 'icon_ui_location', title: '実在の場所を買う', text: '地図を拡大すると、実際に建っている建物や区画が出てくる。家でも店でも工場でも農地でも、気になった場所をそのまま買える。価格はその場所の実勢に近い水準。' },
  { icon: 'icon_facility_iron_mine', title: '買った場所に建てる', text: '買った土地を調査すると、そこに何が埋まっているかが分かる。鉱山・農園・発電所・研究所・商業施設を建て、輸送手段を置くと生産物が本社へ届く。' },
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

  // まだ何も持っていないうちは「所有地」を出さない（空の一覧を見せない）
  const subs = visibleMapSubs(state, derived);
  const active = subs.includes(sub) ? sub : 'map';
  const MAP_SUB_LABEL: Record<string, string> = { map: '地図', owned: '所有地', marks: '気になる', stocks: '株式' };

  const owned = state.lands.length - 1;
  const ownedProps = Object.keys(state.estate.owned).length;
  const ownedCustom = Object.keys(state.estate.custom ?? {}).length;
  const holdings = Object.values(state.stocks.companies).filter((c) => c.playerShares > 0).length;

  return (
    <div className="page">
      <h1 className="page__title">
        地図<small>実在の場所を買って育てる</small>
      </h1>
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="所有する土地" value={`${formatNumber(owned, mode)}ヵ所`} extra={`${new Set(state.lands.map((l) => l.country)).size}ヵ国`} />
          <Stat label="輸送費 /秒" value={formatMoneyRate(-derived.transportCost, mode)} tone={derived.transportCost > 0 ? 'loss' : 'default'} />
          <Stat label="不動産" value={formatMoney(derived.estateValue, mode)} extra={`${ownedProps + ownedCustom}件・賃料 ${formatMoneyRate(derived.rentPerSec, mode)}`} />
          <Stat label="株式" value={formatMoney(derived.stockValue, mode)} extra={`${holdings}社・配当 ${formatMoneyRate(derived.dividendPerSec, mode)}`} />
          <Stat label="所持金" value={formatMoney(state.company.cash, mode)} />
          <Stat label="総資産" value={formatMoney(derived.assets, mode)} />
        </div>
      </Card>
      {subs.length > 1 && (
        <Segmented ariaLabel="地図の表示" items={subs.map((id) => ({ id, label: MAP_SUB_LABEL[id] }))} value={active} onChange={setSub} />
      )}
      {active === 'map' && (
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
            ピンをタップすると詳細が開きます。産業用地は施設を建てられる土地、そのほかは賃料が入る物件です。地図をさらに拡大すると、実在の建物（OpenStreetMap のデータ）が表示され、その場所を買えます。
          </p>
        </>
      )}
      {active === 'owned' && (
        <>
          <MapOverview />
          <div className="section-title">ひとつずつ見る</div>
          <OwnedPlaces />
        </>
      )}
      {active === 'marks' && <BookmarkList />}
      {/*
        転生すると総資産が0に戻るので、一度開いた「株式」は出たままでも中身は使えない。
        何も描かないと空白の画面に取り残されるので、戻る条件を出す。
      */}
      {active === 'stocks' &&
        (estateUnlocked ? (
          <StockList />
        ) : (
          <Card>
            <div className="card__head">
              <Icon name="icon_ui_lock" size={32} fallback="LK" />
              <div className="row__grow">
                <div className="card__title">不動産と株式は、まだ使えません</div>
                <div className="card__sub">
                  総資産が {formatMoney(CONFIG.estate.unlockAssets, 'full')} を超えると、また使えるようになります（いま {formatMoney(derived.assets, mode)}）。
                </div>
              </div>
            </div>
          </Card>
        ))}
      <p className="text-dim" style={{ fontSize: 12 }}>
        建物の形と位置は OpenStreetMap（ODbL）のデータ、名前はそれをもじった架空のものです。価格は実勢を参考にしたゲーム用の値で、会社はすべて架空です。
      </p>
      <LandDetailSheet />
      <PropertySheet />
      <FeatureSheet />
      <CompanySheet />
    </div>
  );
}
