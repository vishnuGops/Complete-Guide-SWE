import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  LANGUAGES,
  LANGUAGE_LABEL,
  PROGRESS_LABEL,
  customTestShapeFrom,
  editorPrefsSchema,
  estimateTurnCostUsd,
  formatUsd,
  parseCustomTests,
  type CompileError,
  type CustomTestInput,
  type Language,
  type ProgressStatus,
  type RunResult,
  type Submission,
} from '@devpromax/shared';
import { api } from '../../api/client.js';
import {
  useDeleteDraft,
  useJudge,
  useProblem,
  useRevealHint,
  useSetBookmark,
  useSaveDraft,
  useSettings,
  useUpdateSettings,
} from '../../api/hooks.js';
import { useResolvedTheme } from '../../app/useAppTheme.js';
import type { CodeEditorHandle } from '../../editor/CodeEditor.js';
import { SHORTCUTS } from '../../shortcuts/shortcuts.js';
import { InterviewTimerControl, useInterviewTimer } from './InterviewTimer.js';
import { useShortcut } from '../../shortcuts/ShortcutProvider.js';
import {
  Button,
  ConfirmDialog,
  ErrorBoundary,
  ErrorState,
  Loading,
  Skeleton,
  StatusMark,
  StickyTabsContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  cn,
} from '../../ui/index.js';
import { CoachPanel } from './CoachPanel.js';
import { ResultsPanel } from './ResultsPanel.js';
import { StatementPanel } from './StatementPanel.js';
import { SplitPane } from './SplitPane.js';
import { TestcasePanel } from './TestcasePanel.js';
import { judgeHeadline, judgeSummary } from './judgeSummary.js';
import { useWorkspaceLayout } from './layout.js';
import { useCoach } from './useCoach.js';

/**
 * The problem workspace (ROADMAP P4-6).
 *
 * Statement on the left, editor top right, testcases and results below it -
 * three panels the user resizes and the app remembers (`layout.ts`). Everything
 * here is about one loop: read, type, Run, read the failure, type again.
 *
 * Two rules the rest of the file follows from:
 *
 *   - **The editor's contents belong to this component, not to the editor.**
 *     Monaco is unmounted whenever the panel is collapsed or the route changes;
 *     code kept inside it would not survive that, and the draft autosave has to
 *     be able to see every keystroke anyway.
 *   - **A draft save never touches status** (D11). It is the one write here that
 *     invalidates nothing: browsing and typing must not mark twenty problems as
 *     attempted.
 *
 * AI Help sits beside Run and Submit (P5-3) and is the only thing here that
 * calls a vendor. It is on-demand by design (D13): nothing on the Run or Submit
 * path touches the coach, and the button opens the Coach tab as it starts so
 * the answer is never streaming somewhere the user cannot see.
 */

// Monaco is about three megabytes. The list page must not pay for it.
const CodeEditor = lazy(() => import('../../editor/CodeEditor.js'));

const DEFAULT_EDITOR_PREFS = editorPrefsSchema.parse({});

/** How long after the last keystroke a draft is written. */
const AUTOSAVE_MS = 800;

/**
 * Roughly the size of the system prompt, for the cost estimate (P5-6).
 *
 * The client does not have the prompt - it is read from disk on the server -
 * and fetching it to put a "~$0.03" on a tooltip would be a round trip for a
 * figure that is approximate by construction. It is a versioned file that
 * changes rarely, so a constant is honest here in a way it would not be for
 * anything the user edits.
 */
const SYSTEM_PROMPT_CHARS = 5_700;

/**
 * The workspace, before it has a problem (ROADMAP P4-10).
 *
 * The three panels in their real proportions - statement left, editor right,
 * results below - because the alternative is a blank screen that becomes a
 * three-panel layout, and the eye has to find everything twice.
 */
