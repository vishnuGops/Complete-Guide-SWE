import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Where the database lives (ROADMAP P4-9).
 *
 * `config.ts` reads the environment once, at import, so each case re-imports it
 * after stubbing - which is also the only way to be sure the default still
 * applies when nothing is set.
 *
 * Worth a test rather than a glance: the end-to-end suite points
 * `DEVPROMAX_DB` at `data/e2e.db` so that submitting real solutions through the
 * real judge does not write into the developer's own practice history. If this
 * override stopped being read, nothing would fail - the tests would simply go
 * back to filling someone's list with Solved rows they did not earn.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('paths.db', () => {
  it('is data/devpromax.db when nothing says otherwise', async () => {
    vi.stubEnv('DEVPROMAX_DB', undefined);
    vi.resetModules();

    const { paths } = await import('./config.js');
    expect(paths.db).toBe(path.join(paths.repoRoot, 'data', 'devpromax.db'));
  });

  it('is whatever DEVPROMAX_DB says', async () => {
    const elsewhere = path.join('somewhere', 'else', 'practice.db');
    vi.stubEnv('DEVPROMAX_DB', elsewhere);
    vi.resetModules();

    const { paths } = await import('./config.js');
    expect(paths.db).toBe(elsewhere);
    // Only the database moves: the judge still works where it always did.
    expect(paths.judgeWorkspaces).toBe(path.join(paths.repoRoot, 'data', 'judge'));
  });
});
