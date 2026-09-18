import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ROULETTE_RED, ROULETTE_WHEEL } from '@/game/data/gambling';
import type { PlayResult } from '@/game/engine/systems/gambling';
import { sfx } from '@/utils/sfx';
import { artUrl } from '@/utils/assets';

const N = ROULETTE_WHEEL.length; // 37
const RED = new Set(ROULETTE_RED);

export type RouletteBet = 'color' | 'parity' | 'dozen' | 'straight';

/**
 * 選んだ賭けが、その数字で当たりかどうか。
 * 0 は赤黒・偶奇・ダースのどれにも当たらない（そのぶんが胴元の取り分）。
 * ただし一点賭けで 0 を選んでいるときだけは、0 が当たりになる。
 */
function hits(bet: RouletteBet, pick: number, n: number): boolean {
  if (bet === 'straight') return n === pick;
  if (n === 0) return false;
  if (bet === 'color') return (pick === 1) === RED.has(n);
  if (bet === 'parity') return (pick === 1) === (n % 2 === 0);
  return Math.floor((n - 1) / 12) === pick;
}

/** 当たり／はずれに合う数字を選ぶ */
function pickNumber(bet: RouletteBet, pick: number, won: boolean, rnd: () => number): number {
  const all = ROULETTE_WHEEL.filter((n) => hits(bet, pick, n) === won);
  if (all.length === 0) return 0;
  return all[Math.floor(rnd() * all.length)];
}

