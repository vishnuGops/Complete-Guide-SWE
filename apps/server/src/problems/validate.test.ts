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
        args: [[1, 2, 3], i],
        expectedMutatedArgs: [{ index: 0, value: [3, 1, 2] }],
        explanation: 'rotated',
      })),
      hidden: Array.from({ length: 10 }, () => ({
        args: [[1, 2, 3], 1],
        expectedMutatedArgs: [{ index: 0, value: [3, 1, 2] }],
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

  const opsSources = {
    'starter.py': 'class MinStack:\n    def __init__(self):\n        pass\n',
    'reference.py': 'class MinStack:\n    def __init__(self):\n        self.s = []\n',
    'starter.java': 'import java.util.*;\n\nclass MinStack {\n    MinStack() {}\n}\n',
    'reference.java': 'import java.util.*;\n\nclass MinStack {\n    MinStack() {}\n}\n',
  };

  function opsTests(expected?: unknown[]) {
    const one = {
      args: [],
      ops: [
        { method: 'push', args: [1] },
        { method: 'getMin', args: [] },
      ],
      expected: expected ?? [null, 1],
    };
    return {
      samples: Array.from({ length: 3 }, () => ({ ...one, explanation: 'push then read min' })),
      hidden: Array.from({ length: 10 }, () => ({ ...one })),
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

  it('rejects a public Java class, which cannot be compiled beside Main', () => {
    const root = catalogue({
      files: {
        'starter.java':
          'import java.util.*;\n\npublic class Solution {\n    public int[] pairSumIndex(int[] nums, int target) { return null; }\n}\n',
      },
    });
    expectError(root, 'must not be public');
  });

  it('rejects a Java class named Main, which collides with the harness', () => {
    const root = catalogue({
      files: {
        'reference.java':
          'import java.util.*;\n\nclass Main {}\n\nclass Solution {\n    public int[] pairSumIndex(int[] nums, int target) { return null; }\n}\n',
      },
    });
    expectError(root, 'collides with the judge harness');
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
