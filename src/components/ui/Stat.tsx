interface StatProps {
  label: string;
  value: string;
  extra?: string;
  tone?: 'default' | 'profit' | 'warn' | 'loss' | 'power' | 'research';
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right';
}

const TONE_CLASS: Record<NonNullable<StatProps['tone']>, string> = {
  default: '',
  profit: 'text-profit',
  warn: 'text-warn',
  loss: 'text-loss',
  power: 'text-power',
  research: 'text-research',
};

export function Stat({ label, value, extra, tone = 'default', size = 'md', align = 'left' }: StatProps) {
  const sizeCls = size === 'lg' ? 'stat__value--lg' : size === 'sm' ? 'stat__value--sm' : '';
  return (
    <div className="stat" style={{ textAlign: align }}>
      <span className="stat__label">{label}</span>
      <span className={`stat__value ${sizeCls} ${TONE_CLASS[tone]}`}>{value}</span>
      {extra !== undefined && <span className="stat__extra">{extra}</span>}
    </div>
  );
}
