import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { BarChart } from '@/components/ui/Chart';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Stat } from '@/components/ui/Stat';
import { ADS, AD_MAP, type AdDef, BUSINESS_MAP, SQM_PER_PARKING, awarenessLabel, brandLabel } from '@/game/data/business';
import { PROJECT_MAP, projectsOf } from '@/game/data/projects';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { claimDeposits, customersPerSec, competition, devPerSec, digPerSec, localDemand, shopCapacity, shopModel, staffRatio, topDemand, variety, divisionProfitPerSec, divisionWage, footfall, getDivision, isProjectAvailable, parkingSpaces, retailPrice } from '@/game/engine/systems/business';
import { getCustom, landCustomId } from '@/game/engine/systems/customEstate';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatDuration, formatMoney, formatMoneyRate, formatNumber, formatPercent } from '@/utils/format';
import { sfx } from '@/utils/sfx';

type Tab = 'overview' | 'work' | 'ads' | 'supply';

/** 事業の詳細。雇用・広告・駐車場・入出荷・案件をここで動かす */
export function DivisionSheet() {
  const id = useUiStore((s) => s.openDivisionId);
  const setOpenDivision = useUiStore((s) => s.setOpenDivision);
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const [tab, setTab] = useState<Tab>('overview');
  const [message, setMessage] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  if (id === null) return null;
  const div = getDivision(state, id);
  if (!div) return null;
  const def = BUSINESS_MAP[div.kind];
  const shop = def.style === 'shop';
  const mine = def.style === 'mine';
  const close = () => {
    setOpenDivision(null);
    setConfirmClose(false);
    setMessage('');
  };
  const land = state.lands.find((l) => l.id === div.landId);
  const profit = divisionProfitPerSec(state, div);

  return (
    <Sheet open onClose={close} title={div.name} icon={<Icon name={def.icon} size={32} fallback={def.name.slice(0, 2)} />}>
      <div className="sheet__section">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <Badge tone="power">{def.name}</Badge>
          <Badge tone={profit >= 0 ? 'profit' : 'loss'}>{formatMoneyRate(profit, mode)}</Badge>
          <Badge>{land?.name ?? div.landId}</Badge>
        </div>
        <ProgressBar ratio={div.awareness / 100} tone="research" label={`知名度 ${Math.round(div.awareness)}（${awarenessLabel(div.awareness)}）`} />
        <div style={{ height: 6 }} />
        <ProgressBar ratio={div.brand / 100} tone="profit" label={`ブランド ${Math.round(div.brand)}（${brandLabel(div.brand)}）`} />
      </div>

      <div className="sheet__section">
        <Segmented
          ariaLabel="事業の表示"
          items={[
            { id: 'overview', label: '概要' },
            { id: 'work', label: shop ? '品ぞろえ' : mine ? '鉱区' : '案件' },
            { id: 'ads', label: '広告' },
            { id: 'supply', label: shop ? '入出荷' : mine ? '掘れたもの' : '製品' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </div>

      {tab === 'overview' && (
        <div className="sheet__section">
          <div className="stat-grid">
            <Stat label="従業員" value={`${formatNumber(div.staff, mode)}人`} extra={`人件費 ${formatMoneyRate(-divisionWage(state, div), mode)}`} />
            <Stat label="通算の売上" value={formatMoney(div.totalEarned, mode)} extra={`完了 ${div.completed}件`} />
            <Stat label="この場所の人通り" value={footfall(state, div.landId).toFixed(1)} extra={`競合の影響 ×${competition(state, div).toFixed(2)}`} />
            {shop ? (
              <Stat label="来客 /秒" value={`${customersPerSec(state, div).toFixed(1)}人`} extra={`駐車 ${parkingSpaces(state, div)}台`} />
            ) : mine ? (
              <Stat label="採掘 /秒" value={digPerSec(state, div, derived.modifiers.devSpeed).toFixed(2)} extra={div.rush && div.rush > 0 ? `大鉱脈！残り ${formatDuration(div.rush)}` : `通算 ${formatNumber(Math.round(div.dug ?? 0), mode)}`} tone={div.rush && div.rush > 0 ? 'profit' : 'default'} />
            ) : (
              <Stat label="仕事量 /秒" value={devPerSec(state, div, derived.modifiers.devSpeed).toFixed(1)} extra={`案件 ${div.projects.length}件・製品 ${div.products.length}件`} />
            )}
          </div>

          <BarChart
            label="いまの収支（円/秒）"
            data={[
              { label: '売上', value: profit + divisionWage(state, div), tone: 'profit' },
              { label: '人件費', value: divisionWage(state, div), tone: 'loss' },
            ]}
            format={(v) => formatMoney(v, mode)}
          />

          <div className="field" style={{ marginTop: 10 }}>
            <span className="field__label">人を雇う・減らす（上限 {def.maxStaff}人）</span>
            <div className="btn-row">
              {[-10, -1, 1, 5, 25].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  disabled={n < 0 ? div.staff <= 0 : div.staff >= def.maxStaff}
                  onClick={() => {
                    engine.setDivisionStaff(div.id, div.staff + n);
                    bumpGame();
                  }}
                >
                  {n > 0 ? `+${n}` : n}
                </Button>
              ))}
            </div>
            <div className="text-sub" style={{ fontSize: 12, marginTop: 4 }}>
              1人あたり {def.wagePerStaff}円/秒。雇うほど仕事は進みますが、赤字が続くと倒産します。
            </div>
          </div>

          {shop && (
            <div className="field" style={{ marginTop: 10 }}>
              <span className="field__label">駐車場（{SQM_PER_PARKING}㎡ で1台）</span>
              <div className="text-sub" style={{ fontSize: 12, marginBottom: 4 }}>
                持っている土地を駐車場にすると、車で来る客が入れるようになります。いま {parkingSpaces(state, div)}台。
              </div>
              <div className="list" style={{ gap: 4 }}>
                {state.lands
                  .filter((l) => l.id !== 'hq' && l.id !== div.landId && getCustom(state, landCustomId(l.id) ?? ''))
                  .slice(0, 12)
                  .map((l) => {
                    const cp = getCustom(state, landCustomId(l.id) ?? '');
                    const on = div.parkingLands.includes(l.id);
                    return (
                      <label key={l.id} className="switch">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            if (!engine.toggleParking(div.id, l.id)) setMessage('その土地は別の事業が使っています');
                            else setMessage('');
                            bumpGame();
                          }}
                        />
                        {l.name}
                        <span className="text-sub" style={{ fontSize: 11, marginLeft: 4 }}>
                          {cp ? `${Math.floor(cp.areaSqm / SQM_PER_PARKING)}台ぶん` : ''}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 12 }}>
            {!confirmClose ? (
              <Button size="sm" variant="danger" onClick={() => setConfirmClose(true)}>
                この事業をたたむ
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    engine.closeDivision(div.id);
                    bumpGame();
                    close();
                  }}
                >
                  本当にたたむ（在庫は本社に戻ります）
                </Button>
                <Button size="sm" onClick={() => setConfirmClose(false)}>
                  やめる
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'work' && shop && (
        <div className="sheet__section">
          <div className="text-sub" style={{ fontSize: 12, marginBottom: 6 }}>
            {shopModel(div.kind).note}
          </div>
          <ul className="list" style={{ gap: 2, paddingLeft: 18, margin: '0 0 8px', fontSize: 12, opacity: 0.8 }}>
            {shopModel(div.kind).tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <BarChart
            label="この街で求められているもの"
            max={2.2}
            data={topDemand(state, div.landId, def.goods ?? []).map((d) => ({ label: RESOURCE_MAP[d.id].name, value: d.mult, tone: 'profit' as const }))}
            format={(v) => `×${v.toFixed(2)}`}
          />
          <BarChart
            label="この店の状態"
            max={1}
            data={[
              { label: '品ぞろえ', value: variety(state, div), tone: 'profit' },
              ...(shopCapacity(state, div) > 0 ? [{ label: '人手', value: staffRatio(state, div), tone: 'research' as const }] : []),
            ]}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          {(div.wasted ?? 0) > 0 && (
            <div className="text-sub" style={{ fontSize: 12, marginBottom: 6 }}>
              傷んで捨てた在庫: {formatAmount(div.wasted ?? 0, mode)}個
            </div>
          )}
          <div className="list" style={{ gap: 6 }}>
            {(def.goods ?? []).map((g) => {
              const res = RESOURCE_MAP[g];
              const have = div.stock[g] ?? 0;
              const price = retailPrice(state, div, g, derived.modifiers.shopSales);
              return (
                <div key={g} className="row" style={{ gap: 8 }}>
                  <Icon name={res.icon} size={24} fallback={res.name.slice(0, 2)} />
                  <div className="row__grow">
                    <div style={{ fontSize: 13 }}>{res.name}</div>
                    <div className="text-sub num" style={{ fontSize: 11 }}>
                      店頭 {formatMoney(price, mode)}（相場比 +{formatPercent(price / Math.max(1, res.basePrice) - 1, 0)}・この街の人気 ×{localDemand(state, div.landId, g).toFixed(2)}）
                    </div>
                  </div>
                  <span className="num" style={{ fontSize: 13 }}>
                    {formatAmount(have, mode)}個
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'work' && mine && (
        <div className="sheet__section">
          <div className="text-sub" style={{ fontSize: 12, marginBottom: 6 }}>
            この鉱区に埋まっているものを、上から順に掘り出して本社の倉庫へ入れます。価値の高いものほど量は少なく、掘り尽くすと枯れます。
          </div>
          {div.note && (
            <div className="text-loss" style={{ fontSize: 12, marginBottom: 6 }}>
              {div.note}
            </div>
          )}
          <div className="list" style={{ gap: 6 }}>
            {claimDeposits(state, div).map((d) => {
              const res = RESOURCE_MAP[d.id];
              const land = state.lands.find((l) => l.id === div.landId);
              const total = land?.deposits[d.id]?.total ?? d.remaining;
              return (
                <div key={d.id}>
                  <div className="row" style={{ gap: 8 }}>
                    <Icon name={res.icon} size={24} fallback={res.name.slice(0, 2)} />
                    <div className="row__grow" style={{ fontSize: 13 }}>{res.name}</div>
                    <span className="num text-sub" style={{ fontSize: 12 }}>
                      残り {formatAmount(d.remaining, mode)}
                    </span>
                  </div>
                  <ProgressBar ratio={d.remaining / Math.max(1, total)} tone={d.id === 'gold_ore' || d.id === 'rough_gem' ? 'profit' : 'research'} />
                </div>
              );
            })}
            {claimDeposits(state, div).length === 0 && (
              <div className="text-sub" style={{ fontSize: 12 }}>
                掘れるものがありません。地図でこの土地を「地質調査」まで進めるか、別の土地に鉱区を開いてください。
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'supply' && mine && (
        <div className="sheet__section">
          <div className="stat-grid">
            <Stat label="通算で掘った量" value={formatAmount(div.dug ?? 0, mode)} />
            <Stat label="働いている人" value={`${formatNumber(div.staff, mode)}人`} extra={formatMoneyRate(-divisionWage(state, div), mode)} />
          </div>
          <p className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
            掘り出したものは本社の倉庫に入ります。金は精錬、宝石の原石は研磨すると、値段が一段と上がります。
            宝石店を開くと、自分で掘って磨いたものをそのまま並べられます。
          </p>
        </div>
      )}

      {tab === 'work' && !shop && !mine && (
        <div className="sheet__section">
          {div.projects.length > 0 && <div className="field__label">進めている案件</div>}
          {div.projects.map((p) => {
            const d = PROJECT_MAP[p.projectId];
            if (!d) return null;
            const power = devPerSec(state, div, derived.modifiers.devSpeed) / Math.max(1, div.projects.length);
            const left = Math.max(0, d.work - p.work);
            return (
              <div key={p.projectId} style={{ marginBottom: 10 }}>
                <div className="row row--between" style={{ fontSize: 13 }}>
                  <span>{d.name}</span>
                  <span className="text-sub num" style={{ fontSize: 11 }}>
                    {power > 0 ? `あと ${formatDuration(left / power)}` : '人がいません'}
                  </span>
                </div>
                <ProgressBar ratio={p.work / d.work} tone="research" />
                <Button
                  size="sm"
                  variant="danger"
                  style={{ marginTop: 4 }}
                  onClick={() => {
                    engine.cancelProject(div.id, p.projectId);
                    bumpGame();
                  }}
                >
                  やめる
                </Button>
              </div>
            );
          })}

          <div className="field__label" style={{ marginTop: 8 }}>
            受けられる案件（同時に3件まで）
          </div>
          <div className="list" style={{ gap: 8 }}>
            {projectsOf(div.kind).map((d) => {
              const available = isProjectAvailable(state, d);
              const running = div.projects.some((p) => p.projectId === d.id);
              return (
                <div key={d.id} className="card" style={{ padding: 10, opacity: available ? 1 : 0.5 }}>
                  <div className="card__head">
                    <Icon name={d.icon} size={26} fallback={d.name.slice(0, 2)} />
                    <div className="row__grow">
                      <div className="card__title" style={{ fontSize: 13 }}>
                        {d.name}
                      </div>
                      <div className="card__sub" style={{ fontSize: 12 }}>
                        {d.description}
                      </div>
                    </div>
                  </div>
                  <div className="stat-grid" style={{ marginTop: 6 }}>
                    <Stat label="着手金" value={d.startCost > 0 ? formatMoney(d.startCost, mode) : 'なし'} />
                    <Stat label="仕事量" value={formatNumber(d.work, mode)} />
                    <Stat label="報酬" value={d.reward > 0 ? formatMoney(d.reward, mode) : '—'} tone="profit" />
                    <Stat label="研究" value={`+${formatNumber(d.research_points, mode)} RP`} tone="research" />
                  </div>
                  {d.inputs && (
                    <div className="text-sub" style={{ fontSize: 12, marginTop: 4 }}>
                      材料: {Object.entries(d.inputs).map(([k, v]) => `${RESOURCE_MAP[k as ResourceId].name} ${v}`).join('・')}
                    </div>
                  )}
                  {d.product && (
                    <div className="text-sub" style={{ fontSize: 12, marginTop: 4 }}>
                      発売すると利用者から毎秒お金が入ります（運用に {d.product.upkeepStaff}人）。
                    </div>
                  )}
                  <Button
                    size="sm"
                    block
                    variant={available && !running ? 'primary' : 'secondary'}
                    disabled={!available || running}
                    style={{ marginTop: 6 }}
                    onClick={() => {
                      const r = engine.startProject(div.id, d.id);
                      setMessage(r.reason ?? '');
                      if (r.ok) sfx('buy');
                      bumpGame();
                    }}
                  >
                    {running ? '進行中' : available ? '始める' : '研究が必要'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'ads' && (
        <div className="sheet__section">
          <div className="text-sub" style={{ fontSize: 12, marginBottom: 6 }}>
            広告を出すと知名度が上がります。広告ごとに「そこまでしか上がらない」上限があるので、上を目指すなら次の手を打ちます。やめると少しずつ下がります。
          </div>
          {div.ads.length > 0 && (
            <div className="list" style={{ gap: 6, marginBottom: 10 }}>
              {div.ads.map((a) => {
                const d = AD_MAP[a.adId];
                return (
                  <div key={a.adId} className="row row--between" style={{ fontSize: 13 }}>
                    <span>{d?.name ?? a.adId}</span>
                    <span className="text-sub num" style={{ fontSize: 11 }}>
                      残り {formatDuration(a.remaining)}・{formatMoneyRate(-(d?.costPerSec ?? 0), mode)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="list" style={{ gap: 8 }}>
            {(ADS as readonly AdDef[]).map((a) => {
              const locked = a.research ? !state.research.completed[a.research] : false;
              const running = div.ads.some((x) => x.adId === a.id);
              return (
                <div key={a.id} className="card" style={{ padding: 10, opacity: locked ? 0.5 : 1 }}>
                  <div className="card__head">
                    <Icon name={a.icon} size={26} fallback={a.name.slice(0, 2)} />
                    <div className="row__grow">
                      <div className="card__title" style={{ fontSize: 13 }}>
                        {a.name}
                      </div>
                      <div className="card__sub" style={{ fontSize: 12 }}>
                        {a.description}
                      </div>
                    </div>
                  </div>
                  <div className="stat-grid" style={{ marginTop: 6 }}>
                    <Stat label="費用" value={formatMoneyRate(-a.costPerSec, mode)} tone="loss" />
                    <Stat label="知名度" value={`+${a.awarenessPerSec}/秒`} extra={`上限 ${a.cap}`} tone="research" />
                    <Stat label="契約" value={formatDuration(a.duration)} />
                  </div>
                  <Button
                    size="sm"
                    block
                    variant={!locked && !running ? 'primary' : 'secondary'}
                    disabled={locked || running}
                    style={{ marginTop: 6 }}
                    onClick={() => {
                      const r = engine.startAd(div.id, a.id);
                      setMessage(r.reason ?? '');
                      bumpGame();
                    }}
                  >
                    {running ? '契約中' : locked ? '研究が必要' : '契約する'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'supply' && shop && (
        <div className="sheet__section">
          <div className="text-sub" style={{ fontSize: 12, marginBottom: 6 }}>
            本社の在庫からお店へ送る（入荷）、お店から本社へ戻す（返品）ができます。目標を決めると自動で補充します。
          </div>
          <div className="list" style={{ gap: 10 }}>
            {(def.goods ?? []).map((g) => {
              const res = RESOURCE_MAP[g];
              const atHq = state.inventory[g] ?? 0;
              const atShop = div.stock[g] ?? 0;
              const target = div.restock[g] ?? 0;
              return (
                <div key={g}>
                  <div className="row" style={{ gap: 8 }}>
                    <Icon name={res.icon} size={24} fallback={res.name.slice(0, 2)} />
                    <div className="row__grow" style={{ fontSize: 13 }}>
                      {res.name}
                      <span className="text-sub num" style={{ fontSize: 11, marginLeft: 6 }}>
                        本社 {formatAmount(atHq, mode)} / 店 {formatAmount(atShop, mode)}
                      </span>
                    </div>
                  </div>
                  <div className="btn-row" style={{ marginTop: 4 }}>
                    {[10, 100, 1000].map((n) => (
                      <Button
                        key={n}
                        size="sm"
                        disabled={atHq < 1}
                        onClick={() => {
                          engine.restockShop(div.id, g, n);
                          bumpGame();
                        }}
                      >
                        入荷 +{n}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      disabled={atShop < 1}
                      onClick={() => {
                        engine.returnFromShop(div.id, g, atShop);
                        bumpGame();
                      }}
                    >
                      ぜんぶ戻す
                    </Button>
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 4 }}>
                    <span className="text-sub" style={{ fontSize: 11 }}>
                      自動補充の目標
                    </span>
                    <input
                      className="input"
                      style={{ width: 90 }}
                      type="number"
                      min={0}
                      value={target}
                      onChange={(e) => {
                        engine.setRestockTarget(div.id, g, Number(e.target.value));
                        bumpGame();
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'supply' && !shop && !mine && (
        <div className="sheet__section">
          {div.products.length === 0 && (
            <div className="text-sub" style={{ fontSize: 12 }}>
              まだ発売した製品がありません。「案件」から製品になる仕事を選ぶと、完成後に利用者から毎秒お金が入るようになります。
            </div>
          )}
          <div className="list" style={{ gap: 10 }}>
            {div.products.map((p) => {
              const d = PROJECT_MAP[p.projectId];
              const rev = d?.product ? p.users * d.product.revenuePerUser * derived.modifiers.productRevenue : 0;
              return (
                <div key={p.id}>
                  <div className="row row--between" style={{ fontSize: 13 }}>
                    <span>{p.name}</span>
                    <span className="text-profit num" style={{ fontSize: 12 }}>
                      {formatMoneyRate(rev, mode)}
                    </span>
                  </div>
                  <ProgressBar ratio={p.users / Math.max(1, p.peakUsers)} tone="profit" label={`利用者 ${formatNumber(Math.round(p.users), mode)}人（最盛期 ${formatNumber(Math.round(p.peakUsers), mode)}人）`} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {message && (
        <div className="sheet__section text-sub" style={{ fontSize: 12 }}>
          {message}
        </div>
      )}
    </Sheet>
  );
}
