import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { PlayResult } from '@/game/engine/systems/gambling';
import { sfx } from '@/utils/sfx';
import { cardArtUrl } from '@/utils/assets';

const SUITS = ['♠', '♥', '♦', '♣'] as const;
/** 絵札の画像のファイル名に使う記号 */
const SUIT_KEY: Record<(typeof SUITS)[number], string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
/** 絵札（J・Q・K）は絵を使う */
function faceArt(c: Card): string | null {
  if (c.rank !== 'J' && c.rank !== 'Q' && c.rank !== 'K') return null;
  return cardArtUrl(`face_${c.rank}_${SUIT_KEY[c.suit]}`);
}
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

interface Card {
  suit: (typeof SUITS)[number];
  rank: (typeof RANKS)[number];
}

/** バカラの数え方（10 と絵札は 0、合計の一の位） */
function value(c: Card): number {
  if (c.rank === 'A') return 1;
  if (c.rank === '10' || c.rank === 'J' || c.rank === 'Q' || c.rank === 'K') return 0;
  return Number(c.rank);
}
function total(cards: Card[]): number {
  return cards.reduce((a, c) => a + value(c), 0) % 10;
}

function draw(): Card {
  return { suit: SUITS[Math.floor(Math.random() * 4)], rank: RANKS[Math.floor(Math.random() * 13)] };
}

export type Side = 'player' | 'banker' | 'tie';

/** 本物と同じ決まりで1回ぶん配る */
function deal(): { player: Card[]; banker: Card[]; winner: Side } {
  const player = [draw(), draw()];
  const banker = [draw(), draw()];
  const p0 = total(player);
  const b0 = total(banker);
  // どちらかが8か9なら、そこで終わり（ナチュラル）
  if (p0 < 8 && b0 < 8) {
    let third: Card | null = null;
    if (p0 <= 5) {
      third = draw();
      player.push(third);
    }
    const t = third ? value(third) : null;
    const bankerDraws = (() => {
      if (t === null) return b0 <= 5;
      if (b0 <= 2) return true;
      if (b0 === 3) return t !== 8;
      if (b0 === 4) return t >= 2 && t <= 7;
      if (b0 === 5) return t >= 4 && t <= 7;
      if (b0 === 6) return t === 6 || t === 7;
      return false;
    })();
    if (bankerDraws) banker.push(draw());
  }
  const p = total(player);
  const b = total(banker);
  return { player, banker, winner: p === b ? 'tie' : p > b ? 'player' : 'banker' };
}

/** 決まった結果に合う配り方が出るまで配りなおす（本物の決まりのまま） */
function dealFor(winner: Side): { player: Card[]; banker: Card[]; winner: Side } {
  for (let i = 0; i < 400; i++) {
    const d = deal();
    if (d.winner === winner) return d;
  }
  return deal();
}

interface Props {
  bet: number;
  canPlay: boolean;
  side: Side;
  onPlay: (side: Side) => PlayResult;
  onResult: (r: PlayResult) => void;
}

