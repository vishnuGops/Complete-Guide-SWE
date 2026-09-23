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
 * Version 2 of the design (P9-6) added the pieces its screens share: `Card`,
 * `Segmented`, `Kbd`, `RailItem`, `Stat`, `Callout`, `ListRow`, `SegmentBar`,
 * `CoachMark` and `VerdictTile` (docs/DESIGN.md 10). Each has at least two
 * callers - the list of screens is in DESIGN.md - which is the rule for
 * promoting anything here.
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
