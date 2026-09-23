import type { LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Tooltip } from './Tooltip.js';
import { cn } from './cn.js';

/**
 * One place in the icon rail (ROADMAP P9-6, docs/DESIGN.md 8).
 *
 * A 40px square with an 18px outline icon; the active one filled with the
 * accent - "this is where you are" is one of the two things blue means. The
 * rail is icons only, so every item has an accessible name and a tooltip that
 * says the same word and, where there is one, the shortcut (DESIGN.md 3: no
 * icon-only control without a label). The name is the page's own name, so
 * "Problems, link, current page" is what a screen reader hears.
 *
 * `activeUnder` is for a place that owns more than its own path: a problem's
 * workspace lives at `/problems/:slug` and is still "in Problems", and a rail
 * that marked nothing while you work would leave the screen used most with no
 * answer to "where am I".
 */
export interface RailItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  keys?: readonly string[];
  /** Other path prefixes that also count as being here. */
  activeUnder?: readonly string[];
}

export function RailItem({ to, label, icon: Icon, keys, activeUnder = [] }: RailItemProps) {
  const { pathname } = useLocation();
  const active =
    (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)) ||
    activeUnder.some((prefix) => pathname.startsWith(prefix));

  return (
    <Tooltip content={label} side="right" {...(keys ? { keys } : {})}>
      <Link
        to={to}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'focus-ring grid size-10 place-items-center rounded-lg transition-colors duration-75',
          active
            ? 'bg-accent text-fg-on-accent'
            : 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
        )}
      >
        <Icon aria-hidden size={18} strokeWidth={1.5} />
      </Link>
    </Tooltip>
  );
}
