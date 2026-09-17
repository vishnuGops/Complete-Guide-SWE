import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  LANGUAGES,
  LANGUAGE_LABEL,
  customTestShapeFrom,
  editorPrefsSchema,
  isAccepted,
  parseCustomTests,
  type CompileError,
  type CustomTestInput,
  type Language,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  cn,
} from '../../ui/index.js';
import { ResultsPanel } from './ResultsPanel.js';
import { StatementPanel } from './StatementPanel.js';
import { SplitPane } from './SplitPane.js';
import { TestcasePanel } from './TestcasePanel.js';
import { useWorkspaceLayout } from './layout.js';

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
 * The AI Help button belongs beside Run and Submit and is not here yet - the
 * coach's streaming half arrives with P5-1, and `Ctrl+Shift+H` is in the
 * shortcut table waiting for it.
 */

// Monaco is about three megabytes. The list page must not pay for it.
const CodeEditor = lazy(() => import('../../editor/CodeEditor.js'));

const DEFAULT_EDITOR_PREFS = editorPrefsSchema.parse({});

/** How long after the last keystroke a draft is written. */
const AUTOSAVE_MS = 800;

export function Workspace() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: problem, isPending, error } = useProblem(slug);
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
  const [confirmingReset, setConfirmingReset] = useState(false);

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
        },
      },
    );
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

  if (isPending) return <p className="text-fg-muted p-6 text-sm">Loading…</p>;
  if (error) {
    return (
      <p className="text-danger-fg p-6 text-sm" role="alert">
        {error.message}
      </p>
    );
  }

  const failure = run.error ?? submit.error;
  const solved = result !== null && result.kind === 'submit' && isAccepted(result.verdict);

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
      <TabsList className="shrink-0 px-2">
        <TabsTrigger value="testcases">
          Testcases
          {customIssues.length > 0 && (
            <span className="text-danger-fg ml-1 text-2xs" aria-label="has errors">
              !
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>

        <Tooltip
          content={layout.panelCollapsed ? 'Show the panel' : 'Hide the panel'}
          keys={SHORTCUTS.togglePanel.keys}
        >
          <Button
            size="sm"
            variant="ghost"
            className="my-1 ml-auto"
            aria-expanded={!layout.panelCollapsed}
            onClick={() => {
              setLayout({ panelCollapsed: !layout.panelCollapsed });
            }}
          >
            {layout.panelCollapsed ? 'Show' : 'Hide'}
          </Button>
        </Tooltip>
      </TabsList>

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

        {solved && (
          <p className="text-success-fg ml-2 text-xs" data-testid="solved">
            Solved in {LANGUAGE_LABEL[language]}.
          </p>
        )}

        <div className="ml-auto flex items-center gap-2">
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
            <StatementPanel problem={problem} />
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
