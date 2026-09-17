import { Suspense, lazy, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  LANGUAGES,
  LANGUAGE_LABEL,
  VERDICT_LABEL,
  isAccepted,
  type Language,
  type RunResult,
  type TestResult,
  type Verdict,
} from '@devpromax/shared';
import { useJudge, useProblem } from '../api/hooks.js';
import { Button, cn } from '../ui/index.js';

/**
 * The problem workspace (ROADMAP P4-1).
 *
 * The walking skeleton: statement on the left, editor on the right, Run and
 * Submit underneath, results below that. Throwaway styling was allowed here, but
 * the structure is not throwaway - P4-6 replaces the layout with a resizable
 * split and tabs, and P4-3 renders the statement as markdown instead of showing
 * it raw, but both build on this arrangement rather than replacing it.
 */

// Monaco is about three megabytes. The list page must not pay for it.
const CodeEditor = lazy(() => import('../editor/CodeEditor.js'));

const VERDICT_TONE: Record<Verdict, string> = {
  AC: 'text-success-fg',
  WA: 'text-danger-fg',
  RE: 'text-danger-fg',
  CE: 'text-danger-fg',
  TLE: 'text-warn-fg',
  MLE: 'text-warn-fg',
};

function TestRow({ test }: { test: TestResult }) {
  return (
    <tr className="border-border border-b align-top">
      <td className="tnum px-2 py-1 text-xs">{test.index + 1}</td>
      <td className="text-fg-muted px-2 py-1 text-xs">{test.source}</td>
      <td className={cn('px-2 py-1 text-xs font-medium', VERDICT_TONE[test.verdict])}>
        {test.verdict}
      </td>
      <td className="tnum text-fg-muted px-2 py-1 text-xs">{Math.round(test.timeMs)} ms</td>
      <td className="px-2 py-1 font-mono text-2xs">
        {test.revealed && test.expected !== undefined ? JSON.stringify(test.expected) : ''}
      </td>
      <td className="px-2 py-1 font-mono text-2xs">
        {test.revealed && test.actual !== undefined ? JSON.stringify(test.actual) : ''}
      </td>
      <td className="text-fg-muted px-2 py-1 text-2xs">{test.message ?? ''}</td>
    </tr>
  );
}

function Results({ result }: { result: RunResult }) {
  return (
    <section className="border-border border-t p-4" data-testid="results">
      <p className={cn('text-sm font-semibold', VERDICT_TONE[result.verdict])}>
        <span data-testid="verdict">{VERDICT_LABEL[result.verdict]}</span>{' '}
        <span className="text-fg-muted tnum font-normal">
          {result.passed}/{result.total} tests · {Math.round(result.totalTimeMs)} ms
        </span>
      </p>

      {result.compileErrors.length > 0 && (
        <pre className="text-danger-fg mt-2 overflow-x-auto text-xs">
          {result.compileErrors
            .map((error) => `${error.line ? `line ${error.line}: ` : ''}${error.message}`)
            .join('\n')}
        </pre>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-fg-muted border-border border-b text-2xs">
              <th className="px-2 py-1 font-medium">#</th>
              <th className="px-2 py-1 font-medium">Source</th>
              <th className="px-2 py-1 font-medium">Verdict</th>
              <th className="px-2 py-1 font-medium">Time</th>
              <th className="px-2 py-1 font-medium">Expected</th>
              <th className="px-2 py-1 font-medium">Actual</th>
              <th className="px-2 py-1 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {result.tests.map((test) => (
              <TestRow key={test.index} test={test} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Workspace() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: problem, isPending, error } = useProblem(slug);

  const [language, setLanguage] = useState<Language>('python');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);

  const run = useJudge('run');
  const submit = useJudge('submit');
  const busy = run.isPending || submit.isPending;

  // The editor starts from the saved draft if there is one, and from the starter
  // otherwise, and resets when the problem or the language changes.
  //
  // Adjusted during render rather than in an effect. React documents this as the
  // way to reset state when a prop changes: an effect would render the old
  // language's code once, then immediately render again, and the editor would
  // flash the wrong source in between.
  const source = problem ? `${problem.summary.slug}:${language}` : '';
  const [loadedFrom, setLoadedFrom] = useState(source);
  if (problem && loadedFrom !== source) {
    setLoadedFrom(source);
    setCode(problem.drafts[language]?.code ?? problem.starters[language]);
    setResult(null);
  }

  if (isPending) return <p className="text-fg-muted p-6 text-sm">Loading…</p>;
  if (error) return <p className="text-danger-fg p-6 text-sm">{error.message}</p>;

  const judge = (mutation: typeof run) => {
    mutation.mutate(
      { slug, language, code },
      {
        onSuccess: (next) => {
          setResult(next);
        },
      },
    );
  };

  const failure = run.error ?? submit.error;

  return (
    <div className="flex h-screen flex-col">
      <header className="border-border flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-baseline gap-3">
          <Link to="/" className="focus-ring text-fg-muted hover:text-fg rounded-xs text-sm">
            Problems
          </Link>
          <h1 className="text-lg font-semibold">{problem.summary.title}</h1>
          <span className="text-fg-subtle text-xs">
            {problem.summary.tier} · rating {problem.summary.rating}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="Language">
            {LANGUAGES.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={language === option ? 'primary' : 'ghost'}
                aria-pressed={language === option}
                onClick={() => {
                  setLanguage(option);
                }}
              >
                {LANGUAGE_LABEL[option]}
              </Button>
            ))}
          </div>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              judge(run);
            }}
          >
            {run.isPending ? 'Running…' : 'Run'}
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              judge(submit);
            }}
          >
            {submit.isPending ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="border-border w-2/5 overflow-y-auto border-r p-4">
          {/* Raw markdown until P4-3 brings the renderer. */}
          <pre className="text-fg font-sans text-sm whitespace-pre-wrap">{problem.statement}</pre>
        </section>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1" data-testid="editor">
            <Suspense fallback={<p className="text-fg-muted p-4 text-sm">Loading the editor…</p>}>
              <CodeEditor value={code} language={language} onChange={setCode} />
            </Suspense>
          </div>

          <div className="max-h-[45%] overflow-y-auto">
            {failure && (
              <p className="text-danger-fg border-border border-t p-4 text-sm">{failure.message}</p>
            )}
            {result && <Results result={result} />}
            {result && isAccepted(result.verdict) && result.kind === 'submit' && (
              <p className="text-success-fg px-4 pb-4 text-sm" data-testid="solved">
                Solved in {LANGUAGE_LABEL[language]}.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
