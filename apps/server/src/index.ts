import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import type { ProviderOptions } from './coach/index.js';
import { createCatalogue, type Catalogue } from './api/services/catalogue.js';
import { applyErrorHandling, badRequest } from './api/errors.js';
import { applyHardening } from './api/hardening.js';
import { registerRoutes } from './api/routes/index.js';
import type { JudgeFn } from './api/services/runService.js';
import { applyRuntimeSettings } from './api/services/settingsService.js';
import { serverConfig } from './config.js';
import { doctorSummary, runDoctor } from './toolchain/doctor.js';
import { formatters, type Formatters } from './toolchain/formatters.js';
import { createDatabase, type Repositories } from './db/index.js';
import { logger } from './logger.js';
import { EXECUTOR_KIND, killLiveChildren, sweepStaleWorkspaces } from './judge/index.js';
import { hasWebBuild, registerWeb } from './api/web.js';

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
  /** Stand-in formatters (P9-5); production finds the real ones. */
  formatters?: Formatters;
  /** Tests pass `silentLogger`; production uses the configured pino instance. */
  logger?: FastifyBaseLogger;
  /**
   * Serve `apps/web/dist` from this process (ROADMAP P3-6, D24).
   *
   * Opt-in, and only `main()` opts in. The alternative - on by default,
   * skipped when the directory is missing - would give a developer who has run
   * `npm run build` once a different 404 handler from one who has not, and an
   * API test suite whose behaviour depends on that is worse than no default.
   */
  serveWeb?: boolean;
  /** Overridden by the test that proves the SPA fallback. */
  webRoot?: string;
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

  // Fastify also parses text/plain out of the box, and text/plain is one of the
  // three content types a cross-origin page can send without a preflight. The
  // hook in api/hardening.ts refuses it on /api, but the parser is the second
  // lock: with it gone, Fastify itself answers 415 to a text/plain body on any
  // route, whatever the hook decided (ROADMAP P3-8, D15).
  app.removeContentTypeParser('text/plain');

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
    ...(options.formatters ? { formatters: options.formatters } : {}),
  });

  // Outside /api on purpose: a health check that needed the client header would
  // not be a health check anything else could use.
  app.get('/health', async () => ({ ok: true }));

  // Last, so nothing it registers can shadow a route above it (P3-6, D24).
  // Absent in development, where Vite serves the UI, and in tests.
  if (options.serveWeb === true || options.webRoot !== undefined) {
    await registerWeb(app, options.webRoot !== undefined ? { root: options.webRoot } : {});
  }

  return app;
}

/**
 * Stops the server the way Ctrl+C should (ROADMAP P3-6).
 *
 * Three things have to happen, and only the first used to:
 *
 *   1. Stop accepting requests, which `app.close()` does.
 *   2. Run the `onClose` hook, which closes the database. Without it SQLite is
 *      left to the operating system - usually fine, and "usually" is not a word
 *      that belongs near a file holding months of practice history.
 *   3. Kill judge children. Node kills this process, not the `java` it started,
 *      and an orphan holds its workspace open - on Windows, undeletably.
 *
 * `once` per signal, and a second signal exits immediately: someone pressing
 * Ctrl+C twice means it now.
 *
 * SIGHUP too (ROADMAP P3-10). On Windows, closing the console window is how
 * most people stop a program, and Node reports it as SIGHUP - then Windows ends
 * the process a few seconds later whatever it is doing. Without a handler the
 * default was to die at once, with none of the three steps above.
 */
function installShutdown(app: Awaited<ReturnType<typeof buildServer>>): void {
  let closing = false;

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      if (closing) {
        process.exit(130);
      }
      closing = true;

      const killed = killLiveChildren();
      if (killed > 0) logger.info({ killed }, 'stopped judge processes');

      void app
        .close()
        .then(() => {
          process.exit(0);
        })
        .catch((error: unknown) => {
          logger.error({ err: error }, 'shutdown failed');
          process.exit(1);
        });
    });
  }
}

/**
 * Starts the server for real (ROADMAP P3-6).
 *
 * Exported because `start.ts` - the production entry point - has to call it:
 * the `isEntrypoint` check below compares `process.argv[1]` against *this*
 * module, and under `node dist/start.js` it is false. That was the whole of the
 * first version of this fix, which built the app, started nothing, and exited 0.
 */
export async function start() {
  // Clear workspaces left behind by a process that died before disposing of its
  // own. Only touches directories older than an hour, so it cannot race a run.
  const swept = await sweepStaleWorkspaces();
  if (swept > 0) logger.info({ swept }, 'removed stale judge workspaces');

  const app = await buildServer({ serveWeb: true });
  installShutdown(app);

  try {
    // 127.0.0.1, never 0.0.0.0: this server runs user code (see api/hardening.ts).
    await app.listen({ host: serverConfig.host, port: serverConfig.port });
  } catch (error) {
    // The one startup failure that is the user's to fix, and Fastify's own
    // message for it names a syscall rather than the thing to do (P3-6).
    if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
      throw new Error(
        `Port ${String(serverConfig.port)} is already in use. Another DevProMax may be running; ` +
          'stop it, or set DEVPROMAX_PORT to a free port.',
      );
    }
    throw error;
  }

  // The one line a person needs. `logger` would print JSON in production, and
  // the address is not a log entry - it is the answer to "where do I go".
  const url = `http://${serverConfig.host}:${String(serverConfig.port)}`;
  const lines = hasWebBuild()
    ? [`DevProMax is running at ${url}`]
    : [
        `DevProMax API is running at ${url}`,
        'No web build found - run `npm run build` to serve the app from here.',
      ];
  // Said only when it is not the default: someone who set DEVPROMAX_EXECUTOR
  // wants to see that it took, and nobody else needs a line about it.
  if (EXECUTOR_KIND === 'docker') lines.push('The judge runs code in Docker containers.');
  process.stdout.write(['', ...lines, '', ''].join('\n'));

  /*
   * The runtime check (ROADMAP P8-3), after the address and not before it.
   *
   * It spawns a JVM, which costs a few hundred milliseconds, and nothing about
   * it should delay the line that tells the user where to go. It also prints
   * only when something is wrong: a start-up that reports three runtimes being
   * fine every time is a start-up nobody reads, and then the once it matters
   * the bad news is in the same place as the noise.
   */
  if (process.env['DEVPROMAX_NO_DOCTOR'] !== '1')
    void runDoctor()
      .then((report) => {
        const summary = doctorSummary(report);
        if (summary !== null) process.stdout.write(summary);
      })
      .catch((error: unknown) => {
        logger.warn({ err: error }, 'the runtime check could not be run');
      });

  /*
   * Look for the formatters now (ROADMAP P9-5), so the workspace's first
   * question is answered from cache rather than by starting a JVM while it
   * waits. Silent either way: both are optional, and a line at every start-up
   * saying black is not installed would be noise to everyone who never wanted
   * it. Settings and `npm run doctor` say so to anyone who asks.
   */
  void formatters.status().catch((error: unknown) => {
    logger.warn({ err: error }, 'the formatter check could not be run');
  });
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  start().catch((err: unknown) => {
    logger.error(err, 'server failed to start');
    process.exitCode = 1;
  });
}
