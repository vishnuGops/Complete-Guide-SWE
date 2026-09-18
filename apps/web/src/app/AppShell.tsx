import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { solvedCount } from '@devpromax/shared';
import { useProgress } from '../api/hooks.js';
import { useShortcut } from '../shortcuts/ShortcutProvider.js';
import { ErrorBoundary, cn } from '../ui/index.js';
import { CommandPalette } from './CommandPalette.js';
import { ThemeToggle } from './ThemeToggle.js';
import { useAppTheme } from './useAppTheme.js';

/**
 * The frame every screen sits in (ROADMAP P4-2).
 *
 * A 40px bar and then the work. It holds the three things that are true no
 * matter which screen is open - where you are, how far through the catalogue you
 * are, and which theme you are in - and nothing else. There is no sidebar here
 * and no second row of chrome: the workspace needs every pixel below this bar
 * for a statement, an editor and a results panel at once (docs/DESIGN.md
 * section 1).
 *
 * The whole shell is `h-screen` with a `min-h-0` body, which is what lets the
 * workspace's own panels scroll independently instead of the page growing a
 * scrollbar and pushing the editor off the bottom.
 */

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'focus-ring rounded-md px-2 py-1 text-sm font-medium transition-colors duration-75',
          isActive ? 'text-fg bg-surface-sunken' : 'text-fg-muted hover:text-fg',
        )
      }
    >
      {children}
    </NavLink>
  );
}

/**
 * Catalogue progress.
 *
 * Reads `/api/progress` rather than the list, because the list is filtered and
 * this must not be: a header that says "Solved 2 / 3" because the user filtered
 * to three problems is a header that has stopped meaning anything.
 */
function GlobalProgress() {
  const { data } = useProgress();
  if (!data) return null;

  const solved = solvedCount(data.byStatus);
  const percent = data.total === 0 ? 0 : Math.round((solved / data.total) * 100);

  return (
    <div className="flex items-center gap-2" data-testid="global-progress">
      <span
        className="bg-surface-sunken border-border h-1.5 w-24 overflow-hidden rounded-xs border"
        role="progressbar"
        aria-label="Problems solved"
        aria-valuenow={solved}
        aria-valuemin={0}
        aria-valuemax={data.total}
        aria-valuetext={`${String(solved)} of ${String(data.total)} solved`}
      >
        <span className="bg-success block h-full" style={{ width: `${String(percent)}%` }} />
      </span>
      <span className="text-fg-muted tnum text-xs">
        Solved {solved} / {data.total}
      </span>
    </div>
  );
}

export function AppShell() {
  const { theme, setTheme } = useAppTheme();
  /*
   * The palette lives here rather than on a screen (ROADMAP P7-7): `Ctrl+K` has
   * to work from the workspace, the list and the settings alike, and a copy per
   * screen would be three dialogs that could disagree.
   */
  const [palette, setPalette] = useState(false);
  useShortcut('commandPalette', () => {
    setPalette(true);
  });

  return (
    <div className="flex h-screen flex-col">
      <header className="border-border bg-surface flex h-10 shrink-0 items-center gap-4 border-b px-3">
        <NavLink
          to="/"
          className="focus-ring text-fg rounded-md px-1 text-sm font-semibold tracking-tight"
        >
          DevProMax
        </NavLink>

        <nav className="flex items-center gap-1" aria-label="Main">
          <NavItem to="/">Problems</NavItem>
          <NavItem to="/progress">Progress</NavItem>
          <NavItem to="/settings">Settings</NavItem>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {/*
            Says its own shortcut, because a palette nobody knows about is a
            palette nobody uses (docs/DESIGN.md section 8).
          */}
          <button
            type="button"
            onClick={() => {
              setPalette(true);
            }}
            className="focus-ring text-fg-muted hover:text-fg border-border hover:bg-surface-sunken rounded-md border px-2 py-0.5 text-xs"
          >
            Search
            <kbd className="text-fg-subtle ml-2 font-mono text-2xs">Ctrl K</kbd>
          </button>

          <GlobalProgress />
          <ThemeToggle value={theme} onChange={setTheme} />
        </div>
      </header>

      <CommandPalette open={palette} onOpenChange={setPalette} />

      <main className="min-h-0 flex-1 max-[1023px]:hidden">
        {/*
          A screen that throws must not take the app with it (P4-12). Inside the
          shell rather than around it, so the top bar - and with it the way out
          to another screen - survives.

          Keyed on nothing: remounting on every navigation would also reset it,
          but React Router replaces the outlet's children anyway, and a boundary
          that cleared itself on render would flash the broken screen again.
        */}
        <ErrorBoundary title="This screen stopped working.">
          <Outlet />
        </ErrorBoundary>
      </main>

      {/*
        The 1024px floor (ROADMAP P4-10, docs/DESIGN.md section 9).

        Below it the workspace stops being a workspace: a statement, an editor
        and a results panel cannot all be useful in 800px, and the honest answer
        is to say so rather than reflow into a phone layout nobody will practise
        algorithms on.

        Done in CSS rather than by measuring the window, so there is no resize
        listener, no state, and nothing to be wrong on the first paint. The two
        halves are `display: none` in turn, so whichever is hidden is out of the
        accessibility tree as well as off the screen.
      */}
      <div className="hidden min-h-0 flex-1 place-content-center p-8 max-[1023px]:grid">
        <div className="max-w-prose">
          <h1 className="text-md font-semibold">This window is too narrow.</h1>
          <p className="text-fg-muted mt-2 text-sm">
            DevProMax needs about 1024px of width: the workspace puts a problem statement, an editor
            and the judge&rsquo;s results on screen at once, and below that they stop being readable
            rather than merely tight. Widen the window and it comes back.
          </p>
        </div>
      </div>
    </div>
  );
}
