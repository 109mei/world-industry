import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Stat } from '@/components/ui/Stat';
import { GAME_MAP, betOf, betReturn, type GameId } from '@/game/data/gambling';
import { betSize } from '@/game/engine/systems/gambling';
import type { PlayResult } from '@/game/engine/systems/gambling';
import { bumpGame, useGame } from '@/stores/gameStore';
import { formatMoney, formatPercent } from '@/utils/format';
import { BaccaratTable, type Side } from './BaccaratTable';
import { PachinkoBoard } from './PachinkoBoard';
import { RouletteWheel, type RouletteBet } from './RouletteWheel';
import { SlotMachine } from './SlotMachine';

interface Props {
  gameId: GameId | null;
  onClose: () => void;
}

/** 実際に遊ぶミニゲームの画面 */
export function GameSheet({ gameId, onClose }: Props) {
  const { state, derived, engine } = useGame();
  const mode = state.settings.numberFormat;
  const [betId, setBetId] = useState<string>('');
  const [log, setLog] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState({ bet: 0, back: 0, plays: 0 });

  if (!gameId) return null;
  const def = GAME_MAP[gameId];
  const bet = betSize(state, derived.assets, gameId);
  const canPlay = bet > 0 && state.company.cash >= bet;
  const chosen = betOf(def, betId || def.bets[0].id);

  const handle = (r: PlayResult) => {
    if (!r.ok) {
      setMessage(r.reason ?? '');
      bumpGame();
      return;
    }
    setMessage('');
    setSession((s) => ({ bet: s.bet + r.bet, back: s.back + r.payout, plays: s.plays + 1 }));
    setLog((prev) =>
      [`${r.label} ${r.payout > r.bet ? `+${formatMoney(r.payout - r.bet, mode)}` : r.payout > 0 ? '±0' : `−${formatMoney(r.bet, mode)}`}`, ...prev].slice(0, 6),
    );
    bumpGame();
  };

  const play = (id?: string) => engine.playGame(gameId, id ?? chosen.id);

  return (
    <Sheet open onClose={onClose} title={def.name} icon={<Icon name={def.icon} size={32} fallback={def.name.slice(0, 2)} />}>
      <div className="sheet__section">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <Badge tone="loss">期待 {formatPercent(betReturn(chosen), 1)}</Badge>
          <Badge>1回 {formatMoney(bet, mode)}</Badge>
          {session.plays > 0 && (
            <Badge tone={session.back >= session.bet ? 'profit' : 'loss'}>
              この台で {session.back >= session.bet ? '+' : '−'}
              {formatMoney(Math.abs(session.back - session.bet), mode)}
            </Badge>
          )}
        </div>
        <p className="text-sub" style={{ fontSize: 12 }}>{def.description}</p>
      </div>

      {def.bets.length > 1 && (
        <div className="sheet__section">
          <div className="field__label">賭け方</div>
          <Segmented
            ariaLabel="賭け方"
            items={def.bets.map((b) => ({ id: b.id, label: b.name }))}
            value={chosen.id}
            onChange={(v) => setBetId(v)}
          />
          <div className="text-dim" style={{ fontSize: 11, marginTop: 4 }}>
            {chosen.note}
          </div>
        </div>
      )}

      <div className="sheet__section">
        {def.kind === 'slot' && <SlotMachine bet={bet} canPlay={canPlay} onPlay={() => play()} onResult={handle} />}
        {def.kind === 'wheel' && (
          <RouletteWheel bet={bet} canPlay={canPlay} betId={chosen.id as RouletteBet} onPlay={(id) => play(id)} onResult={handle} />
        )}
        {def.kind === 'cards' && <BaccaratTable bet={bet} canPlay={canPlay} side={chosen.id as Side} onPlay={(s) => play(s)} onResult={handle} />}
        {def.kind === 'pachinko' && <PachinkoBoard bet={bet} canPlay={canPlay} onPlay={() => play()} onResult={handle} />}
      </div>

      <div className="sheet__section">
        <div className="stat-grid">
          <Stat label="この台で賭けた" value={formatMoney(session.bet, mode)} tone="loss" />
          <Stat label="返ってきた" value={formatMoney(session.back, mode)} tone={session.back >= session.bet ? 'profit' : 'loss'} />
          <Stat label="回した数" value={`${session.plays}回`} />
          <Stat label="回収率" value={session.bet > 0 ? formatPercent(session.back / session.bet, 1) : '—'} />
        </div>
        <div className="text-dim" style={{ fontSize: 11, marginTop: 6 }}>
          {chosen.outcomes
            .filter((o) => o.payout > 0)
            .map((o) => `${o.label} ×${o.payout}（${(o.p * 100).toFixed(2)}%）`)
            .join(' / ')}
        </div>
      </div>

      {log.length > 0 && (
        <div className="sheet__section">
          <div className="field__label">さっきの結果</div>
          <div className="list" style={{ gap: 2 }}>
            {log.map((line, i) => (
              <div key={i} className="num" style={{ fontSize: 12, opacity: 1 - i * 0.12 }}>
                {line}
              </div>
            ))}
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
