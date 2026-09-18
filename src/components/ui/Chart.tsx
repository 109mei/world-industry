import { useId, useState } from 'react';

/**
 * 図表のまとめ。
 *
 * 決めごと:
 *  - 横の目盛線は引かない。両端に数字を出して、線でごちゃつかせない
 *  - 系列が1つのときは1色（棒の長さがもう大きさを表しているので、色で二重に表さない）
 *  - 内訳の色は色覚の分離を確認済みの3色＋「その他」の灰まで。それ以上は「その他」にまとめる
 *  - 状態（動いている・止まっている）の色は、系列の色とは別に取ってある
 *  - 触れると数字が出る（指でも読めるように、当たり判定は見た目より大きく取る）
 */

/** 役割で決まる色 */
export type Tone = 'accent' | 'profit' | 'loss' | 'research' | 'power' | 'warn' | 'neutral';

/** 内訳に使う色。順番は固定で、入れ替えない */
export const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'] as const;
export const OTHER_COLOR = 'var(--series-other)';
/** 内訳に出す最大の数（これを超えたら「その他」にまとめる） */
export const MAX_SERIES = 3;

function toneColor(tone: Tone): string {
  switch (tone) {
    case 'profit':
      return 'var(--profit)';
    case 'loss':
      return 'var(--loss)';
    case 'research':
      return 'var(--research)';
    case 'power':
      return 'var(--power)';
    case 'warn':
      return 'var(--warn)';
    case 'neutral':
      return 'var(--text-dim)';
    default:
      return 'var(--accent)';
  }
}

export interface Point {
  /** 表示用のラベル（触れたときに出す） */
  label?: string;
  value: number;
}

interface AreaChartProps {
  values: number[];
  tone?: Tone;
  /** 縦軸の下端を0にする（増え方が分かりやすい） */
  zeroBased?: boolean;
  height?: number;
  /** 両端に出す数字 */
  topLabel?: string;
  bottomLabel?: string;
  label?: string;
  /** 触れたときに出す文字を作る */
  format?: (v: number, i: number) => string;
}

/** 推移。目盛線は引かず、上端と下端の数字だけ出す */
export function AreaChart({ values, tone = 'accent', zeroBased = false, height = 96, topLabel, bottomLabel, label, format }: AreaChartProps) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const w = 300;
  const h = height;
  const pad = 6;
  if (values.length < 2) {
    return (
      <figure className="chart">
        {label && <figcaption className="chart__label">{label}</figcaption>}
        <div className="chart__empty">まだデータがありません</div>
      </figure>
    );
  }
  const max = Math.max(...values, zeroBased ? 0 : -Infinity);
  const min = zeroBased ? Math.min(0, ...values) : Math.min(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const c = toneColor(tone);
  const at = hover !== null ? values[hover] : null;

  return (
    <figure className="chart">
      {label && <figcaption className="chart__label">{label}</figcaption>}
      <div className="chart__plot">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="chart__svg"
          style={{ height }}
          role="img"
          aria-label={`${label ?? '推移'}。${values.length}点、最小 ${bottomLabel ?? min.toFixed(0)}、最大 ${topLabel ?? max.toFixed(0)}`}
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - box.left) / Math.max(1, box.width);
            setHover(Math.max(0, Math.min(values.length - 1, Math.round(ratio * (values.length - 1)))));
          }}
        >
          <defs>
            <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity="0.32" />
              <stop offset="100%" stopColor={c} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#g${id})`} />
          <polyline points={line} fill="none" stroke={c} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && (
            <g>
              <line x1={x(hover)} y1={pad} x2={x(hover)} y2={h - pad} className="chart__cursor" />
              <circle cx={x(hover)} cy={y(values[hover])} r={4} fill={c} className="chart__dot" />
            </g>
          )}
        </svg>
        {at !== null && (
          <div className="chart__tip" style={{ left: `${(x(hover!) / w) * 100}%` }}>
            {format ? format(at, hover!) : at.toLocaleString('ja-JP')}
          </div>
        )}
      </div>
      {(topLabel || bottomLabel) && (
        <div className="chart__axis">
          <span>{topLabel}</span>
          <span>{bottomLabel}</span>
        </div>
      )}
    </figure>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  tone?: Tone;
  /** 値のうしろに出す小さな補足 */
  note?: string;
}

/**
 * 内訳を見せる横棒。
 * 色をどれも同じにするのは、棒の長さがもう大きさを表しているから
 * （役割の違う値だけ tone を変える）。
 */
