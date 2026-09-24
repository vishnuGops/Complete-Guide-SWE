import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { validateCatalogue } from './validate.js';
import type { ValidationIssue } from './types.js';
import {
  VALID_META,
  catalogueWith,
  json,
  makeStatement,
  makeTests,
  writeProblem,
} from './__fixtures__/factory.js';

const roots: string[] = [];

function catalogue(...args: Parameters<typeof catalogueWith>): string {
  const root = catalogueWith(...args);
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

function issuesFor(root: string): ValidationIssue[] {
  const report = validateCatalogue({ root });
  return [...report.results.flatMap((r) => r.issues), ...report.crossIssues];
}

function errors(root: string): ValidationIssue[] {
  return issuesFor(root).filter((i) => i.severity === 'error');
}

function messages(issues: readonly ValidationIssue[]): string {
  return issues
    .map((i) => `${i.file}${i.jsonPath ? ` (${i.jsonPath})` : ''}: ${i.message}`)
    .join('\n');
}

function expectError(root: string, fragment: string | RegExp): ValidationIssue {
  const found = errors(root).find((i) =>
    typeof fragment === 'string' ? i.message.includes(fragment) : fragment.test(i.message),
  );
  expect(
    found,
    `no error matching ${String(fragment)}.\nGot:\n${messages(issuesFor(root))}`,
  ).toBeDefined();
  return found!;
}

describe('a valid problem', () => {
  it('passes every static rule with no errors and no warnings', () => {
    const root = catalogue();
    const report = validateCatalogue({ root });
    expect(messages(issuesFor(root))).toBe('');
    expect(report.ok).toBe(true);
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
  });

  it('reports the problem it found', () => {
    const root = catalogue();
    const report = validateCatalogue({ root });
    expect(report.results).toHaveLength(1);
    expect(report.results[0]?.pkg?.meta.slug).toBe('pair-sum-index');
  });

  it('reports an empty catalogue as ok', () => {
    const report = validateCatalogue({ root: catalogue({ slug: 'x' }) + '-missing' });
    expect(report.results).toHaveLength(0);
    expect(report.ok).toBe(true);
  });
});

describe('required files', () => {
  it.each([
    'meta.json',
    'statement.md',
    'tests.json',
    'hints.json',
    'editorial.md',
    'starter.py',
    'starter.java',
    'reference.py',
    'reference.java',
  ])('reports %s when it is missing', (file) => {
    const root = catalogue({ files: { [file]: null } });
    const issue = expectError(root, 'required file is missing');
    expect(issue.file).toBe(`problems/arrays/pair-sum-index/${file}`);
  });

  it('reports an empty file separately from a missing one', () => {
    const root = catalogue({ files: { 'editorial.md': '   \n' } });
    expect(expectError(root, 'file is empty').file).toBe(
      'problems/arrays/pair-sum-index/editorial.md',
    );
  });

  it('points at the file when JSON does not parse', () => {
    const root = catalogue({ files: { 'tests.json': '{ "samples": [ }' } });
    const issue = expectError(root, /invalid JSON/);
    expect(issue.file).toBe('problems/arrays/pair-sum-index/tests.json');
  });

  it('warns when generator.py is absent, since hidden tests cannot be regenerated', () => {
    const root = catalogue({ files: { 'generator.py': null } });
    const warnings = issuesFor(root).filter((i) => i.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('no generator.py'))).toBe(true);
    expect(validateCatalogue({ root }).ok).toBe(true);
  });
});

describe('meta.json schema', () => {
  it('reports the JSON path of a schema violation', () => {
    const root = catalogue({ files: { 'meta.json': json({ ...VALID_META, rating: 9 }) } });
    const issue = expectError(root, /outside the Easy band/);
    expect(issue.jsonPath).toBe('rating');
    expect(issue.file).toBe('problems/arrays/pair-sum-index/meta.json');
  });

  it('rejects an unknown key rather than dropping it', () => {
    const root = catalogue({ files: { 'meta.json': json({ ...VALID_META, paterns: ['x'] }) } });
    expect(errors(root).length).toBeGreaterThan(0);
  });

  it('does not attempt semantic rules when meta.json is unparseable', () => {
    const root = catalogue({ files: { 'meta.json': json({ slug: 'x' }) } });
    const report = validateCatalogue({ root });
    expect(report.results[0]?.pkg).toBeUndefined();
    expect(report.ok).toBe(false);
  });
});

