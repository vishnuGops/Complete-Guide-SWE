import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import { serverConfig } from './config.js';
import { logger } from './logger.js';

export async function buildServer() {
  const app = Fastify({ loggerInstance: logger });

  app.get('/health', async () => ({ ok: true }));

  return app;
}

async function main() {
  const app = await buildServer();
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
