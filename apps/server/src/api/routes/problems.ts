import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  hintRevealSchema,
  problemListQuerySchema,
  slugSchema,
  submissionListQuerySchema,
  type HintRevealResponse,
  type ProblemDetail,
  type ProblemListResponse,
  type SubmissionListResponse,
} from '@devpromax/shared';
import { badRequest, notFound, parseInput } from '../errors.js';
import { listProblems, problemDetail } from '../problemService.js';
import type { ApiDeps } from './types.js';

const slugParams = z.object({ slug: slugSchema });

/**
 * Media the assets route will serve.
 *
 * An allow-list rather than a mime lookup: everything else in a problem
 * directory - the reference solutions above all - lives one directory up from
 * `assets/`, and a route that will only ever answer with an image cannot be
 * talked into answering with a solution.
 */
const ASSET_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

export function registerProblemRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.get('/api/problems', async (request): Promise<ProblemListResponse> => {
    const query = parseInput(problemListQuerySchema, request.query, 'query');
    return listProblems(query, deps);
  });

  app.get('/api/problems/:slug', async (request): Promise<ProblemDetail> => {
    const { slug } = parseInput(slugParams, request.params, 'params');
    return problemDetail(slug, deps);
  });

  app.get('/api/problems/:slug/submissions', async (request): Promise<SubmissionListResponse> => {
    const { slug } = parseInput(slugParams, request.params, 'params');
    const query = parseInput(submissionListQuerySchema, request.query, 'query');
    if (!deps.catalogue.get(slug)) throw notFound(`No problem with slug "${slug}".`);

    return {
      items: deps.repos.submissions.list({
        slug,
        ...(query.language ? { language: query.language } : {}),
        limit: query.limit,
      }),
    };
  });

  /**
   * Unlocking a rung of the hint ladder (ROADMAP P7-1).
   *
   * Recorded as an activity event and read back from one, so there is one
   * record of it rather than two. It does not touch progress: reading a hint is
   * not an attempt, the same reasoning D11 applies to saving a draft.
   *
   * Idempotent by construction. The body says which rung is now visible and the
   * answer is the highest ever reached, so a click that is sent twice, or a
   * stale tab that asks for rung 2 after another tab reached rung 3, leaves the
   * ladder where it was.
   */
  app.post('/api/problems/:slug/hints', async (request): Promise<HintRevealResponse> => {
    const { slug } = parseInput(slugParams, request.params, 'params');
    const { revealed } = parseInput(hintRevealSchema, request.body, 'body');
    const pkg = deps.catalogue.get(slug);
    if (!pkg) throw notFound(`No problem with slug "${slug}".`);

    const rungs = pkg.hints.hints.length;
    if (revealed > rungs) {
      throw badRequest(`Problem "${slug}" has ${rungs} hint(s); cannot reveal ${revealed}.`, [
        { path: 'revealed', message: `Must be at most ${rungs}.` },
      ]);
    }

    const highest = deps.repos.events.highestHintRevealed(slug);
    if (revealed > highest) {
      deps.repos.events.record({ type: 'hint_revealed', slug, payload: { revealed } });
      return { revealed };
    }
    return { revealed: highest };
  });

  /**
   * Images referenced by a statement or editorial.
   *
   * The file name comes from the URL, so it is user input by definition: it is
   * resolved against the problem's own `assets/` directory and then checked to
   * still be inside it, which is what stops `..%2f..%2freference.py` from being
   * a path. The same rule the judge follows for workspaces (P2-5).
   */
  app.get('/api/problems/:slug/assets/*', async (request, reply) => {
    const { slug } = parseInput(slugParams, request.params, 'params');
    const pkg = deps.catalogue.get(slug);
    if (!pkg) throw notFound(`No problem with slug "${slug}".`);

    const relative = (request.params as Record<string, string>)['*'] ?? '';
    const assetsDir = path.join(pkg.location.dir, 'assets');
    const full = path.resolve(assetsDir, relative);
    const within = path.relative(assetsDir, full);
    if (within === '' || within.startsWith('..') || path.isAbsolute(within)) {
      throw notFound(`No asset "${relative}" for problem "${slug}".`);
    }

    const contentType = ASSET_TYPES[path.extname(full).toLowerCase()];
    if (contentType === undefined || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      throw notFound(`No asset "${relative}" for problem "${slug}".`);
    }

    // An SVG is a document that can carry script, and this one is served from
    // the app's own origin. Nothing in an illustration needs to load or run
    // anything, so nothing is allowed to.
    await reply
      .header('Content-Type', contentType)
      .header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
      .header('Cache-Control', 'no-cache')
      .send(fs.createReadStream(full));
  });
}
