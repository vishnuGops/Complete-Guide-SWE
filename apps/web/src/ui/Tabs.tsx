import * as RadixTabs from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';
import { cn } from './cn.js';

/**
 * Tabs (ROADMAP P0-8), on Radix.
 *
 * Radix is here for the keyboard and the ARIA wiring - arrow keys move between
 * tabs, Home/End jump to the ends, the panel is labelled by its tab - none of
 * which a hand-rolled version gets right on the first attempt, and all of which
 * the workspace's Description / Hints / Editorial / Submissions / Notes panel
 * depends on (D16: accessibility without a look imposed).
 *
 * The selected tab is marked by a bar under it *and* by weight and colour:
 * "the accent-coloured one" is not a signal everyone can read.
 */

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn('border-border flex items-stretch gap-1 border-b', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'focus-ring-inset relative -mb-px px-3 py-1.5 text-sm font-medium',
        'text-fg-muted hover:text-fg transition-colors duration-75',
        'disabled:pointer-events-none disabled:opacity-45',
        // The 2px bar sits on the list's own border, so switching tabs does not
        // move anything by a pixel.
        'data-[state=active]:text-fg data-[state=active]:border-accent data-[state=active]:border-b-2',
        'border-b-2 border-transparent',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn('focus-ring-inset pt-3', className)} {...props} />;
}

/**
 * A panel that keeps its state while another tab is shown (ROADMAP P4-12).
 *
 * Radix unmounts an inactive panel, which is the right default - a panel that
 * costs nothing when hidden - and wrong for a panel holding something the user
 * typed. Looking at the Description threw away a half-written coach question
 * and the results panel's selected test.
 *
 * `forceMount` keeps it mounted; Radix then marks the inactive one `hidden`,
 * which Tailwind's preflight turns into `display: none`, so it is out of the
 * layout and out of the accessibility tree. `hidden` is not enough on its own
 * for a flex child, hence the explicit `data-[state=inactive]:hidden` - a
 * `flex-1` on an element whose `display` was overridden by a utility class
 * would still take space.
 */
export function StickyTabsContent({
  className,
  ...props
}: ComponentProps<typeof RadixTabs.Content>) {
  return (
    <RadixTabs.Content
      forceMount
      className={cn('focus-ring-inset pt-3 data-[state=inactive]:hidden', className)}
      {...props}
    />
  );
}
