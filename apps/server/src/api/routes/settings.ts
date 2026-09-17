import type { FastifyInstance } from 'fastify';
import {
  settingsUpdateSchema,
  type ConnectionTestResponse,
  type ResetProgressResponse,
  type SettingsView,
} from '@devpromax/shared';
import { parseInput } from '../errors.js';
import { readSettings, resetProgress, testConnection, updateSettings } from '../settingsService.js';
import type { ApiDeps } from './types.js';

/**
 * Settings and the API key (ROADMAP P3-4).
 *
 * Every response here goes through `SettingsView`, which has no `apiKey` field
 * at all - not an empty one. The key is write-only across this boundary: the UI
 * can set it and can see a mask of it, and there is no route that will read it
 * back out.
 */
export function registerSettingsRoutes(app: FastifyInstance, deps: ApiDeps): void {
  const serviceDeps = {
    repos: deps.repos,
    ...(deps.env ? { env: deps.env } : {}),
    ...(deps.provider ? { provider: deps.provider } : {}),
  };

  app.get('/api/settings', async (): Promise<SettingsView> => readSettings(serviceDeps));

  app.put('/api/settings', async (request): Promise<SettingsView> => {
    const patch = parseInput(settingsUpdateSchema, request.body, 'body');
    return updateSettings(patch, serviceDeps);
  });

  /**
   * Checks the key against the provider before the user finds out mid-session.
   * A POST because it costs a network round trip and must not be retried by a
   * browser on its own.
   */
  app.post('/api/settings/test-connection', async (): Promise<ConnectionTestResponse> =>
    testConnection(serviceDeps),
  );

  /** Destructive, and confirmed in the UI before it is ever called. */
  app.post('/api/settings/reset-progress', async (): Promise<ResetProgressResponse> =>
    resetProgress(deps.repos),
  );
}
