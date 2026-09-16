import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  locked?: boolean;
  flat?: boolean;
}

export function Card({ children, locked = false, flat = false, className = '', ...rest }: CardProps) {
  const cls = ['card', locked ? 'card--locked' : '', flat ? 'card--flat' : '', className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
