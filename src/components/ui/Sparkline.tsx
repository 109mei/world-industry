interface SparklineProps {
  values: number[];
  tone?: 'accent' | 'profit' | 'loss';
}

/** 価格推移などの小さな折れ線。横の目盛線は入れない */
export function Sparkline({ values, tone = 'accent' }: SparklineProps) {
  const w = 200;
  const h = 48;
  if (values.length < 2) return <svg className="spark" viewBox={`0 0 ${w} ${h}`} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`).join(' ');
  const color = tone === 'profit' ? 'var(--profit)' : tone === 'loss' ? 'var(--loss)' : 'var(--accent)';
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
