import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import { applyHardening } from './api/hardening.js';
import { serverConfig } from './config.js';
import { createDatabase, type Repositories } from './db/index.js';
import { logger } from './logger.js';
import { sweepStaleWorkspaces } from './judge/index.js';

export interface BuildOptions {
  /** Tests pass an in-memory database; production opens `data/devpromax.db`. */
  repositories?: Repositories;
}

export async function buildServer(options: BuildOptions = {}) {
  // Widened to FastifyBaseLogger on purpose: keeping pino's concrete Logger type
  // makes the instance type incompatible with plain `FastifyInstance`, which
  // every plugin signature in this project uses.
  const app = Fastify({ loggerInstance: logger as FastifyBaseLogger });

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
