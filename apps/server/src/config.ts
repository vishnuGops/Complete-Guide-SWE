import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root, resolved from this file's location (works from src/ and dist/). */
export const repoRoot = (() => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/  -> apps/server/src        dist/ -> apps/server/dist
  return path.resolve(here, '..', '..', '..');
})();

export const paths = {
  repoRoot,
  problems: path.join(repoRoot, 'problems'),
  data: path.join(repoRoot, 'data'),
  db: path.join(repoRoot, 'data', 'devpromax.db'),
  judgeWorkspaces: path.join(repoRoot, 'data', 'judge'),
} as const;

export const serverConfig = {
  host: '127.0.0.1',
  port: Number(process.env.DEVPROMAX_PORT ?? 5174),
  /** Every /api request must carry this header (see ROADMAP D15). */
  clientHeader: 'x-devpromax-client',
} as const;
