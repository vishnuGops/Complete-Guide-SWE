import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RotateCcw, Star, WandSparkles } from 'lucide-react';
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
  type Submission,
} from '@devpromax/shared';
import { api } from '../../api/client.js';
import {
  useDeleteDraft,
  useFormatters,
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
  Callout,
  Card,
  CoachMark,
  ConfirmDialog,
  ErrorBoundary,
  ErrorState,
  Keys,
  Segmented,
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
import { WorkspaceSkeleton } from './WorkspaceSkeleton.js';
import { coachPromptChars } from './coachEstimate.js';
import { judgeHeadline, judgeSummary } from './judgeSummary.js';
import { useWorkspaceLayout } from './layout.js';
import { useCoach } from './useCoach.js';
import { useDebouncedAutosave } from './useDebouncedAutosave.js';
import { useJudgeFlow, type JudgeKind } from './useJudgeFlow.js';

/**
 * The problem workspace (ROADMAP P4-6).
 *
 * Statement on the left, editor top right, testcases and results below it -
 * three cards with 12px gutters (P9-6) that the user resizes and the app
 * remembers (`layout.ts`). Everything here is about one loop: read, type, Run,
 * read the failure, type again.
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
 *
 * Two hooks carry the parts with the most rules (P4-14, P4-15):
 * `useDebouncedAutosave` decides when and where a draft is written, and
 * `useJudgeFlow` decides which verdict may be on screen.
 */

// Monaco is about three megabytes. The list page must not pay for it.
const CodeEditor = lazy(() => import('../../editor/CodeEditor.js'));

const DEFAULT_EDITOR_PREFS = editorPrefsSchema.parse({});

/** Monaco's own binding for Format Document, which the editor action reuses. */
const FORMAT_KEYS = ['Shift', 'Alt', 'F'] as const;

/** No compile errors, as one array: a fresh `[]` per render re-drew the gutter per keystroke. */
const NO_MARKERS: readonly CompileError[] = [];

/** Where the code in the editor was loaded from, and so where it is saved to. */
interface DraftScope {
  key: string;
  slug: string;
  language: Language;
}

/** `two-sum:python` is the problem `two-sum`. */
function slugOf(source: string): string {
  return source.slice(0, source.lastIndexOf(':'));
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
  const [customInputs, setCustomInputs] = useState<CustomTestInput[]>([]);
  const [tab, setTab] = useState<'testcases' | 'results'>('testcases');
  const [leftTab, setLeftTab] = useState('description');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [offerMastery, setOfferMastery] = useState(false);
  /**
   * Interview mode (ROADMAP P7-6).
   *
   * Owned here because three things need it: the header draws the clock, the
   * statement panel hides the hints and the editorial while it runs, and a
   * submit records how long it had been going. The clock's ticking is not
   * owned here (P4-18) - see `InterviewTimer`.
   */
  const timer = useInterviewTimer();
  const stopTimer = timer.stop;
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

  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();
  const revealHint = useRevealHint();
  const setBookmark = useSetBookmark();
  const updateSettings = useUpdateSettings();

  /**
   * The editor starts from the saved draft if there is one, and from the starter
   * otherwise, and resets when the problem or the language changes.
   *
   * Adjusted during render rather than in an effect. React documents this as the
   * way to reset state when a prop changes: an effect would render the old
   * language's code once, then immediately render again, and the editor would
   * flash the wrong source in between.
   *
   * `loadedFrom` starts empty rather than at `source` (P4-14). Starting at
   * `source` meant a problem already in the query cache - the list, then the
   * problem, then the list, then the problem again - mounted with the two equal,
   * skipped the seeding, and showed an empty editor over the saved draft; and
   * the first keystroke's autosave wrote that near-empty text over it.
   */
  const source = problem ? `${problem.summary.slug}:${language}` : '';
  const [loadedFrom, setLoadedFrom] = useState('');
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
    const sameProblem = loadedFrom !== '' && slugOf(loadedFrom) === problem.summary.slug;
    // Recorded on the way out, not on every keystroke: one entry per switch,
    // and the outgoing code is exactly what `code` still holds here.
    if (loadedFrom !== '') setBuffers({ ...buffers, [loadedFrom]: code });
    setLoadedFrom(source);
    setCode(starting);
    setPersisted(saved);
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
    if (!sameProblem) {
      // A different problem is a different sitting. Leaving the clock running
      // across a change would record the first problem's time against the
      // second one's submission. The other language of the *same* problem is
      // not (P4-15): an interview in which you switch to Java is still the
      // same interview, and stopping the clock put the hints back on screen.
      stopTimer();
      // Only the overlay: `problem.revealedHints` is what the user has actually
      // read, and it is per problem rather than per language - the ladder is
      // the same ladder whichever language they are writing in.
      setRevealedLocally(0);
    }
  }

  const ready = problem !== undefined;
  const loadedSlug = problem?.summary.slug;

  /**
   * Where the code on screen belongs (P4-14): the scope it was loaded from,
   * and only once that is the scope being shown. While the next problem loads,
   * the editor still holds the last one's code, and the autosave keyed on the
   * *route* used to file it under the new problem's name.
   */
  const draftScope = useMemo<DraftScope | null>(
    () =>
      loadedSlug !== undefined && loadedFrom === source
        ? { key: source, slug: loadedSlug, language }
        : null,
    [loadedSlug, loadedFrom, source, language],
  );

  /**
   * Autosave, debounced - and flushed rather than dropped, and retried rather
   * than dropped (P4-11, P4-14). The rules live in `useDebouncedAutosave`.
   *
   * `persisted` moves only once the server has answered: marking it saved
   * optimistically meant a failed PUT was never retried and never noticed.
   */
  const saveDraftAsync = saveDraft.mutateAsync;
  const {
    saveNow: saveDraftNow,
    discard: discardDraft,
    retrying: draftRetrying,
    error: draftError,
  } = useDebouncedAutosave<DraftScope>({
    scope: draftScope,
    value: code,
    saved: persisted,
    write: (scope, value) =>
      saveDraftAsync({ slug: scope.slug, language: scope.language, code: value }),
    writeOnUnload: (scope, value) => {
      void api.saveDraftKeepalive(scope.slug, scope.language, value);
    },
    onSaved: (_scope, value, current) => {
      if (current) setPersisted(value);
    },
  });

  /** Which problem and language the editor is showing *now*, for late answers. */
  const showing = useRef({ slug, language });
  useEffect(() => {
    showing.current = { slug, language };
  }, [slug, language]);

  /**
   * Format, and Ctrl+S (ROADMAP P9-5).
   *
   * The formatter runs on the server, so formatting is a round trip, and the
   * editor can change while it is in flight. The answer is applied only if the
   * editor still holds exactly what was sent, for the same problem and
   * language; otherwise it is dropped without comment - the user has moved on,
   * and replacing what they typed since with a formatted copy of what they had
   * before is the one outcome worse than not formatting.
   *
   * The note beside the button is keyed on the code it describes, so the next
   * keystroke clears it by itself: "Formatted" stays true exactly as long as
   * nothing has been typed since.
   */
  const { data: formatterList } = useFormatters();
  const formatter = formatterList?.formatters.find(
    (entry) => entry.language === language && entry.available,
  );
  const editorPrefs = settings?.editor ?? DEFAULT_EDITOR_PREFS;
  const [formatting, setFormatting] = useState(false);
  const [formatNote, setFormatNote] = useState<{
    code: string;
    text: string;
    failed: boolean;
  } | null>(null);

  /**
   * The editor's text as of the last keystroke, not the last render.
   *
   * Written by the editor's change handler as well as by the effect, because
   * a Ctrl+S pressed straight after typing arrives before React has rendered
   * that typing - found in a real browser, where the save sent the previous
   * text, the answer was rightly dropped as stale, and the save went with it.
   * The effect covers every other way `code` moves: restore, reset, switching
   * language. Run, Submit and AI Help read it too (P4-15), for the same reason.
   */
  const codeNow = useRef(code);
  useEffect(() => {
    codeNow.current = code;
  }, [code]);
  const onEditorChange = useCallback((next: string) => {
    codeNow.current = next;
    setCode(next);
  }, []);

  /** Saves this code now rather than after the debounce, then says so. */
  const saveNow = useCallback(
    (value: string, said: string, failed = false) => {
      void saveDraftNow(value).then((landed) => {
        // Not landed means the scope moved on, or the write failed - and a
        // failure has its own note, which "Saved" must not paper over.
        if (landed) setFormatNote({ code: value, text: said, failed });
      });
    },
    [saveDraftNow],
  );

  const formatCode = useCallback(
    async (andSave: boolean) => {
      if (!formatter || formatting) return;
      const sent = codeNow.current;
      const at = { slug, language };
      const stillHere = (): boolean =>
        codeNow.current === sent &&
        showing.current.slug === at.slug &&
        showing.current.language === at.language;

      setFormatting(true);
      try {
        const response = await api.format(language, sent);
        if (!stillHere()) return;
        if (response.outcome === 'formatted') {
          if (response.changed && editorRef.current?.replaceAll(response.code) !== true) {
            setCode(response.code);
          }
          const said = response.changed ? 'Formatted' : 'Already formatted';
          if (andSave) saveNow(response.code, `${said}, and saved`);
          else setFormatNote({ code: response.code, text: said, failed: false });
          return;
        }
        // Saving still happens: Ctrl+S means "keep this", and code that does
        // not parse yet is exactly the code most worth keeping. One note for
        // both, so the save landing second cannot hide why nothing moved.
        const why =
          response.outcome === 'invalid' ? `Not formatted: ${response.message}` : response.message;
        if (andSave) saveNow(sent, `Saved. ${why}`, true);
        else setFormatNote({ code: sent, text: why, failed: true });
      } catch (error) {
        if (!stillHere()) return;
        const why = error instanceof Error ? error.message : 'The formatter could not be reached.';
        if (andSave) saveNow(sent, `Saved. ${why}`, true);
        else setFormatNote({ code: sent, text: why, failed: true });
      } finally {
        setFormatting(false);
      }
    },
    [formatter, formatting, slug, language, saveNow],
  );

  const formatDocument = useCallback(() => {
    void formatCode(false);
  }, [formatCode]);

  useShortcut(
    'save',
    () => {
      if (editorPrefs.formatOnSave && formatter) void formatCode(true);
      else saveNow(codeNow.current, 'Saved');
    },
    ready,
  );

  const shape = useMemo(
    () => (problem ? customTestShapeFrom(problem.summary.mode, problem.samples) : null),
    [problem],
  );
  const parsedCustom = useMemo(
    () => (shape ? parseCustomTests(customInputs, shape) : null),
    [customInputs, shape],
  );
  const customIssues = useMemo(
    () => (parsedCustom && !parsedCustom.ok ? parsedCustom.issues : []),
    [parsedCustom],
  );

  /*
   * What a verdict does to the screen once `useJudgeFlow` has let it through.
   * Read through the hook's ref, so it may close over this render's layout.
   */
  const flow = useJudgeFlow(slug, language, (next, kind) => {
    setTab('results');
    if (layout.panelCollapsed) setLayout({ panelCollapsed: false });
    // The mastery nudge (P5-4). Offered, never taken: a coaching turn costs
    // money, so an accepted submit must not start one by itself.
    if (kind === 'submit' && next.verdict === 'AC') setOfferMastery(true);
  });
  const { result, busy } = flow;

  const judge = (kind: JudgeKind) => {
    if (draftScope === null) return;
    // A run with a case the server would reject is not worth a round trip, and
    // the panel is already showing why beside the box.
    if (kind === 'run' && parsedCustom && !parsedCustom.ok) {
      setTab('testcases');
      return;
    }

    flow.judge(kind, {
      slug: draftScope.slug,
      language: draftScope.language,
      // As of the last keystroke (P4-15): `Ctrl+Enter` straight after typing
      // arrives before React has rendered it, and the judge used to run the
      // code from one character ago.
      code: codeNow.current,
      ...(kind === 'run' && parsedCustom?.ok && parsedCustom.tests.length > 0
        ? { customTests: parsedCustom.tests }
        : {}),
      // Only on a submit, and only when the clock was running (P7-6). A run
      // is not an attempt, and an untimed submit records null rather than
      // zero - "not timed" and "solved instantly" are different facts.
      ...(kind === 'submit' && timer.running ? { solveMs: timer.elapsedMs() } : {}),
    });
  };

  /**
   * What the next coaching turn will roughly cost (ROADMAP P5-6).
   *
   * On the tooltip rather than beside the button: it is a number to check
   * before clicking, not one to watch, and a figure that changed on every
   * keystroke in the toolbar would be noise on a bar that is otherwise stable.
   *
   * The input side is everything the server's context will carry
   * (`coachEstimate.ts`); the output side - the answer and any thinking - is
   * the shared helper's, so this and the spend cap price a turn the same way.
   * The whole thing is prefixed "about" for the same reason the shared helper
   * prefixes its tokens with a tilde.
   */
  const costEstimate = formatUsd(
    estimateTurnCostUsd(
      settings?.coach.provider ?? 'anthropic',
      settings?.coach.model ?? null,
      problem ? coachPromptChars(problem, code, revealedHints) : 0,
    ),
  );

  const interviewMode = timer.running;
  const hideAssistance = interviewMode || reviewing;
  /*
   * Solved against tests that have since changed (P7-9). Only when there is a
   * pass to compare: a problem nobody has solved has not drifted, it is just
   * unsolved.
   */
  const drifted =
    problem !== undefined &&
    problem.summary.solvedVersion !== null &&
    problem.summary.solvedVersion < problem.summary.version;
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
  /**
   * Unlocking a hint (ROADMAP P7-1).
   *
   * Optimistic on purpose: the rung appears on the click, and the POST records
   * it. If that request fails the hint stays open for this sitting and the
   * server simply never heard - which costs the user nothing, where the
   * alternative (waiting for the answer, or rolling back on failure) takes back
   * text they have already read.
   */
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
   * a Python editor would be restoring a syntax error - and so it is refused
   * while the judge is working (P4-15), for the same reason the language
   * switch is: the run in flight belongs to the language that started it.
   */
  const restoreSubmission = useCallback(
    (submission: Submission) => {
      if (submission.language === language) {
        setCode(submission.code);
        return;
      }
      if (busy) return;
      setRestoring({ source: `${slug}:${submission.language}`, code: submission.code });
      setChosen(submission.language);
    },
    [language, slug, busy],
  );

  /*
   * Stable identity, because the Coach panel is memoised (ROADMAP P4-13).
   *
   * The code is read from `codeNow` at the moment of asking rather than closed
   * over (P4-15), which also means this no longer changes on every keystroke -
   * so neither does the coach panel built from it.
   */
  const askCoach = useCallback(
    (options: { masteryCheck?: boolean; newConversation?: boolean } = {}) => {
      setLeftTab('coach');
      setOfferMastery(false);
      coachAsk({ slug, language, code: codeNow.current, revealedHints, interviewMode, ...options });
    },
    [coachAsk, slug, language, revealedHints, interviewMode],
  );

  /*
   * Bound while the problem is on screen, busy or not (P4-15). A no-op while
   * the judge is working, rather than unbound: unbound, the keys fell through
   * to Monaco, whose own Ctrl+Enter inserts a line.
   */
  useShortcut(
    'run',
    () => {
      if (!busy) judge('run');
    },
    ready,
  );
  useShortcut(
    'submit',
    () => {
      if (!busy) judge('submit');
    },
    ready,
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

  const jumpToLine = useCallback((compileError: CompileError) => {
    if (compileError.line !== undefined) {
      editorRef.current?.revealPosition(compileError.line, compileError.column);
    }
  }, []);

  const onStatementRatio = useCallback(
    (next: number) => {
      setLayout({ statement: next });
    },
    [setLayout],
  );
  const onEditorRatio = useCallback(
    (next: number) => {
      setLayout({ editor: next });
    },
    [setLayout],
  );

  if (isPending) return <WorkspaceSkeleton />;
  if (error) {
    return (
      <div className="py-4 pr-4 pl-3">
        <Card>
          <ErrorState
            className="p-0"
            title="This problem could not load."
            error={error}
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  const failure = flow.failure;
  const status = problem.summary.statusByLanguage[language] ?? 'not_started';

  const resetToStarter = () => {
    const starter = problem.starters[language];
    // Dropped before the DELETE, not after: a pending autosave, or a retry of
    // a failed one, that landed second would restore the draft this is
    // deleting (P4-11).
    discardDraft();
    setCode(starter);
    setPersisted(starter);
    deleteDraft.mutate({ slug, language });
    setConfirmingReset(false);
  };

  /*
   * One line beside the toolbar for both kinds of news about saving: a draft
   * that did not save outranks a note about formatting, because it is the one
   * the user has to know about (P4-14).
   */
  const saveNote = draftRetrying
    ? {
        text: 'Not saved — retrying',
        title: draftError ? `Not saved: ${draftError.message}. Retrying.` : undefined,
        failed: true,
      }
    : formatNote?.code === code
      ? { text: formatNote.text, title: formatNote.text, failed: formatNote.failed }
      : null;

  const editor = (
    <Card as="div" padding="none" className="min-h-0 w-full overflow-hidden" data-testid="editor">
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
            onChange={onEditorChange}
            prefs={editorPrefs}
            theme={theme}
            markers={result?.compileErrors ?? NO_MARKERS}
            onFormat={formatter ? formatDocument : undefined}
          />
        </Suspense>
      </ErrorBoundary>
    </Card>
  );

  const bottomPanel = (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        setTab(next as 'testcases' | 'results');
        if (layout.panelCollapsed) setLayout({ panelCollapsed: false });
      }}
      className="bg-surface border-border shadow-card flex min-h-0 w-full flex-col overflow-hidden rounded-xl border"
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
          <TabsContent value="testcases" className="min-h-0 flex-1 relative overflow-y-auto pt-0">
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
              <Callout role="status" className="mx-3 mt-3 flex shrink-0 items-center gap-3 py-2">
                <CoachMark />
                <p className="text-fg flex-1 text-sm">
                  Accepted. Ask the coach whether this is interview-ready?
                </p>
                <Button
                  size="sm"
                  variant="primary-outline"
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
              </Callout>
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
    <div className="flex min-h-0 w-full flex-col gap-3">
      <div className="flex min-h-0 flex-1">{editor}</div>
      <div className="flex shrink-0">{bottomPanel}</div>
    </div>
  ) : (
    <SplitPane
      direction="column"
      ratio={layout.editor}
      onRatio={onEditorRatio}
      label="Editor and results"
      className="w-full flex-1"
      first={editor}
      second={bottomPanel}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 py-4 pr-4 pl-3">
      {/*
        The toolbar, on the canvas above the cards (DESIGN.md 8). Left: the
        conditions you are working under - language, reset, format, bookmark,
        interview mode - and the status. Right: the loop, Run then Submit, then
        AI Help. One filled pill in the row: Submit.
      */}
      <header className="flex h-8 shrink-0 items-center gap-2">
        <Segmented
          label="Language"
          tray="surface"
          options={LANGUAGES.map((option) => ({
            value: option,
            label: LANGUAGE_LABEL[option],
            /*
              Locked while the judge is working (P4-11). The run in flight is
              for the language that started it, and a switch mid-run puts the
              user in front of one language's editor waiting for the other
              language's verdict.
            */
            disabled: busy && language !== option,
          }))}
          value={language}
          onChange={(option) => {
            setChosen(option);
            updateSettings.mutate({ lastLanguage: option });
          }}
        />

        <span className="bg-border mx-1 h-4 w-px" aria-hidden />

        <Button
          variant="secondary"
          onClick={() => {
            setConfirmingReset(true);
          }}
        >
          <RotateCcw aria-hidden size={14} strokeWidth={1.5} />
          Reset
        </Button>

        {/*
          Format (P9-5). Only where this language's formatter was found on the
          machine: a button that can only ever say "not installed" is a
          setting pretending to be an action, and Settings is where the
          installing is explained.
        */}
        {formatter && (
          <Tooltip content={`Format with ${formatter.name}`} keys={FORMAT_KEYS}>
            <Button
              variant="secondary"
              disabled={formatting}
              onClick={() => {
                // Back to the code: the next thing anyone does after formatting
                // is read it or undo it, and Ctrl+Z on a focused button undoes
                // nothing (found by e2e/format.spec.ts).
                editorRef.current?.focus();
                formatDocument();
              }}
            >
              <WandSparkles aria-hidden size={14} strokeWidth={1.5} />
              {formatting ? 'Formatting…' : 'Format'}
            </Button>
          </Tooltip>
        )}

        {/*
          Starring a problem (P7-7). Beside Reset because it is about this
          problem rather than about the code: a bookmark says "come back to
          this one", which the command palette and the list filter both read.
          The star fills when it is on - a shape, beside a word that changes.
        */}
        <Button
          variant="secondary"
          aria-pressed={problem.summary.bookmarked}
          onClick={() => {
            setBookmark.mutate({ slug, bookmarked: !problem.summary.bookmarked });
          }}
        >
          <Star
            aria-hidden
            size={14}
            strokeWidth={1.5}
            className={cn(problem.summary.bookmarked && 'fill-current')}
          />
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
          the reward (docs/DESIGN.md 3). The region is rendered even while it
          is empty, because a live region inserted at the same moment as its
          text is a live region that announces nothing.
        */}
        <p className="ml-2 flex items-center" role="status" data-testid="problem-status">
          {status !== 'not_started' && (
            <StatusMark status={status} label={statusLine(status, language)} />
          )}
        </p>

        {/* Rendered while empty, for the same reason as the status above. */}
        <p
          className={cn(
            'min-w-0 truncate text-xs',
            saveNote?.failed === true ? 'text-danger-fg' : 'text-fg-muted',
          )}
          role="status"
          data-testid="format-note"
          title={saveNote?.title}
        >
          {saveNote?.text ?? ''}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip content="Run the samples and your own cases" keys={SHORTCUTS.run.keys}>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                judge('run');
              }}
            >
              {flow.running ? 'Running…' : 'Run'}
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
              {flow.submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </Tooltip>
          {/*
            An outlined pill, not a filled one: Run and Submit are the loop, and
            AI Help is the thing you reach for when the loop is not working. It
            is also the only control here that spends money, which is a second
            reason not to make it the most clickable thing on the bar (D13). Its
            keys are on the pill itself (DESIGN.md 9), hidden from its name - at
            every width, since P9-7 made room at 1024 by shortening Interview
            mode to its icon instead.
          */}
          <Tooltip
            content={`Ask the coach about the code you have written · about ${costEstimate}`}
            keys={SHORTCUTS.aiHelp.keys}
          >
            <Button
              variant="primary-outline"
              disabled={coachState.phase === 'streaming'}
              onClick={() => {
                askCoach();
              }}
            >
              <CoachMark />
              AI Help
              <Keys keys={SHORTCUTS.aiHelp.keys} />
            </Button>
          </Tooltip>
        </div>
      </header>

      {/*
        Version drift (ROADMAP P7-9).

        The status does not move for this - D11's ratchet stands, and quietly
        un-solving somebody's problem because a generator seed changed would be
        exactly the automatic demotion that rule exists to forbid. What it gets
        instead is a sentence saying the bar moved and a button that finds out.
        Re-verify is an ordinary submit of the last accepted code, so it can
        fail, and a failure is recorded and demotes nothing.
      */}
      {drifted && (
        <div className="bg-warn-subtle flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5">
          <p className="text-fg text-xs">
            Solved against v{problem.summary.solvedVersion}; the tests are now v
            {problem.summary.version}.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            disabled={flow.reVerifying || busy}
            onClick={flow.reVerify}
          >
            {flow.reVerifying ? 'Re-verifying…' : `Re-verify in ${LANGUAGE_LABEL[language]}`}
          </Button>
        </div>
      )}

      {flow.reVerifyError && (
        <p className="text-danger-fg shrink-0 px-1 text-xs" role="alert">
          {flow.reVerifyError.message}
        </p>
      )}

      {/*
        Review mode says so (P7-8). A screen that has quietly removed two tabs
        without explaining itself is a screen that looks broken - and the way
        out has to be on it, because the only other one is editing the URL.
      */}
      {reviewing && (
        <div className="bg-surface border-border flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5">
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
        onRatio={onStatementRatio}
        label="Statement and editor"
        className="flex-1"
        first={
          <Card as="div" padding="none" className="flex min-h-0 w-full overflow-hidden">
            <StatementPanel
              problem={problem}
              tab={leftTab}
              onTab={setLeftTab}
              revealedHints={revealedHints}
              onRevealHint={onRevealHint}
              language={language}
              code={code}
              hideAssistance={hideAssistance}
              languageLocked={busy}
              onRestore={restoreSubmission}
              coach={coachPanel}
            />
          </Card>
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
