import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunResult, TestResult } from '@devpromax/shared';
import { ResultsPanel } from './ResultsPanel.js';

/**
 * The results panel (ROADMAP P4-7).
 *
 * The assertions worth keeping are about what the panel *reveals*: a hidden test
 * that passed must not leak its input, a compile error has to be clickable, and
 * the three shapes a result can take - a return value, mutated arguments, a
 * sequence of calls - each have to be readable as themselves.
 */

function aTest(overrides: Partial<TestResult> = {}): TestResult {
  return {
    index: 0,
    source: 'sample',
    verdict: 'AC',
    timeMs: 3,
    revealed: true,
    stdout: '',
    stderr: '',
    ...overrides,
  };
}

function aResult(overrides: Partial<RunResult> = {}): RunResult {
  const tests = overrides.tests ?? [aTest()];
  return {
    slug: 'pair-sum-index',
    language: 'python',
    kind: 'submit',
    problemVersion: 1,
    verdict: 'AC',
    passed: tests.filter((test) => test.verdict === 'AC').length,
    total: tests.length,
    totalTimeMs: 120,
    compileErrors: [],
    outputTruncated: false,
    isolationFallback: false,
    ...overrides,
    tests,
  };
}

describe('the verdict banner', () => {
  it('names the verdict and the tally', () => {
    render(<ResultsPanel result={aResult({ passed: 1, total: 1, totalTimeMs: 118 })} />);

    expect(screen.getByTestId('verdict')).toHaveTextContent('Accepted');
    expect(screen.getByText('1/1 tests · 118 ms')).toBeInTheDocument();
  });

  it('warns when a timeout forced the judge to isolate the remaining tests', () => {
    render(<ResultsPanel result={aResult({ verdict: 'TLE', isolationFallback: true })} />);

    expect(screen.getByText(/re-run one process each/)).toBeInTheDocument();
  });
});

describe('failures', () => {
  const failing = aResult({
    verdict: 'WA',
    tests: [
      aTest({ index: 0, expected: [0, 1], actual: [0, 1] }),
      aTest({ index: 1, verdict: 'WA', expected: [1, 2], actual: [1, 3] }),
      aTest({ index: 2, verdict: 'WA', expected: [4, 5], actual: [4, 6] }),
    ],
  });

  it('opens on the first failure rather than on test one', () => {
    render(<ResultsPanel result={failing} />);

    expect(screen.getByTestId('first-difference')).toHaveTextContent('[1]');
  });

  it('says where the two values part company', () => {
    render(<ResultsPanel result={failing} />);

    const summary = screen.getByTestId('first-difference');
    expect(summary).toHaveTextContent('expected 2');
    expect(summary).toHaveTextContent('got 3');
  });

  it('steps between failures from the keyboard', async () => {
    render(<ResultsPanel result={failing} />);

    // From the second test (the first failure) to the third.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next failure' }));
    expect(screen.getByTestId('first-difference')).toHaveTextContent('expected 5');
    expect(screen.getByTestId('first-difference')).toHaveTextContent('got 6');
  });
});

describe('hidden tests', () => {
  it('does not show the input of a hidden test that passed', () => {
    render(
      <ResultsPanel
        result={aResult({
          tests: [aTest({ source: 'hidden', revealed: false })],
        })}
      />,
    );

    expect(screen.getByText(/its input stays hidden/)).toBeInTheDocument();
  });
});

describe('compile errors', () => {
  it('lists them and jumps to the line when one is clicked', async () => {
    const onJumpToLine = vi.fn();
    render(
      <ResultsPanel
        onJumpToLine={onJumpToLine}
        result={aResult({
          verdict: 'CE',
          tests: [],
          compileErrors: [
            { line: 7, column: 13, message: 'cannot find symbol', severity: 'error' },
          ],
        })}
      />,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: /cannot find symbol/ }));
    expect(onJumpToLine).toHaveBeenCalledWith(expect.objectContaining({ line: 7, column: 13 }));
  });
});

describe('the three result shapes', () => {
  it('shows mutated arguments as "after the call"', () => {
    render(
      <ResultsPanel
        result={aResult({
          verdict: 'WA',
          tests: [
            aTest({
              verdict: 'WA',
              expectedMutatedArgs: [{ index: 0, value: [3, 1, 2] }],
              actualMutatedArgs: [{ index: 0, value: [1, 2, 3] }],
            }),
          ],
        })}
      />,
    );

    expect(screen.getByText('Argument 1 after the call')).toBeInTheDocument();
  });

  it('shows an operations result one call per row, marking the wrong ones', () => {
    render(
      <ResultsPanel
        result={aResult({
          verdict: 'WA',
          tests: [
            aTest({
              verdict: 'WA',
              input: {
                args: [],
                ops: [
                  { method: 'push', args: [3] },
                  { method: 'smallest', args: [] },
                ],
              },
              expected: [null, 3],
              actual: [null, 7],
            }),
          ],
        })}
      />,
    );

    const table = screen.getByRole('table');
    expect(within(table).getByText('push(3)')).toBeInTheDocument();
    expect(within(table).getByText('smallest()')).toBeInTheDocument();
  });

  it('offers stdout behind a disclosure rather than in the way', async () => {
    render(
      <ResultsPanel
        result={aResult({
          verdict: 'WA',
          tests: [aTest({ verdict: 'WA', expected: 1, actual: 2, stdout: 'debugging\nnoise' })],
        })}
      />,
    );

    expect(screen.queryByText(/debugging/)).not.toBeVisible();
    await userEvent.setup().click(screen.getByText(/Standard output/));
    expect(screen.getByText(/debugging/)).toBeVisible();
  });
});
