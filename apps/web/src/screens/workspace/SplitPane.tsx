import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
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
 * The ratio is controlled by the caller, because the caller is what persists it
 * - but only once a drag has finished (ROADMAP P4-18). While the handle moves,
 * the ratio lives here: reporting every `pointermove` wrote the layout to
 * `localStorage` and re-rendered the whole workspace sixty times a second, for
 * a value nobody reads until the pointer is let go. `first` and `second` are
 * the same elements throughout a drag, so React skips them and only this
 * component's two flex boxes move.
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
  /** The ratio mid-drag, or null when the caller's is the one on screen. */
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? ratio;

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    // Only while dragging. The handle captures the pointer on `pointerdown`, so
    // moves keep arriving here even when the cursor is over the editor.
    if (dragging === null) return;
    const box = container.current?.getBoundingClientRect();
    if (!box || (direction === 'row' ? box.width : box.height) === 0) return;

    const fraction =
      direction === 'row'
        ? (event.clientX - box.left) / box.width
        : (event.clientY - box.top) / box.height;
    setDragging(clamp(fraction * 100));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging === null) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragging(null);
    if (dragging !== ratio) onRatio(dragging);
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
      <div className="flex min-h-0 min-w-0" style={{ flex: `0 0 ${String(shown)}%` }}>
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
        aria-valuenow={Math.round(shown)}
        aria-valuemin={min}
        aria-valuemax={max}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          // Optional-called: jsdom has no pointer capture, and a drag that
          // loses the pointer over the editor is still a drag here.
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setDragging(ratio);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          // The 12px gutter between two cards is the handle (P9-6): wide
          // enough to grab, empty until it is hovered or focused, when a 2px
          // accent line down its middle says "this moves".
          'group focus-ring-inset relative shrink-0 rounded-xs',
          direction === 'row' ? 'w-3 cursor-col-resize' : 'h-3 cursor-row-resize',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'group-hover:bg-accent group-focus-visible:bg-accent absolute rounded-xs bg-transparent transition-colors duration-75',
            direction === 'row'
              ? 'inset-y-2 left-1/2 w-0.5 -translate-x-1/2'
              : 'inset-x-2 top-1/2 h-0.5 -translate-y-1/2',
          )}
        />
      </div>
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}

      <div className="flex min-h-0 min-w-0 flex-1">{second}</div>
    </div>
  );
}