describe('directory agreement', () => {
  it('rejects a slug that does not match its directory', () => {
    const root = catalogue({ slug: 'pair-sum', files: { 'meta.json': json(VALID_META) } });
    expectError(root, 'does not match its directory');
  });

  it('rejects a topic that does not match its parent directory', () => {
    const root = catalogue({ topic: 'hashmap' });
    expectError(root, 'does not match its parent directory');
  });
});

describe('test pools', () => {
  it('requires at least three samples', () => {
    const root = catalogue({
      files: {
        'tests.json': json(makeTests(2, 10)),
        'statement.md': makeStatement(2),
      },
    });
    expectError(root, 'at least 3 samples');
  });

  it('requires at least ten hidden tests and names the generator command', () => {
    const root = catalogue({ files: { 'tests.json': json(makeTests(3, 4)) } });
    expectError(root, /at least 10 hidden tests.*problems:gen pair-sum-index/s);
  });

  it('requires an explanation on every sample', () => {
    const tests = makeTests();
    delete (tests.samples[1] as { explanation?: string }).explanation;
    const root = catalogue({ files: { 'tests.json': json(tests) } });
    expect(expectError(root, 'every sample needs an explanation').jsonPath).toBe(
      'samples[1].explanation',
    );
  });

  it('checks the two argument slots a cyclic chain needs (P2-15)', () => {
    const cyclic = { ...VALID_META, entry: 'hasCycle', cycle: { chain: 0, at: 1 } };
    const testsWith = (args: unknown[], expected: unknown) =>
      json({
        samples: [{ name: 'a chain', args, expected, explanation: 'x' }],
        hidden: [],
      });

    // The index is missing entirely. Left to the harness this is a runtime
    // error on every test, which reads as the solution's fault rather than the
    // author's.
    expectError(
      catalogue({ files: { 'meta.json': json(cyclic), 'tests.json': testsWith([[1, 2]], true) } }),
      'a cyclic chain needs 2 argument(s)',
    );

    // Past the end of the chain: a generator bug, said once.
    expectError(
      catalogue({
        files: { 'meta.json': json(cyclic), 'tests.json': testsWith([[1, 2], 5], true) },
      }),
      'cycle index 5 is past the end of a chain of 2',
    );

    // Not a whole number.
    expectError(
      catalogue({
        files: { 'meta.json': json(cyclic), 'tests.json': testsWith([[1, 2], 'x'], true) },
      }),
      'must be a whole number, or -1 for no cycle',
    );

    // And -1 is the ordinary open chain, which must pass.
    const open = catalogue({
      files: { 'meta.json': json(cyclic), 'tests.json': testsWith([[1, 2], -1], false) },
    });
    expect(messages(errors(open))).not.toContain('cycle index');
  });

  it('requires a name on every sample', () => {
    // Three of the seed problems had unnamed samples, so a failing one showed
    // in the results panel as its index and said nothing (P6-7).
    const tests = makeTests();
    delete (tests.samples[1] as { name?: string }).name;
    const root = catalogue({ files: { 'tests.json': json(tests) } });
    expect(expectError(root, 'every sample needs a name').jsonPath).toBe('samples[1].name');
  });

  it('catches tests that disagree about the entry method arity', () => {
    const tests = makeTests();
    tests.hidden[3]!.args = [[1, 2]] as never;
    const root = catalogue({ files: { 'tests.json': json(tests) } });
    expectError(root, /disagree on how many arguments/);
  });
});

