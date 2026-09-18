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
// Cyclic chains (ROADMAP P2-15)
// ---------------------------------------------------------------------------

describe.each(LANGUAGES)('%s: a chain the harness closes into a cycle', (language) => {
  /**
   * Detect a cycle by walking - the only thing a solution can do with one.
   *
   * Written with two pointers rather than a set of seen nodes, because a set
   * would pass on a chain that merely *repeats a value*, and the whole question
   * this feature answers is whether the harness handed over a chain that loops
   * rather than one that looks like it might.
   */
  const solutions: Record<string, string> = {
    python: [
      'class Solution:',
      '    def hasCycle(self, head):',
      '        slow = fast = head',
      '        while fast is not None and fast.next is not None:',
      '            slow = slow.next',
      '            fast = fast.next.next',
      '            if slow is fast:',
      '                return True',
      '        return False',
      '',
    ].join('\n'),
    java: [
      'class Solution {',
      '    public boolean hasCycle(ListNode head) {',
      '        ListNode slow = head;',
      '        ListNode fast = head;',
      '        while (fast != null && fast.next != null) {',
      '            slow = slow.next;',
      '            fast = fast.next.next;',
      '            if (slow == fast) return true;',
      '        }',
      '        return false;',
      '    }',
      '}',
      '',
    ].join('\n'),
  };

  const meta = { entry: 'hasCycle', cycle: { chain: 0, at: 1 } };

  it('hands the solution a chain that actually loops', async () => {
    const result = await runSynthetic(language, solutions[language] as string, {
      meta,
      tests: [
        // The textbook case: four nodes, the last pointing at the second.
        { source: 'sample', test: { args: [[3, 2, 0, -4], 1], expected: true } },
        { source: 'sample', test: { args: [[1, 2], 0], expected: true } },
        // A single node pointing at itself, which is the smallest cycle there
        // is and the one an off-by-one in the builder gets wrong.
        { source: 'sample', test: { args: [[7], 0], expected: true } },
      ],
    });

    expect(result.verdict).toBe('AC');
    expect(result.passed).toBe(3);
  });

  it('leaves the chain open when the index is -1', async () => {
    const result = await runSynthetic(language, solutions[language] as string, {
      meta,
      tests: [
        { source: 'sample', test: { args: [[3, 2, 0, -4], -1], expected: false } },
        { source: 'sample', test: { args: [[1], -1], expected: false } },
        // An empty chain has no tail to link, whatever the index says.
        { source: 'sample', test: { args: [[], -1], expected: false } },
        { source: 'sample', test: { args: [[], 0], expected: false } },
      ],
    });

    expect(result.verdict).toBe('AC');
    expect(result.passed).toBe(4);
  });

  it('does not pass the cycle index to the solution', async () => {
    /*
     * The signature the starter declares is the signature that gets called.
     * A solution taking one parameter is handed one argument, so if the index
     * leaked through, this would be an arity error rather than a verdict - and
     * on Java it would pick the wrong overload before that.
     */
    const counts: Record<string, string> = {
      python: [
        'class Solution:',
        '    def hasCycle(self, head):',
        '        # Walks the chain, so a leaked integer would raise here.',
        '        seen = 0',
        '        node = head',
        '        while node is not None and seen < 100:',
        '            seen += 1',
        '            node = node.next',
        '        return seen >= 100',
        '',
      ].join('\n'),
      java: [
        'class Solution {',
        '    public boolean hasCycle(ListNode head) {',
        '        int seen = 0;',
        '        ListNode node = head;',
        '        while (node != null && seen < 100) {',
        '            seen++;',
        '            node = node.next;',
        '        }',
        '        return seen >= 100;',
        '    }',
        '}',
        '',
      ].join('\n'),
    };

    const result = await runSynthetic(language, counts[language] as string, {
      meta,
      tests: [
        // A loop of three never runs out, so the walk hits its own hundred.
        { source: 'sample', test: { args: [[1, 2, 3], 0], expected: true } },
        { source: 'sample', test: { args: [[1, 2, 3], -1], expected: false } },
      ],
    });

    expect(result.verdict).toBe('AC');
  });

  it('reports an index past the end as an error rather than looping forever', async () => {
    const result = await runSynthetic(language, solutions[language] as string, {
      meta,
      tests: [{ source: 'sample', test: { args: [[1, 2], 9], expected: true } }],
    });

    // A generator bug, not a wrong answer: the harness says so and the run
    // survives it.
    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message ?? '').toMatch(/cycle index/i);
  });
});

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
// What the child is allowed to see (ROADMAP P2-11)
// ---------------------------------------------------------------------------

