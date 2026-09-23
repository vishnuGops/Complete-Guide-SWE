import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from './cn.js';

/**
 * Button (ROADMAP P0-8; shapes by P9-6).
 *
 * Five variants, because this app has five things a button can be: the one
 * action in a region (`primary`, a filled pill), the others beside it
 * (`secondary`), a control inside a toolbar that should not draw the eye
 * (`ghost`), something that destroys work (`danger`), and the one action that
 * matters but must not compete with the primary one (`primary-outline` - AI
 * Help beside Submit: it is the thing you reach for when the loop is not
 * working, and it spends money).
 *
 * Shape follows importance (docs/DESIGN.md 6): only the primary actions are
 * pills; everything else is `rounded-md`, like the inputs it sits beside. One
 * filled pill per region, or neither is primary.
 */
export type ButtonVariant = 'primary' | 'primary-outline' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-fg-on-accent hover:bg-accent-hover border border-transparent rounded-full',
  'primary-outline':
    'bg-surface text-accent-fg border border-accent hover:bg-accent-subtle rounded-full',
  secondary:
    'bg-surface text-fg border border-border-strong hover:bg-surface-sunken hover:border-border-hover rounded-md',
  ghost:
    'bg-transparent text-fg-muted border border-transparent hover:bg-surface-sunken hover:text-fg rounded-md',
  danger:
    'bg-danger-solid text-fg-on-accent hover:brightness-110 border border-transparent rounded-md',
};

/** Heights land on the 8-pt grid: 28px and 32px. Pills get a little more side room. */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-2',
};

const PILL_SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs gap-1.5',
  md: 'h-8 px-4 text-sm gap-2',
};

/**
 * A button's classes without the button, for the rare link that is the action
 * - "Open it" beside a suggested problem navigates, so it is an `<a>`, but it is
 * the primary action of its card and looks like one.
 */
export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
): string {
  const pill = variant === 'primary' || variant === 'primary-outline';
  return cn(
    'focus-ring inline-flex items-center justify-center font-medium whitespace-nowrap',
    'transition-colors duration-75',
    'disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    pill ? PILL_SIZES[size] : SIZES[size],
  );
}

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
      className={cn(buttonClasses(variant, size), className)}
      {...props}
    />
  );
}