/** バカラ。プレイヤーとバンカー、9に近いほうが勝ち */
export function BaccaratTable({ bet, canPlay, side, onPlay, onResult }: Props) {
  const [hand, setHand] = useState<{ player: Card[]; banker: Card[]; winner: Side } | null>(null);
  const [shown, setShown] = useState(0);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [dealing, setDealing] = useState(false);
  const [auto, setAuto] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => {
    for (const t of timers.current) window.clearTimeout(t);
  }, []);

  const start = useCallback(() => {
    if (dealing) return;
    const r = onPlay(side);
    if (!r.ok) {
      onResult(r);
      return;
    }
    // 結果から、どちらが勝った回かを決める。
    // 引き分けに賭けて外した回はラベルが「決着（はずれ）」で勝者を含まないので、
    // 実際の勝敗の比率（バンカー 50.7%）でどちらかに振る。そうしないと常にバンカーの勝ちになる。
    const winner: Side = r.label.includes('引き分け')
      ? 'tie'
      : r.label.startsWith('プレイヤー')
        ? 'player'
        : r.label.startsWith('バンカー')
          ? 'banker'
          : Math.random() < 0.5067
            ? 'banker'
            : 'player';
    const d = dealFor(winner);
    setHand(d);
    setResult(null);
    setShown(0);
    setDealing(true);
    sfx('tap');
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    const n = d.player.length + d.banker.length;
    for (let i = 1; i <= n; i++) {
      timers.current.push(
        window.setTimeout(() => {
          setShown(i);
          sfx('tap');
        }, i * 320),
      );
    }
    timers.current.push(
      window.setTimeout(() => {
        setDealing(false);
        setResult(r);
        onResult(r);
        if (r.payout > r.bet) sfx('sell');
      }, n * 320 + 350),
    );
  }, [dealing, onPlay, onResult, side, bet]);

  // 自動で回す。start は毎回作りなおされるので ref 経由で呼ぶ
  // （依存に入れると、間隔が発火する前に張り直されて一度も配られなくなる）
  const startRef = useRef(start);
  startRef.current = start;
  const dealingRef = useRef(dealing);
  dealingRef.current = dealing;
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (!dealingRef.current && canPlay) startRef.current();
    }, 2600);
    return () => window.clearInterval(id);
  }, [auto, canPlay]);

  // 配る順番: プレイヤー1 → バンカー1 → プレイヤー2 → バンカー2 → 3枚目
  const order: { side: 'player' | 'banker'; index: number }[] = [];
  if (hand) {
    order.push({ side: 'player', index: 0 }, { side: 'banker', index: 0 }, { side: 'player', index: 1 }, { side: 'banker', index: 1 });
    if (hand.player[2]) order.push({ side: 'player', index: 2 });
    if (hand.banker[2]) order.push({ side: 'banker', index: 2 });
  }
  const visible = (s: 'player' | 'banker', i: number) => {
    const k = order.findIndex((o) => o.side === s && o.index === i);
    return k >= 0 && k < shown;
  };

  const row = (s: 'player' | 'banker', label: string) => {
    const cards = hand?.[s] ?? [];
    const open = cards.filter((_, i) => visible(s, i));
    const win = hand && !dealing && hand.winner === s;
    return (
      <div className={`bacc__row${win ? ' bacc__row--win' : ''}`}>
        <div className="bacc__side">
          <span className="bacc__label">{label}</span>
          <span className="bacc__total num">{open.length > 0 ? total(open) : '—'}</span>
        </div>
        <div className="bacc__cards">
          {cards.map((c, i) => (
            <span key={i} className={`bacc__card${visible(s, i) ? ' bacc__card--open' : ''}${c.suit === '♥' || c.suit === '♦' ? ' bacc__card--red' : ''}`}>
              {visible(s, i) ? (
                faceArt(c) ? (
                  <img className="bacc__face" src={faceArt(c)!} alt={`${c.rank}${c.suit}`} draggable={false} />
                ) : (
                  <>
                    <span className="bacc__rank">{c.rank}</span>
                    <span className="bacc__suit">{c.suit}</span>
                  </>
                )
              ) : (
                <span className="bacc__back" />
              )}
            </span>
          ))}
          {cards.length === 0 && <span className="text-dim" style={{ fontSize: 12 }}>—</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="bacc">
      {row('player', 'プレイヤー')}
      {row('banker', 'バンカー')}

      <div className="slot__result">
        {dealing ? (
          <span className="text-sub">配っています…</span>
        ) : result ? (
          <span className={result.payout > result.bet ? 'text-profit' : result.payout > 0 ? 'text-warn' : 'text-sub'}>
            {result.label}
            {result.payout > 0 && ` ×${(result.payout / result.bet).toFixed(2)}`}
          </span>
        ) : (
          <span className="text-dim">どちらが9に近いかを当てます。10と絵札は0、合計の一の位で比べます</span>
        )}
      </div>

      <div className="btn-row">
        <Button block variant={canPlay && !dealing ? 'primary' : 'secondary'} disabled={!canPlay || dealing} onClick={start}>
          {bet.toLocaleString('ja-JP')}円で勝負
        </Button>
        <Button variant={auto ? 'danger' : 'secondary'} onClick={() => setAuto((v) => !v)}>
          {auto ? '自動を止める' : '自動で回す'}
        </Button>
      </div>
    </div>
  );
}
