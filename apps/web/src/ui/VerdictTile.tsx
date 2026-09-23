import { Check, Clock, MemoryStick, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import type { Verdict } from '@devpromax/shared';
import { cn } from './cn.js';

/**
 * A verdict as a tile (ROADMAP P9-6, docs/DESIGN.md 7 and 8).
 *
 * A 20px `rounded-sm` square in the verdict's subtle tint with a glyph in its
 * text colour: a tick, a cross, a clock. The glyph is the second signal, so the
 * tile still says "accepted" or "failed" to someone who cannot tell the tints
 * apart - and it is always followed by the verdict in words, which is what a
 * screen reader gets; the tile itself is decoration to one.
 *
 * Three families for six verdicts (success, warn, danger), the same mapping as
 * `screens/workspace/verdict.ts`.
 */

const TONE: Record<Verdict, string> = {
  AC: 'bg-success-subtle text-success-fg',
  WA: 'bg-danger-subtle text-danger-fg',
  RE: 'bg-danger-subtle text-danger-fg',
  CE: 'bg-danger-subtle text-danger-fg',
  TLE: 'bg-warn-subtle text-warn-fg',
  MLE: 'bg-warn-subtle text-warn-fg',
};

const GLYPH: Record<Verdict, LucideIcon> = {
  AC: Check,
  WA: X,
  RE: TriangleAlert,
  CE: X,
  TLE: Clock,
  MLE: MemoryStick,
};

export function VerdictTile({
  verdict,
  size = 'md',
  className,
}: {
  verdict: Verdict;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const Glyph = GLYPH[verdict];
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-sm',
        size === 'md' ? 'size-5' : 'size-4',
        TONE[verdict],
        className,
      )}
    >
      <Glyph size={size === 'md' ? 14 : 12} strokeWidth={2} />
    </span>
  );
}
