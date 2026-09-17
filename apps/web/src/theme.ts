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
