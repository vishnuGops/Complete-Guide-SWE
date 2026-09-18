import { useEffect, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  PROBLEM_SORT_KEYS,
  TOPIC_LABEL,
  type ProblemSort,
  type ProblemSummary,
} from '@devpromax/shared';
import { useProblems } from '../../api/hooks.js';
import { Button, ErrorState, Input, Loading, Skeleton, StatusMark, cn } from '../../ui/index.js';
import { Filters } from './Filters.js';
import { filtersFromSearch, isFiltered, searchFromFilters, type ProblemFilters } from './query.js';

/**
 * The problem list (ROADMAP P4-4, P4-5).
 *
 * A table, and nothing but a table. Two hundred rows read by eye want columns
 * they can scan down - status here, rating there - which is the one thing a grid
 * of cards cannot do (docs/DESIGN.md section 2).
 *
 * Sorting and filtering both happen on the server. That is not an optimisation:
 * the default order is "rating, then curriculum position", which is the learning
 * path, and the catalogue is the only thing that knows the curriculum's order.
 * Re-deriving it in the browser would be a second implementation of the sort
 * that matters most.
 *
 * Virtualisation is deliberately absent. P8-2 measures the list at 500 rows and
 * adds it only if the measurement asks for it.
 */

interface Column {
  key: ProblemSort | 'patterns';
  label: string;
  className?: string;
}

const COLUMNS: Column[] = [
  { key: 'status', label: 'Status', className: 'w-28' },
  { key: 'title', label: 'Problem' },
  { key: 'topic', label: 'Topic', className: 'w-36' },
  { key: 'patterns', label: 'Patterns', className: 'w-56' },
  { key: 'tier', label: 'Tier', className: 'w-20' },
  { key: 'rating', label: 'Rating', className: 'w-16' },
  { key: 'lastAttempted', label: 'Last attempted', className: 'w-32' },
];

function sortable(key: Column['key']): key is ProblemSort {
  return (PROBLEM_SORT_KEYS as readonly string[]).includes(key);
}

/** A date a user reads to mean "recently" or "a while ago", not to the minute. */
function whenAttempted(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${String(days)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function Row({ problem }: { problem: ProblemSummary }) {
  const navigate = useNavigate();

  // The whole row is a click target, and the title is the link that makes it
  // reachable from the keyboard. A `tr` with an `onClick` and no anchor would
  // look identical and be unusable without a mouse (docs/DESIGN.md section 8).
  const openRow = (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest('a')) return;
    void navigate(`/problems/${problem.slug}`);
  };

  return (
    <tr className="border-border hover:bg-surface-sunken cursor-pointer border-b" onClick={openRow}>
      <td className="px-3 py-1.5">
        <StatusMark status={problem.status} />
      </td>
      <td className="px-3 py-1.5">
        <Link
          to={`/problems/${problem.slug}`}
          className="focus-ring hover:text-accent-fg rounded-xs font-medium"
        >
          {problem.title}
        </Link>
      </td>
      <td className="text-fg-muted px-3 py-1.5 text-xs">{TOPIC_LABEL[problem.topic]}</td>
      <td
        className="text-fg-subtle truncate px-3 py-1.5 text-xs"
        title={problem.patterns.join(', ')}
      >
        {problem.patterns.join(', ')}
      </td>
      <td className="text-fg-muted px-3 py-1.5 text-xs">{problem.tier}</td>
      <td className="text-fg-muted tnum px-3 py-1.5 text-xs">{problem.rating}</td>
      <td className="text-fg-subtle tnum px-3 py-1.5 text-xs">
        {whenAttempted(problem.lastAttemptedAt)}
      </td>
    </tr>
  );
}

/**
 * The table, before the table (ROADMAP P4-10).
 *
 * Rows of the height the real ones will be, so the header does not jump down
 * the page when the answer arrives. Eight of them: enough to read as a list,
 * few enough that a short catalogue does not shrink on arrival.
 */
function ListSkeleton() {
  return (
    <Loading label="Loading problems" className="p-3">
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} className="flex items-center gap-3 px-1 py-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
        </span>
      ))}
    </Loading>
  );
}

