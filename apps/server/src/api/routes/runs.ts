import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { runBodySchema, type Language, type RunKind, type RunResult } from '@devpromax/shared';
import { HttpError, badRequest, notFound, parseInput } from '../errors.js';
import { CustomTestError, ProblemNotFoundError, executeRun } from '../runService.js';
import type { ApiDeps } from './types.js';

/**
 * Run and Submit (ROADMAP P2-6, P3-1).
 *
 * Two routes over one service. The route is what sets `kind`, so a body cannot
 * ask `/api/run` to record a submission, and both share the error mapping: an
 * unknown slug is a 404, an impossible custom case is a 400 that names which
 * case and why.
 */
export function registerRunRoutes(app: FastifyInstance, deps: ApiDeps): void {
  async function run(kind: RunKind, body: unknown, log: FastifyBaseLogger): Promise<RunResult> {
    const parsed = parseInput(runBodySchema, body, 'body');

    try {
      return await executeRun(
        {
          slug: parsed.slug,
          language: parsed.language,
          code: parsed.code,
          kind,
          // Submit runs the problem's own tests and nothing else; sending custom
          // cases to it is a client bug, and quietly running them would make the
          // recorded verdict mean something different from what it says.
          ...(kind === 'run' && parsed.customTests ? { customTests: parsed.customTests } : {}),
          // The same shape, the other way round: the interview timer is
          // recorded on a submission, and a run records nothing at all (P7-6).
          ...(kind === 'submit' && parsed.solveMs !== undefined ? { solveMs: parsed.solveMs } : {}),
        },
        {
          repos: deps.repos,
          ...(deps.judge ? { judge: deps.judge } : {}),
          ...(deps.problemsRoot ? { problemsRoot: deps.problemsRoot } : {}),
        },
      );
    } catch (error) {
      if (error instanceof ProblemNotFoundError) {
        throw notFound(`No problem with slug "${error.slug}".`);
      }
      if (error instanceof CustomTestError) {
        throw badRequest(
          'One of the custom test cases does not fit this problem.',
          error.issues.map((issue) => ({
            path: `customTests[${issue.case}]`,
            message: issue.message,
          })),
        );
      }
      if (error instanceof HttpError) throw error;

      /*
       * Anything else - a missing interpreter, an unreadable problem package -
       * is our problem, not the client's, but it is worth its own tag: the UI
       * can offer "check that python is on your PATH" for this and nothing
       * else.
       *
       * Node's own message is logged and *not* forwarded (ROADMAP P5-10). A
       * `spawn ENOENT` carries the absolute path it tried, which the browser
       * has no business being told and which reads as a crash rather than as
       * "the judge needs a runtime it cannot find". The mapped message says the
       * one thing the user can act on.
       */
      log.error({ err: error }, 'judge run failed');
      throw new HttpError(500, 'JudgeError', describeJudgeFailure(error, parsed.language));
    }
  }

  app.post('/api/run', async (request) => run('run', request.body, request.log));
  app.post('/api/submit', async (request) => run('submit', request.body, request.log));
}

/**
 * What to tell the user when the judge itself failed (ROADMAP P5-10).
 *
 * Two cases are worth naming, because each has an obvious fix and neither is
 * the user's code: the runtime is not installed, and the runtime is there but
 * refused to start. Everything else is deliberately vague to the client and
 * fully logged on the server - those details are for whoever reads the log,
 * and they routinely contain absolute paths.
 */
function describeJudgeFailure(error: unknown, language: Language): string {
  const runtime = language === 'python' ? 'Python' : 'Java';
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';

  if (code === 'ENOENT') {
    return `The judge could not start ${runtime}. Check that it is installed and on your PATH.`;
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return `The judge was not allowed to start ${runtime} on this machine.`;
  }
  return 'This run could not be completed. The server log has the details.';
}
