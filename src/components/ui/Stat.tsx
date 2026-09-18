import { memo } from 'react';
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

function StatBase({ label, value, extra, tone = 'default', size = 'md', align = 'left' }: StatProps) {
  const sizeCls = size === 'lg' ? 'stat__value--lg' : size === 'sm' ? 'stat__value--sm' : '';
  // 単位を付けない設定だと桁が多くなって切れてしまうので、長いものは字を詰める
  const longCls = value.length > 12 ? 'stat__value--long' : '';
  return (
    <div className="stat" style={{ textAlign: align }}>
      <span className="stat__label">{label}</span>
      <span className={`stat__value ${sizeCls} ${longCls} ${TONE_CLASS[tone]}`}>{value}</span>
      {extra !== undefined && <span className="stat__extra">{extra}</span>}
    </div>
  );
}

/**
 * 同じ内容なら描き直さない。
 * 一覧にたくさん並ぶ部品なので、毎回の画面更新でここまで作り直さないようにしている。
 */
export const Stat = memo(StatBase);
