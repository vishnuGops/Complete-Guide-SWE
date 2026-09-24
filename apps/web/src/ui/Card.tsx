import { useId, type ReactNode } from 'react';
import { cn } from './cn.js';

/**
 * A card (ROADMAP P9-6, docs/DESIGN.md 6 and 10).
 *
 * The one surface the work sits on: `surface`, a hairline `border`, the faint
 * `shadow-card` lift (none in dark, where the tonal step between canvas and
 * card does it) and `rounded-xl`. Every card answers one question, so it takes
 * a title for that question and an optional action beside it; a card with
 * nothing to title is usually a panel that should not be a card.
 *
 * Cards never nest (DESIGN.md 3). Inside one, group with space, a divider or a
 * `Callout`.
 *
 * With a title the card is a labelled `section`, so a screen reader can move
 * between cards the way a sighted user's eye does. `as="div"` is for the few
 * cards that are layout rather than content - the editor's frame.
 */

export type CardPadding = 'default' | 'none';

const PADDING: Record<CardPadding, string> = {
  default: 'p-5',
  none: '',
};

export interface CardProps {
  title?: ReactNode;
  /** A muted line under the title saying what the card is for. */
  description?: ReactNode;
  /** Beside the title, right-aligned: a link out, a range control. */
  action?: ReactNode;
  padding?: CardPadding;
  as?: 'section' | 'div';
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
  'data-testid'?: string;
}

export function Card({
  title,
  description,
  action,
  padding = 'default',
  as = 'section',
  className,
  children,
  ...rest
}: CardProps) {
  const titleId = useId();
  const Element = as;
  const labelled = title !== undefined && as === 'section' && rest['aria-label'] === undefined;

  return (
    <Element
      aria-labelledby={labelled ? titleId : undefined}
      className={cn(
        'bg-surface border-border shadow-card min-w-0 rounded-xl border',
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {(title !== undefined || action !== undefined) && (
        <div className="mb-4 flex min-h-7 items-center gap-3">
          <div className="min-w-0 flex-1">
            {title !== undefined && (
              // `h2`: every card sits directly under its page's `h1`.
              <h2 id={titleId} className="text-fg text-sm font-semibold">
                {title}
              </h2>
            )}
            {description !== undefined && (
              <p className="text-fg-muted mt-0.5 text-xs">{description}</p>
            )}
          </div>
          {action !== undefined && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </Element>
  );
}