function colorOf(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

interface Props {
  bet: number;
  canPlay: boolean;
  betId: RouletteBet;
  onPlay: (betId: RouletteBet) => PlayResult;
  onResult: (r: PlayResult) => void;
}

/** ルーレット。賭け方と数字を選んで、玉が落ちるところを見る */
export function RouletteWheel({ bet, canPlay, betId, onPlay, onResult }: Props) {
  const [pick, setPick] = useState(1);
  const [angle, setAngle] = useState(0);
  const [landed, setLanded] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [result, setResult] = useState<PlayResult | null>(null);
  const raf = useRef<number | null>(null);

  // 賭け方を変えたら、選べる範囲に合わせる
  useEffect(() => {
    if (betId === 'color' || betId === 'parity') setPick(1);
    else if (betId === 'dozen') setPick(0);
    else setPick(7);
  }, [betId]);

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
  }, []);

  const spin = useCallback(() => {
    if (spinning) return;
    const r = onPlay(betId);
    if (!r.ok) {
      onResult(r);
      return;
    }
    const n = pickNumber(betId, pick, r.payout > 0, Math.random);
    const slot = ROULETTE_WHEEL.indexOf(n);
    const turns = 4 + Math.floor(Math.random() * 2);
    // 止めたい絶対角（この角度のとき、上の指針の真下に狙いのマスが来る）
    const want = 360 - (slot * 360) / N;
    const from = angle % 360;
    // いまの角度から、その絶対角まで回りきる（前回の残り角を足してしまわない）
    const to = from + turns * 360 + ((((want - from) % 360) + 360) % 360);
    const dur = 2600;
    const t0 = performance.now();
    setSpinning(true);
    setLanded(null);
    setResult(null);
    sfx('tap');
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      // だんだん遅くなる
      const eased = 1 - Math.pow(1 - k, 3.2);
      setAngle(from + (to - from) * eased);
      if (k < 1) raf.current = requestAnimationFrame(step);
      else {
        raf.current = null;
        setSpinning(false);
        setLanded(n);
        setResult(r);
        onResult(r);
        if (r.payout > r.bet) sfx('sell');
      }
    };
    raf.current = requestAnimationFrame(step);
  }, [angle, betId, onPlay, onResult, pick, spinning]);

  // 自動で回す。spin は毎回作りなおされるので、ref 経由で呼ぶ
  // （依存に入れると、間隔が発火する前に張り直されて一度も回らなくなる）
  const spinRef = useRef(spin);
  spinRef.current = spin;
  const busyRef = useRef(spinning);
  busyRef.current = spinning;
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (!busyRef.current && canPlay) spinRef.current();
    }, 3200);
    return () => window.clearInterval(id);
  }, [auto, canPlay]);

  const r = 46;
  const cx = 50;
  const cy = 50;

  return (
    <div className="roul">
      <div className="roul__wheel">
        {/* 金の外枠（絵）。数字は下の盤に出す */}
        <img className="roul__rim" src={artUrl('roulette_wheel')} alt="" draggable={false} style={{ transform: `rotate(${angle}deg)` }} />
        <svg viewBox="0 0 100 100" role="img" aria-label="ルーレットの盤">
          <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '50px 50px' }}>
            {ROULETTE_WHEEL.map((n, i) => {
              const a0 = ((i - 0.5) * 360) / N - 90;
              const a1 = ((i + 0.5) * 360) / N - 90;
              const rad = (d: number) => (d * Math.PI) / 180;
              const x0 = cx + r * Math.cos(rad(a0));
              const y0 = cy + r * Math.sin(rad(a0));
              const x1 = cx + r * Math.cos(rad(a1));
              const y1 = cy + r * Math.sin(rad(a1));
              const c = colorOf(n);
              const fill = c === 'green' ? 'var(--profit)' : c === 'red' ? 'var(--loss)' : 'var(--text-dim)';
              const tx = cx + r * 0.78 * Math.cos(rad((a0 + a1) / 2));
              const ty = cy + r * 0.78 * Math.sin(rad((a0 + a1) / 2));
              const lit = landed === n;
              return (
                <g key={n}>
                  <path d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`} fill={fill} opacity={lit ? 1 : 0.82} stroke="var(--card)" strokeWidth="0.4" />
                  <text x={tx} y={ty} fontSize="4.2" fill="#fff" textAnchor="middle" dominantBaseline="central" transform={`rotate(${(a0 + a1) / 2 + 90} ${tx} ${ty})`}>
                    {n}
                  </text>
                </g>
              );
            })}
            <circle cx={cx} cy={cy} r={r * 0.5} fill="var(--card-2)" opacity="0.25" />
          </g>
          <polygon points="50,2 47,10 53,10" fill="var(--accent)" />
        </svg>
        {/* 真ん中の金具（絵）。盤と一緒に回る */}
        <img className="roul__hub" src={artUrl('roulette_hub')} alt="" draggable={false} style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }} />
        <div className={`roul__ball${landed !== null ? ` roul__ball--${colorOf(landed)}` : ''}`}>{landed !== null ? landed : spinning ? '…' : '?'}</div>
      </div>

      <div className="roul__picker">
        {(betId === 'color' || betId === 'parity') && (
          <div className="btn-row">
            {(betId === 'color' ? ['黒', '赤'] : ['奇数', '偶数']).map((label, i) => (
              <Button key={label} block variant={pick === i ? 'primary' : 'secondary'} onClick={() => setPick(i)} disabled={spinning}>
                {label}
              </Button>
            ))}
          </div>
        )}
        {betId === 'dozen' && (
          <div className="btn-row">
            {['1〜12', '13〜24', '25〜36'].map((label, i) => (
              <Button key={label} block variant={pick === i ? 'primary' : 'secondary'} onClick={() => setPick(i)} disabled={spinning}>
                {label}
              </Button>
            ))}
          </div>
        )}
        {betId === 'straight' && (
          <div className="roul__grid">
            {Array.from({ length: 37 }, (_, n) => (
              <button
                key={n}
                type="button"
                className={`roul__num roul__num--${colorOf(n)}${pick === n ? ' roul__num--on' : ''}`}
                onClick={() => setPick(n)}
                disabled={spinning}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="slot__result">
        {spinning ? (
          <span className="text-sub">玉が回っています…</span>
        ) : result ? (
          <span className={result.payout > result.bet ? 'text-profit' : 'text-sub'}>
            {landed} — {result.label}
            {result.payout > 0 && ` ×${(result.payout / result.bet).toFixed(1)}`}
          </span>
        ) : (
          <span className="text-dim">賭ける場所を選んで回します</span>
        )}
      </div>

      <div className="btn-row">
        <Button block variant={canPlay && !spinning ? 'primary' : 'secondary'} disabled={!canPlay || spinning} onClick={spin}>
          {bet.toLocaleString('ja-JP')}円で回す
        </Button>
        <Button variant={auto ? 'danger' : 'secondary'} onClick={() => setAuto((v) => !v)}>
          {auto ? '自動を止める' : '自動で回す'}
        </Button>
      </div>
    </div>
  );
}
