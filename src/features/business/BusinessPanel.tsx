import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { BUSINESSES, BUSINESS_MAP, SECTOR_LABEL, awarenessLabel, brandLabel, type BusinessDef, type BusinessSector } from '@/game/data/business';
import { availablePlaces, customersPerSec, digPerSec, divisionProfitPerSec, divisionWage, divisions, footfall, isBusinessUnlocked, parkingSpaces } from '@/game/engine/systems/business';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatMoneyRate, formatNumber } from '@/utils/format';
import { sfx } from '@/utils/sfx';
import { DivisionSheet } from './DivisionSheet';
import { GamblingPanel } from './GamblingPanel';

const SECTORS: BusinessSector[] = ['retail', 'mining', 'industry', 'info', 'logistics', 'finance'];

/** 事業。自分で始めたお店・会社の一覧と、新しく始める画面 */
export function BusinessPanel() {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const setOpenDivision = useUiStore((s) => s.setOpenDivision);
  const setTab = useUiStore((s) => s.setTab);
  const [sector, setSector] = useState<BusinessSector>('retail');
  const [pick, setPick] = useState<BusinessDef | null>(null);
  const [place, setPlace] = useState<string>('');
  const [message, setMessage] = useState('');
  const mine = divisions(state);
  const places = availablePlaces(state);
  const unlockedCount = BUSINESSES.filter((b) => isBusinessUnlocked(state, b.id)).length;
  const totalProfit = mine.reduce((a, d) => a + divisionProfitPerSec(state, d), 0);

  return (
    <div className="list">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="事業の数" value={`${mine.length}件`} extra={`始められる業種 ${unlockedCount} / ${BUSINESSES.length}`} />
          <Stat label="事業の利益 /秒" value={formatMoneyRate(totalProfit, mode)} tone={totalProfit >= 0 ? 'profit' : 'loss'} />
          <Stat label="事業の人件費 /秒" value={formatMoneyRate(-mine.reduce((a, d) => a + divisionWage(state, d), 0), mode)} tone="loss" />
          <Stat label="広告費 /秒" value={formatMoneyRate(-derived.adCost, mode)} tone={derived.adCost > 0 ? 'loss' : 'default'} />
        </div>
        <p className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
          地図で買った場所に、お店や会社を構えられます。人を雇うと毎秒の人件費がかかり、知名度とブランド価値が育つほど客と仕事が増えます。
        </p>
      </Card>

      {mine.length > 0 && <div className="section-title">やっている事業</div>}
      <div className="grid grid--2">
        {mine.map((d) => {
          const def = BUSINESS_MAP[d.kind];
          const profit = divisionProfitPerSec(state, d);
          const shop = def.style === 'shop';
          const mine = def.style === 'mine';
          return (
            <Card key={d.id} flat>
              <div className="card__head">
                <Icon name={def.icon} size={30} fallback={def.name.slice(0, 2)} />
                <div className="row__grow">
                  <div className="card__title">{d.name}</div>
                  <div className="card__sub">
                    {def.name}・{state.lands.find((l) => l.id === d.landId)?.name ?? d.landId}
                  </div>
                </div>
                <Badge tone={profit >= 0 ? 'profit' : 'loss'}>{formatMoneyRate(profit, mode)}</Badge>
              </div>
              <div className="card__body">
                <ProgressBar ratio={d.awareness / 100} tone="research" label={`知名度 ${Math.round(d.awareness)}（${awarenessLabel(d.awareness)}）`} />
                <div style={{ height: 6 }} />
                <ProgressBar ratio={d.brand / 100} tone="profit" label={`ブランド ${Math.round(d.brand)}（${brandLabel(d.brand)}）`} />
                <div className="stat-grid" style={{ marginTop: 8 }}>
                  <Stat label="従業員" value={`${formatNumber(d.staff, mode)}人`} extra={formatMoneyRate(-divisionWage(state, d), mode)} />
                  {shop ? (
                    <Stat label="来客 /秒" value={`${customersPerSec(state, d).toFixed(1)}人`} extra={`駐車 ${parkingSpaces(state, d)}台`} />
                  ) : mine ? (
                    <Stat label="採掘 /秒" value={`${digPerSec(state, d).toFixed(1)}`} extra={d.rush && d.rush > 0 ? '大鉱脈！×3' : `通算 ${formatNumber(Math.round(d.dug ?? 0), mode)}`} tone={d.rush && d.rush > 0 ? 'profit' : 'default'} />
                  ) : (
                    <Stat label="進行中の案件" value={`${d.projects.length}件`} extra={`製品 ${d.products.length}件`} />
                  )}
                  <Stat label="通算の売上" value={formatMoney(d.totalEarned, mode)} />
                </div>
                <Button size="sm" block variant="primary" style={{ marginTop: 8 }} onClick={() => setOpenDivision(d.id)}>
                  くわしく見る・動かす ›
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="section-title">新しく始める</div>
      <Segmented
        ariaLabel="業種の系統"
        items={SECTORS.map((s) => ({ id: s, label: SECTOR_LABEL[s] }))}
        value={sector}
        onChange={(v) => setSector(v as BusinessSector)}
      />
      <div className="grid grid--2">
        {BUSINESSES.filter((b) => b.sector === sector).map((b) => {
          const unlocked = isBusinessUnlocked(state, b.id);
          const affordable = state.company.cash >= b.setupCost;
          return (
            <Card key={b.id} flat locked={!unlocked}>
              <div className="card__head">
                <Icon name={b.icon} size={30} fallback={b.name.slice(0, 2)} />
                <div className="row__grow">
                  <div className="card__title">{b.name}</div>
                  <div className="card__sub">{b.description}</div>
                </div>
              </div>
              <div className="card__body">
                <div className="stat-grid">
                  <Stat label="開業の費用" value={formatMoney(b.setupCost, mode)} tone={affordable ? 'default' : 'loss'} />
                  <Stat label="人件費" value={`${b.wagePerStaff}円/秒/人`} extra={`最初 ${b.initialStaff}人`} />
                </div>
                <div className="text-sub" style={{ fontSize: 12, margin: '6px 0' }}>
                  {b.placeHint}
                </div>
                {unlocked ? (
                  <Button size="sm" block variant={affordable ? 'primary' : 'secondary'} disabled={!affordable} onClick={() => setPick(b)}>
                    この事業を始める
                  </Button>
                ) : (
                  <Button size="sm" block onClick={() => setTab('research')}>
                    研究で解放する ›
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {pick && (
        <Card>
          <div className="card__head">
            <Icon name={pick.icon} size={32} fallback={pick.name.slice(0, 2)} />
            <div className="row__grow">
              <div className="card__title">{pick.name} をどこに構えますか</div>
              <div className="card__sub">{pick.placeHint}。地図で買った場所から選びます。</div>
            </div>
          </div>
          <div className="card__body">
            {places.length === 0 ? (
              <>
                <p className="text-sub" style={{ fontSize: 12 }}>
                  使える場所がありません。地図から土地や建物を買ってください。
                </p>
                <Button size="sm" onClick={() => setTab('map')}>
                  地図へ ›
                </Button>
              </>
            ) : (
              <div className="list" style={{ gap: 6 }}>
                {places.map((p) => (
                  <button
                    key={p.landId}
                    type="button"
                    className={`row row--between tree__req${place === p.landId ? ' text-research' : ''}`}
                    onClick={() => setPlace(p.landId)}
                  >
                    <span>{p.name}</span>
                    <span className="num text-sub" style={{ fontSize: 12 }}>
                      人通り {footfall(state, p.landId).toFixed(1)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 8 }}>
              <Button
                variant="primary"
                size="sm"
                disabled={!place}
                onClick={() => {
                  const r = engine.openDivision(pick.id, place);
                  setMessage(r.reason ?? '');
                  if (r.ok) {
                    sfx('buy');
                    setPick(null);
                    setPlace('');
                    if (r.id) setOpenDivision(r.id);
                  }
                  bumpGame();
                }}
              >
                ここに開業する（{formatMoney(pick.setupCost, mode)}）
              </Button>
              <Button size="sm" onClick={() => setPick(null)}>
                やめる
              </Button>
            </div>
            {message && (
              <div className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
                {message}
              </div>
            )}
          </div>
        </Card>
      )}

      {state.research.completed.gaming_license && (
        <>
          <div className="section-title">賭け事</div>
          <GamblingPanel />
        </>
      )}

      <DivisionSheet />
    </div>
  );
}
