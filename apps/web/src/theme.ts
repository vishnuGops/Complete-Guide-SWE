import type { Theme } from '@devpromax/shared';

/**
 * Applying a theme to the document (ROADMAP P0-8).
 *
 * The mechanism only: `data-theme` on `<html>`, which is what the token blocks
 * in `styles/tokens.css` key off. Choosing the theme, persisting it in settings
 * and putting a control in the top bar is P4-2's job - this is what that control
 * will call.
 *
 * `system` removes the attribute rather than writing a resolved value, so the
 * page follows the OS if the user changes it while the app is open. The CSS
 * already handles the absent attribute; resolving it here would freeze it.
 */
export function applyTheme(choice: Theme, root: HTMLElement = document.documentElement): void {
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/** What `system` currently resolves to. For anything that needs the actual value. */
export function resolvedTheme(choice: Theme): Exclude<Theme, 'system'> {
  if (choice !== 'system') return choice;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * The theme cache (ROADMAP P4-2).
 *
 * The theme is a setting, and settings live in the database - but the database
 * is on the other side of a fetch, and a page that paints light and then flips
 * to dark a moment later is worse than one that guesses. So the chosen theme is
 * mirrored into `localStorage` and read back synchronously before the first
 * paint; the server's answer overwrites it as soon as it arrives.
 *
 * The cache is never the source of truth. If the two disagree - a second window,
 * a reset - the server wins, because that is the value the settings screen is
 * showing and the one that survives a new browser.
 */
const THEME_CACHE_KEY = 'devpromax.theme';

export function cachedTheme(): Theme {
  try {
    const stored = globalThis.localStorage?.getItem(THEME_CACHE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Private-browsing modes throw on access rather than returning null. The
    // theme then follows the OS for one paint, which is the right default.
  }
  return 'system';
}

export function cacheTheme(choice: Theme): void {
  try {
    globalThis.localStorage?.setItem(THEME_CACHE_KEY, choice);
  } catch {
    // Not being able to remember the choice is not a reason to fail to apply it.
  }
}