describe('expect modes', () => {
  it('requires expected on every test when expect is return', () => {
    const tests = makeTests();
    delete (tests.hidden[2] as { expected?: unknown }).expected;
    const root = catalogue({ files: { 'tests.json': json(tests) } });
    expect(expectError(root, 'needs an "expected" value').jsonPath).toBe('hidden[2].expected');
  });

  it('requires expectedMutatedArgs on every test when expect is mutatedArgs', () => {
    const root = catalogue({
      files: { 'meta.json': json({ ...VALID_META, expect: 'mutatedArgs' }) },
    });
    expectError(root, 'needs a non-empty "expectedMutatedArgs"');
  });

  it('warns that expected is ignored under mutatedArgs', () => {
    const root = catalogue({
      files: { 'meta.json': json({ ...VALID_META, expect: 'mutatedArgs' }) },
    });
    const warnings = issuesFor(root).filter((i) => i.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('"expected" is ignored'))).toBe(true);
  });

  it('accepts a well-formed mutatedArgs problem', () => {
    const tests = {
      samples: Array.from({ length: 3 }, (_, i) => ({
        name: `rotation ${i}`,
        args: [[1, 2, 3], i],
        expectedMutatedArgs: [{ index: 0, value: [3, 1, 2] }],
        explanation: 'rotated',
      })),
      // Distinct from the samples: a hidden test that repeats one runs twice
      // on Submit, which the P6-0 check rejects.
      hidden: Array.from({ length: 10 }, (_, i) => ({
        args: [[1, 2, 3, i], 1],
        expectedMutatedArgs: [{ index: 0, value: [i, 1, 2, 3] }],
      })),
    };
    const root = catalogue({
      files: {
        'meta.json': json({ ...VALID_META, expect: 'mutatedArgs' }),
        'tests.json': json(tests),
      },
    });
    expect(messages(errors(root))).toBe('');
  });

  it('rejects a mutated-arg index beyond the argument list', () => {
    const tests = {
      samples: Array.from({ length: 3 }, () => ({
        name: 'x',
        args: [[1, 2, 3], 1],
        expectedMutatedArgs: [{ index: 5, value: [1] }],
        explanation: 'x',
      })),
      hidden: Array.from({ length: 10 }, () => ({
        args: [[1, 2, 3], 1],
        expectedMutatedArgs: [{ index: 0, value: [1] }],
      })),
    };
    const root = catalogue({
      files: {
        'meta.json': json({ ...VALID_META, expect: 'mutatedArgs' }),
        'tests.json': json(tests),
      },
    });
    expectError(root, 'is out of range');
  });

  it('rejects the same argument index listed twice', () => {
    const tests = {
      samples: Array.from({ length: 3 }, () => ({
        args: [[1, 2, 3], 1],
        expectedMutatedArgs: [
          { index: 0, value: [1] },
          { index: 0, value: [2] },
        ],
        explanation: 'x',
        name: 'x',
      })),
      hidden: Array.from({ length: 10 }, () => ({
        args: [[1, 2, 3], 1],
        expectedMutatedArgs: [{ index: 0, value: [1] }],
      })),
    };
    const root = catalogue({
      files: {
        'meta.json': json({ ...VALID_META, expect: 'mutatedArgs' }),
        'tests.json': json(tests),
      },
    });
    expectError(root, 'twice');
  });
});

