import { memo, useMemo, useState, type ReactNode } from 'react';
import {
  VERDICT_LABEL,
  isAccepted,
  type CompileError,
  type JsonValue,
  type MutatedArg,
  type RunResult,
  type TestResult,
} from '@devpromax/shared';
import { Button, VerdictTile, cn } from '../../ui/index.js';
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
      <pre className="text-fg overflow-x-auto font-mono text-xs leading-5">
        {lines.length > 0 ? lines.join('\n') : '—'}
      </pre>
      {truncated && <p className="text-fg-subtle mt-1 text-xs">…truncated for display.</p>}
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
      {/*
        A paragraph, not an `h4` (ROADMAP P4-13). "Expected" and "Actual" label
        the two columns beside them; they are not a level of the document, and
        an `h4` under the workspace's `h1` was a two-level jump that a screen
        reader reads as missing structure.
      */}
      <p className="text-fg-muted mb-1 text-xs font-medium">{label}</p>
      {multiline ? (
        <div className="border-border bg-surface-sunken overflow-x-auto rounded-md border">
          {lines.map((line, index) => (
            <pre
              key={`${String(index)}:${line}`}
              className={cn(
                'px-2 font-mono text-xs leading-5 whitespace-pre',
                changed[index] && 'bg-danger-subtle',
              )}
            >
              {line}
            </pre>
          ))}
          {truncated && <p className="text-fg-subtle px-2 py-1 text-xs">…truncated for display.</p>}
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
      {/*
        A paragraph, not an `h4` (ROADMAP P4-13). "Expected" and "Actual" label
        the two columns beside them; they are not a level of the document, and
        an `h4` under the workspace's `h1` was a two-level jump that a screen
        reader reads as missing structure.
      */}
      <p className="text-fg-muted mb-1 text-xs font-medium">{label}</p>
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
/**
 * How many call rows to draw (ROADMAP P4-13).
 *
 * Values are capped at 6 KB for display (`diff.ts`), but the call table was
 * not - so a design problem with two thousand operations drew two thousand
 * rows, which is slow to lay out and useless to read. The first mismatch is
 * what matters, and it is always near the top of what is shown because the
 * table is in call order.
 */
const MAX_OP_ROWS = 60;

function OperationsView({ test }: { test: TestResult }) {
  const allOps = test.input?.ops ?? [];
  const expected = Array.isArray(test.expected) ? test.expected : [];
  const actual = Array.isArray(test.actual) ? test.actual : [];

  const mismatchAt = allOps.findIndex(
    (_op, index) =>
      JSON.stringify(expected[index] ?? null) !== JSON.stringify(actual[index] ?? null),
  );

  /*
   * A window that always contains the first mismatch.
   *
   * Showing the first sixty rows would hide the only interesting one when the
   * sequence is long and the failure is late, so the window starts a few calls
   * before it.
   */
  const start =
    mismatchAt > MAX_OP_ROWS - 10 ? Math.min(mismatchAt - 10, allOps.length - MAX_OP_ROWS) : 0;
  const ops = allOps.slice(start, start + MAX_OP_ROWS);
  const hidden = allOps.length - ops.length;

  return (
    <Field label="Calls">
      <div className="border-border overflow-x-auto rounded-md border">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="text-fg-subtle border-border border-b font-sans">
              <th className="px-2 py-1 font-medium">#</th>
              <th className="px-2 py-1 font-medium">Call</th>
              <th className="px-2 py-1 font-medium">Expected</th>
              <th className="px-2 py-1 font-medium">Your output</th>
            </tr>
          </thead>
          <tbody>
            {ops.map((op, offset) => {
              const index = start + offset;
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
      {hidden > 0 && (
        <p className="text-fg-subtle mt-1 text-xs">
          {`Showing calls ${String(start + 1)}–${String(start + ops.length)} of ${String(allOps.length)}.`}
        </p>
      )}
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
      <pre className="text-fg-muted max-h-48 relative overflow-auto px-2 pb-2 font-mono text-xs leading-5">
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
        hasReturn && <SideBySide expected={test.expected} actual={test.actual} />
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

function ResultsPanelBody({ result, onJumpToLine }: ResultsPanelProps) {
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
      {/*
        The verdict line leads with a verdict tile (P9-6, DESIGN.md 8): the
        verdict's tint and glyph, then the verdict in words - so it is read by
        shape and word as well as by colour.
      */}
      <header className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        <VerdictTile verdict={result.verdict} />
        {/* The loudest words on the screen after a run (P9-6): the verdict leads its card. */}
        <p className={cn('text-lg font-semibold whitespace-nowrap', VERDICT_TONE[result.verdict])}>
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
        <div className="min-h-0 flex-1 relative overflow-y-auto">
          <CompileErrors
            errors={result.compileErrors}
            {...(onJumpToLine ? { onJump: onJumpToLine } : {})}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ul
            className="border-border w-44 shrink-0 relative overflow-y-auto border-r"
            aria-label="Test results"
          >
            {result.tests.map((test, index) => (
              <li key={test.index}>
                <button
                  type="button"
                  aria-current={index === selected}
                  /*
                   * The test being read: the selected step, a 2px accent bar
                   * and a heavier label - three signals, none of them only a
                   * tint (P9-6; the sunken grey this replaces was 1.03:1).
                   */
                  className={cn(
                    'focus-ring-inset border-border flex w-full items-center gap-2 border-b border-l-2 py-1.5 pr-3 pl-2.5 text-left',
                    index === selected
                      ? 'bg-surface-selected border-l-accent font-semibold'
                      : 'hover:bg-surface-sunken border-l-transparent',
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
                  <span className={cn('ml-auto text-xs font-medium', VERDICT_TONE[test.verdict])}>
                    {test.verdict}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/*
            Focusable, because it scrolls (ROADMAP P4-13).
            A pane whose only content is text - a diff, a traceback - cannot be
            scrolled from the keyboard unless it can hold focus, so someone who
            does not use a mouse could read the first screenful of a failure and
            no more. Found by the axe pass this task added, which is the first
            one that audits the panel after a run.
          */}
          <div
            className="focus-ring-inset min-w-0 flex-1 relative overflow-y-auto"
            tabIndex={0}
            role="group"
            aria-label="Selected test"
          >
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

/**
 * Memoised (ROADMAP P4-18). It sits under the editor and every keystroke
 * re-renders the workspace, while what it shows only changes when a verdict
 * arrives - so the caller keeps `onJumpToLine` stable and this skips the rest.
 */
export const ResultsPanel = memo(ResultsPanelBody);
