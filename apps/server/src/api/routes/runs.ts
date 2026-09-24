import type { FastifyBaseLogger, FastifyInstance, FastifyReply } from 'fastify';
import { runBodySchema, type Language, type RunKind, type RunResult } from '@devpromax/shared';
import { HttpError, badRequest, notFound, parseInput } from '../errors.js';
import { JudgeUnavailableError } from '../../judge/executors/launcher.js';
import { isAbortError } from '../../judge/process.js';
import { CustomTestError, ProblemNotFoundError, executeRun } from '../services/runService.js';
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
  async function run(
    kind: RunKind,
    body: unknown,
    log: FastifyBaseLogger,
    signal: AbortSignal,
  ): Promise<RunResult> {
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
          signal,
        },
      );
    } catch (error) {
      throw runErrorToHttp(error, parsed.language, log);
    }
  }

  app.post('/api/run', async (request, reply) =>
    run('run', request.body, request.log, clientGone(reply)),
  );
  app.post('/api/submit', async (request, reply) =>
    run('submit', request.body, request.log, clientGone(reply)),
  );
}

/**
 * A signal that fires when the client stops waiting (ROADMAP P2-17).
 *
 * The response's `close`, not the request's: Node closes the request stream as
 * soon as the body has been read, long before the verdict, while the response
 * closes either when it has been sent - `writableFinished` - or when the
 * connection went first, which is the case that matters here.
 */
function clientGone(reply: FastifyReply): AbortSignal {
  const controller = new AbortController();
  reply.raw.once('close', () => {
    if (!reply.raw.writableFinished) controller.abort();
  });
  return controller.signal;
}

/**
 * The error mapping for anything that runs the judge through `executeRun`
 * (ROADMAP P2-19), so that `/api/run`, `/api/submit` and re-verify answer the
 * same failure the same way. Returns the error to throw:
 *
 *   ProblemNotFoundError    404
 *   CustomTestError         400, naming the case
 *   a cancelled run         499, which nobody is waiting to read
 *   HttpError, JudgeUnavailableError   as they are
 *   anything else           logged, then 500 JudgeError with a safe message
 */
export function runErrorToHttp(error: unknown, language: Language, log: FastifyBaseLogger): Error {
  if (error instanceof ProblemNotFoundError) {
    return notFound(`No problem with slug "${error.slug}".`);
  }
  if (error instanceof CustomTestError) {
    return badRequest(
      'One of the custom test cases does not fit this problem.',
      error.issues.map((issue) => ({
        path: `customTests[${issue.case}]`,
        message: issue.message,
      })),
    );
  }
  if (error instanceof HttpError) return error;
  if (error instanceof JudgeUnavailableError) return error;
  if (isAbortError(error)) {
    // nginx's code for it; the client closed the connection, so the status is
    // for the log rather than for anyone reading a response.
    return new HttpError(499, 'ClientClosedRequest', 'The run was cancelled.');
  }

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
  return new HttpError(500, 'JudgeError', describeJudgeFailure(error, language));
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