describe('operations mode', () => {
  const opsMeta = {
    ...VALID_META,
    id: 'min-stack',
    slug: 'min-stack',
    title: 'Min Stack',
    topic: 'stack',
    mode: 'operations',
    entry: 'MinStack',
    expect: 'return',
  };

  /*
   * Both starters declare every method the tests call (P6-0).
   *
   * A design problem whose starter is missing one fails every test with a "no
   * method named" from inside the harness, which reads as a judge bug - so the
   * validator checks it, and this fixture has to satisfy it.
   */
  const opsSources = {
    'starter.py': [
      'class MinStack:',
      '    def __init__(self):',
      '        pass',
      '',
      '    def push(self, value):',
      '        pass',
      '',
      '    def getMin(self):',
      '        pass',
      '',
    ].join('\n'),
    'reference.py': [
      'class MinStack:',
      '    def __init__(self):',
      '        self.s = []',
      '',
      '    def push(self, value):',
      '        self.s.append(value)',
      '',
      '    def getMin(self):',
      '        return min(self.s)',
      '',
    ].join('\n'),
    'starter.java': [
      'import java.util.*;',
      '',
      'class MinStack {',
      '    MinStack() {}',
      '',
      '    void push(int value) {}',
      '',
      '    int getMin() {',
      '        return 0;',
      '    }',
      '}',
      '',
    ].join('\n'),
    'reference.java': [
      'import java.util.*;',
      '',
      'class MinStack {',
      '    private final List<Integer> s = new ArrayList<>();',
      '',
      '    MinStack() {}',
      '',
      '    void push(int value) {',
      '        s.add(value);',
      '    }',
      '',
      '    int getMin() {',
      '        return Collections.min(s);',
      '    }',
      '}',
      '',
    ].join('\n'),
  };

  /** One design test: push a value, read the minimum. */
  function opsCase(value: number, expected?: unknown[]) {
    return {
      args: [],
      ops: [
        { method: 'push', args: [value] },
        { method: 'getMin', args: [] },
      ],
      expected: expected ?? [null, value],
    };
  }

  function opsTests(expected?: unknown[]) {
    return {
      samples: Array.from({ length: 3 }, (_, i) => ({
        name: `sequence ${i + 1}`,
        ...opsCase(i + 1, expected),
        explanation: 'push then read min',
      })),
      // Distinct sequences: in operations mode a test's identity is its `ops`,
      // and a hidden test that repeats a sample runs twice on Submit (P6-0).
      hidden: Array.from({ length: 10 }, (_, i) => opsCase(100 + i)),
    };
  }

  it('accepts a well-formed design problem', () => {
    const root = catalogue({
      topic: 'stack',
      slug: 'min-stack',
      files: { 'meta.json': json(opsMeta), 'tests.json': json(opsTests()), ...opsSources },
    });
    expect(messages(errors(root))).toBe('');
  });

  it('requires one expected entry per op, counting void methods', () => {
    const root = catalogue({
      topic: 'stack',
      slug: 'min-stack',
      files: { 'meta.json': json(opsMeta), 'tests.json': json(opsTests([1])), ...opsSources },
    });
    expectError(root, /expected has 1 entries but there are 2 ops/);
  });

  it('requires a non-empty ops list', () => {
    const tests = opsTests();
    tests.samples[0]!.ops = [];
    tests.samples[0]!.expected = [];
    const root = catalogue({
      topic: 'stack',
      slug: 'min-stack',
      files: { 'meta.json': json(opsMeta), 'tests.json': json(tests), ...opsSources },
    });
    expectError(root, 'non-empty "ops" list');
  });

  it('rejects ops on a function-mode problem', () => {
    const tests = makeTests();
    tests.samples[0]! = { ...tests.samples[0]!, ops: [{ method: 'x', args: [] }] } as never;
    const root = catalogue({ files: { 'tests.json': json(tests) } });
    expectError(root, 'only meaningful in operations mode');
  });
});

describe('comparators and checkers', () => {
  it('requires checker.ts when the comparator is checker', () => {
    const root = catalogue({
      files: { 'meta.json': json({ ...VALID_META, comparator: 'checker' }) },
    });
    expectError(root, 'no checker.ts');
  });

  it('accepts a checker problem that ships checker.ts', () => {
    const root = catalogue({
      files: {
        'meta.json': json({ ...VALID_META, comparator: 'checker' }),
        'checker.ts': 'export default () => ({ pass: true });\n',
      },
    });
    expect(messages(errors(root))).toBe('');
  });

  it('warns when checker.ts is present but never loaded', () => {
    const root = catalogue({ files: { 'checker.ts': 'export default () => ({ pass: true });\n' } });
    const warnings = issuesFor(root).filter((i) => i.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('never loaded'))).toBe(true);
  });

  it('rejects floatTolerance without an eps', () => {
    const root = catalogue({
      files: { 'meta.json': json({ ...VALID_META, comparator: 'floatTolerance' }) },
    });
    expect(errors(root).length).toBeGreaterThan(0);
  });
});

