import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import { applyHardening } from './api/hardening.js';
import { serverConfig } from './config.js';
import { logger } from './logger.js';
import { sweepStaleWorkspaces } from './judge/index.js';

export async function buildServer() {
  // Widened to FastifyBaseLogger on purpose: keeping pino's concrete Logger type
  // makes the instance type incompatible with plain `FastifyInstance`, which
  // every plugin signature in this project uses.
  const app = Fastify({ loggerInstance: logger as FastifyBaseLogger });

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
