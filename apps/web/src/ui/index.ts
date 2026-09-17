/**
 * The design system, as far as it goes (ROADMAP P0-8, D16).
 *
 * Four primitives, chosen because every screen in P4 needs all four and none of
 * them can be written well without Radix or without the tokens. A fifth,
 * `ConfirmDialog`, joined them with P4-6: reset-to-starter is the first thing in
 * the app that destroys the user's work, and Settings' reset-all-progress is the
 * second. Everything else
 * - tables, panels, verdict banners, the diff view - is built with the screen
 * that needs it, so it is designed against a real layout rather than invented in
 * a vacuum and then bent to fit.
 */
export { Button } from './Button.js';
export { ConfirmDialog } from './ConfirmDialog.js';
export type { ConfirmDialogProps } from './ConfirmDialog.js';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button.js';
export { Input } from './Input.js';
export type { InputProps } from './Input.js';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs.js';
export { Tooltip, TooltipProvider } from './Tooltip.js';
export type { TooltipProps } from './Tooltip.js';
export { cn } from './cn.js';
export type { ClassValue } from './cn.js';