describe('statement prose', () => {
  it('requires one Example heading per sample', () => {
    const root = catalogue({ files: { 'statement.md': makeStatement(2) } });
    expectError(root, /has 2 "### Example" heading\(s\) but tests.json declares 3/);
  });

  it.each(['## Input', '## Output', '## Constraints'])('requires the %s section', (heading) => {
    const root = catalogue({
      files: { 'statement.md': makeStatement().replace(heading, '## Other') },
    });
    expectError(root, `missing required section "${heading}"`);
  });

  it('rejects an image that is not in assets/', () => {
    const root = catalogue({
      files: { 'statement.md': `${makeStatement()}\n\n![grid](./grid.png)\n` },
    });
    expectError(root, 'must live under assets/');
  });

  it('rejects an assets/ image that does not exist', () => {
    const root = catalogue({
      files: { 'statement.md': `${makeStatement()}\n\n![grid](assets/grid.png)\n` },
    });
    expectError(root, 'does not exist in the problem');
  });

  it('accepts an assets/ image that does exist', () => {
    const root = catalogue({
      files: {
        'statement.md': `${makeStatement()}\n\n![grid](assets/grid.png)\n`,
        'assets/grid.png': 'not really a png',
      },
    });
    expect(messages(errors(root))).toBe('');
  });

  it('ignores remote images', () => {
    const root = catalogue({
      files: { 'statement.md': `${makeStatement()}\n\n![x](https://example.com/x.png)\n` },
    });
    expect(messages(errors(root))).toBe('');
  });
});

describe('starters and references', () => {
  it('requires class Solution in both Python files', () => {
    const root = catalogue({
      files: { 'starter.py': 'def pairSumIndex(nums, target):\n    pass\n' },
    });
    expectError(root, 'must declare "class Solution"');
  });

  it('requires the entry method in Python', () => {
    const root = catalogue({
      files: { 'starter.py': 'class Solution:\n    def somethingElse(self):\n        pass\n' },
    });
    expectError(root, 'must define the entry method "pairSumIndex"');
  });

  it('rejects a redefined ListNode, which would break deserialisation', () => {
    const root = catalogue({
      files: {
        'starter.py':
          'class ListNode:\n    pass\n\n\nclass Solution:\n    def pairSumIndex(self, nums, target):\n        pass\n',
      },
    });
    expectError(root, 'injected by the harness');
  });

  it('rejects a public Java class, which cannot be saved as Solution.java', () => {
    const root = catalogue({
      files: {
        'starter.java':
          'import java.util.*;\n\npublic class Solution {\n    public int[] pairSumIndex(int[] nums, int target) { return null; }\n}\n',
      },
    });
    expectError(root, 'must not be public');
  });

  it('rejects a Java class the harness owns', () => {
    const root = catalogue({
      files: {
        'reference.java':
          'import java.util.*;\n\nclass DevProMaxJson {}\n\nclass Solution {\n    public int[] pairSumIndex(int[] nums, int target) { return null; }\n}\n',
      },
    });
    expectError(root, 'class DevProMaxJson is owned by the judge harness');
  });

  it('accepts a Java helper class named Main, which the harness no longer uses', () => {
    const root = catalogue({
      files: {
        'reference.java':
          'import java.util.*;\n\nclass Main {}\n\nclass Solution {\n    public int[] pairSumIndex(int[] nums, int target) { return new int[] {0, 1}; }\n}\n',
      },
    });
    expect(messages(errors(root))).not.toContain('harness');
  });
});

