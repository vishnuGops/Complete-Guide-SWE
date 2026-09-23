import type { ReactNode } from 'react';
import { cn } from './cn.js';

/**
 * A key, as a chip (ROADMAP P9-6, docs/DESIGN.md 9 and 10).
 *
 * Shown where the control is - inside the search pill, the AI Help pill and in
 * tooltips - so a shortcut is learnt by using the thing it belongs to. A row of
 * chips is one chip per key: `Ctrl` `Shift` `H`, not "Ctrl+Shift+H" in one.
 */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'bg-surface-sunken text-fg-muted border-border inline-flex h-4.5 items-center rounded-xs border px-1 font-sans text-2xs font-medium',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Several keys, one chip each, hidden from the accessible name of their control. */
export function Keys({ keys, className }: { keys: readonly string[]; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex items-center gap-0.5', className)}>
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}
