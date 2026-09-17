import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from './cn.js';

/**
 * Button (ROADMAP P0-8).
 *
 * Four variants, because this app has exactly four things a button can be: the
 * one action on the screen (`primary`), the others beside it (`secondary`), a
 * control that lives inside a toolbar and should not draw the eye (`ghost`), and
 * something that destroys work (`danger`). A fifth variant would mean the screen
 * is unclear about which is which.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-fg-on-accent hover:bg-accent-hover border border-transparent',
  secondary: 'bg-surface text-fg border border-border-strong hover:bg-surface-sunken',
  ghost:
    'bg-transparent text-fg-muted border border-transparent hover:bg-surface-sunken hover:text-fg',
  danger: 'bg-danger-solid text-fg-on-accent hover:brightness-110 border border-transparent',
};

/** Heights land on the 8-pt grid: 28px and 32px. */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      // A button inside a form defaults to `submit` and will submit it. Almost
      // nothing here wants that, and the failure is a mysterious page reload.
      type={type ?? 'button'}
      className={cn(
        'focus-ring inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap',
        'transition-colors duration-75',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