describe('child environment', () => {
  /**
   * The defect this closes, in the form it was found: the judge spawned its
   * children with `process.env`, so one `print` returned the user's coach API
   * key through the run result and into the results panel.
   *
   * Real subprocesses are the only honest way to test it - the whole question
   * is what the operating system handed the child - so the canaries are set on
   * this process for the duration and the solution prints its own environment.
   */
  const SECRETS = {
    COACH_API_KEY: 'sk-ant-leak-canary-0001',
    DEVPROMAX_SECRET_CANARY: 'canary-0002',
    GITHUB_TOKEN: 'ghp-leak-canary-0003',
  } as const;

  const saved: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const [name, value] of Object.entries(SECRETS)) {
      saved[name] = process.env[name];
      process.env[name] = value;
    }
  });

  afterAll(() => {
    for (const name of Object.keys(SECRETS)) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  const PRINT_ENV = {
    python: [
      'import os',
      '',
      '',
      'class Solution:',
      '    def solve(self, n):',
      '        for name, value in sorted(os.environ.items()):',
      '            print(name + "=" + value)',
      '        return n',
      '',
    ].join('\n'),
    java: [
      'import java.util.*;',
      '',
      'class Solution {',
      '    public int solve(int n) {',
      '        for (Map.Entry<String, String> e : new TreeMap<>(System.getenv()).entrySet()) {',
      '            System.out.println(e.getKey() + "=" + e.getValue());',
      '        }',
      '        return n;',
      '    }',
      '}',
      '',
    ].join('\n'),
  } as const;

  it.each(LANGUAGES)('%s: cannot read the coach key or any DEVPROMAX_ name', async (language) => {
    const result = await runSynthetic(language, PRINT_ENV[language]);
    expect(result.verdict).toBe('AC');

    const printed = result.tests[0]?.stdout ?? '';
    // Proof that something was printed, or this passes by printing nothing.
    expect(printed).toMatch(/PATH=/i);
    expect(result.outputTruncated).toBe(false);

    for (const [name, value] of Object.entries(SECRETS)) {
      expect(printed).not.toContain(name);
      expect(printed).not.toContain(value);
    }
    expect(printed).not.toContain('DEVPROMAX_');
  });

  /**
   * The other half of an allow-list.
   *
   * Too short a list breaks the JVM before `main` - without SYSTEMROOT on
   * Windows it cannot initialise sockets - and the symptom is an unexplained RE
   * on every problem in the catalogue. So: a temp file and a loopback address,
   * which are the two things that fail first.
   */
  const NEEDS_ENV = {
    python: [
      'import tempfile',
      '',
      '',
      'class Solution:',
      '    def solve(self, n):',
      '        with tempfile.TemporaryFile() as handle:',
      '            handle.write(b"ok")',
      '        return n',
      '',
    ].join('\n'),
    java: [
      'import java.io.*;',
      'import java.net.*;',
      '',
      'class Solution {',
      '    public int solve(int n) throws Exception {',
      '        File temp = File.createTempFile("devpromax", ".tmp");',
      '        temp.delete();',
      '        InetAddress.getLoopbackAddress();',
      '        return n;',
      '    }',
      '}',
      '',
    ].join('\n'),
  } as const;

  it.each(LANGUAGES)('%s: still has what it needs to run at all', async (language) => {
    const result = await runSynthetic(language, NEEDS_ENV[language]);
    expect(result.verdict).toBe('AC');
  });
});

// ---------------------------------------------------------------------------
// Class names the harness owns (ROADMAP P2-11)
// ---------------------------------------------------------------------------

