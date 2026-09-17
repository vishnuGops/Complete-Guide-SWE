import type { FastifyInstance } from 'fastify';
import { registerDraftRoutes } from './drafts.js';
import { registerProblemRoutes } from './problems.js';
import { registerProgressRoutes } from './progress.js';
import { registerRunRoutes } from './runs.js';
import { registerSettingsRoutes } from './settings.js';
import type { ApiDeps } from './types.js';

export type { ApiDeps } from './types.js';

/**
 * The whole HTTP surface (ROADMAP P3-1).
 *
 * The coach routes (`POST /api/coach/feedback`, `POST /api/coach/chat`) are
 * deliberately absent: they stream a provider's response, and the provider's
 * streaming half arrives with P5-1. Registering them now as stubs would put two
 * endpoints in the contract that answer nothing.
 */
export function registerRoutes(app: FastifyInstance, deps: ApiDeps): void {
  registerProblemRoutes(app, deps);
  registerRunRoutes(app, deps);
  registerDraftRoutes(app, deps);
  registerProgressRoutes(app, deps);
  registerSettingsRoutes(app, deps);
}
