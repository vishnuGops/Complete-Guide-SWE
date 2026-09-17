import type { ReactNode } from 'react';
import { cn } from './cn.js';

/**
 * Loading placeholders (ROADMAP P4-10).
 *
 * `Skeleton` is one grey block; the *shape* a screen makes out of them belongs
 * to that screen, because a skeleton is only worth having when it is the outline
 * of the thing that is coming. A generic spinner in the middle of the page
 * reserves no space and tells you nothing about what will fill it.
 *
 * Both are `aria-hidden`, and `Loading` says out loud what a sighted user reads
 * from the shape. Announcing twenty grey rectangles would be announcing the
 * layout; "Loading problems" is the information.
 *
 * The blocks stay invisible for their first 150ms - see the `skeleton` utility
 * in tokens.css, which is also where the case against a shimmer is written
 * down. On this app's own machine most of these never become visible at all,
 * which is the intended outcome.
 */

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton block rounded-xs', className)} />;
}

export interface LoadingProps {
  /** What is being waited for, e.g. "Loading problems". Read out, never shown. */
  label: string;
  className?: string;
  children: ReactNode;
}

export function Loading({ label, className, children }: LoadingProps) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <span aria-hidden>{children}</span>
    </div>
  );
}
