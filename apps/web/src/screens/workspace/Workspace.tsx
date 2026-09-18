import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
} from '@devpromax/shared';
import {
  useDeleteDraft,
  useJudge,
  useProblem,
  useSaveDraft,
  useSettings,
  useUpdateSettings,
} from '../../api/hooks.js';
import { useResolvedTheme } from '../../app/useAppTheme.js';
import type { CodeEditorHandle } from '../../editor/CodeEditor.js';
import { SHORTCUTS } from '../../shortcuts/shortcuts.js';
import { useShortcut } from '../../shortcuts/ShortcutProvider.js';
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Loading,
  Skeleton,
  StatusMark,
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

  const coach = useCoach(slug, language);
  const navigate = useNavigate();

  const run = useJudge('run');
  const submit = useJudge('submit');
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();
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
  if (problem && loadedFrom !== source) {
    const starting = problem.drafts[language]?.code ?? problem.starters[language];
    setLoadedFrom(source);
    setCode(starting);
    setPersisted(starting);
    setResult(null);
    setCustomInputs([]);
    setTab('testcases');
    setLeftTab('description');
    setOfferMastery(false);
  }

  /**
   * Autosave, debounced.
   *
   * `persisted` is what the server already has, so reverting an edit by hand
   * does not queue a write of a value that is already stored. `mutate` is stable
   * across renders, which is what stops this timer from being cleared and
   * restarted on every render and therefore never firing.
   */
  const save = saveDraft.mutate;
  const ready = problem !== undefined;
  useEffect(() => {
    if (!ready || code === persisted) return;
    const timer = setTimeout(() => {
      setPersisted(code);
      save({ slug, language, code });
    }, AUTOSAVE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [code, persisted, ready, slug, language, save]);

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
      },
      {
        onSuccess: (next) => {
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

  const askCoach = (options: { masteryCheck?: boolean } = {}) => {
    setLeftTab('coach');
    setOfferMastery(false);
    coach.ask({ slug, language, code, ...options });
  };

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
      <Suspense fallback={<p className="text-fg-muted p-4 text-sm">Loading the editor…</p>}>
        <CodeEditor
          ref={editorRef}
          value={code}
          language={language}
          onChange={setCode}
          prefs={settings?.editor ?? DEFAULT_EDITOR_PREFS}
          theme={theme}
          markers={result?.compileErrors ?? []}
        />
      </Suspense>
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
              <span className="text-danger-fg ml-1 text-2xs" aria-label="has errors">
                !
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

          <TabsContent
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
          </TabsContent>
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
              disabled={coach.state.phase === 'streaming'}
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
              coach={
                <CoachPanel
                  state={coach.state}
                  fallback={
                    result
                      ? {
                          headline: judgeHeadline(result),
                          points: judgeSummary(result, problem.timeoutMs[language]),
                        }
                      : null
                  }
                  onAsk={() => {
                    askCoach();
                  }}
                  onFollowUp={coach.followUp}
                  onStop={coach.stop}
                  onOpenSettings={() => {
                    void navigate('/settings');
                  }}
                />
              }
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
