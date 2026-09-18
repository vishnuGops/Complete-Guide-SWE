import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { noteUpdateSchema, slugSchema, type NoteResponse } from '@devpromax/shared';
import { notFound, parseInput } from '../errors.js';
import type { ApiDeps } from './types.js';

const noteParams = z.object({ slug: slugSchema });

/**
 * Per-problem notes (ROADMAP P7-4).
 *
 * Keyed by problem and not by language, because a note is about the problem -
 * the trick, the case that keeps catching you out - and someone who solves it
 * twice should not have to remember which language they wrote it under.
 *
 * Like a draft, writing one changes nothing else: no progress row, no status,
 * no activity event (D11). Writing down what you noticed is not an attempt.
 */
export function registerNoteRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.put('/api/notes/:slug', async (request): Promise<NoteResponse> => {
    const { slug } = parseInput(noteParams, request.params, 'params');
    const { body } = parseInput(noteUpdateSchema, request.body, 'body');
    if (!deps.catalogue.get(slug)) throw notFound(`No problem with slug "${slug}".`);

    // A blank body deletes the row rather than storing an empty note, so
    // "has a note" stays a question the database can answer by itself.
    return { note: deps.repos.notes.save(slug, body) };
  });

  app.delete('/api/notes/:slug', async (request): Promise<NoteResponse> => {
    const { slug } = parseInput(noteParams, request.params, 'params');
    deps.repos.notes.remove(slug);
    return { note: null };
  });
}