function WorkspaceSkeleton() {
  return (
    <Loading label="Loading the problem" className="flex h-full min-h-0 flex-col">
      <span className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="ml-auto h-6 w-32" />
      </span>
      <span className="flex min-h-0 flex-1">
        <span className="border-border w-2/5 shrink-0 border-r p-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
        </span>
        <span className="flex-1 p-4">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-2 h-3 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </span>
      </span>
    </Loading>
  );
}

export function Workspace() {
  const { slug = '' } = useParams<{ slug: string }>();
  /*
   * Review mode (ROADMAP P7-8), carried in the URL.
   *
   * In the URL rather than in state, because the review queue links to it and a
   * reloaded review has to still be a review. `?review=1` hides the hints and
   * the editorial: a review you can look the answer up in is not a review.
   */
  const [search, setSearch] = useSearchParams();
  const reviewing = search.get('review') === '1';
  const { data: problem, isPending, error, refetch } = useProblem(slug);
  const { data: settings } = useSettings();
  const theme = useResolvedTheme();

  const [layout, setLayout] = useWorkspaceLayout();
  const editorRef = useRef<CodeEditorHandle>(null);

  // Null until the user picks one, so the last-used language from settings wins
  // on arrival without overriding a choice made while settings were loading.
  const [chosen, setChosen] = useState<Language | null>(null);
  const language = chosen ?? settings?.lastLanguage ?? 'python';

  const [code, setCode] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [customInputs, setCustomInputs] = useState<CustomTestInput[]>([]);
  const [tab, setTab] = useState<'testcases' | 'results'>('testcases');
  const [leftTab, setLeftTab] = useState('description');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [offerMastery, setOfferMastery] = useState(false);
  /**
   * Hint rungs the user has revealed (P4-12, persisted by P7-1).
   *
   * Owned here because the Hints panel is unmounted whenever another tab is
   * shown - so a glance at the Description used to re-hide every hint - and
   * because this is the number the coach has to be told: it must not repeat a
   * rung the user has already read, and it was sending 0 unconditionally.
   *
   * The server's count is the floor and this is the overlay on top of it, the
   * same shape as `chosen` and the last-used language above: the button moves
   * the moment it is clicked, and the write-through in `useRevealHint` catches
   * the floor up a round trip later. Reading `problem.revealedHints` alone
   * would make the hint appear only once the POST answered; holding only local
   * state would re-hide it on reload.
   */
  /**
   * Interview mode (ROADMAP P7-6).
   *
   * Owned here because three things need it: the header draws the clock, the
   * statement panel hides the hints and the editorial while it runs, and a
   * submit records how long it had been going.
   */
  const timer = useInterviewTimer();
  const stopTimer = timer.stop;
  const [revealedLocally, setRevealedLocally] = useState(0);
  const revealedHints = Math.max(revealedLocally, problem?.revealedHints ?? 0);

  /*
   * Destructured, not held as an object (ROADMAP P4-13).
   *
   * `useCoach` returns a fresh wrapper every render while the functions inside
   * it are stable, so a callback closing over the wrapper would change
   * identity on every keystroke and defeat the memoised panel below.
   */
  const {
    state: coachState,
    ask: coachAsk,
    followUp: coachFollowUp,
    stop: coachStop,
  } = useCoach(slug, language);

  const navigate = useNavigate();

  const run = useJudge('run');
  const submit = useJudge('submit');
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();
  const revealHint = useRevealHint();
  const setBookmark = useSetBookmark();
  const updateSettings = useUpdateSettings();
  const busy = run.isPending || submit.isPending;

  /**
   * The editor starts from the saved draft if there is one, and from the starter
   * otherwise, and resets when the problem or the language changes.
   *
   * Adjusted during render rather than in an effect. React documents this as the
   * way to reset state when a prop changes: an effect would render the old
   * language's code once, then immediately render again, and the editor would
   * flash the wrong source in between.
   */
  const source = problem ? `${problem.summary.slug}:${language}` : '';
  const [loadedFrom, setLoadedFrom] = useState(source);
  /** What the server already has: the draft it sent, or the starter when none. */
  const [persisted, setPersisted] = useState('');
  /**
   * What was on screen last time each language was, this visit.
   *
   * The saved draft is the source of truth across visits, but there is a window
   * in which it is not the freshest thing anyone knows: switching language
   * flushes the draft and switching straight back re-seeds the editor before
   * that PUT has answered, which showed the *starter* over code typed a second
   * earlier (found by the P4-11 end-to-end test). Nothing was lost - the save
   * was in flight - but the user was looking at the wrong code, and typing on
   * top of it is how that becomes lost.
   */
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  /**
   * Code a restored submission is bringing with it (ROADMAP P7-3).
   *
   * Restoring an attempt written in the other language has to change the
   * language *and* the code, and the switch below would otherwise re-seed the
   * editor from that language's draft a render later - throwing the restore
   * away. Held as state rather than passed through, because the switch happens
   * during the next render and not in the handler.
   */
  const [restoring, setRestoring] = useState<{ source: string; code: string } | null>(null);
  if (problem && loadedFrom !== source) {
    const saved = problem.drafts[language]?.code ?? problem.starters[language];
    const restored = restoring?.source === source ? restoring.code : null;
    const starting = restored ?? buffers[source] ?? saved;
    // Recorded on the way out, not on every keystroke: one entry per switch,
    // and the outgoing code is exactly what `code` still holds here.
    setBuffers({ ...buffers, [loadedFrom]: code });
    setLoadedFrom(source);
    setCode(starting);
    setPersisted(saved);
    setResult(null);
    setCustomInputs([]);
    setTab('testcases');
    if (restored === null) {
      // A restore came *from* the Submissions tab, and sending the user back to
      // the Description to tell them it worked is a strange way to say so.
      setLeftTab('description');
    } else {
      setRestoring(null);
    }
    setOfferMastery(false);
    // A different problem is a different sitting. Leaving the clock running
    // across a change would record the first problem's time against the
    // second one's submission.
    stopTimer();
    // Only the overlay: `problem.revealedHints` is what the user has actually
    // read, and it is per problem rather than per language - the ladder is the
    // same ladder whichever language they are writing in.
    setRevealedLocally(0);
  }

  /**
   * Autosave, debounced - and flushed rather than dropped.
   *
   * `persisted` is what the server already has, so reverting an edit by hand
   * does not queue a write of a value that is already stored. `mutate` is stable
   * across renders, which is what stops this timer from being cleared and
   * restarted on every render and therefore never firing.
   *
   * Three effects rather than one, and the split is the whole point (ROADMAP
   * P4-11):
   *
   *   1. `pending` records what is unsaved. In a ref, because the flush must
   *      not be a reason to re-run anything.
   *   2. The debounce. Its cleanup only clears the timer - a cleanup that also
   *      flushed would write on every keystroke, which is the opposite of a
   *      debounce.
   *   3. The flush, keyed on the problem and language. Its cleanup is the only
   *      one that means "we are leaving", and it runs on exactly the three
   *      things most likely to happen right after typing: pressing Back,
   *      clicking the other language, and changing problem. Before this, the
   *      last 800 ms of typing was dropped by all three.
   *
   * `persisted` moves in `onSuccess` and not before the request: marking it
   * saved optimistically meant a failed PUT was never retried and never
   * noticed - the draft was gone and the editor claimed otherwise.
   */
  const save = saveDraft.mutate;
  const ready = problem !== undefined;

  const pending = useRef<{ slug: string; language: Language; code: string } | null>(null);
  useEffect(() => {
    pending.current = code === persisted ? null : { slug, language, code };
  }, [code, persisted, slug, language]);

  /** Which problem and language the editor is showing *now*, for the flush. */
  const showing = useRef({ slug, language });
  useEffect(() => {
    showing.current = { slug, language };
  }, [slug, language]);

  const flush = useCallback(() => {
    const next = pending.current;
    if (next === null) return;
    pending.current = null;
    save(next, {
      onSuccess: () => {
        // Only if the editor still holds the code that was saved. A flush on
        // the way out resolves after the next language is on screen, and
        // marking *that* code persisted would hide its first edit.
        if (showing.current.slug === next.slug && showing.current.language === next.language) {
          setPersisted(next.code);
        }
      },
    });
  }, [save]);

  useEffect(() => {
    if (!ready || code === persisted) return;
    const timer = setTimeout(flush, AUTOSAVE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [code, persisted, ready, flush]);

  useEffect(
    () => () => {
      flush();
    },
    [slug, language, flush],
  );

  /**
   * The tab closing, which no React cleanup sees.
   *
   * `pagehide` fires on close, reload and navigating away, including into the
   * back-forward cache where `beforeunload` does not. The request has to
   * outlive the page, which is what `keepalive` is for - a normal `fetch` from
   * a page being torn down is cancelled with it.
   */
  useEffect(() => {
    const onPageHide = (): void => {
      const next = pending.current;
      if (next === null) return;
      pending.current = null;
      void api.saveDraftKeepalive(next.slug, next.language, next.code);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  const shape = useMemo(
    () => (problem ? customTestShapeFrom(problem.summary.mode, problem.samples) : null),
    [problem],
  );
  const parsedCustom = useMemo(
    () => (shape ? parseCustomTests(customInputs, shape) : null),
    [customInputs, shape],
  );
  const customIssues = parsedCustom && !parsedCustom.ok ? parsedCustom.issues : [];

  const judge = (kind: 'run' | 'submit') => {
    const mutation = kind === 'run' ? run : submit;
    // A run with a case the server would reject is not worth a round trip, and
    // the panel is already showing why beside the box.
    if (kind === 'run' && parsedCustom && !parsedCustom.ok) {
      setTab('testcases');
      return;
    }

    mutation.mutate(
      {
        slug,
        language,
        code,
        ...(kind === 'run' && parsedCustom?.ok && parsedCustom.tests.length > 0
          ? { customTests: parsedCustom.tests }
          : {}),
        // Only on a submit, and only when the clock was running (P7-6). A run
        // is not an attempt, and an untimed submit records null rather than
        // zero - "not timed" and "solved instantly" are different facts.
        ...(kind === 'submit' && timer.running ? { solveMs: timer.elapsedMs } : {}),
      },
      {
        onSuccess: (next, variables) => {
          // A Java submit that resolves after the user switched to Python was
          // landing its verdict, its tab switch and its mastery nudge on the
          // Python screen - advice about code no longer on display (P4-11).
          // The result is still cached by the mutation; it is only refused the
          // screen it no longer belongs to.
          if (variables.slug !== slug || variables.language !== language) return;

          setResult(next);
          setTab('results');
          if (layout.panelCollapsed) setLayout({ panelCollapsed: false });
          // The mastery nudge (P5-4). Offered, never taken: a coaching turn
          // costs money, so an accepted submit must not start one by itself.
          if (kind === 'submit' && next.verdict === 'AC') setOfferMastery(true);
        },
      },
    );
  };

  /**
   * The one call in this component that reaches a vendor.
   *
   * Opening the Coach tab is part of asking, not a nicety: a turn that streams
   * into a hidden tab looks to the user like a button that did nothing, and by
   * the time they find it the prose they were meant to watch arrive is already
   * finished.
   */
  /**
   * What the next coaching turn will roughly cost (ROADMAP P5-6).
   *
   * On the tooltip rather than beside the button: it is a number to check
   * before clicking, not one to watch, and a figure that changed on every
   * keystroke in the toolbar would be noise on a bar that is otherwise stable.
   *
   * Estimated from what the client can see - the prompt, the statement and the
   * code - plus a constant for the system prompt, which the client does not
   * have and which barely moves. The whole thing is prefixed "about" for the
   * same reason the shared helper prefixes its tokens with a tilde.
   */
  const costEstimate = formatUsd(
    estimateTurnCostUsd(
      settings?.coach.provider ?? 'anthropic',
      settings?.coach.model ?? null,
      SYSTEM_PROMPT_CHARS + code.length + (problem?.statement.length ?? 0),
    ),
  );

  /**
   * Unlocking a hint (ROADMAP P7-1).
   *
   * Optimistic on purpose: the rung appears on the click, and the POST records
   * it. If that request fails the hint stays open for this sitting and the
   * server simply never heard - which costs the user nothing, where the
   * alternative (waiting for the answer, or rolling back on failure) takes back
   * text they have already read.
   */
  const interviewMode = timer.running;
  const hideAssistance = interviewMode || reviewing;
  /**
   * Starting the clock while the Hints tab is open (P7-6).
   *
   * That tab is about to stop existing, and Radix left with no matching trigger
   * shows an empty panel. Moved back to the Description in render rather than
   * in the button's handler, because the timer can also start from a place that
   * does not know which tab is showing.
   */
  if (hideAssistance && (leftTab === 'hints' || leftTab === 'editorial')) {
    setLeftTab('description');
  }
  const reveal = revealHint.mutate;
  const onRevealHint = useCallback(
    (next: number) => {
      setRevealedLocally(next);
      reveal({ slug, revealed: next });
    },
    [reveal, slug],
  );

  /**
   * Putting an old submission back in the editor (ROADMAP P7-3).
   *
   * It goes in as a draft like anything else typed there - the autosave picks
   * it up, and Submit is still what records an attempt. An attempt written in
   * the other language brings the language with it, because restoring Java into
   * a Python editor would be restoring a syntax error.
   */
  const restoreSubmission = useCallback(
    (submission: Submission) => {
      if (submission.language === language) {
        setCode(submission.code);
        return;
      }
      setRestoring({ source: `${slug}:${submission.language}`, code: submission.code });
      setChosen(submission.language);
    },
    [language, slug],
  );

  /*
   * Stable identity, because the Coach panel is memoised (ROADMAP P4-13).
   *
   * `code` is in the dependency list, so this *does* change as the user types -
   * which is unavoidable: the coach reviews the code that is there when asked.
   * What it buys is that the panel re-renders only when something it shows
   * changes, rather than on every keystroke through a freshly built element.
   */
  const askCoach = useCallback(
    (options: { masteryCheck?: boolean; newConversation?: boolean } = {}) => {
      setLeftTab('coach');
      setOfferMastery(false);
      coachAsk({ slug, language, code, revealedHints, interviewMode, ...options });
    },
    [coachAsk, slug, language, code, revealedHints, interviewMode],
  );

  useShortcut(
    'run',
    () => {
      judge('run');
    },
    !busy && ready,
  );
  useShortcut(
    'submit',
    () => {
      judge('submit');
    },
    !busy && ready,
  );
  useShortcut('togglePanel', () => {
    setLayout({ panelCollapsed: !layout.panelCollapsed });
  });
  useShortcut(
    'aiHelp',
    () => {
      askCoach();
    },
    ready,
  );

  const askNewConversation = useCallback(() => {
    askCoach({ newConversation: true });
  }, [askCoach]);

  const openSettings = useCallback(() => {
    void navigate('/settings');
  }, [navigate]);

  /*
   * Built with `useMemo`, not inline (ROADMAP P4-13).
   *
   * Inline, this element was recreated on every render - so the memoised
   * `StatementPanel` saw a new `coach` prop on every keystroke and re-rendered
   * anyway, taking the statement's markdown with it.
   */
  const coachPanel = useMemo(
    () => (
      <CoachPanel
        state={coachState}
        fallback={
          result
            ? {
                headline: judgeHeadline(result),
                points: judgeSummary(result, problem?.timeoutMs[language] ?? 0),
              }
            : null
        }
        onAsk={askCoach}
        onNewConversation={askNewConversation}
        onFollowUp={coachFollowUp}
        onStop={coachStop}
        onOpenSettings={openSettings}
      />
    ),
    [
      coachState,
      result,
      problem,
      language,
      askCoach,
      askNewConversation,
      coachFollowUp,
      coachStop,
      openSettings,
    ],
  );

  if (isPending) return <WorkspaceSkeleton />;
  if (error) {
    return (
      <ErrorState
        title="This problem could not load."
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const failure = run.error ?? submit.error;
  const status = problem.summary.statusByLanguage[language] ?? 'not_started';

  const resetToStarter = () => {
    const starter = problem.starters[language];
    // Dropped before the DELETE, not after: a pending autosave that landed
    // second would restore the draft this is deleting (P4-11).
    pending.current = null;
    setCode(starter);
    setPersisted(starter);
    deleteDraft.mutate({ slug, language });
    setConfirmingReset(false);
  };

  const jumpToLine = (compileError: CompileError) => {
    if (compileError.line !== undefined) {
      editorRef.current?.revealPosition(compileError.line, compileError.column);
    }
  };

  const editor = (
    <div className="min-h-0 w-full" data-testid="editor">
      {/*
        The editor is a lazy chunk, and the chunk can be gone (P4-12): after the
        dev server restarts, the hashed file this page is holding a reference to
        no longer exists, the import rejects, and Suspense has nothing to show
        for a rejection - the whole workspace went white. The boundary offers
        the reload that actually fixes it.
      */}
      <ErrorBoundary title="The editor could not load.">
        <Suspense fallback={<p className="text-fg-muted p-4 text-sm">Loading the editor…</p>}>
          <CodeEditor
            ref={editorRef}
            value={code}
            // One Monaco model per problem and language; see CodeEditorProps.
            path={`${slug}.${language}`}
            language={language}
            onChange={setCode}
            prefs={settings?.editor ?? DEFAULT_EDITOR_PREFS}
            theme={theme}
            markers={result?.compileErrors ?? []}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );

  const bottomPanel = (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        setTab(next as 'testcases' | 'results');
        if (layout.panelCollapsed) setLayout({ panelCollapsed: false });
      }}
      className="flex min-h-0 w-full flex-col"
    >
      {/*
        The toggle sits beside the tab strip, not in it.

        A `tablist` may contain tabs and nothing else, and a button inside one
        is a critical axe finding rather than a style question: assistive
        technology counts "tab 3 of 3" and then hands over something that is not
        a tab (P4-10). The trailing cell repeats the strip's bottom border so
        the line still runs the width of the panel.
      */}
      <div className="flex shrink-0 items-stretch">
        <TabsList className="flex-1 px-2">
          <TabsTrigger value="testcases">
            Testcases
            {customIssues.length > 0 && (
              /* `sr-only` text rather than an `aria-label` on a bare span,
                 which is ignored - the tab's name then actually says there is
                 a problem (P4-13). */
              <span className="text-danger-fg ml-1 text-2xs">
                <span aria-hidden>!</span>
                <span className="sr-only">has errors</span>
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <div className="border-border flex items-center border-b pr-2">
          <Tooltip
            content={layout.panelCollapsed ? 'Show the panel' : 'Hide the panel'}
            keys={SHORTCUTS.togglePanel.keys}
          >
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={!layout.panelCollapsed}
              onClick={() => {
                setLayout({ panelCollapsed: !layout.panelCollapsed });
              }}
            >
              {layout.panelCollapsed ? 'Show' : 'Hide'}
            </Button>
          </Tooltip>
        </div>
      </div>

      {!layout.panelCollapsed && (
        <>
          <TabsContent value="testcases" className="min-h-0 flex-1 overflow-y-auto pt-0">
            {shape && (
              <TestcasePanel
                samples={problem.samples}
                shape={shape}
                inputs={customInputs}
                onChange={setCustomInputs}
                issues={customIssues}
              />
            )}
          </TabsContent>

          {/*
            Kept mounted (P4-12): the results panel owns which test is selected,
            and flipping to Testcases and back used to send the user back to the
            first failure - losing the one they were reading.
          */}
          <StickyTabsContent
            value="results"
            className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0"
          >
            {/*
              The mastery nudge (ROADMAP P5-4, D13).

              Non-blocking and non-modal on purpose: it appears above the result
              the user came here to read, and ignoring it is one of the two
              buttons. A dialog would interrupt the moment a problem is solved
              to ask for money, which is the wrong thing to do with that moment.

              It is a `role="status"`, not an alert - nothing is wrong. Offering
              rather than running is the whole point: D13 says the coach is
              never auto-called, and an accepted submit is not a request.
            */}
            {offerMastery && (
              <div
                className="border-border bg-surface-sunken flex shrink-0 items-center gap-3 border-b px-4 py-2"
                role="status"
              >
                <p className="text-fg-muted flex-1 text-sm">
                  Accepted. Ask the coach whether this is interview-ready?
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    askCoach({ masteryCheck: true });
                  }}
                >
                  Check it
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOfferMastery(false);
                  }}
                >
                  Not now
                </Button>
              </div>
            )}

            {failure ? (
              <p className="text-danger-fg p-4 text-sm" role="alert">
                {failure.message}
              </p>
            ) : result ? (
              <ResultsPanel result={result} onJumpToLine={jumpToLine} />
            ) : (
              <p className="text-fg-muted p-4 text-sm">
                Run to check your code against the samples, or Submit to run every test.
              </p>
            )}
          </StickyTabsContent>
        </>
      )}
    </Tabs>
  );

  const editorColumn = layout.panelCollapsed ? (
    <div className="flex min-h-0 w-full flex-col">
      <div className="min-h-0 flex-1">{editor}</div>
      <div className="border-border shrink-0 border-t">{bottomPanel}</div>
    </div>
  ) : (
    <SplitPane
      direction="column"
      ratio={layout.editor}
      onRatio={(next) => {
        setLayout({ editor: next });
      }}
      label="Editor and results"
      className="w-full flex-1"
      first={editor}
      second={bottomPanel}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <div className="flex items-center gap-1" role="group" aria-label="Language">
          {LANGUAGES.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={language === option ? 'secondary' : 'ghost'}
              aria-pressed={language === option}
              /*
                Locked while the judge is working (P4-11). The run in flight is
                for the language that started it, and a switch mid-run puts the
                user in front of one language's editor waiting for the other
                language's verdict.
              */
              disabled={busy && language !== option}
              onClick={() => {
                setChosen(option);
                updateSettings.mutate({ lastLanguage: option });
              }}
            >
              {LANGUAGE_LABEL[option]}
            </Button>
          ))}
        </div>

        <span className="bg-border mx-1 h-4 w-px" aria-hidden />

        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setConfirmingReset(true);
          }}
        >
          Reset
        </Button>

        {/*
          Starring a problem (P7-7). Beside Reset because it is about this
          problem rather than about the code: a bookmark says "come back to
          this one", which the command palette and the list filter both read.
        */}
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={problem.summary.bookmarked}
          onClick={() => {
            setBookmark.mutate({ slug, bookmarked: !problem.summary.bookmarked });
          }}
        >
          {problem.summary.bookmarked ? 'Bookmarked' : 'Bookmark'}
        </Button>

        {/*
          Interview mode (P7-6). Beside Reset rather than out on the right with
          Run and Submit: it changes the conditions you are working under, which
          is the same kind of thing as which language you are writing in, and
          not an action on the code.
        */}
        <InterviewTimerControl timer={timer} />

        {/*
          Live status propagation (ROADMAP P4-8), and the whole of the
          confirmation an accepted submit gets.

          Read from the server, not from the run result sitting in state: an
          accepted submit invalidates this problem's query (`useJudge`), the
          refetch brings back the new status, and the mark flips. That is why
          the status is right on arrival too - a problem solved yesterday says
          so before anything is run today, which a flag set by this session's
          own submit never could.

          `role="status"` makes the flip a polite announcement, so the one
          confirmation that exists reaches a screen reader as well as an eye.
          There is no toast and no confetti: the status flipping to Solved *is*
          the reward (docs/DESIGN.md section 2). The region is rendered even
          while it is empty, because a live region inserted at the same moment
          as its text is a live region that announces nothing.
        */}
        <p className="ml-2 flex items-center" role="status" data-testid="problem-status">
          {status !== 'not_started' && (
            <StatusMark status={status} label={statusLine(status, language)} />
          )}
        </p>

        <div className="ml-auto flex items-center gap-2">
          {/*
            Ghost, not primary: Run and Submit are the loop, and AI Help is the
            thing you reach for when the loop is not working. It is also the
            only control here that spends money, which is a second reason not
            to make it the most clickable thing on the bar (D13).
          */}
          <Tooltip
            content={`Ask the coach about the code you have written · about ${costEstimate}`}
            keys={SHORTCUTS.aiHelp.keys}
          >
            <Button
              variant="ghost"
              disabled={coachState.phase === 'streaming'}
              onClick={() => {
                askCoach();
              }}
            >
              AI Help
            </Button>
          </Tooltip>

          <span className="bg-border mx-1 h-4 w-px" aria-hidden />

          <Tooltip content="Run the samples and your own cases" keys={SHORTCUTS.run.keys}>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                judge('run');
              }}
            >
              {run.isPending ? 'Running…' : 'Run'}
            </Button>
          </Tooltip>
          <Tooltip content="Run every test and record the result" keys={SHORTCUTS.submit.keys}>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                judge('submit');
              }}
            >
              {submit.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </Tooltip>
        </div>
      </header>

      {/*
        Review mode says so (P7-8). A screen that has quietly removed two tabs
        without explaining itself is a screen that looks broken - and the way
        out has to be on it, because the only other one is editing the URL.
      */}
      {reviewing && (
        <div className="border-border bg-surface-sunken flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
          <p className="text-fg-muted text-xs">
            Reviewing from memory. Hints and the editorial are shut until you leave review mode.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              const next = new URLSearchParams(search);
              next.delete('review');
              setSearch(next, { replace: true });
            }}
          >
            Leave review mode
          </Button>
        </div>
      )}

      <SplitPane
        direction="row"
        ratio={layout.statement}
        onRatio={(next) => {
          setLayout({ statement: next });
        }}
        label="Statement and editor"
        className={cn('flex-1')}
        first={
          <div className="border-border flex min-h-0 w-full border-r">
            <StatementPanel
              problem={problem}
              tab={leftTab}
              onTab={setLeftTab}
              revealedHints={revealedHints}
              onRevealHint={onRevealHint}
              language={language}
              code={code}
              hideAssistance={hideAssistance}
              onRestore={restoreSubmission}
              coach={coachPanel}
            />
          </div>
        }
        second={editorColumn}
      />

      <ConfirmDialog
        open={confirmingReset}
        onOpenChange={setConfirmingReset}
        title="Reset to the starter code?"
        description={`Your saved ${LANGUAGE_LABEL[language]} draft for this problem will be deleted and the editor will go back to the starter. Submissions you have already made are not affected.`}
        confirmLabel="Reset"
        onConfirm={resetToStarter}
      />
    </div>
  );
}

/**
 * The header's one line of status.
 *
 * Solved and Mastered name the language; In progress does not. Which language a
 * problem was *solved* in is the question the language switch immediately
 * raises - Python solved and Java untouched is the normal state of a problem
 * halfway through - while "in progress in Python" is a distinction nobody is
 * waiting on. Not started says nothing at all; see the caller.
 */
function statusLine(status: ProgressStatus, language: Language): string {
  return status === 'solved' || status === 'mastered'
    ? `${PROGRESS_LABEL[status]} in ${LANGUAGE_LABEL[language]}`
    : PROGRESS_LABEL[status];
}