export function ProblemList() {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromSearch(params);

  /**
   * The search box types faster than the server answers.
   *
   * Its own state, pushed into the URL after a pause: writing every keystroke
   * into the history would make the back button undo the word letter by letter,
   * and firing a request per character would show four stale answers for every
   * real one.
   */
  const [search, setSearch] = useState(filters.q);
  /**
   * Whether the box is holding something the URL has not been told about yet.
   *
   * State rather than a ref, because the re-seed below reads it during render
   * (P4-13) - and a ref read during render is the thing React tells you not to
   * do, for the good reason that it does not cause the re-render you wanted.
   */
  const [typing, setTyping] = useState(false);

  /*
   * Re-seeded when the URL changes under us (ROADMAP P4-13).
   *
   * The box was seeded once, at mount, so Back and Forward through `?q=` moved
   * the *list* and left the text sitting there - the filter and the box saying
   * different things, which is the sort of thing a user works around by
   * reloading. Only while nothing is pending: a re-seed mid-debounce would
   * fight the typist.
   */
  const [seededFrom, setSeededFrom] = useState(filters.q);
  if (filters.q !== seededFrom) {
    setSeededFrom(filters.q);
    if (!typing) setSearch(filters.q);
  }

  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => {
      setTyping(false);
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (search) next.set('q', search);
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, 200);
    return () => {
      clearTimeout(timer);
    };
  }, [search, typing, setParams]);

  const { data, isPending, isFetching, error, refetch } = useProblems(filters);

  const apply = (next: ProblemFilters) => {
    setSearch(next.q);
    setTyping(false);
    setParams(new URLSearchParams(searchFromFilters(next)));
  };

  const sortBy = (key: ProblemSort) => {
    // A second click on the same column reverses it; a first click on a new one
    // starts ascending, which for `status` and `rating` means "least done" and
    // "easiest" - the two orders someone picking a problem actually wants.
    apply(
      filters.sort === key
        ? { ...filters, dir: filters.dir === 'asc' ? 'desc' : 'asc' }
        : { ...filters, sort: key, dir: 'asc' },
    );
  };

  if (error) {
    return (
      <ErrorState
        title="The problem list could not load."
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const narrowed = isFiltered(filters);

  return (
    <div className="flex h-full min-h-0">
      <Filters filters={filters} onChange={apply} counts={data} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border flex h-10 shrink-0 items-center gap-3 border-b px-4">
          <h1 className="text-sm font-semibold">Problems</h1>

          <Input
            type="search"
            value={search}
            aria-label="Search problems"
            placeholder="Search titles and patterns"
            className="max-w-64"
            onChange={(event) => {
              setTyping(true);
              setSearch(event.target.value);
            }}
          />

          {/*
            How many rows are on screen, and not how many are solved: the top
            bar already carries the catalogue's solved count on every screen, and
            printing it twice on one page makes both copies read like they might
            mean different things.
          */}
          {data && (
            <p className="text-fg-muted tnum ml-auto text-xs" data-testid="list-counts">
              {narrowed
                ? `${String(data.matched)} of ${String(data.total)} problems`
                : `${String(data.total)} problems`}
            </p>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isPending ? (
            <ListSkeleton />
          ) : data.items.length === 0 ? (
            <div className="p-6">
              <p className="text-fg-muted text-sm">
                {narrowed
                  ? 'No problem matches these filters.'
                  : 'The catalogue is empty. Run `npm run problems:validate` to check the problem packages.'}
              </p>
              {narrowed && (
                <Button
                  className="mt-3"
                  onClick={() => {
                    apply({
                      ...filters,
                      topic: [],
                      tier: [],
                      status: [],
                      q: '',
                      language: undefined,
                    });
                  }}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <table
              className={cn(
                'w-full table-fixed text-left text-sm transition-opacity duration-75',
                // The previous rows stay while the next query runs, dimmed so it
                // is visible that they are the old answer.
                isFetching && 'opacity-60',
              )}
            >
              <thead>
                <tr className="border-border text-fg-muted bg-bg sticky top-0 z-10 border-b text-xs">
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn('font-medium', column.className)}
                      aria-sort={
                        sortable(column.key) && filters.sort === column.key
                          ? filters.dir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      {sortable(column.key) ? (
                        <button
                          type="button"
                          className="focus-ring-inset hover:text-fg flex w-full items-center gap-1 px-3 py-2 text-left"
                          onClick={() => {
                            sortBy(column.key as ProblemSort);
                          }}
                        >
                          {column.label}
                          <span aria-hidden className="text-2xs">
                            {filters.sort === column.key ? (filters.dir === 'asc' ? '↑' : '↓') : ''}
                          </span>
                        </button>
                      ) : (
                        <span className="block px-3 py-2">{column.label}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((problem) => (
                  <Row key={problem.slug} problem={problem} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
