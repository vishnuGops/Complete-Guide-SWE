import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Language, RunResult } from '@devpromax/shared';
import { DOCKER_COMMAND, DOCKER_IMAGES } from './executors/commands.js';
import { JUDGE_LABEL } from './executors/docker.js';
import { runProblemUnqueued, type JudgeTest, type RunProblemOptions } from './index.js';
import { PILOTS, makeWorkspaceRoot, syntheticMeta } from './__fixtures__/pilots.js';

/**
 * The Docker executor against a real daemon (ROADMAP P9-2).
 *
 * Opt-in with `DEVPROMAX_DOCKER_TESTS=1`, because every test here starts
 * containers on the machine it runs on, and nobody running `npm test` should
 * find that out afterwards. CI's docker lane sets it on Linux, where Docker is
 * part of the runner; the images must already be pulled.
 *
 * Two kinds of test. The first half runs the pilots and the classic verdicts
 * through containers and expects exactly what the local executor gives - the
 * container must be invisible to anyone judging code. The second half is the
 * reason the executor exists: each restriction the launcher asks for is
 * attempted from inside and has to fail.
 */

const enabled = process.env['DEVPROMAX_DOCKER_TESTS'] === '1';
const LANGUAGES: Language[] = ['python', 'java'];
let workspaceRoot: string;

beforeAll(() => {
  if (!enabled) return;
  workspaceRoot = makeWorkspaceRoot();
  for (const image of Object.values(DOCKER_IMAGES)) {
    // Fail with the fix, not with a timeout eleven tests later.
    try {
      execFileSync(DOCKER_COMMAND, ['image', 'inspect', image], { stdio: 'ignore' });
    } catch {
      throw new Error(`the Docker suite needs ${image}; run: docker pull ${image}`);
    }
  }
});