describe('catalogue-wide rules', () => {
  it('rejects a duplicate id across two problems', () => {
    const root = catalogue();
    writeProblem(root, {
      topic: 'hashmap',
      slug: 'other-problem',
      files: {
        'meta.json': json({
          ...VALID_META,
          slug: 'other-problem',
          topic: 'hashmap',
          title: 'Other Problem',
        }),
      },
    });
    expectError(root, /id "pair-sum-index" is also used by/);
  });

  it('rejects a related slug that does not exist', () => {
    const root = catalogue({
      files: { 'meta.json': json({ ...VALID_META, related: ['no-such-problem'] }) },
    });
    const issue = expectError(root, 'does not exist in the catalogue');
    expect(issue.jsonPath).toBe('related[0]');
  });

  it('accepts a related slug that does exist', () => {
    const root = catalogue({
      files: { 'meta.json': json({ ...VALID_META, related: ['three-sum-zero'] }) },
    });
    writeProblem(root, {
      topic: 'arrays',
      slug: 'three-sum-zero',
      files: {
        'meta.json': json({
          ...VALID_META,
          id: 'three-sum-zero',
          slug: 'three-sum-zero',
          title: 'Three Sum Zero',
          order: 1,
        }),
      },
    });
    expect(messages(errors(root))).toBe('');
  });
});

describe('slug filtering', () => {
  it('reports only the requested problem', () => {
    const root = catalogue();
    writeProblem(root, {
      topic: 'hashmap',
      slug: 'other-problem',
      files: {
        'meta.json': json({
          ...VALID_META,
          id: 'other-problem',
          slug: 'other-problem',
          topic: 'hashmap',
          title: 'Other Problem',
        }),
        'tests.json': json(makeTests(1, 1)),
      },
    });

    const all = validateCatalogue({ root });
    expect(all.results).toHaveLength(2);
    expect(all.ok).toBe(false);

    const scoped = validateCatalogue({ root, slug: 'pair-sum-index' });
    expect(scoped.results).toHaveLength(1);
    expect(scoped.ok).toBe(true);
  });
});

describe('wire integers (D22, P2-12)', () => {
  /** The valid tests file with one value replaced. */
  function testsWith(value: unknown, field: 'expected' | 'args' = 'expected'): string {
    const tests = JSON.parse(json(makeTests())) as {
      samples: { args: unknown[]; expected: unknown }[];
      hidden: unknown[];
    };
    if (field === 'expected') tests.samples[0]!.expected = value;
    else tests.samples[0]!.args = [value];
    return json(tests);
  }

  it('rejects a test value too large to survive JSON', () => {
    const root = catalogue({ files: { 'tests.json': testsWith(Number.MAX_SAFE_INTEGER + 2) } });

    const issue = expectError(root, 'too large to survive JSON');
    expect(issue.jsonPath).toBe('samples[0].expected');
    // The message says what to do instead, because "use a smaller number" is
    // not advice for a problem about large sums.
    expect(issue.message).toMatch(/modulo 10\^9\+7/);
  });

  it('names the element inside an argument', () => {
    const root = catalogue({ files: { 'tests.json': testsWith([1, 2 ** 53], 'args') } });

    const issue = expectError(root, 'too large to survive JSON');
    expect(issue.jsonPath).toBe('samples[0].args[0][1]');
  });

  it('accepts the boundary itself', () => {
    const root = catalogue({ files: { 'tests.json': testsWith(Number.MAX_SAFE_INTEGER) } });

    expect(errors(root).some((issue) => issue.message.includes('too large'))).toBe(false);
  });
});

/**
 * The rules the seed catalogue taught us (ROADMAP P6-0).
 *
 * Each of these shipped in twenty problems before anyone looked, which is the
 * argument for checking them mechanically rather than in review.
 */
