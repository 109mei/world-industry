import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Stat } from '@/components/ui/Stat';
import { GAMES, LOTTERY, expectedReturn } from '@/game/data/gambling';
import { betSize, lotteryState, winChance } from '@/game/engine/systems/gambling';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatAmount, formatDuration, formatMoney, formatNumber, formatPercent } from '@/utils/format';
import { sfx } from '@/utils/sfx';

/** 賭け事。自分で遊ぶ側。研究「遊技場の許可」で解放する */
export function GamblingPanel() {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const setTab = useUiStore((s) => s.setTab);
  const [log, setLog] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const unlocked = state.research.completed.gaming_license === true;
  const l = lotteryState(state);
  const bet = state.stats.gambleBet ?? 0;
  const won = state.stats.gambleWon ?? 0;

  if (!unlocked) {
    return (
      <Card>
        <div className="card__head">
          <Icon name="icon_ui_star" size={34} fallback="賭" />
          <div className="row__grow">
            <div className="card__title">賭け事はまだできません</div>
            <div className="card__sub">研究「遊技場の許可」を終えると、スロット・ルーレット・カード・パチンコ・宝くじで遊べるようになり、カジノも建てられます。</div>
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

  const push = (line: string) => setLog((prev) => [line, ...prev].slice(0, 8));

  return (
    <div className="list">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="賭けた額（通算）" value={formatMoney(bet, mode)} tone="loss" />
          <Stat label="返ってきた額" value={formatMoney(won, mode)} tone={won >= bet ? 'profit' : 'loss'} />
          <Stat label="回収率" value={bet > 0 ? formatPercent(won / bet, 1) : '—'} extra={won >= bet ? '運がいい' : '胴元が勝っている'} />
          <Stat label="宝くじの賞金" value={formatMoney(l.jackpot, mode)} tone="research" />
        </div>
        <p className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
          どの遊びも胴元が少し有利で、長く遊べば必ず減っていきます（下に期待値を出しています）。
          本気で稼ぐなら、カジノを建てて<strong>開く側</strong>に回るほうがずっと早いです。
        </p>
      </Card>

      <div className="section-title">遊ぶ</div>
      <div className="grid grid--2">
        {GAMES.map((g) => {
          const ret = expectedReturn(g);
          const b = betSize(state, derived.assets, g.id);
          const canPlay = state.company.cash >= b && b > 0;
          return (
            <Card key={g.id} flat>
              <div className="card__head">
                <Icon name={g.icon} size={30} fallback={g.name.slice(0, 2)} />
                <div className="row__grow">
                  <div className="card__title">{g.name}</div>
                  <div className="card__sub">{g.description}</div>
                </div>
                <Badge tone={ret >= 1 ? 'profit' : 'loss'}>期待 {formatPercent(ret, 1)}</Badge>
              </div>
              <div className="card__body">
                <div className="text-sub" style={{ fontSize: 12, marginBottom: 6 }}>
                  {g.outcomes
                    .filter((o) => o.payout > 0)
                    .map((o) => `${o.label} ×${o.payout}（${(o.p * 100).toFixed(1)}%）`)
                    .join(' / ')}
                </div>
                <Button
                  size="sm"
                  block
                  variant={canPlay ? 'primary' : 'secondary'}
                  disabled={!canPlay}
                  onClick={() => {
                    const r = engine.playGame(g.id);
                    if (!r.ok) {
                      setMessage(r.reason ?? '');
                    } else {
                      setMessage('');
                      push(`${g.name}: ${r.label} ${r.payout > 0 ? `+${formatMoney(r.payout - r.bet, mode)}` : `-${formatMoney(r.bet, mode)}`}`);
                      sfx(r.payout > r.bet ? 'sell' : 'tap');
                    }
                    bumpGame();
                  }}
                >
                  {formatMoney(b, mode)} 賭ける
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {log.length > 0 && (
        <Card flat>
          <div className="field__label">さっきの結果</div>
          <div className="list" style={{ gap: 2 }}>
            {log.map((line, i) => (
              <div key={i} className="num" style={{ fontSize: 12, opacity: 1 - i * 0.1 }}>
                {line}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="section-title">宝くじ</div>
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="いまの賞金" value={formatMoney(l.jackpot, mode)} size="lg" tone="research" />
          <Stat label="次の抽選まで" value={formatDuration(Math.max(0, l.nextDrawIn))} />
          <Stat label="買った枚数" value={`${formatAmount(l.tickets, mode)}枚`} extra={`1枚 ${formatMoney(LOTTERY.ticketPrice, 'full')}`} />
          <Stat label="当たる確率" value={formatPercent(winChance(l.tickets), 2)} extra={`当選 ${l.won}回 / ${l.draws}回`} />
        </div>
        <div style={{ marginTop: 8 }}>
          <ProgressBar ratio={1 - Math.max(0, l.nextDrawIn) / LOTTERY.intervalSec} tone="research" label="抽選までの進み" />
        </div>
        <p className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
          ほかに {formatNumber(LOTTERY.publicTickets, mode)}枚が出回っています。買うほど当たりやすくなり、買い占めれば当選も狙えます。
          はずれた回の賞金は次回に持ち越して膨らむので、<strong>積み上がった回</strong>を狙って買い占めるのがいちばん分がいいです。
          いま買っている枚数での見込みは {l.tickets > 0 ? formatPercent((winChance(l.tickets) * l.jackpot) / (l.tickets * LOTTERY.ticketPrice), 0) : '—'} です。
        </p>
        <div className="btn-row" style={{ marginTop: 8 }}>
          {[1, 100, 10_000, 1_000_000].map((n) => (
            <Button
              key={n}
              size="sm"
              variant={n >= 10_000 ? 'primary' : 'secondary'}
              onClick={() => {
                const r = engine.buyLotteryTickets(n);
                setMessage(r.ok ? `${formatAmount(r.bought, mode)}枚 買いました` : (r.reason ?? ''));
                if (r.ok) sfx('buy');
                bumpGame();
              }}
            >
              {formatNumber(n, mode)}枚
            </Button>
          ))}
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const r = engine.buyLotteryTickets(LOTTERY.maxPerDraw);
              setMessage(r.ok ? `${formatAmount(r.bought, mode)}枚 買い占めました` : (r.reason ?? ''));
              if (r.ok) sfx('buy');
              bumpGame();
            }}
          >
            買い占める
          </Button>
        </div>
        {l.lastMessage && (
          <div className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
            前回: {l.lastMessage}
          </div>
        )}
      </Card>

      {message && (
        <Card flat>
          <div className="card__body text-sub">{message}</div>
        </Card>
      )}
    </div>
  );
}
