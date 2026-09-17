import { Suspense, lazy } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { CONFIG } from '@/game/data/config';
import { isEstateSystemUnlocked } from '@/game/engine/systems/unlocks';
import { bumpGame, useGame } from '@/stores/gameStore';
import { formatMoney, formatMoneyRate } from '@/utils/format';
import { LandDetailSheet } from '../land/LandDetailSheet';
import { CompanySheet } from './CompanySheet';
import { PropertyList } from './PropertyList';
import { PropertySheet } from './PropertySheet';
import { StockList } from './StockList';

// Leaflet は大きいので、地図を開いたときだけ読み込む
const RealMap = lazy(() => import('./RealMap').then((m) => ({ default: m.RealMap })));

const GUIDE = [
  { icon: 'icon_ui_location', title: '実在の地図で物件を買う', text: '東京・銀座から北海道の原野、ニューヨークやドバイまで、実在の場所の土地・ビル・ホテルを買える。賃料が毎秒入り、地価の上下で評価額も動く。' },
  { icon: 'icon_ui_chart', title: '会社の株を買う', text: '架空の28社の株を売買。配当が入り、株価の値上がり益も狙える。' },
  { icon: 'icon_office_contract', title: '3分の2で経営権', text: '発行株の3分の2を持つと、方針変更・増設・解体・完全買収ができる。買収すればその会社の物件も手に入る。' },
];

export function EstatePage() {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const view = state.settings.estateView ?? 'map';
  const unlocked = isEstateSystemUnlocked(state, derived.assets);
  const target = CONFIG.estate.unlockAssets;
  const ratio = derived.assets / target;

  if (!unlocked) {
    return (
      <div className="page">
        <h1 className="page__title">
          不動産・株式<small>実在の地図で資産を増やす</small>
        </h1>
        <Card>
          <div className="card__head">
            <Icon name="icon_ui_lock" size={36} fallback="LK" />
            <div className="row__grow">
              <div className="card__title">不動産・株式は未解放</div>
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

  const ownedCount = Object.keys(state.estate.owned).length;
  const holdings = Object.values(state.stocks.companies).filter((c) => c.playerShares > 0).length;

  return (
    <div className="page">
      <h1 className="page__title">
        不動産・株式<small>実在の地図</small>
      </h1>
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="不動産の評価額" value={formatMoney(derived.estateValue, mode)} extra={`${ownedCount}件`} />
          <Stat label="賃料 /秒" value={formatMoneyRate(derived.rentPerSec, mode)} tone={derived.rentPerSec > 0 ? 'profit' : 'default'} />
          <Stat label="株式の評価額" value={formatMoney(derived.stockValue, mode)} extra={`${holdings}社`} />
          <Stat label="配当 /秒" value={formatMoneyRate(derived.dividendPerSec, mode)} tone={derived.dividendPerSec > 0 ? 'profit' : 'default'} />
          <Stat label="所持金" value={formatMoney(state.company.cash, mode)} />
          <Stat label="総資産" value={formatMoney(derived.assets, mode)} />
          <Stat label="累計賃料" value={formatMoney(state.stats.rentEarned, mode)} />
          <Stat label="累計配当" value={formatMoney(state.stats.dividendsEarned, mode)} />
        </div>
      </Card>
      <Segmented
        ariaLabel="不動産・株式の表示"
        items={[
          { id: 'map', label: '地図' },
          { id: 'list', label: '物件' },
          { id: 'stocks', label: '株式' },
        ]}
        value={view}
        onChange={(v) => {
          engine.updateSettings({ estateView: v });
          bumpGame();
        }}
      />
      {view === 'map' && (
        <Suspense
          fallback={
            <Card>
              <div className="card__body text-sub">地図を読み込み中…</div>
            </Card>
          }
        >
          <RealMap />
        </Suspense>
      )}
      {view === 'list' && <PropertyList />}
      {view === 'stocks' && <StockList />}
      <PropertySheet />
      <CompanySheet />
      <LandDetailSheet />
    </div>
  );
}
