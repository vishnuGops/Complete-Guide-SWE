import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from './cn.js';

/**
 * Tooltip (ROADMAP P0-8), on Radix.
 *
 * A tooltip is a label for a control whose meaning is not already on screen -
 * an icon button, a truncated title, a keyboard shortcut. It is never where an
 * instruction lives: it cannot be read on a touch screen, it cannot be selected,
 * and it disappears the moment the pointer moves. If the user needs the text to
 * do the task, the text belongs on the page.
 *
 * Radix gives it the part that is easy to get wrong: it opens on keyboard focus
 * as well as hover, closes on Escape, and is wired as the trigger's
 * accessible description rather than floating unannounced.
 */

export interface TooltipProps {
  /** The label. Short: one line, no markup, no paragraph. */
  content: ReactNode;
  /** The control being labelled. Must accept a ref and take focus. */
  children: ReactNode;
  side?: RadixTooltip.TooltipContentProps['side'];
  /** Keys shown beside the label, e.g. `['Ctrl', 'Enter']` (D16 shortcuts). */
  keys?: readonly string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Mounted once, near the root. It carries the shared open/close timing, which is
 * what stops a row of toolbar buttons from each waiting the full delay as the
 * pointer crosses them.
 */
export function TooltipProvider({
  children,
  delayDuration = 400,
}: {
  children: ReactNode;
  delayDuration?: number;
}) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration} skipDelayDuration={300}>
      {children}
    </RadixTooltip.Provider>
  );
}

export function Tooltip({ content, children, side = 'bottom', keys, ...props }: TooltipProps) {
  return (
    <RadixTooltip.Root {...props}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            'bg-overlay text-fg border-border shadow-overlay z-50 rounded-md border',
            'flex items-center gap-2 px-2 py-1 text-xs',
            'select-none',
          )}
        >
          {content}
          {keys && keys.length > 0 && (
            <span className="flex items-center gap-0.5">
              {keys.map((key) => (
                <kbd
                  key={key}
                  className="border-border-strong text-fg-muted rounded-xs border px-1 text-2xs"
                >
                  {key}
                </kbd>
              ))}
            </span>
          )}
          <RadixTooltip.Arrow className="fill-overlay" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
