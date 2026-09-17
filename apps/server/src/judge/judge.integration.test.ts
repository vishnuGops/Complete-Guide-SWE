import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Language, RunResult } from '@devpromax/shared';
import { runProblemUnqueued, type JudgeTest, type RunProblemOptions } from './index.js';
import { PILOTS, makeWorkspaceRoot, syntheticMeta } from './__fixtures__/pilots.js';

/**
 * Judge integration tests. These spawn real `python`, `javac` and `java`
 * processes — mocking them would test nothing that matters, since almost every
 * bug this layer can have lives in process handling, encodings or the harness
 * protocol. CI runs this file on both ubuntu-latest and windows-latest.
 */

const LANGUAGES: Language[] = ['python', 'java'];
let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = makeWorkspaceRoot();
});

afterAll(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

async function run(
  options: Omit<RunProblemOptions, 'workspaceRoot' | 'kind'> & { kind?: RunResult['kind'] },
) {
  return runProblemUnqueued({ kind: 'submit', ...options, workspaceRoot });
}

/** A one-off problem whose solution is supplied inline, for the failure modes. */
async function runSynthetic(
  language: Language,
  code: string,
  opts: {
    tests?: JudgeTest[];
    meta?: Parameters<typeof syntheticMeta>[0];
  } = {},
) {
  return run({
    meta: syntheticMeta(opts.meta),
    language,
    code,
    tests: opts.tests ?? [{ source: 'sample', test: { args: [1], expected: 1 } }],
  });
}

// ---------------------------------------------------------------------------
// The happy path, on the real pilot problems
// ---------------------------------------------------------------------------

describe.each(LANGUAGES)('%s: pilot problems', (language) => {
  it('accepts the reference solution for a function/return problem', async () => {
    const pilot = PILOTS.pairSum();
    const result = await run({
      meta: pilot.meta,
      language,
      code: pilot.reference(language),
      tests: pilot.tests,
    });

    expect(result.verdict).toBe('AC');
    expect(result.passed).toBe(result.total);
    expect(result.compileErrors).toEqual([]);
    expect(result.isolationFallback).toBe(false);
  });

  it('accepts the reference solution for a function/mutatedArgs problem', async () => {
    const pilot = PILOTS.shiftRight();
    const result = await run({
      meta: pilot.meta,
      language,
      code: pilot.reference(language),
      tests: pilot.tests,
    });

    expect(result.verdict).toBe('AC');
    expect(result.passed).toBe(result.total);
  });

  it('accepts the reference solution for an operations problem', async () => {
    const pilot = PILOTS.minStack();
    const result = await run({
      meta: pilot.meta,
      language,
      code: pilot.reference(language),
      tests: pilot.tests,
    });

    expect(result.verdict).toBe('AC');
    expect(result.passed).toBe(result.total);
  });

  it('rejects the untouched starter without crashing', async () => {
    const pilot = PILOTS.pairSum();
    const result = await run({
      meta: pilot.meta,
      language,
      code: pilot.starter(language),
      tests: pilot.tests,
    });

    // The starter compiles and runs; it simply gets the answer wrong. A compile
    // error here would mean the starter convention has regressed.
    expect(result.verdict).toBe('WA');
    expect(result.passed).toBe(0);
  });

  it('reports timing for every test', async () => {
    const pilot = PILOTS.pairSum();
    const result = await run({
      meta: pilot.meta,
      language,
      code: pilot.reference(language),
      tests: pilot.tests,
    });

    expect(result.tests.every((t) => t.timeMs >= 0)).toBe(true);
    expect(result.totalTimeMs).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Wrong answers and diffs
// ---------------------------------------------------------------------------

describe('wrong answers', () => {
  it('reports the actual value and a message pointing at the difference (python)', async () => {
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        return n + 1\n',
      { tests: [{ source: 'sample', test: { args: [1], expected: 1 } }] },
    );

    expect(result.verdict).toBe('WA');
    expect(result.tests[0]?.actual).toBe(2);
    expect(result.tests[0]?.expected).toBe(1);
    expect(result.tests[0]?.message).toContain('2');
  });

  it('reports the actual value and a message pointing at the difference (java)', async () => {
    const result = await runSynthetic(
      'java',
      'class Solution {\n    public int solve(int n) {\n        return n + 1;\n    }\n}\n',
      { tests: [{ source: 'sample', test: { args: [1], expected: 1 } }] },
    );

    expect(result.verdict).toBe('WA');
    expect(result.tests[0]?.actual).toBe(2);
    expect(result.tests[0]?.message).toContain('2');
  });

  it('keeps running after a failure so the user sees every test', async () => {
    const tests: JudgeTest[] = [
      { source: 'sample', test: { args: [1], expected: 99 } },
      { source: 'sample', test: { args: [2], expected: 2 } },
      { source: 'sample', test: { args: [3], expected: 3 } },
    ];
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        return n\n',
      { tests },
    );

    expect(result.verdict).toBe('WA');
    expect(result.passed).toBe(2);
    expect(result.tests.map((t) => t.verdict)).toEqual(['WA', 'AC', 'AC']);
  });
});

// ---------------------------------------------------------------------------
// Compile errors
// ---------------------------------------------------------------------------

describe('compile errors', () => {
  it('maps a Java syntax error to CE with a line and column', async () => {
    const result = await runSynthetic(
      'java',
      'class Solution {\n    public int solve(int n) {\n        int x = 1\n        return x;\n    }\n}\n',
    );

    expect(result.verdict).toBe('CE');
    expect(result.compileErrors.length).toBeGreaterThan(0);
    const first = result.compileErrors[0]!;
    expect(first.line).toBe(3);
    expect(first.column).toBeGreaterThan(0);
    expect(first.message).toMatch(/expected/);
  });

  it('maps a Python syntax error to CE with a line, before any test runs', async () => {
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n)\n        return n\n',
    );

    expect(result.verdict).toBe('CE');
    expect(result.compileErrors.length).toBeGreaterThan(0);
    expect(result.compileErrors[0]?.line).toBe(2);
  });

  it('marks every test CE, since none of them ran', async () => {
    const tests: JudgeTest[] = [
      { source: 'sample', test: { args: [1], expected: 1 } },
      { source: 'hidden', test: { args: [2], expected: 2 } },
    ];
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self n):\n        pass\n',
      {
        tests,
      },
    );

    expect(result.verdict).toBe('CE');
    expect(result.tests.every((t) => t.verdict === 'CE')).toBe(true);
    expect(result.passed).toBe(0);
  });

  it('does not blame the user when the class is simply missing', async () => {
    const result = await runSynthetic('python', 'class NotSolution:\n    pass\n');
    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message).toMatch(/Solution/);
  });
});