describe('seed-catalogue rules (P6-0)', () => {
  it('warns when the hidden tests never reach a stated size bound (D21)', () => {
    // The defect: three problems claimed 10^5 and generated a thousand, so the
    // quadratic solution their own editorials said would time out passed.
    const root = catalogue({
      files: {
        'statement.md': makeStatement().replace(
          '2 <= nums.length <= 3',
          '2 <= nums.length <= 10^5',
        ),
      },
    });

    const issue = issuesFor(root).find((i) => i.message.includes('the statement allows up to'));
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('100000');
  });

  it('ignores a value range, which bounds the numbers rather than the work', () => {
    // `-10^9 <= nums[i] <= 10^9` does not ask for a billion of anything, and an
    // earlier version of this check flagged every problem that had one.
    const root = catalogue({
      files: {
        'statement.md': makeStatement().replace(
          '- `2 <= nums.length <= 3`',
          '- `2 <= nums.length <= 3`\n- `-10^9 <= nums[i] <= 10^9`',
        ),
      },
    });

    expect(issuesFor(root).some((i) => i.message.includes('the statement allows up to'))).toBe(
      false,
    );
  });

  /**
   * Some problems carry their size in a scalar (P6-5).
   *
   * `combinations-of-k` takes `n` and `k` and builds its own data; the hidden
   * tests hold no array at all, so measuring only lengths reported 0 and the
   * check fired however large `n` was.
   */
  it('counts a scalar argument towards a size bound that names one', () => {
    const root = catalogue({
      files: {
        'statement.md': makeStatement().replace('- `2 <= nums.length <= 3`', '- `1 <= n <= 14`'),
        'tests.json': json({
          samples: [{ name: 'a', args: [14, 3], expected: [0, 2] }],
          hidden: Array.from({ length: 10 }, (_, i) => ({ args: [14, i], expected: [0, 2] })),
        }),
      },
    });

    expect(issuesFor(root).some((i) => i.message.includes('the statement allows up to'))).toBe(
      false,
    );
  });

  it('still warns when the scalar the bound names stays small', () => {
    const root = catalogue({
      files: {
        'statement.md': makeStatement().replace('- `2 <= nums.length <= 3`', '- `1 <= n <= 14`'),
        'tests.json': json({
          samples: [{ name: 'a', args: [2, 1], expected: [0, 2] }],
          hidden: Array.from({ length: 10 }, (_, i) => ({ args: [2, i % 2], expected: [0, 2] })),
        }),
      },
    });

    const issue = issuesFor(root).find((i) => i.message.includes('the statement allows up to'));
    expect(issue?.severity).toBe('warning');
  });

  it('does not let an out-of-range scalar satisfy a size bound', () => {
    // A `target` of a million says nothing about how much input there is, and
    // must not silence a size bound of ten thousand.
    const root = catalogue({
      files: {
        'statement.md': makeStatement().replace('- `2 <= nums.length <= 3`', '- `1 <= n <= 10000`'),
        'tests.json': json({
          samples: [{ name: 'a', args: [2, 1000000], expected: [0, 2] }],
          hidden: Array.from({ length: 10 }, (_, i) => ({
            args: [2, 1000000 + i],
            expected: [0, 2],
          })),
        }),
      },
    });

    const issue = issuesFor(root).find((i) => i.message.includes('the statement allows up to'));
    expect(issue?.severity).toBe('warning');
  });

  it('rejects code in a hint, structurally', () => {
    for (const hint of [
      'Use `sorted(counts, key=lambda v: -counts[v])`.',
      'Write `values[:] = result` rather than rebinding.',
      'Then call `map.get(target - value)`.',
      'for (int i = 0; i < n; i++) { ... }',
    ]) {
      const root = catalogue({
        files: { 'hints.json': json({ hints: [hint, 'b', 'c', 'd'] }) },
      });
      const issue = expectError(root, 'must not contain code');
      expect(issue.jsonPath, hint).toBe('hints[0]');
    }
  });

  it('leaves prose alone, including a sentence that ends in a colon', () => {
    // The first version matched `\bfor\b.*:` and rejected "being asked for:
    // how often each value occurs", which is a sentence.
    const root = catalogue({
      files: {
        'hints.json': json({
          hints: [
            'Two things are being asked for: how often each value occurs, and an order over them.',
            'A map from value to count answers the first.',
            'Sort the distinct values, comparing counts before values.',
            'Insert after checking, so a value cannot pair with itself.',
          ],
        }),
      },
    });

    expect(issuesFor(root).some((i) => i.message.includes('must not contain code'))).toBe(false);
  });

  it('warns when a hint ladder is not four rungs', () => {
    const root = catalogue({ files: { 'hints.json': json({ hints: ['only one'] }) } });
    const issue = issuesFor(root).find((i) => i.message.includes('rung(s)'));
    expect(issue?.severity).toBe('warning');
  });

  it('rejects an example whose Input and Output share a paragraph', () => {
    const root = catalogue({
      files: {
        'statement.md': makeStatement().replaceAll(
          '`target = 4`\n\nOutput:',
          '`target = 4`\nOutput:',
        ),
      },
    });

    expectError(root, 'Input and Output in one paragraph');
  });

  it('requires the editorial to have an approach and a complexity', () => {
    const root = catalogue({
      files: { 'editorial.md': '## Approach\n\nOne pass with a hash map.\n' },
    });
    expectError(root, 'missing required section "## Complexity"');
  });

  it('rejects an operations test calling a method the starters do not declare', () => {
    // It would fail every test with a "no method named" from inside the
    // harness, which reads as a judge bug rather than a problem bug.
    const root = catalogue({
      topic: 'stack',
      slug: 'min-stack',
      files: {
        'meta.json': json({
          ...VALID_META,
          id: 'min-stack',
          slug: 'min-stack',
          topic: 'stack',
          title: 'Min Stack',
          mode: 'operations',
          entry: 'MinStack',
          expect: 'return',
          rating: 4,
          tier: 'Medium',
        }),
        'tests.json': json({
          samples: Array.from({ length: 3 }, (_, i) => ({
            name: `peek ${i}`,
            args: [],
            ops: [{ method: 'peek', args: [i] }],
            expected: [i],
            explanation: 'peek',
          })),
          hidden: Array.from({ length: 10 }, (_, i) => ({
            args: [],
            ops: [{ method: 'peek', args: [100 + i] }],
            expected: [100 + i],
          })),
        }),
        'starter.py': 'class MinStack:\n    def __init__(self):\n        pass\n',
        'reference.py': 'class MinStack:\n    def __init__(self):\n        pass\n',
        'starter.java': 'import java.util.*;\n\nclass MinStack {\n    MinStack() {}\n}\n',
        'reference.java': 'import java.util.*;\n\nclass MinStack {\n    MinStack() {}\n}\n',
      },
    });

    expectError(root, /tests call "peek", which starter\.py and starter\.java does not declare/);
  });
});

