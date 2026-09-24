import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  formatRequestSchema,
  type FormatResponse,
  type FormattersResponse,
} from '@devpromax/shared';
import { formatters as defaultFormatters } from '../../toolchain/formatters.js';
import { parseInput } from '../errors.js';
import type { ApiDeps } from './types.js';

const statusQuery = z.object({ refresh: z.enum(['0', '1']).optional() });

/**
 * Format on save (ROADMAP P9-5).
 *
 * `GET /api/format` says which formatters this machine has, so the workspace
 * can offer Format only where it will work; `?refresh=1` looks again, which is
 * Settings' "Check again" after someone has installed one. `POST` formats.
 *
 * Neither touches progress, drafts or activity. Formatting is an edit, and the
 * formatted code reaches the server the way any edit does - through the
 * draft autosave, when the workspace next saves.
 */
export function registerFormatRoutes(app: FastifyInstance, deps: ApiDeps): void {
  const formatters = deps.formatters ?? defaultFormatters;

  app.get('/api/format', async (request): Promise<FormattersResponse> => {
    const { refresh } = parseInput(statusQuery, request.query, 'query');
    return { formatters: await formatters.status(refresh === '1') };
  });

  app.post('/api/format', async (request): Promise<FormatResponse> => {
    const { language, code } = parseInput(formatRequestSchema, request.body, 'body');
    return formatters.format(language, code);
  });
}
