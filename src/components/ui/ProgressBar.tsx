interface ProgressBarProps {
  ratio: number;
  tone?: 'accent' | 'profit' | 'warn' | 'loss' | 'research' | 'auto';
  size?: 'md' | 'lg';
  label?: string;
}

/** 0〜1 のゲージ。tone=auto なら満杯に近づくほど警告色になる */
export function ProgressBar({ ratio, tone = 'accent', size = 'md', label }: ProgressBarProps) {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  let t = tone;
  if (tone === 'auto') t = r >= 0.999 ? 'loss' : r >= 0.85 ? 'warn' : 'accent';
  const fillCls = t === 'accent' ? '' : `bar__fill--${t}`;
  return (
    <div className={`bar ${size === 'lg' ? 'bar--lg' : ''}`} role="progressbar" aria-valuenow={Math.round(r * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`bar__fill ${fillCls}`} style={{ width: `${r * 100}%` }} />
    </div>
  );
}
