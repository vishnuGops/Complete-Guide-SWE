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
