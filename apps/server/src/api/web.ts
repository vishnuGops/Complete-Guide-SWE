import fs from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { paths } from '../config.js';

/**
 * Serving the built web app from the API process (ROADMAP P3-6, D24).
 *
 * Until this existed, `npm start` built the UI and then ran the API alone:
 * nothing served `apps/web/dist`, so the command CLAUDE.md described as
 * "production build + serve" opened a page that did not exist.
 *
 * One process on one port, for three reasons that all matter to a local tool:
 *
 *   - **One origin, so there is no CORS to configure** - and no second server
 *     whose absence breaks the first one.
 *   - **The Host allow-list covers page loads too**, because it is a hook on
 *     the whole server (see `hardening.ts`). The client-header rule stays an
 *     `/api` rule: a browser loading a page cannot send a custom header, so
 *     applying it here would make the app unreachable by the only thing that
 *     ever loads it.
 *   - **Ctrl+C stops all of it**, which is P3-6's other half.
 *
 * Registered only when the directory is there. In development Vite serves the
 * UI and this is absent; a missing build is not an error, it is the normal
 * state of a checkout that has not run `npm run build`.
 */

export interface WebOptions {
  /** Overridden by the test that proves the fallback; production uses the default. */
  root?: string;
}

/** True when a built UI exists to serve. */
export function hasWebBuild(root: string = paths.webDist): boolean {
  return fs.existsSync(path.join(root, 'index.html'));
}

export async function registerWeb(app: FastifyInstance, options: WebOptions = {}): Promise<void> {
  const root = options.root ?? paths.webDist;
  if (!hasWebBuild(root)) return;

  await app.register(fastifyStatic, {
    root,
    /*
     * Immutable assets are hashed by Vite, so a year is safe for them; the
     * entry document must never be cached, or a reload after an update serves
     * the old page's script references and the app breaks in a way that looks
     * like a build problem.
     */
    maxAge: '1y',
    setHeaders(reply, filePath) {
      if (path.basename(filePath) === 'index.html') {
        reply.header('cache-control', 'no-cache');
      }
    },
  });

  /*
   * The flag `errors.ts`'s not-found handler reads to decide whether an unknown
   * GET is a router path or a mistake. Fastify allows one not-found handler per
   * instance, and that one is already taken by the error envelope - so this is
   * a decoration rather than a second handler.
   */
  app.decorate('devpromaxWeb', true);
}
