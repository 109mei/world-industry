import { useId } from 'react';

type Tone = 'accent' | 'profit' | 'loss' | 'research' | 'power';

function color(tone: Tone): string {
  switch (tone) {
    case 'profit':
      return 'var(--profit)';
    case 'loss':
      return 'var(--loss)';
    case 'research':
      return 'var(--research)';
    case 'power':
      return 'var(--power)';
    default:
      return 'var(--accent)';
  }
}

interface AreaChartProps {
  values: number[];
  tone?: Tone;
  /** 縦軸の下端を0にする（増え方が分かりやすい） */
  zeroBased?: boolean;
  height?: number;
  /** 軸の目盛りに出す文字（上端と下端） */
  topLabel?: string;
  bottomLabel?: string;
  label?: string;
}

/** 推移を見せる折れ線＋塗り。目盛りを2本だけ引いて、数字は端に小さく出す */
export function AreaChart({ values, tone = 'accent', zeroBased = false, height = 96, topLabel, bottomLabel, label }: AreaChartProps) {
  const id = useId();
  const w = 300;
  const h = height;
  const pad = 6;
  if (values.length < 2) {
    return (
      <div className="chart">
        {label && <div className="chart__label">{label}</div>}
        <div className="chart__empty">まだデータがありません</div>
      </div>
    );
  }
  const max = Math.max(...values, zeroBased ? 0 : -Infinity);
  const min = zeroBased ? Math.min(0, ...values) : Math.min(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const c = color(tone);
  const zero = min < 0 && max > 0 ? y(0) : null;
  return (
    <div className="chart">
      {label && <div className="chart__label">{label}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="chart__svg" style={{ height }} aria-hidden="true">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.35" />
            <stop offset="100%" stopColor={c} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={pad} y1={pad} x2={w - pad} y2={pad} className="chart__grid" />
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} className="chart__grid" />
        {zero !== null && <line x1={pad} y1={zero} x2={w - pad} y2={zero} className="chart__zero" />}
        <polygon points={area} fill={`url(#g${id})`} />
        <polyline points={line} fill="none" stroke={c} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      {(topLabel || bottomLabel) && (
        <div className="chart__axis">
          <span>{topLabel}</span>
          <span>{bottomLabel}</span>
        </div>
      )}
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  tone?: Tone;
}

/** 内訳を見せる横棒。合計に対する割合も出す */
export function BarChart({ data, format, label, max }: { data: BarDatum[]; format?: (v: number) => string; label?: string; max?: number }) {
  const top = max ?? Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <div className="chart">
      {label && <div className="chart__label">{label}</div>}
      <div className="bars">
        {data.map((d) => (
          <div key={d.label} className="bars__row">
            <span className="bars__name">{d.label}</span>
            <span className="bars__track">
              <span className="bars__fill" style={{ width: `${Math.min(100, (Math.abs(d.value) / top) * 100)}%`, background: color(d.tone ?? 'accent') }} />
            </span>
            <span className="bars__value num">{format ? format(d.value) : d.value.toLocaleString('ja-JP')}</span>
          </div>
        ))}
        {data.length === 0 && <div className="chart__empty">まだデータがありません</div>}
      </div>
    </div>
  );
}

/** 全体に占める割合を見せる円（ドーナツ） */
export function DonutChart({ data, label, format }: { data: BarDatum[]; label?: string; format?: (v: number) => string }) {
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0);
  const size = 132;
  const r = 52;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;
  const TONES: Tone[] = ['accent', 'profit', 'research', 'power', 'loss'];
  return (
    <div className="chart">
      {label && <div className="chart__label">{label}</div>}
      <div className="donut">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={cx} cy={cy} r={r} className="donut__track" />
          {total > 0 &&
            data.map((d, i) => {
              const frac = Math.max(0, d.value) / total;
              const dash = frac * 2 * Math.PI * r;
              const gap = 2 * Math.PI * r - dash;
              const offset = -acc * 2 * Math.PI * r;
              acc += frac;
              return (
                <circle
                  key={d.label}
                  cx={cx}
                  cy={cy}
                  r={r}
                  className="donut__seg"
                  stroke={color(d.tone ?? TONES[i % TONES.length])}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={offset}
                />
              );
            })}
        </svg>
        <ul className="donut__legend">
          {data.map((d, i) => (
            <li key={d.label}>
              <span className="donut__dot" style={{ background: color(d.tone ?? TONES[i % TONES.length]) }} />
              <span className="donut__name">{d.label}</span>
              <span className="num">{format ? format(d.value) : d.value.toLocaleString('ja-JP')}</span>
            </li>
          ))}
        </ul>
      </div>
      {total <= 0 && <div className="chart__empty">まだデータがありません</div>}
    </div>
  );
}