describe('the learning path (P6-1)', () => {
  it('rejects two problems sharing an order within a topic', () => {
    // `order` is the path (D8), and a tie is broken by slug - alphabetically,
    // which is to say by accident.
    const root = catalogue();
    writeProblem(root, {
      topic: 'arrays',
      slug: 'another-array-problem',
      files: {
        'meta.json': json({
          ...VALID_META,
          id: 'another-array-problem',
          slug: 'another-array-problem',
          title: 'Another Array Problem',
        }),
      },
    });

    const issue = expectError(root, /order 0 in arrays is also used by/);
    expect(issue.jsonPath).toBe('order');
  });

  it('accepts the same order in two different topics', () => {
    const root = catalogue();
    writeProblem(root, {
      topic: 'hashmap',
      slug: 'a-hashmap-problem',
      files: {
        'meta.json': json({
          ...VALID_META,
          id: 'a-hashmap-problem',
          slug: 'a-hashmap-problem',
          topic: 'hashmap',
          title: 'A HashMap Problem',
        }),
      },
    });

    expect(errors(root).some((issue) => issue.message.includes('is also used by'))).toBe(false);
  });

  it('rejects a pattern outside the vocabulary', () => {
    const root = catalogue({
      files: { 'meta.json': json({ ...VALID_META, patterns: ['hash-map'] }) },
    });
    expectError(root, /Invalid option/);
  });
});
