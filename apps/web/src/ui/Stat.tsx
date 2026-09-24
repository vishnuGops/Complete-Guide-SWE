import type { ReactNode } from 'react';
import { cn } from './cn.js';

/**
 * A number worth reading big (ROADMAP P9-6, docs/DESIGN.md 5 and 10).
 *
 * The numeral, its label, and optionally a delta chip: the 36px numeral a card
 * leads with - the largest thing in the app, and the one place a 700 weight is
 * allowed. Tabular figures and a slight negative tracking, so a count that
 * changes does not shuffle its neighbours. (A 28px `secondary` size went in
 * P4-17: nothing on any screen used it.)
 *
 * The label comes after the number in the DOM, so "18 Solved" is read in the
 * order it is seen.
 */
export interface StatProps {
  value: ReactNode;
  label: ReactNode;
  delta?: ReactNode;
  className?: string;
}

export function Stat({ value, label, delta, className }: StatProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        {/* 700 only here, on numerals of 28px and up (DESIGN.md 5). */}
        <span className="text-fg tnum tracking-numeral text-3xl font-bold">{value}</span>
        {delta}
      </div>
      <span className="text-fg-muted text-xs">{label}</span>
    </div>
  );
}

/**
 * A change, as a chip (DESIGN.md 7). Good news in the success family, anything
 * else neutral: red is for failure, not for "less".
 */
export function DeltaChip({ children, good }: { children: ReactNode; good: boolean }) {
  return (
    <span
      className={cn(
        'tnum inline-flex h-5 items-center rounded-full px-2 text-xs font-medium',
        good ? 'bg-success-subtle text-success-fg' : 'bg-surface-sunken text-fg-muted',
      )}
    >
      {children}
    </span>
  );
}
