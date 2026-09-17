import { NavLink, Outlet } from 'react-router-dom';
import { solvedCount } from '@devpromax/shared';
import { useProgress } from '../api/hooks.js';
import { cn } from '../ui/index.js';
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
          <GlobalProgress />
          <ThemeToggle value={theme} onChange={setTheme} />
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
