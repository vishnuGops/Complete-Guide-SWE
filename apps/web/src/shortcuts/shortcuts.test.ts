import { describe, expect, it } from 'vitest';
import { SHORTCUTS, matchShortcut } from './shortcuts.js';

/**
 * The shortcut table (ROADMAP P4-2, D16).
 *
 * Worth testing rather than reading, because the interesting cases are the near
 * misses: `Ctrl+Enter` and `Ctrl+Shift+Enter` differ by one modifier and mean
 * Run and Submit, and getting that wrong means a stray Shift records a
 * submission the user did not ask for.
 */

function press(init: Partial<KeyboardEventInit> & { code: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', { ctrlKey: false, shiftKey: false, altKey: false, ...init });
}

describe('matchShortcut', () => {
  it('reads Ctrl+Enter as Run and Ctrl+Shift+Enter as Submit', () => {
    expect(matchShortcut(press({ code: 'Enter', ctrlKey: true }))).toBe(SHORTCUTS.run);
    expect(matchShortcut(press({ code: 'Enter', ctrlKey: true, shiftKey: true }))).toBe(
      SHORTCUTS.submit,
    );
  });

  it('reads Ctrl+J and Ctrl+Shift+H', () => {
    expect(matchShortcut(press({ code: 'KeyJ', ctrlKey: true }))).toBe(SHORTCUTS.togglePanel);
    expect(matchShortcut(press({ code: 'KeyH', ctrlKey: true, shiftKey: true }))).toBe(
      SHORTCUTS.aiHelp,
    );
  });

  it('accepts Cmd as well as Ctrl, so the same keys work on a Mac keyboard', () => {
    expect(matchShortcut(press({ code: 'Enter', metaKey: true }))).toBe(SHORTCUTS.run);
  });

  it('ignores the key on its own, and with Alt held', () => {
    expect(matchShortcut(press({ code: 'Enter' }))).toBeUndefined();
    // AltGr arrives as Ctrl+Alt on Windows layouts; swallowing it would eat
    // characters people are trying to type.
    expect(matchShortcut(press({ code: 'Enter', ctrlKey: true, altKey: true }))).toBeUndefined();
  });

  it('does not bind Ctrl+/, which is Monaco’s comment toggle', () => {
    expect(matchShortcut(press({ code: 'Slash', ctrlKey: true }))).toBeUndefined();
    expect(Object.values(SHORTCUTS).some((shortcut) => shortcut.code === 'Slash')).toBe(false);
  });
});
