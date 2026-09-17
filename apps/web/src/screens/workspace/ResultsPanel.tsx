import { useMemo, useState, type ReactNode } from 'react';
import {
  VERDICT_LABEL,
  isAccepted,
  type CompileError,
  type JsonValue,
  type MutatedArg,
  type RunResult,
  type TestResult,
} from '@devpromax/shared';
import { Button, cn } from '../../ui/index.js';
import { changedLines, firstDifference, formatValue } from './diff.js';
import { VERDICT_MARK, VERDICT_TONE } from './verdict.js';

/**
 * What the judge said (ROADMAP P4-7).
 *
 * The screen a user spends most of their failures looking at, so it is built
 * around one question: *which* test failed and *where*. A list of verdicts on
 * the left, the selected test's detail on the right, and the selection starts on
 * the first failure rather than on test 1 - nobody opens this panel to read
 * about the tests that passed.
 *
 * Every value is shown as JSON, in mono, exactly as the judge serialised it.
 * Prettifying a `[0, 1]` into "index 0 and index 1" would be inventing a second
 * notation the user then has to map back onto their own code.
 */

const SOURCE_LABEL = { sample: 'Sample', hidden: 'Hidden', custom: 'Custom' } as const;

// ---------------------------------------------------------------------------
// Value rendering
// ---------------------------------------------------------------------------

function ValueBlock({ lines, truncated }: { lines: readonly string[]; truncated: boolean }) {
  return (
    <>
      <pre className="text-fg overflow-x-auto font-mono text-2xs leading-5">
        {lines.length > 0 ? lines.join('\n') : '—'}
      </pre>
      {truncated && <p className="text-fg-subtle mt-1 text-2xs">…truncated for display.</p>}
    </>
  );
}

/**
 * Expected beside actual, with the lines that differ marked.
 *
 * Side by side rather than a unified diff: these are two values, not two
 * versions of a file, and "mine" and "the judge's" are easier to hold apart in
 * two columns than in one with `+` and `-` down the margin.
 */
