import { useSettings, useUpdateSettings } from '../api/hooks.js';
import { SHORTCUTS } from '../shortcuts/shortcuts.js';
import { Button } from '../ui/index.js';

/**
 * The first-run welcome (ROADMAP P8-3).
 *
 * Three sentences about the three things that are not obvious: that Run and
 * Submit are different operations, that AI Help costs money and is never
 * automatic, and that nothing here leaves the machine. Everything else on the
 * screen explains itself.
 *
 * A panel above the list rather than a modal or a tour. A modal is a thing to
 * dismiss before you can look at what you came for, and a tour of five steps
 * teaches less than one sentence beside the button it is about.
 *
 * Dismissed once, for good, in the database: someone who has read it has read
 * it, and clearing site data or opening the app in another browser should not
 * start it again.
 */
export function Welcome() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();

  // Nothing at all until Settings has arrived: a welcome that flashes on every
  // page load for the user who dismissed it last week is worse than none.
  if (!settings || settings.welcomeDismissed) return null;

  return (
    <aside className="border-border bg-surface-sunken border-b px-6 py-4" aria-label="Welcome">
      <h2 className="text-sm font-semibold">Welcome to DevProMax</h2>
      <ul className="text-fg-muted mt-2 max-w-prose space-y-1 text-sm">
        <li>
          <strong className="text-fg">Run</strong> ({SHORTCUTS.run.keys.join('+')}) tries your code
          against the visible samples and your own cases. It records nothing.
        </li>
        <li>
          <strong className="text-fg">Submit</strong> ({SHORTCUTS.submit.keys.join('+')}) runs every
          hidden test and writes the verdict down. That is what moves a problem to Solved.
        </li>
        <li>
          <strong className="text-fg">AI Help</strong> ({SHORTCUTS.aiHelp.keys.join('+')}) asks a
          coach to review what you have written. It needs your own API key, it costs a few cents a
          turn, and it is never called on its own.
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
        disabled={update.isPending}
        onClick={() => {
          update.mutate({ welcomeDismissed: true });
        }}
      >
        Got it
      </Button>
    </aside>
  );
}
