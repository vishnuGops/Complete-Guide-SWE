import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from './cn.js';

/**
 * Input (ROADMAP P0-8).
 *
 * `invalid` sets `aria-invalid` as well as the red border, because the border
 * alone says nothing to a screen reader and nothing at all to someone who
 * cannot distinguish it from the normal one. Colour is never the only carrier of
 * meaning in this app (docs/DESIGN.md).
 *
 * The message that explains *why* it is invalid belongs to the form that owns
 * the field, wired up with `aria-describedby`; this is a text box, not a form
 * system.
 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  invalid?: boolean;
  /** Renders in JetBrains Mono: API keys, slugs, anything read character by character. */
  mono?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ invalid = false, mono = false, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'focus-ring h-8 w-full rounded-md border px-2.5 text-sm',
        'bg-surface text-fg placeholder:text-fg-subtle',
        'transition-colors duration-75',
        'disabled:cursor-not-allowed disabled:opacity-45',
        // A field's edge carries meaning, so it holds 3:1 (border-input, P9-6).
        invalid ? 'border-danger' : 'border-border-input hover:border-fg-muted',
        mono && 'font-mono',
        className,
      )}
      {...props}
    />
  );
}
