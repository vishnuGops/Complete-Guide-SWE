import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  applyProgressEvent,
  initialProgress,
  languageSchema,
  progressStatusSchema,
  slugSchema,
  type ProblemProgress,
  type ProgressResponse,
} from '@devpromax/shared';
import { transaction } from '../../db/index.js';
import { notFound, parseInput } from '../errors.js';
import { progressOverview } from '../services/problemService.js';
import type { ApiDeps } from './types.js';

const overrideParams = z.object({ slug: slugSchema, language: languageSchema });
const overrideBody = z.object({ status: progressStatusSchema });

export function registerProgressRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.get('/api/progress', async (): Promise<ProgressResponse> => progressOverview(deps));

  /**
   * The manual override (D11): the only way a status moves down.
   *
   * It goes through the same status engine as everything else rather than
   * writing the row directly, so the rules about `solvedAt` and `masteredAt`
   * hold whether the change came from the judge or from the user's own opinion
   * of how well they know this problem.
   */
  app.put('/api/progress/:slug/:language', async (request): Promise<ProblemProgress> => {
    const { slug, language } = parseInput(overrideParams, request.params, 'params');
    const { status } = parseInput(overrideBody, request.body, 'body');
    if (!deps.catalogue.get(slug)) throw notFound(`No problem with slug "${slug}".`);

    const at = new Date().toISOString();
    return transaction(deps.repos.db, () => {
      const current = deps.repos.progress.get(slug, language) ?? initialProgress(slug, language);
      const next = deps.repos.progress.put(
        applyProgressEvent(current, { event: 'manual_override', status, at }),
      );
      deps.repos.events.record({
        type: 'status_override',
        slug,
        language,
        payload: { from: current.status, to: status },
        createdAt: at,
      });
      return next;
    });
  });
}
