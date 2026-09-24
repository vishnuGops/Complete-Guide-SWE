/**
 * The design system, as far as it goes (ROADMAP P0-8, D16).
 *
 * Four primitives, chosen because every screen in P4 needs all four and none of
 * them can be written well without Radix or without the tokens. A fifth,
 * `ConfirmDialog`, joined them with P4-6: reset-to-starter is the first thing in
 * the app that destroys the user's work, and Settings' reset-all-progress is the
 * second. `StatusMark` joined them with P4-8, when the workspace header became
 * the second place that has to draw a problem's status, and `Loading` and
 * `ErrorState` with P4-10, which is when the fourth screen was waiting on a
 * query and the fourth copy of "Loading…" was about to be written.
 *
 * Version 2 of the design (P9-6) added its vocabulary, the patterns named in
 * docs/DESIGN.md 10: `Card`, `Segmented`, `Kbd`, `RailItem`, `Stat`,
 * `Callout`, `ListRow`, `SegmentBar`, `CoachMark` and `VerdictTile`. Most have
 * two screens or more behind them. Four do not, and are here anyway, on
 * purpose (P4-17 corrected a comment that said otherwise): `Stat`, `ListRow`
 * and `SegmentBar` are drawn only by Progress, and `RailItem` only by the
 * shell. They are the design's named parts rather than one screen's markup -
 * DESIGN.md specifies each, `/dev/kitchen-sink` renders each for review in
 * both themes, and `v2.test.tsx` holds their behaviour - so the rule for
 * anything *else* stays the one above: it moves here when a second screen
 * needs it.
 *
 * A variant goes when nothing uses it (P4-17 removed `Stat`'s second size,
 * `Card`'s `dense` padding and heading level, `Callout`'s `note` role and
 * `SegmentBar`'s label): an option no screen exercises is a promise no screen
 * has checked.
 *
 * Everything else - tables, verdict banners, the diff view - is built with the
 * screen that needs it, so it is designed against a real layout rather than
 * invented in a vacuum and then bent to fit.
 */
export { Button, buttonClasses } from './Button.js';
export { Callout } from './Callout.js';
export { Card } from './Card.js';
export type { CardPadding, CardProps } from './Card.js';
export { CoachMark } from './CoachMark.js';
export { ConfirmDialog } from './ConfirmDialog.js';
export type { ConfirmDialogProps } from './ConfirmDialog.js';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button.js';
export { ErrorBoundary } from './ErrorBoundary.js';
export type { ErrorBoundaryProps } from './ErrorBoundary.js';
export { ErrorState } from './ErrorState.js';
export type { ErrorStateProps } from './ErrorState.js';
export { Input } from './Input.js';
export { Kbd, Keys } from './Kbd.js';
export { IconTile, ListRow } from './ListRow.js';
export type { ListRowProps } from './ListRow.js';
export { RailItem } from './RailItem.js';
export type { RailItemProps } from './RailItem.js';
export { SegmentBar } from './SegmentBar.js';
export type { SegmentBarProps } from './SegmentBar.js';
export { Segmented } from './Segmented.js';
export type { SegmentedOption, SegmentedProps } from './Segmented.js';
export { DeltaChip, Stat } from './Stat.js';
export type { StatProps } from './Stat.js';
export { Loading, Skeleton } from './Loading.js';
export type { LoadingProps } from './Loading.js';
export { StatusMark } from './StatusMark.js';
export type { StatusMarkProps } from './StatusMark.js';
export type { InputProps } from './Input.js';
export { StickyTabsContent, Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs.js';
export { Tooltip, TooltipProvider } from './Tooltip.js';
export type { TooltipProps } from './Tooltip.js';
export { VerdictTile } from './VerdictTile.js';
export { cn } from './cn.js';
export type { ClassValue } from './cn.js';
