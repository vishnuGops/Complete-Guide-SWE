import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root, resolved from this file's location (works from src/ and dist/). */
export const repoRoot = (() => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/  -> apps/server/src        dist/ -> apps/server/dist
  return path.resolve(here, '..', '..', '..');
})();

/**
 * Where the practice database lives.
 *
 * `DEVPROMAX_DB` overrides it, and the reason it exists is the end-to-end
 * suite (ROADMAP P4-9): those tests submit real solutions through the real
 * judge, and without an override they write that into the developer's own
 * practice history - and a suite that wants a known starting state would have
 * to delete it. Playwright points this at `data/e2e.db` instead. P8-3 makes the
 * whole `data/` directory configurable; this is the part of it the tests need
 * now.
 */
const dbFile = process.env.DEVPROMAX_DB ?? path.join(repoRoot, 'data', 'devpromax.db');

export const paths = {
  repoRoot,
  problems: path.join(repoRoot, 'problems'),
  data: path.join(repoRoot, 'data'),
  db: dbFile,
  judgeWorkspaces: path.join(repoRoot, 'data', 'judge'),
} as const;

export const serverConfig = {
  host: '127.0.0.1',
  port: Number(process.env.DEVPROMAX_PORT ?? 5174),
  /** Every /api request must carry this header (see ROADMAP D15). */
  clientHeader: 'x-devpromax-client',
} as const;
