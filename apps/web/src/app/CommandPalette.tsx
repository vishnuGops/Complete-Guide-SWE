import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as RadixDialog from '@radix-ui/react-dialog';
import { TOPIC_LABEL, type ProblemSummary } from '@devpromax/shared';
import { useNextProblem, useProblems } from '../api/hooks.js';
import { StatusMark, cn } from '../ui/index.js';

/**
 * The command palette (ROADMAP P7-7).
 *
 * `Ctrl+K` from anywhere: type a few letters of a problem and press Enter. The
 * list already has a search box, but the palette is reachable from inside the
 * editor, which is where someone actually is when they want the next problem.
 *
 * A plain dialog rather than the alert dialog the app uses elsewhere: this is
 * not a question about destroying work, it should close when you click away,
 * and it has no business being announced as an alert.
 *
 * The rows are a listbox driven from the input rather than focusable buttons.
 * Focus has to stay in the text field - the user is still typing - so the
 * highlighted row is tracked with `aria-activedescendant`, which is the pattern
 * that exists for exactly this.
 */

/**
 * A row that does something rather than opening a problem.
 *
 * `run` answers with a message to show, or null when it has handled itself and
 * the palette should close. The two suggestions can come back empty - everything
 * is solved - and closing the palette on that would look like a dead key.
 */
interface Action {
  id: string;
  label: string;
  hint: string;
  /**
   * The hint is the coach's judgement rather than the app's description - the
   * recommendation is chosen from the coach's rubric marks - so it is set in
   * the coach's serif (docs/DESIGN.md 5).
   */
  coach?: boolean;
  run: () => Promise<string | null>;
}

const MAX_RESULTS = 30;

