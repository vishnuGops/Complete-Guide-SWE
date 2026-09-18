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

/**
 * The port, checked rather than coerced (ROADMAP P3-6).
 *
 * `Number('5174 ')` is a number and `Number('5174x')` is `NaN`, and Fastify's
 * message for a `NaN` port names a syscall. A typo in an environment variable
 * should be answered in the first line of output.
 */
describe('parsePort', () => {
  it('defaults when nothing is set', async () => {
    const { parsePort } = await import('./config.js');
    expect(parsePort(undefined)).toBe(5174);
    expect(parsePort('')).toBe(5174);
    expect(parsePort('   ')).toBe(5174);
  });

  it('takes a valid port', async () => {
    const { parsePort } = await import('./config.js');
    expect(parsePort('3000')).toBe(3000);
    expect(parsePort('65535')).toBe(65535);
  });

  it('refuses what is not a port, and says which value', async () => {
    const { parsePort } = await import('./config.js');
    for (const bad of ['5174x', 'nope', '0', '-1', '65536', '5174.5', 'NaN']) {
      expect(() => parsePort(bad), bad).toThrow(/DEVPROMAX_PORT/);
    }
    expect(() => parsePort('abc')).toThrow(/got "abc"/);
  });
});
