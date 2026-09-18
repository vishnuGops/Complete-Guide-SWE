/**
 * The app's keyboard shortcuts, as data (ROADMAP P4-2, D16).
 *
 * One table, used three ways: the provider matches key events against it, the
 * tooltips render `keys` beside the control they trigger so the shortcut is
 * discoverable without a cheatsheet (docs/DESIGN.md section 8), and a test can
 * assert the whole set rather than four scattered `if` statements.
 *
 * Matching is on `event.code` rather than `event.key`. `Ctrl+Shift+H` arrives
 * with `key: 'H'` and `Ctrl+H` with `key: 'h'`, so a `key` comparison has to
 * re-derive the shift state it is also checking; `code` is the physical key and
 * says `KeyH` either way.
 *
 * `Ctrl+/` is Monaco's comment toggle and is never bound here.
 */

export const SHORTCUT_IDS = ['run', 'submit', 'togglePanel', 'aiHelp', 'commandPalette'] as const;
export type ShortcutId = (typeof SHORTCUT_IDS)[number];

export interface Shortcut {
  id: ShortcutId;
  /** What the shortcut does, in the words the control beside it uses. */
  label: string;
  /** `KeyboardEvent.code` of the non-modifier key. */
  code: string;
  /** Shift must match exactly: `Ctrl+Enter` must not fire on `Ctrl+Shift+Enter`. */
  shift: boolean;
  /** For tooltips and the settings screen. */
  keys: readonly string[];
}

export const SHORTCUTS: Record<ShortcutId, Shortcut> = {
  run: { id: 'run', label: 'Run', code: 'Enter', shift: false, keys: ['Ctrl', 'Enter'] },
  submit: {
    id: 'submit',
    label: 'Submit',
    code: 'Enter',
    shift: true,
    keys: ['Ctrl', 'Shift', 'Enter'],
  },
  togglePanel: {
    id: 'togglePanel',
    label: 'Toggle the bottom panel',
    code: 'KeyJ',
    shift: false,
    keys: ['Ctrl', 'J'],
  },
  aiHelp: {
    id: 'aiHelp',
    label: 'AI Help',
    code: 'KeyH',
    shift: true,
    keys: ['Ctrl', 'Shift', 'H'],
  },
  /*
   * `Ctrl+K` is Monaco's chord prefix (`Ctrl+K Ctrl+C` comments a block), and
   * this takes it. The trade is deliberate: a palette that is not reachable
   * from inside the editor is not reachable from where people work, and the
   * chords it displaces have single-key equivalents that are already bound.
   * `Ctrl+/` stays untouched, which is the comment toggle people actually use.
   */
  commandPalette: {
    id: 'commandPalette',
    label: 'Command palette',
    code: 'KeyK',
    shift: false,
    keys: ['Ctrl', 'K'],
  },
};

/**
 * Which shortcut an event is, if any.
 *
 * `metaKey` counts as `ctrlKey` so the same binding works on a Mac keyboard,
 * which is the convention every editor follows and costs nothing here: no
 * shortcut in the table means something different with Cmd.
 *
 * `altKey` is checked so that `Ctrl+Alt+Enter` - which on Windows is how some
 * layouts type AltGr characters - is not swallowed as a Run.
 */
export function matchShortcut(event: KeyboardEvent): Shortcut | undefined {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return undefined;
  return Object.values(SHORTCUTS).find(
    (shortcut) => shortcut.code === event.code && shortcut.shift === event.shiftKey,
  );
}
