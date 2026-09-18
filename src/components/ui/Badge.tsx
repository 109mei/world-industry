import { memo } from 'react';
import type { ReactNode } from 'react';

interface BadgeProps {
  tone?: 'default' | 'profit' | 'warn' | 'loss' | 'power' | 'research';
  children: ReactNode;
}

function BadgeBase({ tone = 'default', children }: BadgeProps) {
  return <span className={`badge ${tone === 'default' ? '' : `badge--${tone}`}`}>{children}</span>;
}

/**
 * 同じ内容なら描き直さない。
 * 一覧にたくさん並ぶ部品なので、毎回の画面更新でここまで作り直さないようにしている。
 */
export const Badge = memo(BadgeBase);