afterAll(() => {
  if (workspaceRoot) fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

async function run(
  options: Omit<RunProblemOptions, 'workspaceRoot' | 'kind'> & { kind?: RunResult['kind'] },
) {
  return runProblemUnqueued({ kind: 'submit', executor: 'docker', ...options, workspaceRoot });
}

/** One Python test whose return value is what the restriction under test allowed. */
async function probe(body: string, meta: Parameters<typeof syntheticMeta>[0] = {}) {
  const code = ['import os, sys', '', 'class Solution:', '    def solve(self, n):', body, ''].join(
    '\n',
  );
  const tests: JudgeTest[] = [{ source: 'sample', test: { args: [1], expected: 'unreachable' } }];
  const result = await run({ meta: syntheticMeta(meta), language: 'python', code, tests });
  return result.tests[0]!;
}

function judgeContainers(): string[] {
  const out = execFileSync(
    DOCKER_COMMAND,
    ['ps', '--all', '--quiet', '--filter', `label=${JUDGE_LABEL}`],
    { encoding: 'utf8' },
  );
  return out.split('\n').filter((line) => line.trim() !== '');
}

describe.skipIf(!enabled)('the Docker executor judges like the local one', () => {
  it.each(LANGUAGES)(
    '%s: every pilot reference is accepted',
    async (language) => {
      for (const pilot of [PILOTS.pairSum(), PILOTS.shiftRight(), PILOTS.minStack()]) {
        const result = await run({
          meta: pilot.meta,
          language,
          code: pilot.reference(language),
          tests: pilot.tests,
        });
        expect(result.verdict, `${pilot.meta.slug} in ${language}`).toBe('AC');
      }
    },
    180_000,
  );

  it.each(LANGUAGES)(
    '%s: the starter is a wrong answer with a diff',
    async (language) => {
      const pilot = PILOTS.pairSum();
      const result = await run({
        meta: pilot.meta,
        language,
        code: pilot.starter(language),
        tests: pilot.tests,
      });
      expect(result.verdict).toBe('WA');
      expect(result.tests[0]?.expected).toBeDefined();
    },
    60_000,
  );

  it('java: a compile error lands on the user line, not on /ws', async () => {
    const result = await run({
      meta: syntheticMeta(),
      language: 'java',
      code: 'class Solution {\n  int solve(int n) {\n    return n\n  }\n}\n',
      tests: [{ source: 'sample', test: { args: [1], expected: 1 } }],
    });
    expect(result.verdict).toBe('CE');
    expect(result.compileErrors[0]?.line).toBe(3);
  }, 60_000);

  it('python: a syntax error is a compile error with its line', async () => {
    const result = await run({
      meta: syntheticMeta(),
      language: 'python',
      code: 'class Solution:\n    def solve(self, n):\n        return (n\n',
      tests: [{ source: 'sample', test: { args: [1], expected: 1 } }],
    });
    expect(result.verdict).toBe('CE');
    expect(result.compileErrors[0]?.line).toBeGreaterThan(0);
  }, 60_000);

  it.each(LANGUAGES)(
    '%s: an endless loop is a timeout, and leaves no container behind',
    async (language) => {
      const code =
        language === 'python'
          ? 'class Solution:\n    def solve(self, n):\n        while True:\n            pass\n'
          : 'class Solution {\n  int solve(int n) {\n    while (true) {}\n  }\n}\n';
      const result = await run({
        meta: syntheticMeta({ limits: { timeoutMs: { python: 1500, java: 1500 } } }),
        language,
        code,
        tests: [{ source: 'sample', test: { args: [1], expected: 1 } }],
      });
      expect(result.verdict).toBe('TLE');

      // `--rm` removes a container once it has stopped, which takes the daemon
      // a moment after the kill.
      const deadline = Date.now() + 10_000;
      while (judgeContainers().length > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(judgeContainers()).toEqual([]);
    },
    60_000,
  );

  it('java: running out of heap is still MLE', async () => {
    const result = await run({
      meta: syntheticMeta(),
      language: 'java',
      code: 'class Solution {\n  int solve(int n) {\n    long[] big = new long[400_000_000];\n    return big.length;\n  }\n}\n',
      tests: [{ source: 'sample', test: { args: [1], expected: 1 } }],
    });
    expect(result.verdict).toBe('MLE');
  }, 60_000);
});

describe.skipIf(!enabled)('what a solution in a judge container cannot do', () => {
  it('reach the network', async () => {
    const test = await probe(
      [
        '        import socket',
        '        try:',
        '            socket.create_connection(("1.1.1.1", 53), timeout=3)',
        '            return "connected"',
        '        except OSError as error:',
        '            return "refused: %s" % type(error).__name__',
      ].join('\n'),
    );
    expect(test.actual).toMatch(/^refused/);
  }, 60_000);

  it("see this server's environment", async () => {
    process.env['COACH_API_KEY'] = 'sk-must-not-leak';
    process.env['DEVPROMAX_SECRET_PROBE'] = 'nor-this';
    try {
      const test = await probe('        return sorted(os.environ)');
      const names = test.actual as string[];
      expect(names).not.toContain('COACH_API_KEY');
      expect(names.some((name) => name.startsWith('DEVPROMAX_'))).toBe(false);
    } finally {
      delete process.env['COACH_API_KEY'];
      delete process.env['DEVPROMAX_SECRET_PROBE'];
    }
  }, 60_000);

  it('write outside the workspace and /tmp', async () => {
    const test = await probe(
      [
        '        results = []',
        '        for target in ("/etc/devpromax", "/usr/local/devpromax", "/tmp/devpromax"):',
        '            try:',
        '                open(target, "w").write("x")',
        '                results.append("wrote " + target)',
        '            except OSError:',
        '                results.append("denied " + target)',
        '        return results',
      ].join('\n'),
    );
    expect(test.actual).toEqual([
      'denied /etc/devpromax',
      'denied /usr/local/devpromax',
      'wrote /tmp/devpromax',
    ]);
  }, 60_000);

  it('change the compiled harness every later run executes (P2-18)', async () => {
    // The harness is compiled once and mounted into every Java step; a
    // solution that could rewrite it would be running code in the next one.
    const code = [
      'import java.nio.file.*;',
      '',
      'class Solution {',
      '    public String solve(int n) {',
      '        try {',
      '            Files.writeString(Path.of("/devpromax/DevProMaxMain.class"), "x");',
      '            return "wrote";',
      '        } catch (Exception denied) {',
      '            return "denied";',
      '        }',
      '    }',
      '}',
      '',
    ].join('\n');
    const result = await run({
      meta: syntheticMeta(),
      language: 'java',
      code,
      tests: [{ source: 'sample', test: { args: [1], expected: 'unreachable' } }],
    });
    expect(result.tests[0]?.actual).toBe('denied');
  }, 60_000);

  it('run as root', async () => {
    const test = await probe('        return os.getuid()');
    expect(test.actual).not.toBe(0);
  }, 60_000);

  it('start more processes than the limit', async () => {
    const test = await probe(
      [
        '        import subprocess',
        '        started = []',
        '        try:',
        '            for _ in range(1000):',
        '                started.append(subprocess.Popen(["sleep", "30"]))',
        '            return "unbounded"',
        '        except OSError:',
        '            return "bounded"',
        '        finally:',
        '            for child in started:',
        '                child.kill()',
      ].join('\n'),
      { limits: { timeoutMs: { python: 8000 } } },
    );
    expect(test.actual).toBe('bounded');
  }, 60_000);
});
