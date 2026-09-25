import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Language } from '@devpromax/shared';
import { judgeCacheDir, runProblemUnqueued } from './index.js';
import { PILOTS } from './__fixtures__/pilots.js';

/**
 * A data directory the ANSI code page cannot spell (ROADMAP P10-1).
 *
 * Windows hands a JVM its command line in the ANSI code page, so on a cp1252
 * machine a workspace under `测试` reached `javac` as `??` - "Invalid filename" -
 * and a payload path reached the harness the same way. Anyone whose account name
 * falls outside their code page had this, because their `data/` is under their
 * profile, and an installer puts it there for everyone.
 *
 * The layout is the real one: workspaces under `<data>/judge` and the compiled
 * harness in the cache beside them, both inside the awkward directory, so the
 * relative class path the fix relies on is exercised too. Linux passes paths as
 * bytes and never had the problem; it runs here anyway, as a check that the
 * relative paths are right everywhere.
 */

const LANGUAGES: Language[] = ['python', 'java'];
let data: string;
let workspaceRoot: string;

beforeAll(() => {
  data = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax 测试 数据-'));
  workspaceRoot = path.join(data, 'judge');
  fs.mkdirSync(workspaceRoot);
});

afterAll(() => {
  fs.rmSync(data, { recursive: true, force: true });
});

describe.each(LANGUAGES)('%s: a data directory outside the ANSI code page', (language) => {
  it('accepts the reference solution of a function problem', async () => {
    const pilot = PILOTS.pairSum();
    const result = await runProblemUnqueued({
      kind: 'submit',
      meta: pilot.meta,
      language,
      code: pilot.reference(language),
      tests: pilot.tests,
      workspaceRoot,
    });

    expect(result.compileErrors).toEqual([]);
    expect(result.verdict).toBe('AC');
    expect(result.passed).toBe(result.total);
  });

  it('accepts the reference solution of a design problem', async () => {
    const pilot = PILOTS.minStack();
    const result = await runProblemUnqueued({
      kind: 'submit',
      meta: pilot.meta,
      language,
      code: pilot.reference(language),
      tests: pilot.tests,
      workspaceRoot,
    });

    expect(result.compileErrors).toEqual([]);
    expect(result.verdict).toBe('AC');
  });
});

it('keeps the compiled Java harness inside the awkward directory', () => {
  // Otherwise the test above would pass against a cache somewhere ASCII.
  expect(judgeCacheDir(workspaceRoot).startsWith(data)).toBe(true);
  expect(
    fs.readdirSync(judgeCacheDir(workspaceRoot)).some((entry) => entry.startsWith('java-harness-')),
  ).toBe(true);
});
