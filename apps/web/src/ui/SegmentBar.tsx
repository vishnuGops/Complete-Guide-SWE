import { cn } from './cn.js';

/**
 * Progress through a set, one segment per item (ROADMAP P9-6, DESIGN.md 10).
 *
 * The reference's goal bars: a row of small segments rather than one smooth
 * fill, so "7 of 14" is countable at a glance and a topic of four problems does
 * not look like a topic of forty. Filled segments are `success` - solved is a
 * status, and the accent never is one (DESIGN.md 4) - or `warn` when the set is
 * behind its review schedule, which the caller must also say in words.
 *
 * The bar is a picture of a number the caller prints beside it, so it is
 * `aria-hidden`: the caller must print the number. (A `label` that made it a
 * named image went in P4-17 - no caller ever had a bar without its number.)
 */
export interface SegmentBarProps {
  filled: number;
  total: number;
  tone?: 'success' | 'warn';
  className?: string;
}

export function SegmentBar({ filled, total, tone = 'success', className }: SegmentBarProps) {
  return (
    <span aria-hidden className={cn('flex h-1.5 gap-0.5', className)}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'min-w-0 flex-1 rounded-xs',
            index < filled ? (tone === 'warn' ? 'bg-warn' : 'bg-success') : 'bg-border',
          )}
        />
      ))}
    </span>
  );
}
