import { useEffect, useState, type MouseEvent } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  PROBLEM_SORT_KEYS,
  TOPIC_LABEL,
  type ProblemSort,
  type ProblemSummary,
} from '@devpromax/shared';
import { useProblems } from '../../api/hooks.js';
import { PageHeader } from '../../app/PageHeader.js';
import {
  Button,
  Card,
  ErrorState,
  Input,
  Loading,
  Segmented,
  Skeleton,
  StatusMark,
  cn,
} from '../../ui/index.js';
import { Filters } from './Filters.js';
import { filtersFromSearch, isFiltered, searchFromFilters, type ProblemFilters } from './query.js';

/**
 * The problem list (ROADMAP P4-4, P4-5).
 *
 * A table in a card, beside the filters in a card of their own (P9-6). Two
 * hundred rows read by eye want columns they can scan down - status here,
 * rating there - which is the one thing a grid of cards cannot do, so the rows
 * are table rows and only the two regions are cards (docs/DESIGN.md 8).
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

type ListView = 'all' | 'due' | 'starred';

/** Every filter off; sort is not a filter and is left alone. */
const CLEARED = {
  topic: [],
  tier: [],
  status: [],
  q: '',
  language: undefined,
  bookmarked: false,
  due: false,
} satisfies Partial<ProblemFilters>;

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
  { key: 'rating', label: 'Rating', className: 'w-20 text-right' },
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

  /*
   * 36px rows (DESIGN.md 6). The row under the pointer takes `surface-sunken`;
   * the row holding keyboard focus - where you are - gets a 2px accent bar at
   * its left edge, drawn as the first cell's border so nothing shifts.
   */
  return (
    <tr
      className="border-border hover:bg-surface-sunken group h-9 cursor-pointer border-b last:border-b-0"
      onClick={openRow}
    >
      <td className="group-focus-within:border-l-accent border-l-2 border-l-transparent py-0 pr-3 pl-3.5">
        <StatusMark status={problem.status} />
      </td>
      <td className="px-3 py-0">
        <Link
          to={`/problems/${problem.slug}`}
          className="focus-ring hover:text-accent-fg rounded-xs font-medium"
        >
          {problem.title}
        </Link>
        {/*
          A marker, not the note (P7-4). Without it a search that matched
          something the user wrote shows a row with nothing on it saying why -
          and the note itself has no business in a list row.
        */}
        {/*
          The tests moved after this was solved (P7-9). On the row because the
          list is where someone decides what to work on, and a Solved earned
          against tests that no longer exist is worth knowing before you skip
          past it.
        */}
        {problem.solvedVersion !== null && problem.solvedVersion < problem.version && (
          <span
            className="text-warn-fg ml-1.5 text-2xs"
            title={`Solved against v${String(problem.solvedVersion)}; the tests are now v${String(problem.version)}`}
          >
            <span aria-hidden>tests changed</span>
            <span className="sr-only">
              Solved against version {problem.solvedVersion}; tests are now version{' '}
              {problem.version}
            </span>
          </span>
        )}
        {problem.hasNote && (
          <span className="text-fg-subtle ml-1.5 text-2xs" title="You have a note on this problem">
            <span aria-hidden>note</span>
            <span className="sr-only">Has a note</span>
          </span>
        )}
      </td>
      <td className="text-fg-muted px-3 py-0 text-xs">{TOPIC_LABEL[problem.topic]}</td>
      <td className="text-fg-subtle truncate px-3 py-0 text-xs" title={problem.patterns.join(', ')}>
        {problem.patterns.join(', ')}
      </td>
      <td className="text-fg-muted px-3 py-0 text-xs">{problem.tier}</td>
      <td className="text-fg-muted tnum px-3 py-0 text-right text-xs">{problem.rating}</td>
      <td className="text-fg-subtle tnum px-3 py-0 pr-4 text-xs">
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  /*
   * The view: everything, what is due for review, or what is starred (P9-6).
   * Three exclusive answers to "which list", so a segmented control rather than
   * two more checkboxes in the filter card - and both are still filters, in the
   * URL like the rest.
   */
  const view: ListView = filters.due ? 'due' : filters.bookmarked ? 'starred' : 'all';
  const setView = (next: ListView) => {
    apply({ ...filters, due: next === 'due', bookmarked: next === 'starred' });
  };

  const narrowed = isFiltered(filters);
  const due = data?.due ?? 0;

  const header = (
    <PageHeader
      title="Problems"
      context={
        data
          ? `${String(data.total)} problems${due > 0 ? ` · ${String(due)} due for review` : ''}`
          : undefined
      }
    />
  );

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        <div className="px-6 pb-6">
          <Card>
            <ErrorState
              className="p-0"
              title="The problem list could not load."
              error={error}
              onRetry={() => {
                void refetch();
              }}
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}

      <div className="flex min-h-0 flex-1 gap-4 px-6 pb-6 max-[1279px]:gap-3 max-[1279px]:px-4 max-[1279px]:pb-4">
        <Filters
          filters={filters}
          onChange={apply}
          counts={data}
          className={cn(!filtersOpen && 'max-[1279px]:hidden')}
        />

        <Card
          aria-label="Problem list"
          padding="none"
          className="flex min-w-0 flex-1 flex-col overflow-hidden"
        >
          <div className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-3">
            {/*
              At 1024px the filter card folds away behind this button
              (DESIGN.md 11) and comes back beside the table when asked. CSS
              decides whether the button is there at all.
            */}
            <Button
              size="sm"
              variant="secondary"
              className="min-[1280px]:hidden"
              aria-expanded={filtersOpen}
              onClick={() => {
                setFiltersOpen(!filtersOpen);
              }}
            >
              <SlidersHorizontal aria-hidden size={14} strokeWidth={1.5} />
              Filters
            </Button>

            <Input
              type="search"
              value={search}
              aria-label="Search problems"
              placeholder="Search titles, patterns and notes"
              className="max-w-72"
              onChange={(event) => {
                setTyping(true);
                setSearch(event.target.value);
              }}
            />

            <Segmented
              label="Which problems"
              options={[
                { value: 'all', label: 'All' },
                { value: 'due', label: 'Due' },
                { value: 'starred', label: 'Starred' },
              ]}
              value={view}
              onChange={setView}
            />

            {/*
              How many rows are on screen, and not how many are solved: the page
              header already carries the catalogue's solved count, and printing
              it twice on one page makes both copies read like they might mean
              different things.
            */}
            {data && (
              <p className="text-fg-muted tnum ml-auto text-xs" data-testid="list-counts">
                {narrowed
                  ? `${String(data.matched)} of ${String(data.total)} problems`
                  : `${String(data.total)} problems`}
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isPending ? (
              <ListSkeleton />
            ) : data.items.length === 0 ? (
              <div className="p-5">
                <p className="text-fg-muted text-sm">
                  {view === 'due' && !isFiltered({ ...filters, due: false })
                    ? 'Nothing is due for review. Solved problems come back here as they age.'
                    : narrowed
                      ? 'No problem matches these filters.'
                      : 'The catalogue is empty. Run `npm run problems:validate` to check the problem packages.'}
                </p>
                {narrowed && (
                  <Button
                    className="mt-3"
                    onClick={() => {
                      apply({ ...filters, ...CLEARED });
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
                  <tr className="border-border text-fg-muted bg-surface-sunken sticky top-0 z-10 border-b text-xs">
                    {COLUMNS.map((column, index) => (
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
                            className={cn(
                              'focus-ring-inset hover:text-fg flex w-full items-center gap-1 px-3 py-2',
                              column.key === 'rating' ? 'justify-end' : 'text-left',
                              index === 0 && 'pl-4',
                            )}
                            onClick={() => {
                              sortBy(column.key as ProblemSort);
                            }}
                          >
                            {column.label}
                            <span aria-hidden className="text-2xs">
                              {filters.sort === column.key
                                ? filters.dir === 'asc'
                                  ? '↑'
                                  : '↓'
                                : ''}
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
        </Card>
      </div>
    </div>
  );
}
