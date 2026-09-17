import type { FastifyInstance } from 'fastify';
import { runBodySchema, type RunKind, type RunResult } from '@devpromax/shared';
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
  async function run(kind: RunKind, body: unknown): Promise<RunResult> {
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
      // Anything else - a missing interpreter, an unreadable problem package -
      // is our problem, not the client's, but it is worth its own tag: the UI
      // can offer "check that python is on your PATH" for this and nothing else.
      throw new HttpError(
        500,
        'JudgeError',
        error instanceof Error
          ? `This run could not be completed: ${error.message}`
          : 'This run could not be completed.',
      );
    }
  }

  app.post('/api/run', async (request) => run('run', request.body));
  app.post('/api/submit', async (request) => run('submit', request.body));
}
