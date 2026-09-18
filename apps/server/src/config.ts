import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root, resolved from this file's location (works from src/ and dist/). */
export const repoRoot = (() => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/  -> apps/server/src        dist/ -> apps/server/dist
  return path.resolve(here, '..', '..', '..');
})();

/**
 * Where everything the app writes lives.
 *
 * `DEVPROMAX_DATA` moves the whole directory (ROADMAP P8-3) - the database, the
 * judge's workspaces, a backup written next to them. The case it is for is a
 * checkout on a synced drive: practice history belongs with the user, and
 * judge workspaces belong on a disk nobody is backing up every ten minutes.
 *
 * `DEVPROMAX_DB` moves only the database file, and stays because the
 * end-to-end suite needs exactly that (ROADMAP P4-9): those tests submit real
 * solutions through the real judge, and without an override they write that
 * into the developer's own practice history. It wins over `DEVPROMAX_DATA`
 * when both are set, being the narrower of the two.
 */
const dataDir = process.env.DEVPROMAX_DATA
  ? path.resolve(process.env.DEVPROMAX_DATA)
  : path.join(repoRoot, 'data');
const dbFile = process.env.DEVPROMAX_DB ?? path.join(dataDir, 'devpromax.db');

export const paths = {
  repoRoot,
  problems: path.join(repoRoot, 'problems'),
  data: dataDir,
  db: dbFile,
  judgeWorkspaces: path.join(dataDir, 'judge'),
  /** The built web app, served by the same process in production (D24, P3-6). */
  webDist: path.join(repoRoot, 'apps', 'web', 'dist'),
} as const;

/**
 * The port, checked rather than coerced (ROADMAP P3-6).
 *
 * `Number('5174x')` is `NaN`, and Fastify's own error for a `NaN` port is not
 * something anyone can act on. A typo in an environment variable should say so
 * in the first line of output.
 */
export function parsePort(value: string | undefined, fallback = 5174): number {
  if (value === undefined || value.trim() === '') return fallback;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DEVPROMAX_PORT must be a whole number between 1 and 65535; got "${value}".`);
  }
  return port;
}

export const serverConfig = {
  host: '127.0.0.1',
  port: parsePort(process.env.DEVPROMAX_PORT),
  /** Every /api request must carry this header (see ROADMAP D15). */
  clientHeader: 'x-devpromax-client',
} as const;
