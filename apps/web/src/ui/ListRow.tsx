import type { ReactNode } from 'react';
import { cn } from './cn.js';

/**
 * One row of a short list inside a card (ROADMAP P9-6, docs/DESIGN.md 10).
 *
 * A tile, a title, a muted meta line under it, and a value on the right -
 * recent submissions, the review queue. Rows are divided by hairlines, not
 * boxed: the card is the box.
 */
export interface ListRowProps {
  tile?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  value?: ReactNode;
  className?: string;
}

export function ListRow({ tile, title, meta, value, className }: ListRowProps) {
  return (
    <li
      className={cn(
        'border-border flex items-center gap-3 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0',
        className,
      )}
    >
      {tile}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {meta !== undefined && <div className="text-fg-subtle truncate text-xs">{meta}</div>}
      </div>
      {value !== undefined && (
        <div className="text-fg-muted tnum shrink-0 text-right text-xs">{value}</div>
      )}
    </li>
  );
}

/**
 * A neutral tile for an icon: 28px beside a sub-stat, 20px in a list row, where
 * it lines up with the verdict tiles around it.
 */
export function IconTile({ children, size = 'md' }: { children: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-surface-sunken text-fg-muted border-border grid shrink-0 place-items-center rounded-sm border',
        size === 'md' ? 'size-7' : 'size-5',
      )}
    >
      {children}
    </span>
  );
}