// ---------------------------------------------------------------------------
// Runtime errors
// ---------------------------------------------------------------------------

describe('runtime errors', () => {
  it('reports a Python exception with its traceback', async () => {
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        return [1, 2][5]\n',
    );

    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message).toContain('IndexError');
    expect(result.tests[0]?.stderr).toContain('IndexError');
  });

  it('strips the harness frames from a Python traceback', async () => {
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        raise ValueError("boom")\n',
    );

    expect(result.tests[0]?.stderr).not.toContain('runner.py');
    expect(result.tests[0]?.stderr).toContain('boom');
  });

  it('reports a Java exception with its stack trace', async () => {
    const result = await runSynthetic(
      'java',
      'class Solution {\n    public int solve(int n) {\n        int[] a = new int[1];\n        return a[5];\n    }\n}\n',
    );

    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message).toContain('ArrayIndexOutOfBoundsException');
  });

  it('unwraps the reflection layer so the user sees their own exception', async () => {
    const result = await runSynthetic(
      'java',
      'class Solution {\n    public int solve(int n) {\n        throw new IllegalStateException("boom");\n    }\n}\n',
    );

    expect(result.tests[0]?.message).toContain('IllegalStateException');
    expect(result.tests[0]?.message).toContain('boom');
    expect(result.tests[0]?.message).not.toContain('InvocationTargetException');
  });

  it('recovers and runs the remaining tests after one raises', async () => {
    const tests: JudgeTest[] = [
      { source: 'sample', test: { args: [0], expected: 1 } },
      { source: 'sample', test: { args: [1], expected: 1 } },
    ];
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        return 1 // n\n',
      { tests },
    );

    expect(result.tests[0]?.verdict).toBe('RE');
    expect(result.tests[1]?.verdict).toBe('AC');
    expect(result.verdict).toBe('RE');
  });
});

