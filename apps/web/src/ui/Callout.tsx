import type { ReactNode } from 'react';
import { cn } from './cn.js';

/**
 * A tinted inset inside a card (ROADMAP P9-6, docs/DESIGN.md 10).
 *
 * For the one thing in a card that is a suggestion to act on: the coach's next
 * step, the next problem, the mastery offer. `accent-subtle`, `rounded-lg`, no
 * border - it is a region of the card, not a card inside it (DESIGN.md 3).
 */
export function Callout({
  children,
  className,
  role,
}: {
  children: ReactNode;
  className?: string;
  /** For a callout that appears in answer to something, and should be heard. */
  role?: 'status';
}) {
  return (
    <div role={role} className={cn('bg-accent-subtle text-fg rounded-lg px-4 py-3', className)}>
      {children}
    </div>
  );
}
