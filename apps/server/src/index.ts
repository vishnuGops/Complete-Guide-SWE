import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import type { ProviderOptions } from './coach/index.js';
import { createCatalogue, type Catalogue } from './api/catalogue.js';
import { applyErrorHandling, badRequest } from './api/errors.js';
import { applyHardening } from './api/hardening.js';
import { registerRoutes } from './api/routes/index.js';
import type { JudgeFn } from './api/runService.js';
import { applyRuntimeSettings } from './api/settingsService.js';
import { serverConfig } from './config.js';
import { createDatabase, type Repositories } from './db/index.js';
import { logger } from './logger.js';
import { sweepStaleWorkspaces } from './judge/index.js';

export interface BuildOptions {
  /** Tests pass an in-memory database; production opens `data/devpromax.db`. */
  repositories?: Repositories;
  /** Tests point this at fixtures; production reads `problems/`. */
  problemsRoot?: string;
  catalogue?: Catalogue;
  /** Stand-in judge, so API tests do not spawn python or javac. */
  judge?: JudgeFn;
  /** Environment the `COACH_API_KEY` override is read from. */
  env?: NodeJS.ProcessEnv;
  /** Injected `fetch` for the coach provider, so tests stay offline. */
  provider?: ProviderOptions;
  /** Tests pass `silentLogger`; production uses the configured pino instance. */
  logger?: FastifyBaseLogger;
}

export async function buildServer(options: BuildOptions = {}) {
  // Widened to FastifyBaseLogger on purpose: keeping pino's concrete Logger type
  // makes the instance type incompatible with plain `FastifyInstance`, which
  // every plugin signature in this project uses.
  const app = Fastify({ loggerInstance: options.logger ?? (logger as FastifyBaseLogger) });

  // Opening the database applies any pending migration, so a build that adds one
  // migrates on first start rather than failing at the first query that needs it.
  const repositories = options.repositories ?? createDatabase();

  // Only close what we opened: a caller that passed its own handle owns it.
  if (options.repositories === undefined) {
    app.addHook('onClose', async () => {
      repositories.close();
    });
  }

  applyHardening(app);
  applyErrorHandling(app);

  // Fastify rejects an empty body sent with `Content-Type: application/json`,
  // which is exactly what a client that always sets the header produces for a
  // POST that takes no arguments - `/api/settings/test-connection` and
  // `/api/settings/reset-progress` are both that shape. An absent body is not a
  // malformed one, so it parses to `undefined` and the route's schema decides.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const text = typeof body === 'string' ? body.trim() : '';
    if (text === '') {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(text));
    } catch {
      // Our own error type, so this leaves through the same envelope as every
      // other failure rather than as an unhandled 500.
      done(badRequest('The request body could not be read as JSON.'), undefined);
    }
  });

  const catalogue =
    options.catalogue ??
    createCatalogue(options.problemsRoot ? { root: options.problemsRoot } : {});

  applyRuntimeSettings(repositories);

  registerRoutes(app, {
    repos: repositories,
    catalogue,
    ...(options.problemsRoot ? { problemsRoot: options.problemsRoot } : {}),
    ...(options.judge ? { judge: options.judge } : {}),
    ...(options.env ? { env: options.env } : {}),
    ...(options.provider ? { provider: options.provider } : {}),
  });

  // Outside /api on purpose: a health check that needed the client header would
  // not be a health check anything else could use.
  app.get('/health', async () => ({ ok: true }));

  return app;
}

async function main() {
  // Clear workspaces left behind by a process that died before disposing of its
  // own. Only touches directories older than an hour, so it cannot race a run.
  const swept = await sweepStaleWorkspaces();
  if (swept > 0) logger.info({ swept }, 'removed stale judge workspaces');

  const app = await buildServer();
  // 127.0.0.1, never 0.0.0.0: this server runs user code (see api/hardening.ts).
  await app.listen({ host: serverConfig.host, port: serverConfig.port });
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((err: unknown) => {
    logger.error(err, 'server failed to start');
    process.exitCode = 1;
  });
}