function matches(problem: ProblemSummary, needle: string): boolean {
  if (needle === '') return true;
  return (
    problem.title.toLowerCase().includes(needle) ||
    problem.slug.includes(needle) ||
    TOPIC_LABEL[problem.topic].toLowerCase().includes(needle) ||
    problem.patterns.some((pattern) => pattern.toLowerCase().includes(needle))
  );
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetched only while it is open: the palette is a keystroke away from every
  // screen, and loading the catalogue behind all of them would be a request per
  // page load for something most of them never show.
  const { data } = useProblems({}, open);
  const next = useNextProblem();
  const suggest = next.mutateAsync;

  const needle = query.trim().toLowerCase();

  const actions = useMemo<Action[]>(
    () => [
      {
        id: 'recommended',
        label: 'Next recommended problem',
        hint: 'the easiest one left in your weakest topic',
        coach: true,
        run: async () => {
          const result = await suggest('recommended');
          if (!result.problem) return result.reason;
          void navigate(`/problems/${result.problem.slug}`);
          return null;
        },
      },
      {
        id: 'random',
        label: 'Random unsolved problem',
        hint: 'stop choosing, start solving',
        run: async () => {
          const result = await suggest('random');
          if (!result.problem) return result.reason;
          void navigate(`/problems/${result.problem.slug}`);
          return null;
        },
      },
      {
        id: 'review',
        label: 'Review something due',
        hint: 'the most overdue thing you have solved',
        run: async () => {
          const result = await suggest('review');
          if (!result.problem) return result.reason;
          // Straight into review mode: coming here from the queue and then
          // being able to open the editorial would make the review pointless.
          void navigate(`/problems/${result.problem.slug}?review=1`);
          return null;
        },
      },
      {
        id: 'bookmarks',
        label: 'Bookmarked problems',
        hint: 'the ones you starred',
        run: () => {
          void navigate('/?bookmarked=true');
          return Promise.resolve(null);
        },
      },
      {
        id: 'interview',
        label: 'Start a mock interview',
        hint: 'two problems, 45 minutes, approach first',
        run: () => {
          void navigate('/interview');
          return Promise.resolve(null);
        },
      },
      {
        id: 'progress',
        label: 'Progress',
        hint: 'streak, topics, skills report',
        run: () => {
          void navigate('/progress');
          return Promise.resolve(null);
        },
      },
      {
        id: 'settings',
        label: 'Settings',
        hint: 'coach key, editor, theme',
        run: () => {
          void navigate('/settings');
          return Promise.resolve(null);
        },
      },
    ],
    [navigate, suggest],
  );

  const shownActions = useMemo(
    () => actions.filter((action) => needle === '' || action.label.toLowerCase().includes(needle)),
    [actions, needle],
  );
  const problems = useMemo(
    () => (data?.items ?? []).filter((problem) => matches(problem, needle)).slice(0, MAX_RESULTS),
    [data, needle],
  );
  const rows = shownActions.length + problems.length;

  /*
   * Both resets happen during render rather than in an effect, which is the
   * pattern React documents for "this state is stale now": an effect would
   * paint the old highlight, or the previous query, for one frame first.
   */
  const [lastNeedle, setLastNeedle] = useState(needle);
  if (lastNeedle !== needle) {
    // A new query is a new list, so the highlight goes back to the top instead
    // of staying on whichever index happens to still exist.
    setLastNeedle(needle);
    setAt(0);
    setNotice(null);
  }

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    // Closed and reopened is a fresh palette. Keeping the last query would put
    // yesterday's search in front of today's.
    if (!open) {
      setQuery('');
      setNotice(null);
    }
  }

  // Keeps the highlighted row in view when the arrows walk past the fold.
  // Optional-called: `scrollIntoView` is a layout API, and jsdom has no layout.
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [at]);

  function choose(index: number): void {
    const action = shownActions[index];
    if (action) {
      void action.run().then((message) => {
        if (message === null) onOpenChange(false);
        else setNotice(message);
      });
      return;
    }
    const problem = problems[index - shownActions.length];
    if (!problem) return;
    onOpenChange(false);
    void navigate(`/problems/${problem.slug}`);
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="bg-overlay-scrim fixed inset-0 z-50" />
        <RadixDialog.Content
          /*
            Radix focuses the content element by default, which would leave the
            first keystroke going nowhere. The field is the whole dialog, so it
            takes the focus - said here rather than with `autoFocus`, which
            fires on mount whether or not the dialog is the reason for it.
          */
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className={[
            'bg-surface-raised border-border shadow-overlay fixed top-24 left-1/2 z-50',
            'w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg border',
          ].join(' ')}
        >
          {/* Radix requires a title; this dialog's visible name is on the field. */}
          <RadixDialog.Title className="sr-only">Command palette</RadixDialog.Title>

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
            aria-activedescendant={rows > 0 ? `palette-row-${String(at)}` : undefined}
            aria-label="Search problems and commands"
            placeholder="Go to a problem, or type a command…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setAt((current) => (rows === 0 ? 0 : (current + 1) % rows));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setAt((current) => (rows === 0 ? 0 : (current - 1 + rows) % rows));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                choose(at);
              }
            }}
            className="focus-ring-inset border-border text-fg placeholder:text-fg-subtle w-full border-b bg-transparent px-4 py-3 text-sm"
          />

          {notice !== null && (
            <p className="text-fg-muted border-border border-b px-4 py-2 text-sm" role="status">
              {notice}
            </p>
          )}

          {/*
            Two groups, each under its label (P9-7): what you can do, then
            where you can go. One unlabelled run of rows made "Settings" and
            the first problem look like neighbours in the same list. 384px
            tall rather than 320, so the labels do not push the problems out
            of the first screen.
          */}
          <div
            ref={listRef}
            id="palette-results"
            role="listbox"
            aria-label="Results"
            className="max-h-96 overflow-y-auto pb-1"
          >
            {rows === 0 && (
              <p className="text-fg-muted px-4 py-3 text-sm">
                Nothing matches. Titles, topics, patterns and slugs are all searched.
              </p>
            )}

            {shownActions.length > 0 && (
              <Group id="palette-group-commands" label="Commands">
                {shownActions.map((action, index) => (
                  <Row
                    key={action.id}
                    index={index}
                    active={index === at}
                    onHover={setAt}
                    onChoose={choose}
                    label={action.label}
                    trailing={
                      <span
                        className={cn(
                          action.coach === true ? 'font-serif text-sm' : 'text-xs',
                          index === at ? 'text-fg-muted' : 'text-fg-subtle',
                        )}
                      >
                        {action.hint}
                      </span>
                    }
                  />
                ))}
              </Group>
            )}

            {problems.length > 0 && (
              <Group id="palette-group-problems" label="Problems">
                {problems.map((problem, index) => {
                  const row = shownActions.length + index;
                  return (
                    <Row
                      key={problem.slug}
                      index={row}
                      active={row === at}
                      onHover={setAt}
                      onChoose={choose}
                      /*
                        A column of fixed width, so every title starts at the
                        same x whether the word beside its glyph is "Solved",
                        "In progress" or nothing at all (P9-7).
                      */
                      leading={
                        <span className="w-24 shrink-0">
                          <StatusMark status={problem.status} />
                        </span>
                      }
                      label={problem.title}
                      trailing={
                        <span
                          className={cn(
                            'flex text-xs',
                            row === at ? 'text-fg-muted' : 'text-fg-subtle',
                          )}
                        >
                          <span className="w-32 truncate">{TOPIC_LABEL[problem.topic]}</span>
                          <span className="w-14 text-right">{problem.tier}</span>
                        </span>
                      }
                    />
                  );
                })}
              </Group>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** A labelled run of options: `group` is the one child role a listbox allows besides `option`. */
function Group({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id}>
      <div id={id} role="presentation" className="text-fg-muted px-4 pt-3 pb-1 text-xs font-medium">
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({
  index,
  active,
  label,
  leading,
  trailing,
  onHover,
  onChoose,
}: {
  index: number;
  active: boolean;
  label: string;
  leading?: ReactNode;
  trailing: ReactNode;
  onHover: (index: number) => void;
  onChoose: (index: number) => void;
}) {
  return (
    /*
      Mouse-only, and the lint rule is right to ask. The keyboard path through
      this list is the combo box pattern: focus stays in the text field, the
      arrows move `aria-activedescendant`, and Enter chooses. A key handler on a
      row that can never hold focus would never fire - and a row that could
      hold focus would take it from the field on click (the rule asking for
      focusable options is the other pattern, roving tabindex).
    */
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
    <div
      id={`palette-row-${String(index)}`}
      role="option"
      aria-selected={active}
      data-active={active}
      onMouseMove={() => {
        onHover(index);
      }}
      onClick={() => {
        onChoose(index);
      }}
      /*
        The highlighted row: the selected step, a 2px accent bar and its hint
        in `fg-muted` - `fg-subtle` drops below 4.5:1 on the selected step. A
        tint alone was 1.07:1 and invisible (P9-6).
      */
      className={cn(
        'flex cursor-pointer items-center gap-2 border-l-2 py-1.5 pr-4 pl-3.5 text-sm',
        active ? 'bg-surface-selected border-l-accent' : 'border-l-transparent',
      )}
    >
      {leading}
      <span className="min-w-0 truncate">{label}</span>
      <span className="ml-auto shrink-0">{trailing}</span>
    </div>
  );
}
