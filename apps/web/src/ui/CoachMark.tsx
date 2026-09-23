import { cn } from './cn.js';

/**
 * The coach's mark (ROADMAP P9-6, docs/DESIGN.md 10).
 *
 * An 8px accent dot in a 2px `accent-subtle` ring - flat, no gradient. The
 * reference marked its assistant with a glossy orb; this is the same idea with
 * the decoration taken out. The coach's words themselves are told apart by
 * their serif, so the mark is only a small signpost beside them.
 */
export function CoachMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-accent ring-accent-subtle block size-2 shrink-0 rounded-full ring-2',
        className,
      )}
    />
  );
}
