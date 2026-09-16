import type { ReactNode } from 'react';

interface BadgeProps {
  tone?: 'default' | 'profit' | 'warn' | 'loss' | 'power' | 'research';
  children: ReactNode;
}

export function Badge({ tone = 'default', children }: BadgeProps) {
  return <span className={`badge ${tone === 'default' ? '' : `badge--${tone}`}`}>{children}</span>;
}
