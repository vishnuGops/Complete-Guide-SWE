import { createContext, useContext, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { solvedCount } from '@devpromax/shared';
import { useProgress } from '../api/hooks.js';
import { SHORTCUTS } from '../shortcuts/shortcuts.js';
import { Keys, cn } from '../ui/index.js';

/**
 * A page's header (ROADMAP P9-6, docs/DESIGN.md 8).
 *
 * On the canvas, not in a card: the page's title, one muted line of real
 * context ("171 problems · 4 due for review" - something true and useful, or
 * nothing), and on the right the two things that are true on every page - the
 * way to anything (the search pill, which opens the palette) and how far
 * through the catalogue you are.
 *
 * Rendered by each screen rather than by the shell, because the title and the
 * context line belong to the screen; the shell only lends it the palette.
 */

interface Shell {
  openPalette: () => void;
}

const ShellContext = createContext<Shell>({ openPalette: () => undefined });
export const ShellProvider = ShellContext.Provider;

function useShell(): Shell {
  return useContext(ShellContext);
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
        className="bg-border block h-1.5 w-20 overflow-hidden rounded-xs"
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

/**
 * The search pill. Says its own shortcut, because a palette nobody knows about
 * is a palette nobody uses; the chips are hidden from its name, which stays
 * "Search".
 */
function SearchPill({ className }: { className?: string }) {
  const { openPalette } = useShell();
  return (
    <button
      type="button"
      onClick={openPalette}
      className={cn(
        'focus-ring bg-surface border-border text-fg-muted hover:border-border-hover hover:text-fg',
        'flex h-8 w-56 items-center gap-2 rounded-full border pr-1.5 pl-3 text-sm transition-colors duration-75',
        className,
      )}
    >
      <Search aria-hidden size={16} strokeWidth={1.5} />
      <span className="flex-1 text-left">Search</span>
      <Keys keys={SHORTCUTS.commandPalette.keys} />
    </button>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  /** One line of real context. Omit it rather than fill it. */
  context?: ReactNode;
  /** Page-specific controls, left of the search pill. */
  children?: ReactNode;
}

/*
 * One row, and the same height on every page (P9-7). The context sits on the
 * title's baseline rather than on a line of its own: a second line cost the
 * problem list a row of problems for a sentence that fits beside the title, and
 * a page with no context (Not found) came out shorter than the rest.
 */
export function PageHeader({ title, context, children }: PageHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 px-6">
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <h1 className="tracking-title shrink-0 text-xl font-semibold">{title}</h1>
        {context !== undefined && (
          <p
            className="text-fg-muted tnum min-w-0 truncate text-sm"
            title={typeof context === 'string' ? context : undefined}
          >
            {context}
          </p>
        )}
      </div>
      {children}
      <SearchPill />
      <GlobalProgress />
    </header>
  );
}
