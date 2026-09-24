import { useEffect, useRef } from 'react';
import { useSettings, useUpdateSettings } from '../api/hooks.js';
import { SHORTCUTS } from '../shortcuts/shortcuts.js';
import { Button, Keys } from '../ui/index.js';

/**
 * The first-run welcome (ROADMAP P8-3).
 *
 * Three sentences about the three things that are not obvious: that Run and
 * Submit are different operations, that AI Help costs money and is never
 * automatic, and that nothing here leaves the machine. Everything else on the
 * screen explains itself.
 *
 * A card above the page rather than a modal or a tour. A modal is a thing to
 * dismiss before you can look at what you came for, and a tour of five steps
 * teaches less than one sentence beside the button it is about.
 *
 * Dismissed once, for good, in the database: someone who has read it has read
 * it, and clearing site data or opening the app in another browser should not
 * start it again.
 */

/**
 * Whether this browser last saw the welcome dismissed (2026-09-24 audit).
 *
 * The card sits above the page, so one that arrives with Settings pushes the
 * whole screen down after it has painted - a layout shift every first-time user
 * saw, and the entire reason the workspace scored under 90 on Lighthouse. So,
 * like the theme (P4-2), the answer is mirrored into `localStorage` and read
 * synchronously for the first paint: the card is there from the start for
 * someone new, and absent from the start for someone this browser saw dismiss
 * it. The server still wins when it answers; the mirror only decides the first
 * frame, and is wrong at most once per browser.
 */
const WELCOME_CACHE_KEY = 'devpromax.welcomeDismissed';

function cachedDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(WELCOME_CACHE_KEY) === '1';
  } catch {
    // Private-browsing modes throw on access; the card then shows for one
    // paint, which is the right default for a fresh install.
    return false;
  }
}

function cacheDismissed(dismissed: boolean): void {
  try {
    globalThis.localStorage?.setItem(WELCOME_CACHE_KEY, dismissed ? '1' : '0');
  } catch {
    // Not being able to remember it costs one shifted paint, nothing more.
  }
}
export function Welcome() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const panel = useRef<HTMLElement>(null);

  /*
   * Where focus goes once the welcome has gone (P4-17). The button that had it
   * is removed with the card, and focus on a removed element falls to the page
   * - so it moves to the page's own heading first, which is also the next
   * thing a screen-reader user wants to hear: where they are.
   */
  const moveFocusTo = (page: ParentNode) => {
    const heading = page.querySelector('h1');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus();
  };

  useEffect(() => {
    if (settings) cacheDismissed(settings.welcomeDismissed);
  }, [settings]);

  // The server's answer once it has one; the mirror until then, so the first
  // paint already has the card in it - or not - and nothing moves after.
  const dismissed = settings ? settings.welcomeDismissed : cachedDismissed();
  if (dismissed) return null;

  return (
    <aside
      ref={panel}
      className="bg-surface border-border shadow-card mx-6 mt-5 max-w-3xl rounded-xl border p-5"
      aria-label="Welcome"
    >
      <h2 className="text-md font-semibold">Welcome to DevProMax</h2>
      <ul className="text-fg-muted mt-2 max-w-prose space-y-1 text-sm">
        <li>
          <strong className="text-fg">Run</strong> <Keys keys={SHORTCUTS.run.keys} />
          <span className="sr-only">({SHORTCUTS.run.keys.join('+')})</span> tries your code against
          the visible samples and your own cases. It marks the problem In progress, and no verdict
          is written down.
        </li>
        <li>
          <strong className="text-fg">Submit</strong> <Keys keys={SHORTCUTS.submit.keys} />
          <span className="sr-only">({SHORTCUTS.submit.keys.join('+')})</span> runs every hidden
          test and writes the verdict down. That is what moves a problem to Solved.
        </li>
        <li>
          <strong className="text-fg">AI Help</strong> <Keys keys={SHORTCUTS.aiHelp.keys} />
          <span className="sr-only">({SHORTCUTS.aiHelp.keys.join('+')})</span> asks a coach to
          review what you have written. It needs your own API key, it costs a few cents a turn, and
          it is never called on its own.
        </li>
      </ul>
      <p className="text-fg-subtle mt-2 max-w-prose text-xs">
        Everything else stays on this machine: your code, your history and your notes are in a
        SQLite file under <code className="font-mono">data/</code>.
      </p>

      <Button
        size="sm"
        variant="secondary"
        className="mt-3"
        disabled={update.isPending || !settings}
        onClick={() => {
          // Found now, while the card is still in the page to search up from.
          const page = panel.current?.closest('main') ?? document;
          update.mutate(
            { welcomeDismissed: true },
            {
              onSuccess: () => {
                moveFocusTo(page);
              },
            },
          );
        }}
      >
        Got it
      </Button>
    </aside>
  );
}
