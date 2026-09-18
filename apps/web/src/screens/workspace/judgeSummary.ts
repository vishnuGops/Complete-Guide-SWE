import { VERDICT_LABEL, type RunResult, type TestResult } from '@devpromax/shared';

/**
 * What the judge alone can tell you (ROADMAP P5-6).
 *
 * The coach is optional - it needs a key, and it costs money. This is the floor
 * underneath it: everything that can be said about a failed run without asking
 * anyone, derived from the result already on screen.
 *
 * It is deliberately not an imitation of the coach. It makes no judgement about
 * the approach, offers no hint, and says nothing it cannot prove from the
 * result. A local heuristic pretending to be advice would be worse than saying
 * nothing, because the user cannot tell which one they are reading.
 */

/** Past this fraction of the limit, a pass is close enough to worry about. */
const NEAR_TIMEOUT = 0.5;

export function judgeSummary(result: RunResult, timeoutMs: number | undefined): string[] {
  const points: string[] = [];
  const failures = result.tests.filter((test) => test.verdict !== 'AC');

  if (result.verdict === 'CE') {
    const first = result.compileErrors[0];
    points.push(
      first?.line === undefined
        ? 'It did not compile. The compiler output is above.'
        : `It did not compile. The first error is on line ${first.line}.`,
    );
    return points;
  }

  if (result.verdict === 'TLE') {
    points.push(
      `A test hit the ${formatMs(timeoutMs)} limit. That is usually a complexity problem rather than a slow line.`,
    );
  }

  if (result.verdict === 'MLE') {
    points.push('It ran out of memory, which usually means an unbounded structure or recursion.');
  }

  if (result.verdict === 'RE') {
    const message = failures.find((test) => test.message)?.message;
    points.push(
      message === undefined ? 'It threw an exception.' : `It threw: ${firstLine(message)}`,
    );
  }

  if (failures.length > 0 && result.verdict === 'WA') {
    points.push(`${failures.length} of ${result.total} tests disagreed with the expected output.`);

    const shape = describeShape(failures);
    if (shape) points.push(shape);
  }

  // A pass that is close to the limit is worth saying, because it is the one
  // thing a green result hides: the next-largest hidden test may not pass.
  if (result.verdict === 'AC' && timeoutMs !== undefined) {
    const slowest = result.tests.reduce((max, test) => Math.max(max, test.timeMs), 0);
    if (slowest > timeoutMs * NEAR_TIMEOUT) {
      points.push(
        `Accepted, but the slowest test took ${Math.round(slowest)} ms of the ${formatMs(timeoutMs)} limit. A larger input might not make it.`,
      );
    }
  }

  return points;
}

/**
 * A pattern across the failures - but only one, and only because it is provable.
 *
 * "Every failing case returned the same value" is a fact about the data: it is
 * either true of the results on screen or it is not. A first draft also tried
 * "every failing input is empty or minimal", and that was dropped rather than
 * tuned - whether `target = 0` counts as minimal depends on the problem, and a
 * rule that has to guess is the local heuristic pretending to be a coach, which
 * is the one thing this file exists not to do.
 */
function describeShape(failures: readonly TestResult[]): string | null {
  const revealed = failures.filter((test) => test.revealed);
  if (revealed.length < 2) return null;

  const first = JSON.stringify(revealed[0]?.actual);
  const sameActual = revealed.every((test) => JSON.stringify(test.actual) === first);

  return sameActual ? `Every failing case returned the same value, ${first}.` : null;
}

function firstLine(text: string): string {
  return text.split('\n')[0] ?? text;
}

function formatMs(ms: number | undefined): string {
  if (ms === undefined) return 'time';
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s` : `${ms} ms`;
}

/** Verdict plus counts, for the line above the points. */
export function judgeHeadline(result: RunResult): string {
  return `${VERDICT_LABEL[result.verdict]} — ${result.passed}/${result.total} tests passed.`;
}
