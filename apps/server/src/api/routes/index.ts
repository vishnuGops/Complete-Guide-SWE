import type { FastifyInstance } from 'fastify';
import { registerCoachRoutes } from './coach.js';
import { registerDraftRoutes } from './drafts.js';
import { registerNoteRoutes } from './notes.js';
import { registerProblemRoutes } from './problems.js';
import { registerProgressRoutes } from './progress.js';
import { registerRunRoutes } from './runs.js';
import { registerSettingsRoutes } from './settings.js';
import type { ApiDeps } from './types.js';

export type { ApiDeps } from './types.js';

/**
 * The whole HTTP surface (ROADMAP P3-1, completed by P5-3).
 *
 * Every route here answers with JSON except the two coach routes, which answer
 * with an event stream because their whole point is showing an answer while it
 * is still being written.
 */
export function registerRoutes(app: FastifyInstance, deps: ApiDeps): void {
  registerProblemRoutes(app, deps);
  registerRunRoutes(app, deps);
  registerDraftRoutes(app, deps);
  registerNoteRoutes(app, deps);
  registerProgressRoutes(app, deps);
  registerSettingsRoutes(app, deps);
  registerCoachRoutes(app, deps);
}