describe('java: harness class collisions', () => {
  it('explains a user-declared ListNode instead of blaming the harness', async () => {
    const code = [
      'class Solution {',
      '    public int solve(int n) {',
      '        return n;',
      '    }',
      '}',
      '',
      'class ListNode {',
      '    int val;',
      '    ListNode next;',
      '}',
      '',
    ].join('\n');

    const result = await runSynthetic('java', code);
    expect(result.verdict).toBe('CE');
    const message = result.compileErrors.map((error) => error.message).join('\n');
    expect(message).toContain('the judge already defines `ListNode`');
    expect(message).not.toContain("the judge's Java harness failed to compile");
  });

  it('accepts a class named Main, which the harness no longer owns', async () => {
    const code = [
      'class Solution {',
      '    public int solve(int n) {',
      '        return Main.twice(n) - n;',
      '    }',
      '}',
      '',
      'class Main {',
      '    static int twice(int n) {',
      '        return n * 2;',
      '    }',
      '}',
      '',
    ].join('\n');

    const result = await runSynthetic('java', code);
    expect(result.verdict).toBe('AC');
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
// Custom cases (ROADMAP P2-6)
// ---------------------------------------------------------------------------

describe('custom cases', () => {
  it('reports the value a custom case produced instead of grading it', async () => {
    // A custom case has no expected output, so "correct" is not a question the
    // judge can answer about it - only "here is what your code returned".
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        return n * 10\n',
      { tests: [{ source: 'custom', test: { args: [4] } }] },
    );

    expect(result.verdict).toBe('AC');
    expect(result.tests[0]?.actual).toBe(40);
    expect(result.tests[0]?.expected).toBeUndefined();
    expect(result.tests[0]?.revealed).toBe(true);
  });

  it('still reports a crash in a custom case as a runtime error', async () => {
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        raise ValueError("boom")\n',
      { tests: [{ source: 'custom', test: { args: [4] } }] },
    );

    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message).toContain('boom');
  });

  it('grades the samples beside it as usual', async () => {
    const result = await runSynthetic(
      'python',
      'class Solution:\n    def solve(self, n):\n        return n * 10\n',
      {
        tests: [
          { source: 'sample', test: { args: [1], expected: 1 } },
          { source: 'custom', test: { args: [2] } },
        ],
      },
    );

    expect(result.verdict).toBe('WA');
    expect(result.tests[0]?.verdict).toBe('WA');
    expect(result.tests[1]?.verdict).toBe('AC');
    expect(result.tests[1]?.actual).toBe(20);
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

// ---------------------------------------------------------------------------
// Node types across the wire (ROADMAP P2-12)
// ---------------------------------------------------------------------------

/**
 * The linked-list and tree paths, before the catalogue needs them.
 *
 * No seed problem uses `ListNode` or `TreeNode`, which is why the Python
 * harness could render `Optional[ListNode]` as `"Union"` and hand the solution
 * a raw list without a single test noticing. Every linked-list and tree starter
 * in Batch B and C would have hit it (P6-3, P6-4), so the cases live here
 * first.
 */
describe('node arguments', () => {
  it.each(LANGUAGES)('%s: decodes an optional node argument', async (language) => {
    const code =
      language === 'python'
        ? [
            'from typing import List, Optional',
            '',
            '',
            'class Solution:',
            '    def solve(self, head: Optional[ListNode]) -> List[int]:',
            '        out = []',
            '        while head is not None:',
            '            out.append(head.val)',
            '            head = head.next',
            '        return out',
            '',
          ].join('\n')
        : [
            'import java.util.*;',
            '',
            'class Solution {',
            '    public List<Integer> solve(ListNode head) {',
            '        List<Integer> out = new ArrayList<>();',
            '        for (ListNode at = head; at != null; at = at.next) {',
            '            out.add(at.val);',
            '        }',
            '        return out;',
            '    }',
            '}',
            '',
          ].join('\n');

    const result = await runSynthetic(language, code, {
      tests: [{ source: 'sample', test: { args: [[3, 1, 4]], expected: [3, 1, 4] } }],
    });

    expect(result.verdict).toBe('AC');
  });

  it.each(LANGUAGES)('%s: decodes a tree argument', async (language) => {
    const code =
      language === 'python'
        ? [
            'from typing import Optional',
            '',
            '',
            'class Solution:',
            '    def solve(self, root: Optional[TreeNode]) -> int:',
            '        if root is None:',
            '            return 0',
            '        return root.val + self.solve(root.left) + self.solve(root.right)',
            '',
          ].join('\n')
        : [
            'class Solution {',
            '    public int solve(TreeNode root) {',
            '        if (root == null) {',
            '            return 0;',
            '        }',
            '        return root.val + solve(root.left) + solve(root.right);',
            '    }',
            '}',
            '',
          ].join('\n');

    const result = await runSynthetic(language, code, {
      tests: [{ source: 'sample', test: { args: [[5, 3, 8, null, null, 1]], expected: 17 } }],
    });

    expect(result.verdict).toBe('AC');
  });

  it.each(LANGUAGES)('%s: decodes a list of nodes', async (language) => {
    // `List[ListNode]` in Python and `ListNode[]` in Java - merge-K's shape,
    // and the annotation the old renderer flattened to `"List"`.
    const code =
      language === 'python'
        ? [
            'from typing import List',
            '',
            '',
            'class Solution:',
            '    def solve(self, heads: List[ListNode]) -> int:',
            '        total = 0',
            '        for head in heads:',
            '            at = head',
            '            while at is not None:',
            '                total += at.val',
            '                at = at.next',
            '        return total',
            '',
          ].join('\n')
        : [
            'class Solution {',
            '    public int solve(ListNode[] heads) {',
            '        int total = 0;',
            '        for (ListNode head : heads) {',
            '            for (ListNode at = head; at != null; at = at.next) {',
            '                total += at.val;',
            '            }',
            '        }',
            '        return total;',
            '    }',
            '}',
            '',
          ].join('\n');

    const result = await runSynthetic(language, code, {
      tests: [
        {
          source: 'sample',
          test: {
            args: [[[1, 2], [3], []]],
            expected: 6,
          },
        },
      ],
    });

    expect(result.verdict).toBe('AC');
  });

  it.each(LANGUAGES)('%s: encodes a returned node back to a list', async (language) => {
    const code =
      language === 'python'
        ? [
            'from typing import Optional',
            '',
            '',
            'class Solution:',
            '    def solve(self, head: Optional[ListNode]) -> Optional[ListNode]:',
            '        previous = None',
            '        while head is not None:',
            '            head.next, previous, head = previous, head, head.next',
            '        return previous',
            '',
          ].join('\n')
        : [
            'class Solution {',
            '    public ListNode solve(ListNode head) {',
            '        ListNode previous = null;',
            '        while (head != null) {',
            '            ListNode next = head.next;',
            '            head.next = previous;',
            '            previous = head;',
            '            head = next;',
            '        }',
            '        return previous;',
            '    }',
            '}',
            '',
          ].join('\n');

    const result = await runSynthetic(language, code, {
      tests: [{ source: 'sample', test: { args: [[1, 2, 3]], expected: [3, 2, 1] } }],
    });

    expect(result.verdict).toBe('AC');
  });

  /**
   * A returned tree with a missing child (ROADMAP P6-4).
   *
   * The level-order format puts a `null` in the queue for every absent child,
   * and the Java encoder used an `ArrayDeque`, which refuses null elements - so
   * every tree that was not perfect came back as a NullPointerException thrown
   * from inside the harness. Nothing caught it because P2-12 covered trees as
   * *arguments* and lists as returns, and no catalogue problem handed a tree
   * back until `flatten-to-chain`.
   *
   * `[1, 2, 3, null, 4]` has exactly that shape: the 2 has no left child.
   */
  it.each(LANGUAGES)('%s: encodes a returned tree with a missing child', async (language) => {
    const code =
      language === 'python'
        ? [
            'from typing import Optional',
            '',
            '',
            'class Solution:',
            '    def solve(self, root: Optional[TreeNode]) -> Optional[TreeNode]:',
            '        return root',
            '',
          ].join('\n')
        : [
            'class Solution {',
            '    public TreeNode solve(TreeNode root) {',
            '        return root;',
            '    }',
            '}',
            '',
          ].join('\n');

    const result = await runSynthetic(language, code, {
      tests: [
        {
          source: 'sample',
          test: { args: [[1, 2, 3, null, 4]], expected: [1, 2, 3, null, 4] },
        },
      ],
    });

    expect(result.verdict).toBe('AC');
  });

  /** The same encoder, reached through `mutatedArgs` rather than a return. */
  it.each(LANGUAGES)('%s: encodes a tree that the method changed in place', async (language) => {
    const code =
      language === 'python'
        ? [
            'from typing import Optional',
            '',
            '',
            'class Solution:',
            '    def solve(self, root: Optional[TreeNode]) -> None:',
            '        root.left = None',
            '',
          ].join('\n')
        : [
            'class Solution {',
            '    public void solve(TreeNode root) {',
            '        root.left = null;',
            '    }',
            '}',
            '',
          ].join('\n');

    const result = await runSynthetic(language, code, {
      meta: { expect: 'mutatedArgs' },
      tests: [
        {
          source: 'sample',
          test: {
            args: [[1, 2, 3]],
            expectedMutatedArgs: [{ index: 0, value: [1, null, 3] }],
          },
        },
      ],
    });

    expect(result.verdict).toBe('AC');
  });
});

describe('java: argument conversion refuses what it cannot represent', () => {
  it('will not truncate 2.5 into an int parameter', async () => {
    // `intValue()` on 2.5 is 2, which made a test whose input was written as a
    // float pass against an argument nobody chose (P2-12).
    const code = 'class Solution {\n    public int solve(int n) {\n        return n;\n    }\n}\n';

    const result = await runSynthetic('java', code, {
      tests: [{ source: 'sample', test: { args: [2.5], expected: 2 } }],
    });

    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message).toMatch(/expected an integer/i);
  });

  it('names the element when a char[] gets something that is not one character', async () => {
    // `charAt(0)` on "" threw StringIndexOutOfBounds from inside the harness,
    // which reads as the judge being broken rather than the data being wrong.
    const code =
      'class Solution {\n    public int solve(char[] letters) {\n        return letters.length;\n    }\n}\n';

    const result = await runSynthetic('java', code, {
      tests: [{ source: 'sample', test: { args: [['a', '', 'c']], expected: 3 } }],
    });

    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message).toMatch(/index 1 of a char\[\]/);
  });
});

describe('operations mode: which call failed', () => {
  const META = {
    mode: 'operations' as const,
    entry: 'Counter',
    expect: 'return' as const,
  };

  const CODE = {
    python: [
      'class Counter:',
      '    def __init__(self):',
      '        self.values = []',
      '',
      '    def push(self, value):',
      '        self.values.append(value)',
      '',
      '    def pop(self):',
      '        return self.values.pop()',
      '',
    ].join('\n'),
    java: [
      'import java.util.*;',
      '',
      'class Counter {',
      '    private final Deque<Integer> values = new ArrayDeque<>();',
      '',
      '    void push(int value) {',
      '        values.push(value);',
      '    }',
      '',
      '    int pop() {',
      '        return values.pop();',
      '    }',
      '}',
      '',
    ].join('\n'),
  } as const;

  it.each(LANGUAGES)(
    '%s: names the operation and keeps the returns before it',
    async (language) => {
      const result = await run({
        meta: syntheticMeta(META),
        language,
        code: CODE[language],
        tests: [
          {
            source: 'sample',
            test: {
              args: [],
              ops: [
                { method: 'push', args: [7] },
                { method: 'pop', args: [] },
                // Nothing left to pop: the third call is the one that fails.
                { method: 'pop', args: [] },
              ],
              expected: [null, 7, null],
            },
          },
        ],
      });

      expect(result.verdict).toBe('RE');
      // "It threw IndexError" with no index is a needle in twenty haystacks.
      expect(result.tests[0]?.message).toMatch(/operation 2 \(pop\)/);
      // And the calls that did work are still reported, so they can be counted.
      expect(result.tests[0]?.actual).toEqual([null, 7]);
    },
  );

  it.each(LANGUAGES)('%s: names a method that does not exist', async (language) => {
    const result = await run({
      meta: syntheticMeta(META),
      language,
      code: CODE[language],
      tests: [
        {
          source: 'sample',
          test: {
            args: [],
            ops: [
              { method: 'push', args: [1] },
              { method: 'peek', args: [] },
            ],
            expected: [null, 1],
          },
        },
      ],
    });

    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message).toMatch(/operation 1 \(peek\)/);
  });
});

// ---------------------------------------------------------------------------
// Bounds on output, results and hangs (ROADMAP P2-13)
// ---------------------------------------------------------------------------

describe('output and result bounds', () => {
  const fastLimits = { limits: { timeoutMs: { python: 1500, java: 2500 } } };

  it.each(LANGUAGES)('%s: a print storm is a timeout, not a memory error', async (language) => {
    // The buffers used to grow without bound and be capped only afterwards, so
    // this filled `-Xmx` in Java and was reported as MLE - blaming the user's
    // memory use for their print loop.
    const code =
      language === 'python'
        ? [
            'class Solution:',
            '    def solve(self, n):',
            '        while True:',
            '            print("x" * 1000)',
            '        return n',
            '',
          ].join('\n')
        : [
            'class Solution {',
            '    public int solve(int n) {',
            '        String line = "x".repeat(1000);',
            '        while (true) {',
            '            System.out.println(line);',
            '        }',
            '    }',
            '}',
            '',
          ].join('\n');

    const result = await runSynthetic(language, code, { meta: fastLimits });

    expect(result.verdict).toBe('TLE');
    // What it must *not* be: the print loop is not an allocation problem.
    expect(result.tests[0]?.verdict).not.toBe('MLE');
  });

  it.each(LANGUAGES)('%s: reports a return too large to carry', async (language) => {
    // A wrong subsets-style answer can be tens of megabytes; serialised whole
    // it is parsed whole by zod and sent to the browser.
    const code =
      language === 'python'
        ? [
            'class Solution:',
            '    def solve(self, n):',
            '        return ["x" * 1000] * 4000',
            '',
          ].join('\n')
        : [
            'import java.util.*;',
            '',
            'class Solution {',
            '    public List<String> solve(int n) {',
            '        List<String> out = new ArrayList<>();',
            '        String chunk = "x".repeat(1000);',
            '        for (int i = 0; i < 4000; i++) {',
            '            out.add(chunk);',
            '        }',
            '        return out;',
            '    }',
            '}',
            '',
          ].join('\n');

    const result = await runSynthetic(language, code, { meta: fastLimits });

    expect(result.verdict).toBe('RE');
    expect(result.tests[0]?.message).toMatch(/past the 2 MB the judge will carry/);
    // And the run survived it: this is one failing test, not a broken judge.
    expect(result.tests).toHaveLength(1);
  });

  it('python: an uninterruptible call still ends as a timeout', async () => {
    /*
     * The harness's own watchdog is a `threading.Timer`, and a C call holding
     * the GIL keeps it from firing at all - so before P2-13 the only bound was
     * the batch's whole wall clock, and then the isolation fallback ran every
     * test again. The judge now watches the results file and kills the process
     * when nothing has arrived for a per-test budget plus slack.
     *
     * The *bound* is asserted in `process.test.ts`, where a fake progress
     * function makes it deterministic. What matters here is that a real
     * uninterruptible call is reported as a timeout rather than as a crash.
     */
    const code = [
      'class Solution:',
      '    def solve(self, n):',
      '        # Allocating a gigantic list holds the GIL inside C.',
      '        return len([0] * (10 ** 10))',
      '',
    ].join('\n');

    const result = await runSynthetic('python', code, { meta: fastLimits });

    expect(result.verdict).toBe('TLE');
    expect(result.tests[0]?.message).toMatch(/time limit/i);
  });
});
