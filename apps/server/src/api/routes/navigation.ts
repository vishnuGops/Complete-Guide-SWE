import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  nextQuerySchema,
  slugSchema,
  type BookmarkResponse,
  type NextProblemResponse,
} from '@devpromax/shared';
import { notFound, parseInput } from '../errors.js';
import { nextProblem } from '../nextService.js';
import type { ApiDeps } from './types.js';

const bookmarkParams = z.object({ slug: slugSchema });

/**
 * Getting around the catalogue (ROADMAP P7-7): bookmarks, and what to do next.
 *
 * Neither touches progress. Starring a problem and being told which one to try
 * are both about intent, and D11's ratchet is about work actually done.
 */
export function registerNavigationRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.put('/api/bookmarks/:slug', async (request): Promise<BookmarkResponse> => {
    const { slug } = parseInput(bookmarkParams, request.params, 'params');
    if (!deps.catalogue.get(slug)) throw notFound(`No problem with slug "${slug}".`);

    deps.repos.bookmarks.add(slug);
    return { slug, bookmarked: true };
  });

  app.delete('/api/bookmarks/:slug', async (request): Promise<BookmarkResponse> => {
    const { slug } = parseInput(bookmarkParams, request.params, 'params');
    // No existence check: unstarring a problem that has been removed from the
    // catalogue is exactly what someone with a stale bookmark needs to do.
    deps.repos.bookmarks.remove(slug);
    return { slug, bookmarked: false };
  });

  app.get('/api/next', async (request): Promise<NextProblemResponse> => {
    const { mode } = parseInput(nextQuerySchema, request.query, 'query');
    return nextProblem(mode, deps);
  });
}
