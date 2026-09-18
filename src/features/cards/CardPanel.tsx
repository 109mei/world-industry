import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BarChart, DonutChart, topWithOther } from '@/components/ui/Chart';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { Stat } from '@/components/ui/Stat';
import { CARDS, CARD_MAP, PACKS, RARITIES, RARITY_MAP, SERIES_MAP, cardsOf, type CardRarity } from '@/game/data/cards';
import { cardBuyPrice, cardPrice, cardState, collectionValue, isCardsUnlocked, packValue, seriesProgress } from '@/game/engine/systems/cards';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';
import { sfx } from '@/utils/sfx';
import { CardFace } from './CardFace';
import { PackOpener } from './PackOpener';

type Sub = 'open' | 'book' | 'market';

/** トレーディングカード。パックを開ける・集める・売り買いする */
export function CardPanel() {
  const { state, engine } = useGame();
  const mode = state.settings.numberFormat;
  const setTab = useUiStore((s) => s.setTab);
  const [sub, setSub] = useState<Sub>('open');
  const [packId, setPackId] = useState(PACKS[0].id);
  const [message, setMessage] = useState('');
  // 売り買いの絞り込み。100種あるので、そのまま全部は出さない
  const [filterRarity, setFilterRarity] = useState<CardRarity | 'all'>('all');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [limit, setLimit] = useState(20);

  if (!isCardsUnlocked(state)) {
    return (
      <Card>
        <div className="card__head">
          <Icon name="icon_card_pack" size={34} fallback="カ" />
          <div className="row__grow">
            <div className="card__title">カードはまだ扱えません</div>
            <div className="card__sub">研究「カード相場」を終えると、パックを開けて集めたり、値上がりしたカードを売ったりできます。</div>
          </div>
        </div>
        <div className="card__body">
          <Button size="sm" onClick={() => setTab('research')}>
            研究へ ›
          </Button>
        </div>
      </Card>
    );
  }

  const cs = cardState(state);
  const owned = Object.entries(cs.owned).filter(([, n]) => (n ?? 0) > 0);
  const kinds = owned.length;
  const sheets = owned.reduce((a, [, n]) => a + (n ?? 0), 0);
  const value = collectionValue(state);
  const progress = seriesProgress(state);
  const pack = PACKS.find((p) => p.id === packId) ?? PACKS[0];

  // レア度ごとの持ち枚数
  const byRarity = RARITIES.map((r) => ({
    label: r.short,
    value: owned.filter(([id]) => CARD_MAP[id]?.rarity === r.id).reduce((a, [, n]) => a + (n ?? 0), 0),
  })).filter((d) => d.value > 0);

  // 売り買いの一覧。レア度と「持っているものだけ」で絞り、最初は20種だけ描く
  const filtered = useMemo(
    () => CARDS.filter((c) => (filterRarity === 'all' || c.rarity === filterRarity) && (!ownedOnly || (cs.owned[c.id] ?? 0) > 0)),
    [filterRarity, ownedOnly, cs.owned],
  );
  const shown = filtered.slice(0, limit);

  // 値打ちの内訳（高いものから）
  const byValue = topWithOther(
    owned.map(([id, n]) => ({ label: CARD_MAP[id]?.name ?? id, value: cardPrice(state, id) * (n ?? 0) })),
  );

  return (
    <div className="list">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="持っている種類" value={`${kinds} / ${CARDS.length}`} extra={`${formatNumber(sheets, mode)}枚`} />
          <Stat label="コレクションの値打ち" value={formatMoney(value, mode)} tone="profit" />
          <Stat label="相場の熱" value={`×${cs.hype.toFixed(2)}`} tone={cs.hype >= 1.2 ? 'profit' : cs.hype <= 0.8 ? 'loss' : 'default'} extra={cs.hype >= 1.2 ? '売り時' : cs.hype <= 0.8 ? '買い時' : '平常'} />
          <Stat
            label="開けたパック"
            value={`${formatNumber(cs.packsOpened, mode)}個`}
            extra={cs.spent > 0 ? `回収率 ${formatPercent((cs.earned + value) / cs.spent, 0)}` : undefined}
          />
        </div>
        <p className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
          パックを開けて出たものをそのまま売ると、<strong>かけた額の半分強しか戻りません</strong>（下のバッジがその見込みです）。
          開け続けて増やすものではなく、<strong>集めて図鑑を埋める</strong>か、
          <strong>相場が上がったところで売る</strong>ものです。
        </p>
      </Card>

      <Segmented
        ariaLabel="カードの表示"
        items={[
          { id: 'open', label: 'パックを開ける' },
          { id: 'book', label: '図鑑' },
          { id: 'market', label: '売り買い' },
        ]}
        value={sub}
        onChange={(v) => setSub(v as Sub)}
      />

      {sub === 'open' && (
        <>
          <Card>
            <div className="field__label">どのパックを開けるか</div>
            <div className="list" style={{ gap: 6 }}>
              {PACKS.map((p) => {
                const ev = packValue(state, p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`packpick${p.id === packId ? ' packpick--on' : ''}`}
                    onClick={() => setPackId(p.id)}
                  >
                    <Icon name={p.icon} size={30} fallback={p.name.slice(0, 2)} />
                    <div className="row__grow">
                      <div className="packpick__name">
                        {p.name}
                        <span className="text-sub" style={{ fontSize: 11, marginLeft: 6 }}>
                          {formatMoney(p.cost, mode)}・{p.cards}枚
                        </span>
                      </div>
                      <div className="text-dim" style={{ fontSize: 11 }}>{p.note}</div>
                      <div className="packpick__rates">
                        {RARITIES.filter((r) => (p.rates[r.id] ?? 0) > 0).map((r) => (
                          <span key={r.id} className={`packpick__rate packpick__rate--${r.id}`}>
                            {r.short} {((p.rates[r.id] ?? 0) * 100).toFixed(1)}%
                          </span>
                        ))}
                      </div>
                    </div>
                    <Badge tone={ev >= p.cost ? 'profit' : 'loss'}>見込み {formatPercent(ev / p.cost, 0)}</Badge>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <PackOpener pack={pack} canBuy={state.company.cash >= pack.cost} onOpen={() => engine.openPack(pack.id, 1)} />
          </Card>
        </>
      )}

      {sub === 'book' && (
        <>
          {progress.map((p) => {
            const list = cardsOf(p.id);
            return (
              <Card key={p.id}>
                <div className="card__head">
                  <div className="row__grow">
                    <div className="card__title">{p.name}</div>
                    <div className="card__sub">{SERIES_MAP[p.id]?.note}</div>
                  </div>
                  <Badge tone={p.complete ? 'profit' : 'default'}>
                    {p.have} / {p.total}
                  </Badge>
                </div>
                <div className="card__body">
                  <ProgressBar ratio={p.have / p.total} tone={p.complete ? 'profit' : 'research'} label={`そろい ${Math.round((p.have / p.total) * 100)}%`} />
                  <div className="tcards">
                    {list.map((c) => {
                      const n = cs.owned[c.id] ?? 0;
                      return n > 0 ? <CardFace key={c.id} id={c.id} size="sm" count={n} /> : <CardFace key={c.id} id={c.id} size="sm" faded />;
                    })}
                  </div>
                  {p.complete && !p.claimed && (
                    <Button
                      size="sm"
                      block
                      variant="primary"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        const r = engine.claimCardSeries(p.id);
                        setMessage(r.ok ? `研究ポイント +${formatNumber(r.reward, mode)}` : (r.reason ?? ''));
                        if (r.ok) sfx('sell');
                        bumpGame();
                      }}
                    >
                      そろった見返りを受け取る（研究 +{formatNumber(p.reward, mode)}）
                    </Button>
                  )}
                  {p.claimed && (
                    <div className="text-dim" style={{ fontSize: 11, marginTop: 6 }}>
                      見返りは受け取り済みです。
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          {kinds > 0 && (
            <Card>
              <BarChart data={byRarity} label="持っている枚数（レア度ごと）" format={(v) => `${formatNumber(v, mode)}枚`} />
              <DonutChart data={byValue} label="値打ちの内訳" format={(v) => formatMoney(v, mode)} />
            </Card>
          )}
        </>
      )}

      {sub === 'market' && (
        <Card>
          <p className="text-sub" style={{ fontSize: 12, marginBottom: 6 }}>
            売ると相場は下がり、買い占めると上がります。買うときは売値より3割高いので、
            そのまま売り返すと損をします。
          </p>
          <div className="cardfilter">
            <button
              type="button"
              className={`cardfilter__btn${filterRarity === 'all' ? ' cardfilter__btn--on' : ''}`}
              onClick={() => {
                setFilterRarity('all');
                setLimit(20);
              }}
            >
              すべて
            </button>
            {RARITIES.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`cardfilter__btn tcard__rarity--${r.id}${filterRarity === r.id ? ' cardfilter__btn--on' : ''}`}
                onClick={() => {
                  setFilterRarity(r.id);
                  setLimit(20);
                }}
              >
                {r.short}
              </button>
            ))}
            <button
              type="button"
              className={`cardfilter__btn${ownedOnly ? ' cardfilter__btn--on' : ''}`}
              onClick={() => {
                setOwnedOnly((v) => !v);
                setLimit(20);
              }}
            >
              持っているものだけ
            </button>
          </div>
          <div className="list" style={{ gap: 6 }}>
            {shown.map((c) => {
              const n = cs.owned[c.id] ?? 0;
              const sell = cardPrice(state, c.id);
              const buy = cardBuyPrice(state, c.id);
              const mult = cs.price[c.id] ?? 1;
              return (
                <div key={c.id} className="cardrow">
                  <CardFace id={c.id} size="sm" count={n} faded={n === 0} />
                  <div className="row__grow">
                    <div className="cardrow__name">
                      {c.name}
                      <span className={`tcard__rarity tcard__rarity--${c.rarity}`} style={{ marginLeft: 6 }}>
                        {RARITY_MAP[c.rarity].short}
                      </span>
                    </div>
                    <div className="text-dim" style={{ fontSize: 11 }}>{c.flavor}</div>
                    <div className="cardrow__prices num">
                      売 {formatMoney(sell, mode)} / 買 {formatMoney(buy, mode)}
                      <span className={mult >= 1.15 ? ' text-profit' : mult <= 0.85 ? ' text-loss' : ' text-dim'}> ×{mult.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="cardrow__btns">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={n === 0}
                      onClick={() => {
                        const r = engine.sellCard(c.id, 1);
                        setMessage(r.ok ? `${formatMoney(r.revenue, mode)} で売りました` : (r.reason ?? ''));
                        if (r.ok) sfx('sell');
                        bumpGame();
                      }}
                    >
                      売る
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={state.company.cash < buy}
                      onClick={() => {
                        const r = engine.buyCard(c.id, 1);
                        setMessage(r.ok ? `${formatMoney(r.cost, mode)} で買いました` : (r.reason ?? ''));
                        if (r.ok) sfx('buy');
                        bumpGame();
                      }}
                    >
                      買う
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length > shown.length && (
            <div className="cardfilter__more">
              <Button size="sm" variant="secondary" onClick={() => setLimit((v) => v + 40)}>
                のこり {filtered.length - shown.length}種を表示
              </Button>
            </div>
          )}
          {filtered.length === 0 && (
            <div className="text-dim" style={{ fontSize: 12, textAlign: 'center', padding: '10px 0' }}>
              あてはまるカードがありません。
            </div>
          )}
        </Card>
      )}

      {message && (
        <Card flat>
          <div className="card__body text-sub">{message}</div>
        </Card>
      )}
    </div>
  );
}