export function BarChart({
  data,
  format,
  label,
  max,
  tone = 'accent',
}: {
  data: BarDatum[];
  format?: (v: number) => string;
  label?: string;
  max?: number;
  tone?: Tone;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <figure className="chart">
      {label && <figcaption className="chart__label">{label}</figcaption>}
      <div className="bars">
        {data.map((d) => (
          <div key={d.label} className="bars__row" title={`${d.label} ${format ? format(d.value) : d.value}`}>
            <span className="bars__name">{d.label}</span>
            <span className="bars__track">
              <span
                className="bars__fill"
                style={{ width: `${Math.max(1.5, Math.min(100, (Math.abs(d.value) / top) * 100))}%`, background: toneColor(d.tone ?? tone) }}
              />
            </span>
            <span className="bars__value num">
              {format ? format(d.value) : d.value.toLocaleString('ja-JP')}
              {d.note && <small className="bars__note">{d.note}</small>}
            </span>
          </div>
        ))}
        {data.length === 0 && <div className="chart__empty">まだデータがありません</div>}
      </div>
    </figure>
  );
}

/** 多いものから3つ＋「その他」にまとめる */
export function topWithOther(data: BarDatum[], keep = MAX_SERIES, otherLabel = 'その他'): BarDatum[] {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= keep + 1) return sorted;
  const head = sorted.slice(0, keep);
  const rest = sorted.slice(keep).reduce((a, d) => a + d.value, 0);
  return rest > 0 ? [...head, { label: otherLabel, value: rest }] : head;
}

/**
 * 全体に占める割合を見せる円（ドーナツ）。
 * 名前と数字を必ず横に並べるので、色だけで見分ける必要がない。
 */
export function DonutChart({ data, label, format }: { data: BarDatum[]; label?: string; format?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = topWithOther(data);
  const total = shown.reduce((a, d) => a + Math.max(0, d.value), 0);
  const size = 128;
  const r = 50;
  const cx = size / 2;
  const cy = size / 2;
  const colorAt = (i: number) => (shown[i].label === 'その他' ? OTHER_COLOR : SERIES_COLORS[i % SERIES_COLORS.length]);
  let acc = 0;
  const circumference = 2 * Math.PI * r;
  return (
    <figure className="chart">
      {label && <figcaption className="chart__label">{label}</figcaption>}
      {total > 0 ? (
        <div className="donut">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? '内訳'}。${shown.map((d) => d.label).join('、')}`}>
            <circle cx={cx} cy={cy} r={r} className="donut__track" />
            {shown.map((d, i) => {
              const frac = Math.max(0, d.value) / total;
              // 2px ぶん間をあけて、隣の色とくっつかないようにする
              const gapPx = shown.length > 1 ? 2 : 0;
              const dash = Math.max(0, frac * circumference - gapPx);
              const offset = -acc * circumference;
              acc += frac;
              return (
                <circle
                  key={d.label}
                  cx={cx}
                  cy={cy}
                  r={r}
                  className={`donut__seg${hover === i ? ' donut__seg--on' : ''}`}
                  stroke={colorAt(i)}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
              );
            })}
          </svg>
          <ul className="donut__legend">
            {shown.map((d, i) => (
              <li key={d.label} className={hover === i ? 'is-on' : undefined} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                <span className="donut__dot" style={{ background: colorAt(i) }} />
                <span className="donut__name">{d.label}</span>
                <span className="num">{format ? format(d.value) : d.value.toLocaleString('ja-JP')}</span>
                <span className="donut__pct num">{Math.round((d.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="chart__empty">まだデータがありません</div>
      )}
    </figure>
  );
}

/** 状態の内訳（動いている・止まっている など）。状態の色は系列の色と混ぜない */
export function StatusBar({ data, label, total }: { data: { label: string; value: number; tone: Tone }[]; label?: string; total?: number }) {
  const sum = total ?? data.reduce((a, d) => a + d.value, 0);
  if (sum <= 0) {
    return (
      <figure className="chart">
        {label && <figcaption className="chart__label">{label}</figcaption>}
        <div className="chart__empty">まだデータがありません</div>
      </figure>
    );
  }
  return (
    <figure className="chart">
      {label && <figcaption className="chart__label">{label}</figcaption>}
      <div className="statusbar" role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join('、')}>
        {data
          .filter((d) => d.value > 0)
          .map((d) => (
            <span key={d.label} className="statusbar__seg" style={{ flexGrow: d.value, background: toneColor(d.tone) }} title={`${d.label} ${d.value}`} />
          ))}
      </div>
      <ul className="statusbar__legend">
        {data
          .filter((d) => d.value > 0)
          .map((d) => (
            <li key={d.label}>
              <span className="donut__dot" style={{ background: toneColor(d.tone) }} />
              {d.label}
              <span className="num">{d.value}</span>
            </li>
          ))}
      </ul>
    </figure>
  );
}
