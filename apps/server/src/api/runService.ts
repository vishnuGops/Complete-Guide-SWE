import {
  applyProgressEvent,
  checkCustomTest,
  customTestShape,
  initialProgress,
  isAccepted,
  MAX_CUSTOM_TESTS,
  type CustomTestIssue,
  type RunRequest,
  type RunResult,
  type TestCase,
} from '@devpromax/shared';
import { transaction, type Repositories } from '../db/index.js';
import { runProblem, type JudgeTest } from '../judge/index.js';
import { throwIfAborted } from '../judge/process.js';
import { loadProblemBySlug } from '../problems/loader.js';

/**
 * Run and Submit (ROADMAP P2-6).
 *
 * The two share a judge and differ in three ways that matter, all of them here
 * rather than spread across the routes that will call this:
 *
 *   Run     samples plus the user's own cases; nothing is persisted beyond the
 *           fact that they are working on the problem.
 *   Submit  samples plus every hidden test; the code, verdict, timing and the
 *           problem version it faced are recorded, and an accepted run promotes
 *           the problem to Solved.
 *
 * The hidden-test reveal policy - the first failing hidden test is shown, the
 * rest stay hidden - lives in the judge, because it has to apply to anything
 * that runs hidden tests, including the validator.
 */

/** Thrown when the slug in a request names no problem; routes map this to 404. */
export class ProblemNotFoundError extends Error {
  constructor(readonly slug: string) {
    super(`no problem with slug "${slug}"`);
    this.name = 'ProblemNotFoundError';
  }
}

/** Thrown when a custom case does not fit the problem; routes map this to 400. */
export class CustomTestError extends Error {
  constructor(readonly issues: (CustomTestIssue & { case: number })[]) {
    super(`custom test cases are not valid for this problem`);
    this.name = 'CustomTestError';
  }
}

/** Swapped out in tests so the service can be driven without an interpreter. */
export type JudgeFn = typeof runProblem;

export interface RunServiceOptions {
  repos: Repositories;
  judge?: JudgeFn;
  problemsRoot?: string;
  workspaceRoot?: string;
  /** The time recorded against whatever this run changes; defaults to now. */
  now?: string;
  /**
   * The request's lifetime (ROADMAP P2-17). Aborted when the client goes away,
   * which cancels the judge run and records nothing: a Submit whose verdict
   * nobody saw is not an attempt anybody made.
   */
  signal?: AbortSignal;
}

export async function executeRun(
  request: RunRequest,
  options: RunServiceOptions,
): Promise<RunResult> {
  const { repos } = options;
  const judge = options.judge ?? runProblem;

  // A Run never uses the hidden tests, and reading them is most of the cost of
  // loading a problem that has large ones - 1033 ms against 57 ms measured on
  // one (ROADMAP P2-18) - so it does not ask for them.
  const pkg = loadProblemBySlug(
    request.slug,
    options.problemsRoot,
    request.kind === 'run' ? { hidden: false } : {},
  );
  if (!pkg) throw new ProblemNotFoundError(request.slug);

  const customTests = request.kind === 'run' ? validateCustomTests(request, pkg) : [];
  const tests: JudgeTest[] = [
    ...pkg.tests.samples.map((test) => ({ source: 'sample' as const, test })),
    ...(request.kind === 'submit'
      ? pkg.tests.hidden.map((test) => ({ source: 'hidden' as const, test }))
      : customTests.map((test) => ({ source: 'custom' as const, test }))),
  ];

  const settings = repos.settings.get();
  const result = await judge({
    meta: pkg.meta,
    problemDir: pkg.location.dir,
    language: request.language,
    code: request.code,
    tests,
    kind: request.kind,
    timeoutMultiplier: settings.judge.timeoutMultiplier,
    ...(options.workspaceRoot ? { workspaceRoot: options.workspaceRoot } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  // The verdict may have landed just as the client left; it still goes
  // unrecorded, because nobody is there to have seen it.
  throwIfAborted(options.signal);
  record(request, result, options);
  return result;
}

/**
 * Re-checks the cases the client sent against the problem's own shape.
 *
 * The editor validates as the user types using the same rules from
 * `@devpromax/shared`, which is a convenience for them and no guarantee to us:
 * what arrives is whatever was posted.
 */
function validateCustomTests(
  request: RunRequest,
  pkg: NonNullable<ReturnType<typeof loadProblemBySlug>>,
): TestCase[] {
  const cases = request.customTests ?? [];
  if (cases.length === 0) return [];

  if (cases.length > MAX_CUSTOM_TESTS) {
    throw new CustomTestError([
      { case: MAX_CUSTOM_TESTS, message: `at most ${MAX_CUSTOM_TESTS} custom cases` },
    ]);
  }

  const shape = customTestShape(pkg.meta, pkg.tests);
  const issues = cases.flatMap((test, index) =>
    checkCustomTest(test, shape).map((issue) => ({ ...issue, case: index })),
  );
  if (issues.length > 0) throw new CustomTestError(issues);

  return cases;
}

/**
 * Writes what the run means, in one transaction.
 *
 * A submission whose progress row did not move, or a promotion to Solved with no
 * submission behind it, would each be a lie about what happened - so they land
 * together or not at all.
 */
function record(request: RunRequest, result: RunResult, options: RunServiceOptions): void {
  const { repos } = options;
  const at = options.now ?? new Date().toISOString();
  const accepted = isAccepted(result.verdict);

  transaction(repos.db, () => {
    if (request.kind === 'submit') {
      repos.submissions.insert({
        slug: request.slug,
        language: request.language,
        code: request.code,
        verdict: result.verdict,
        passed: result.passed,
        total: result.total,
        // The slowest test, which is the number shown beside the verdict: a sum
        // would grow with the size of the test set rather than with the
        // solution's cost.
        timeMs: result.tests.reduce((slowest, test) => Math.max(slowest, test.timeMs), 0),
        problemVersion: result.problemVersion,
        // Only what the client measured, and only on a submit: `/api/run` is
        // not an attempt at anything (P7-6).
        solveMs: request.solveMs ?? null,
      });
    }

    const current =
      repos.progress.get(request.slug, request.language) ??
      initialProgress(request.slug, request.language);

    repos.progress.put(
      applyProgressEvent(current, {
        event: request.kind === 'run' ? 'run' : accepted ? 'submit_accepted' : 'submit_rejected',
        at,
      }),
    );

    repos.events.record({
      type: request.kind === 'run' ? 'run' : 'submit',
      slug: request.slug,
      language: request.language,
      payload: { verdict: result.verdict, passed: result.passed, total: result.total },
      createdAt: at,
    });
  });
}