function SideBySide({
  expected,
  actual,
  expectedLabel = 'Expected',
  actualLabel = 'Your output',
}: {
  expected: JsonValue | undefined;
  actual: JsonValue | undefined;
  expectedLabel?: string;
  actualLabel?: string;
}) {
  const left = formatValue(expected);
  const right = formatValue(actual);
  const changed = changedLines(left.lines, right.lines);
  const multiline = left.lines.length > 1 || right.lines.length > 1;

  const column = (label: string, lines: readonly string[], truncated: boolean) => (
    <div className="min-w-0 flex-1">
      <h4 className="text-fg-subtle mb-1 text-2xs font-medium tracking-wide uppercase">{label}</h4>
      {multiline ? (
        <div className="border-border bg-surface-sunken overflow-x-auto rounded-md border">
          {lines.map((line, index) => (
            <pre
              key={`${String(index)}:${line}`}
              className={cn(
                'px-2 font-mono text-2xs leading-5 whitespace-pre',
                changed[index] && 'bg-danger-subtle',
              )}
            >
              {line}
            </pre>
          ))}
          {truncated && (
            <p className="text-fg-subtle px-2 py-1 text-2xs">…truncated for display.</p>
          )}
        </div>
      ) : (
        <div className="border-border bg-surface-sunken rounded-md border px-2 py-1">
          <ValueBlock lines={lines} truncated={truncated} />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex gap-3">
      {column(expectedLabel, left.lines, left.truncated)}
      {column(actualLabel, right.lines, right.truncated)}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-fg-subtle mb-1 text-2xs font-medium tracking-wide uppercase">{label}</h4>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The three shapes a result can take
// ---------------------------------------------------------------------------

function byIndex(args: readonly MutatedArg[] | undefined): Map<number, JsonValue> {
  return new Map((args ?? []).map((arg) => [arg.index, arg.value]));
}

/** In-place problems: what each argument should look like after the call (D4). */
function MutatedArgsView({ test }: { test: TestResult }) {
  const expected = byIndex(test.expectedMutatedArgs);
  const actual = byIndex(test.actualMutatedArgs);
  const indexes = [...new Set([...expected.keys(), ...actual.keys()])].sort((a, b) => a - b);

  return (
    <>
      {indexes.map((index) => (
        <Field key={index} label={`Argument ${String(index + 1)} after the call`}>
          <SideBySide expected={expected.get(index)} actual={actual.get(index)} />
        </Field>
      ))}
    </>
  );
}

/**
 * Design problems: one row per call, so a mismatch is read as "the fourth
 * `pop()` returned the wrong thing" rather than as two long arrays that differ
 * somewhere (D4, `operations` mode).
 */
function OperationsView({ test }: { test: TestResult }) {
  const ops = test.input?.ops ?? [];
  const expected = Array.isArray(test.expected) ? test.expected : [];
  const actual = Array.isArray(test.actual) ? test.actual : [];

  return (
    <Field label="Calls">
      <div className="border-border overflow-x-auto rounded-md border">
        <table className="w-full text-left font-mono text-2xs">
          <thead>
            <tr className="text-fg-subtle border-border border-b font-sans">
              <th className="px-2 py-1 font-medium">#</th>
              <th className="px-2 py-1 font-medium">Call</th>
              <th className="px-2 py-1 font-medium">Expected</th>
              <th className="px-2 py-1 font-medium">Your output</th>
            </tr>
          </thead>
          <tbody>
            {ops.map((op, index) => {
              const mismatch =
                JSON.stringify(expected[index] ?? null) !== JSON.stringify(actual[index] ?? null);
              return (
                <tr
                  key={`${op.method}:${String(index)}`}
                  className={cn(
                    'border-border border-b last:border-b-0',
                    mismatch && 'bg-danger-subtle',
                  )}
                >
                  <td className="text-fg-subtle tnum px-2 py-1">{index + 1}</td>
                  <td className="px-2 py-1">
                    {op.method}({op.args.map((arg) => JSON.stringify(arg)).join(', ')})
                  </td>
                  <td className="px-2 py-1">{JSON.stringify(expected[index] ?? null)}</td>
                  <td className="px-2 py-1">{JSON.stringify(actual[index] ?? null)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Field>
  );
}

function Stream({ label, text }: { label: string; text: string }) {
  if (text === '') return null;
  return (
    <details className="border-border rounded-md border">
      <summary className="focus-ring-inset text-fg-muted cursor-pointer px-2 py-1 text-xs">
        {label} ({text.split('\n').length} lines)
      </summary>
      <pre className="text-fg-muted max-h-48 overflow-auto px-2 pb-2 font-mono text-2xs leading-5">
        {text}
      </pre>
    </details>
  );
}

function TestDetail({ test }: { test: TestResult }) {
  const difference = useMemo(
    () => (test.verdict === 'WA' ? firstDifference(test.expected, test.actual) : null),
    [test],
  );

  if (!test.revealed) {
    return (
      <div className="text-fg-muted p-4 text-sm">
        <p>
          This hidden test passed, so its input stays hidden. Only the first hidden test you fail is
          revealed.
        </p>
      </div>
    );
  }

  const isOperations = (test.input?.ops?.length ?? 0) > 0;
  const hasMutated =
    (test.expectedMutatedArgs?.length ?? 0) > 0 || (test.actualMutatedArgs?.length ?? 0) > 0;
  const hasReturn = test.expected !== undefined || test.actual !== undefined;

  return (
    <div className="flex flex-col gap-3 p-4">
      {test.message !== undefined && test.message !== '' && (
        <p className={cn('text-sm', VERDICT_TONE[test.verdict])}>{test.message}</p>
      )}

      {difference && (
        <p className="text-fg-muted text-xs" data-testid="first-difference">
          First difference at <code className="text-fg font-mono">{difference.path}</code>: expected{' '}
          <code className="text-success-fg font-mono">{difference.expected}</code>, got{' '}
          <code className="text-danger-fg font-mono">{difference.actual}</code>.
        </p>
      )}

      {test.input && (
        <Field label={isOperations ? 'Constructor arguments' : 'Input'}>
          <div className="border-border bg-surface-sunken rounded-md border px-2 py-1">
            <ValueBlock {...formatValue(test.input.args)} />
          </div>
        </Field>
      )}

      {isOperations ? (
        <OperationsView test={test} />
      ) : (
        hasReturn && (
          <Field label="Result">
            <SideBySide expected={test.expected} actual={test.actual} />
          </Field>
        )
      )}

      {hasMutated && <MutatedArgsView test={test} />}

      <Stream label="Standard output" text={test.stdout} />
      <Stream label="Standard error" text={test.stderr} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compile errors
// ---------------------------------------------------------------------------

function CompileErrors({
  errors,
  onJump,
}: {
  errors: readonly CompileError[];
  onJump?: (error: CompileError) => void;
}) {
  return (
    <ul className="flex flex-col gap-1 p-4" data-testid="compile-errors">
      {errors.map((error, index) => (
        <li key={`${String(error.line ?? 0)}:${String(index)}`}>
          {error.line !== undefined && onJump ? (
            <button
              type="button"
              className="focus-ring hover:bg-surface-sunken w-full rounded-md px-2 py-1 text-left"
              onClick={() => {
                onJump(error);
              }}
            >
              <span className="text-accent-fg tnum font-mono text-xs">
                line {error.line}
                {error.column === undefined ? '' : `:${String(error.column)}`}
              </span>{' '}
              <span className="text-danger-fg text-xs">{error.message}</span>
            </button>
          ) : (
            <p className="text-danger-fg px-2 py-1 text-xs">{error.message}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

function firstFailure(tests: readonly TestResult[]): number {
  const index = tests.findIndex((test) => !isAccepted(test.verdict));
  return index === -1 ? 0 : index;
}

export interface ResultsPanelProps {
  result: RunResult;
  /** Puts the caret on a compile error's line (P4-7). */
  onJumpToLine?: (error: CompileError) => void;
}

export function ResultsPanel({ result, onJumpToLine }: ResultsPanelProps) {
  const [selected, setSelected] = useState(() => firstFailure(result.tests));

  // A new run is a new set of tests; the selection follows the new first failure
  // rather than staying on whatever row happened to be at that index. Adjusted
  // during render rather than in an effect - React's documented way to reset
  // state when a prop changes, and one render instead of two.
  const [shownFor, setShownFor] = useState(result);
  if (shownFor !== result) {
    setShownFor(result);
    setSelected(firstFailure(result.tests));
  }

  const failures = result.tests
    .map((test, index) => ({ test, index }))
    .filter((entry) => !isAccepted(entry.test.verdict));

  const jumpFailure = (direction: 1 | -1) => {
    if (failures.length === 0) return;
    const at = failures.findIndex((entry) => entry.index >= selected);
    const current = at === -1 ? failures.length - 1 : at;
    const isOnFailure = failures[current]?.index === selected;
    const next = isOnFailure ? current + direction : direction === 1 ? current : current - 1;
    const wrapped = ((next % failures.length) + failures.length) % failures.length;
    setSelected(failures[wrapped]?.index ?? selected);
  };

  const current = result.tests[selected];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="results">
      <header className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <span
          aria-hidden
          className={cn('size-2 shrink-0 rounded-full', VERDICT_MARK[result.verdict])}
        />
        <p className={cn('text-sm font-semibold', VERDICT_TONE[result.verdict])}>
          <span data-testid="verdict">{VERDICT_LABEL[result.verdict]}</span>
        </p>
        <p className="text-fg-muted tnum text-xs">
          {result.passed}/{result.total} tests · {Math.round(result.totalTimeMs)} ms
          {result.compileTimeMs !== undefined &&
            ` · compiled in ${String(Math.round(result.compileTimeMs))} ms`}
        </p>

        {failures.length > 1 && (
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                jumpFailure(-1);
              }}
            >
              Previous failure
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                jumpFailure(1);
              }}
            >
              Next failure
            </Button>
          </div>
        )}
      </header>

      {result.isolationFallback && (
        <p className="text-warn-fg border-border border-b px-4 py-1 text-xs">
          A test ran out of time, so the rest were re-run one process each. Timings below are from
          that second pass.
        </p>
      )}
      {result.outputTruncated && (
        <p className="text-fg-muted border-border border-b px-4 py-1 text-xs">
          Your code printed more than the judge keeps; the output below was cut short.
        </p>
      )}

      {result.verdict === 'CE' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CompileErrors
            errors={result.compileErrors}
            {...(onJumpToLine ? { onJump: onJumpToLine } : {})}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ul
            className="border-border w-44 shrink-0 overflow-y-auto border-r"
            aria-label="Test results"
          >
            {result.tests.map((test, index) => (
              <li key={test.index}>
                <button
                  type="button"
                  aria-current={index === selected}
                  className={cn(
                    'focus-ring-inset border-border flex w-full items-center gap-2 border-b px-3 py-1.5 text-left',
                    index === selected ? 'bg-surface-sunken' : 'hover:bg-surface-sunken',
                  )}
                  onClick={() => {
                    setSelected(index);
                  }}
                >
                  <span
                    aria-hidden
                    className={cn('size-1.5 shrink-0 rounded-full', VERDICT_MARK[test.verdict])}
                  />
                  <span className="text-fg tnum text-xs">
                    {SOURCE_LABEL[test.source]} {index + 1}
                  </span>
                  <span className={cn('ml-auto text-2xs font-medium', VERDICT_TONE[test.verdict])}>
                    {test.verdict}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="min-w-0 flex-1 overflow-y-auto">
            {current ? (
              <TestDetail test={current} />
            ) : (
              <p className="text-fg-muted p-4 text-sm">This run produced no tests.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
