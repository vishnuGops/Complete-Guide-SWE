import { useCallback, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cn } from '../../ui/index.js';

/**
 * A draggable split (ROADMAP P4-6).
 *
 * Written here rather than pulled in, because the whole of it is forty lines and
 * every library version of it brings a styling opinion we would have to undo
 * (D16: Radix for behaviour, never for looks — and Radix has no splitter).
 *
 * The part worth the care is the keyboard. ARIA calls this a window splitter: a
 * focusable `separator` with a value, moved with the arrow keys and reset with
 * Home/End. Someone practising algorithms by keyboard should be able to give the
 * statement more room without reaching for the mouse (docs/DESIGN.md section 8).
 *
 * The ratio is controlled by the caller, because the caller is what persists it.
 */

export interface SplitPaneProps {
  /** `row` splits left/right and the handle is vertical; `column` splits top/bottom. */
  direction: 'row' | 'column';
  /** Percentage of the container given to `first`. */
  ratio: number;
  onRatio: (ratio: number) => void;
  /** Names the handle for screen readers, e.g. "Statement and editor". */
  label: string;
  first: ReactNode;
  second: ReactNode;
  min?: number;
  max?: number;
  className?: string;
}

const STEP = 2;

export function SplitPane({
  direction,
  ratio,
  onRatio,
  label,
  first,
  second,
  min = 20,
  max = 80,
  className,
}: SplitPaneProps) {
  const container = useRef<HTMLDivElement>(null);

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    // Only while dragging: the handle captures the pointer on `pointerdown`, so
    // moves keep arriving here even when the cursor is over the editor.
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const box = container.current?.getBoundingClientRect();
    if (!box) return;

    const fraction =
      direction === 'row'
        ? (event.clientX - box.left) / box.width
        : (event.clientY - box.top) / box.height;
    onRatio(clamp(fraction * 100));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const back = direction === 'row' ? 'ArrowLeft' : 'ArrowUp';
    const forward = direction === 'row' ? 'ArrowRight' : 'ArrowDown';

    if (event.key === back) onRatio(clamp(ratio - STEP));
    else if (event.key === forward) onRatio(clamp(ratio + STEP));
    else if (event.key === 'Home') onRatio(min);
    else if (event.key === 'End') onRatio(max);
    else return;

    event.preventDefault();
  };

  return (
    <div
      ref={container}
      className={cn(
        'flex min-h-0 min-w-0',
        direction === 'row' ? 'flex-row' : 'flex-col',
        className,
      )}
    >
      <div className="flex min-h-0 min-w-0" style={{ flex: `0 0 ${String(ratio)}%` }}>
        {first}
      </div>

      {/*
        ARIA's window-splitter pattern, exactly: a `separator` that is focusable
        and carries a value. `jsx-a11y` models `separator` as decorative and so
        objects to the `tabIndex` - and objects the other way round if the handle
        is a `button` with the role on it, because then it is an interactive
        element given a "non-interactive" role. The pattern is the authority
        here, and it is the reason the handle can be moved with the arrow keys at
        all (docs/DESIGN.md section 8).
      */}
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        role="separator"
        tabIndex={0}
        aria-orientation={direction === 'row' ? 'vertical' : 'horizontal'}
        aria-label={label}
        aria-valuenow={Math.round(ratio)}
        aria-valuemin={min}
        aria-valuemax={max}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        className={cn(
          'focus-ring-inset bg-border hover:bg-accent shrink-0 transition-colors duration-75',
          direction === 'row'
            ? 'w-px cursor-col-resize hover:w-0.5'
            : 'h-px cursor-row-resize hover:h-0.5',
        )}
      />
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}

      <div className="flex min-h-0 min-w-0 flex-1">{second}</div>
    </div>
  );
}
