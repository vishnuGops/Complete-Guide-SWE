import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  draftUpdateSchema,
  languageSchema,
  slugSchema,
  type DraftResponse,
} from '@devpromax/shared';
import { notFound, parseInput } from '../errors.js';
import type { ApiDeps } from './types.js';

const draftParams = z.object({ slug: slugSchema, language: languageSchema });

/**
 * Autosaved editor content (ROADMAP P3-1).
 *
 * Saving a draft is the one write in this API that changes nothing else: no
 * progress row, no activity event, no status (D11). The editor autosaves while
 * the user types, and a progress display that reacted to typing would tell them
 * they had attempted every problem they ever opened.
 */
export function registerDraftRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.put('/api/drafts/:slug/:language', async (request): Promise<DraftResponse> => {
    const { slug, language } = parseInput(draftParams, request.params, 'params');
    const { code } = parseInput(draftUpdateSchema, request.body, 'body');
    if (!deps.catalogue.get(slug)) throw notFound(`No problem with slug "${slug}".`);

    return { draft: deps.repos.drafts.save(slug, language, code) };
  });

  /** Reset-to-starter: the editor goes back to the starter, so the draft goes. */
  app.delete('/api/drafts/:slug/:language', async (request): Promise<DraftResponse> => {
    const { slug, language } = parseInput(draftParams, request.params, 'params');
    deps.repos.drafts.remove(slug, language);
    return { draft: null };
  });
}
