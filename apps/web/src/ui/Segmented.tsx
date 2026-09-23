import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn.js';

/**
 * A segmented control (ROADMAP P9-6, docs/DESIGN.md 10).
 *
 * A sunken tray of mutually exclusive choices with the chosen one filled in
 * the accent: the language, a time range, a view of the list, the theme.
 *
 * Toggle buttons in a labelled group, each with `aria-pressed`, rather than
 * Radix Toggle Group: the behaviour is small enough to own, and the app's
 * existing choosers (the language switch, the theme) were already announced
 * this way - "Python, toggle button, pressed" - which is what their tests and
 * users rely on. Every segment stays in the tab order; the arrow keys also
 * move between them, as they would in a toolbar.
 *
 * `selectedLabel` exists for the one case where the pressed state is not the
 * whole story: a segment can say more than its visible word (a count) without
 * the word itself changing.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  /** An accessible name when the visible label is not enough on its own. */
  'aria-label'?: string;
}

export interface SegmentedProps<T extends string> {
  /** Names the group, e.g. "Language". */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /**
   * The tray's fill. `sunken` inside a card; `surface` on the canvas, where a
   * sunken tray is lighter than what it sits on and reads as raised (P9-6).
   */
  tray?: 'sunken' | 'surface';
  className?: string;
}

/** Tray included, the two sizes match the buttons beside them: 28px and 32px. */
const SIZE = {
  sm: 'h-5.5 px-2 text-xs',
  md: 'h-6.5 px-2.5 text-sm',
} as const;

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  tray = 'sunken',
  className,
}: SegmentedProps<T>) {
  const group = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const buttons = [
      ...(group.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
    ];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) return;
    const step = event.key === 'ArrowRight' ? 1 : -1;
    buttons[(at + step + buttons.length) % buttons.length]?.focus();
    event.preventDefault();
  };

  return (
    // A group of toggle buttons, which is interactive through its children;
    // the arrow-key handler is a convenience on top of Tab, not the only way in.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={group}
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'border-border inline-flex items-center gap-0.5 rounded-md border p-0.5',
        tray === 'sunken' ? 'bg-surface-sunken' : 'bg-surface',
        className,
      )}
    >
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            aria-label={option['aria-label']}
            disabled={option.disabled}
            onClick={() => {
              if (!pressed) onChange(option.value);
            }}
            className={cn(
              'focus-ring inline-flex items-center gap-1.5 rounded-sm font-medium whitespace-nowrap',
              'transition-colors duration-75',
              'disabled:pointer-events-none disabled:opacity-45',
              SIZE[size],
              pressed ? 'bg-accent text-fg-on-accent' : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