// ---------------------------------------------------------------------------
// stdout, stdin and output caps
// ---------------------------------------------------------------------------

describe('user output', () => {
  it.each(LANGUAGES)('%s: tolerates printing and reports it as data', async (language) => {
    const code =
      language === 'python'
        ? 'class Solution:\n    def solve(self, n):\n        print("debugging", n)\n        return n\n'
        : 'class Solution {\n    public int solve(int n) {\n        System.out.println("debugging " + n);\n        return n;\n    }\n}\n';

    const result = await runSynthetic(language, code);
    expect(result.verdict).toBe('AC');
    expect(result.tests[0]?.stdout).toContain('debugging');
  });

  it.each(LANGUAGES)(
    '%s: prints that look like results cannot corrupt the verdict',
    async (language) => {
      // The harness writes results to a file precisely so that this cannot work.
      const forged = '{"index": 0, "status": "ok", "returned": 1, "timeMs": 0}';
      const code =
        language === 'python'
          ? `class Solution:\n    def solve(self, n):\n        print(${JSON.stringify(forged)})\n        return 999\n`
          : `class Solution {\n    public int solve(int n) {\n        System.out.println(${JSON.stringify(forged)});\n        return 999;\n    }\n}\n`;

      const result = await runSynthetic(language, code);
      expect(result.verdict).toBe('WA');
      expect(result.tests[0]?.actual).toBe(999);
    },
  );

  it.each(LANGUAGES)('%s: reading stdin fails cleanly rather than hanging', async (language) => {
    const code =
      language === 'python'
        ? 'import sys\n\n\nclass Solution:\n    def solve(self, n):\n        return int(sys.stdin.readline())\n'
        : 'import java.util.*;\n\nclass Solution {\n    public int solve(int n) {\n        return new Scanner(System.in).nextInt();\n    }\n}\n';

    const result = await runSynthetic(language, code);
    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.timeMs).toBeLessThan(2000);
  });

  it.each(LANGUAGES)('%s: caps runaway output instead of buffering it all', async (language) => {
    const code =
      language === 'python'
        ? 'class Solution:\n    def solve(self, n):\n        print("x" * 200000)\n        return n\n'
        : 'class Solution {\n    public int solve(int n) {\n        System.out.println("x".repeat(200000));\n        return n;\n    }\n}\n';

    const result = await runSynthetic(language, code);
    expect(result.verdict).toBe('AC');
    expect(result.tests[0]?.stdout.length).toBeLessThanOrEqual(16 * 1024);
    expect(result.outputTruncated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Timeouts and the isolation fallback
// ---------------------------------------------------------------------------

describe('timeouts', () => {
  const fastLimits = { limits: { timeoutMs: { python: 800, java: 800 } } };

  it.each(LANGUAGES)('%s: reports TLE for an endless loop', async (language) => {
    const code =
      language === 'python'
        ? 'class Solution:\n    def solve(self, n):\n        while True:\n            pass\n'
        : 'class Solution {\n    public int solve(int n) {\n        while (true) {\n        }\n    }\n}\n';

    const result = await runSynthetic(language, code, { meta: fastLimits });
    expect(result.verdict).toBe('TLE');
    expect(result.tests[0]?.verdict).toBe('TLE');
  });

  it.each(LANGUAGES)(
    '%s: isolates the tests after a mid-batch timeout so the rest still run',
    async (language) => {
      const tests: JudgeTest[] = [
        { source: 'sample', test: { args: [0], expected: 0 } },
        { source: 'sample', test: { args: [1], expected: 1 } },
        { source: 'sample', test: { args: [2], expected: 2 } },
      ];
      const code =
        language === 'python'
          ? 'class Solution:\n    def solve(self, n):\n        if n == 1:\n            while True:\n                pass\n        return n\n'
          : 'class Solution {\n    public int solve(int n) {\n        if (n == 1) {\n            while (true) {\n            }\n        }\n        return n;\n    }\n}\n';

      const result = await runSynthetic(language, code, { tests, meta: fastLimits });

      expect(result.tests.map((t) => t.verdict)).toEqual(['AC', 'TLE', 'AC']);
      expect(result.verdict).toBe('TLE');
      expect(result.isolationFallback).toBe(true);
      expect(result.passed).toBe(2);
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Java-only limits
// ---------------------------------------------------------------------------

describe('java memory and stack', () => {
  it('maps OutOfMemoryError to MLE', async () => {
    const result = await runSynthetic(
      'java',
      'import java.util.*;\n\nclass Solution {\n    public int solve(int n) {\n        List<long[]> hold = new ArrayList<>();\n        while (true) {\n            hold.add(new long[1024 * 1024]);\n        }\n    }\n}\n',
      { meta: { limits: { timeoutMs: { java: 15000 } } } },
    );

    expect(result.verdict).toBe('MLE');
  });

  it('keeps a StackOverflowError as RE, not MLE', async () => {
    const result = await runSynthetic(
      'java',
      'class Solution {\n    public int solve(int n) {\n        return solve(n + 1);\n    }\n}\n',
    );

    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message).toContain('StackOverflowError');
  });
});

describe('python recursion', () => {
  it('reports RE rather than taking the process down', async () => {
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        return self.solve(n + 1)\n',
    );

    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message).toContain('RecursionError');
  });

  it('allows recursion far deeper than the interpreter default', async () => {
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        if n == 0:\n            return 0\n        return self.solve(n - 1)\n',
      { tests: [{ source: 'sample', test: { args: [5000], expected: 0 } }] },
    );

    expect(result.verdict).toBe('AC');
  });
});

// ---------------------------------------------------------------------------
// The hidden-test reveal policy (ROADMAP P2-6)
// ---------------------------------------------------------------------------

describe('hidden test reveal policy', () => {
  const tests: JudgeTest[] = [
    { source: 'sample', test: { args: [1], expected: 1 } },
    { source: 'hidden', test: { args: [2], expected: 2 } },
    { source: 'hidden', test: { args: [3], expected: 3 } },
    { source: 'hidden', test: { args: [4], expected: 4 } },
  ];

  it('hides passing hidden tests entirely', async () => {
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        return n\n',
      {
        tests,
      },
    );

    expect(result.verdict).toBe('AC');
    expect(result.tests[0]?.revealed).toBe(true);
    expect(result.tests.slice(1).every((t) => t.revealed === false)).toBe(true);
    expect(result.tests.slice(1).every((t) => t.input === undefined)).toBe(true);
  });

  it('reveals the first failing hidden test and only that one', async () => {
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        return 0 if n > 1 else n\n',
      { tests },
    );

    expect(result.verdict).toBe('WA');
    expect(result.tests[1]?.revealed).toBe(true);
    expect(result.tests[1]?.input?.args).toEqual([2]);
    expect(result.tests[1]?.actual).toBe(0);
    expect(result.tests[2]?.revealed).toBe(false);
    expect(result.tests[2]?.actual).toBeUndefined();
    expect(result.tests[3]?.revealed).toBe(false);
  });

  it('reveals everything when asked, which is what the validator needs', async () => {
    const result = await runProblemUnqueued({
      meta: syntheticMeta(),
      language: 'python',
      code: 'class Solution:\n    def solve(self, n):\n        return 0\n',
      tests,
      kind: 'submit',
      workspaceRoot,
      revealAll: true,
    });

    expect(result.tests.every((t) => t.revealed)).toBe(true);
    expect(result.tests.every((t) => t.input !== undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Workspace hygiene
// ---------------------------------------------------------------------------

describe('workspaces', () => {
  it('leaves nothing behind, even when the solution crashes', async () => {
    const before = fs.readdirSync(workspaceRoot).length;
    await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        raise SystemExit(1)\n',
    );
    expect(fs.readdirSync(workspaceRoot).length).toBe(before);
  });

  it('leaves nothing behind after a compile error', async () => {
    const before = fs.readdirSync(workspaceRoot).length;
    await runSynthetic('java', 'class Solution { this is not java }');
    expect(fs.readdirSync(workspaceRoot).length).toBe(before);
  });
});
