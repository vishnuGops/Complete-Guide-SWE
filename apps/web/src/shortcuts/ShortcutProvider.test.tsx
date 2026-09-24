import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ShortcutProvider, useShortcut } from './ShortcutProvider.js';

/**
 * The registry's behaviour (ROADMAP P4-2).
 *
 * Three things here are not obvious from reading the component, and all three
 * are the kind of thing that breaks quietly:
 *
 *   - a shortcut nobody is listening for must reach the browser, or `Ctrl+J`
 *     stops opening downloads on the list page for no reason;
 *   - a disabled binding must not fire *and* must not swallow the key;
 *   - the most recently mounted handler wins, because that is the screen the
 *     user is looking at.
 */

function Binder({ onRun, enabled = true }: { onRun: () => void; enabled?: boolean }) {
  useShortcut('run', onRun, enabled);
  return null;
}

function pressRun(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code: 'Enter',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
}

describe('ShortcutProvider', () => {
  it('runs the bound handler and stops the browser seeing the key', () => {
    const onRun = vi.fn();
    render(
      <ShortcutProvider>
        <Binder onRun={onRun} />
      </ShortcutProvider>,
    );

    const event = pressRun();
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves an unclaimed shortcut to the browser', () => {
    render(<ShortcutProvider>{null}</ShortcutProvider>);

    expect(pressRun().defaultPrevented).toBe(false);
  });

  it('does not fire or swallow a disabled binding', () => {
    const onRun = vi.fn();
    render(
      <ShortcutProvider>
        <Binder onRun={onRun} enabled={false} />
      </ShortcutProvider>,
    );

    const event = pressRun();
    expect(onRun).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('gives the key to the most recently mounted handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <ShortcutProvider>
        <Binder onRun={first} />
        <Binder onRun={second} />
      </ShortcutProvider>,
    );

    pressRun();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('calls the latest version of a handler, not the one bound on mount', () => {
    // The handler is a fresh closure every render; a registry that captured the
    // first one would Run with the code the editor held when the page opened.
    const calls: number[] = [];
    function Counting({ value }: { value: number }) {
      useShortcut('run', () => {
        calls.push(value);
      });
      return null;
    }

    const { rerender } = render(
      <ShortcutProvider>
        <Counting value={1} />
      </ShortcutProvider>,
    );
    rerender(
      <ShortcutProvider>
        <Counting value={2} />
      </ShortcutProvider>,
    );

    pressRun();
    expect(calls).toEqual([2]);
  });

  it('ignores an auto-repeating key, so holding Ctrl+Enter is one run', () => {
    const onRun = vi.fn();
    render(
      <ShortcutProvider>
        <Binder onRun={onRun} />
      </ShortcutProvider>,
    );

    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Enter', ctrlKey: true, repeat: true }),
    );
    expect(onRun).not.toHaveBeenCalled();
  });
});

describe('a dialog owns the keyboard', () => {
  /** The same key, but pressed on an element inside a modal. */
  function pressRunInside(target: Element): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      code: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  it('does not run the code a confirmation is asking about deleting', () => {
    // The concrete case (ROADMAP P4-12): reset-to-starter's dialog is open,
    // `Ctrl+Enter` reaches the window listener, and the judge runs the code
    // behind the dialog.
    const onRun = vi.fn();
    render(
      <ShortcutProvider>
        <Binder onRun={onRun} />
        <div role="dialog">
          <button>Reset</button>
        </div>
      </ShortcutProvider>,
    );

    const inside = document.querySelector('[role="dialog"] button')!;
    const event = pressRunInside(inside);

    expect(onRun).not.toHaveBeenCalled();
    // And the key is left alone rather than swallowed: the dialog may want it.
    expect(event.defaultPrevented).toBe(false);
  });

  it('treats an alertdialog the same way', () => {
    const onRun = vi.fn();
    render(
      <ShortcutProvider>
        <Binder onRun={onRun} />
        <div role="alertdialog">
          <input aria-label="inside" />
        </div>
      </ShortcutProvider>,
    );

    pressRunInside(document.querySelector('[role="alertdialog"] input')!);
    expect(onRun).not.toHaveBeenCalled();
  });

  it('still fires for a key pressed outside an open dialog', () => {
    // Checked on the target, not on "is a dialog open anywhere", so a popover
    // somewhere on screen does not disable the whole keyboard.
    const onRun = vi.fn();
    render(
      <ShortcutProvider>
        <Binder onRun={onRun} />
        <div role="dialog" />
        <button>in the page</button>
      </ShortcutProvider>,
    );

    pressRunInside(document.querySelector('button')!);
    expect(onRun).toHaveBeenCalledOnce();
  });
});

describe('a field that handles its own keys (P4-15)', () => {
  it('is left alone, and the key is not swallowed', () => {
    // The coach's follow-up box: Ctrl+Enter there means "send", and the
    // registry runs first because it listens on the window in capture.
    const onRun = vi.fn();
    render(
      <ShortcutProvider>
        <Binder onRun={onRun} />
        <form data-shortcuts="local">
          <input aria-label="follow-up" />
        </form>
      </ShortcutProvider>,
    );

    const event = new KeyboardEvent('keydown', {
      code: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.querySelector('input')!.dispatchEvent(event);

    expect(onRun).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
