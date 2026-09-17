import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIMEOUT_MS,
  comparatorSchema,
  operationSchema,
  problemMetaSchema,
  slugSchema,
  testCaseSchema,
  testsFileSchema,
  timeoutFor,
  expectsMutatedArgs,
  expectsReturn,
} from './problem.js';
import { tierForRating } from './curriculum.js';

const functionMeta = {
  id: 'pair-sum-index',
  slug: 'pair-sum-index',
  title: 'Pair Sum Index',
  version: 1,
  topic: 'arrays',
  patterns: ['hash map'],
  tier: 'Easy',
  rating: 2,
  order: 0,
  mode: 'function',
  entry: 'pairSumIndex',
  expect: 'return',
} as const;

describe('slugSchema', () => {
  it.each(['two-sum', 'lru-cache', 'k3-sum', 'abc'])('accepts %s', (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it.each([
    ['uppercase', 'Two-Sum'],
    ['underscores', 'two_sum'],
    ['leading dash', '-two-sum'],
    ['trailing dash', 'two-sum-'],
    ['double dash', 'two--sum'],
    ['too short', 'ab'],
    ['spaces', 'two sum'],
  ])('rejects %s', (_label, slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false);
  });
});

describe('comparatorSchema', () => {
  it('expands the string shorthand for option-less kinds', () => {
    expect(comparatorSchema.parse('exact')).toEqual({ kind: 'exact' });
    expect(comparatorSchema.parse('unorderedListOfLists')).toEqual({
      kind: 'unorderedListOfLists',
    });
  });

  it('rejects the shorthand for floatTolerance, which needs an eps', () => {
    expect(comparatorSchema.safeParse('floatTolerance').success).toBe(false);
  });

  it('accepts floatTolerance in object form', () => {
    expect(comparatorSchema.parse({ kind: 'floatTolerance', eps: 1e-6 })).toEqual({
      kind: 'floatTolerance',
      eps: 1e-6,
    });
  });

  it('rejects a non-positive eps', () => {
    expect(comparatorSchema.safeParse({ kind: 'floatTolerance', eps: 0 }).success).toBe(false);
    expect(comparatorSchema.safeParse({ kind: 'floatTolerance', eps: -1 }).success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(comparatorSchema.safeParse({ kind: 'closeEnough' }).success).toBe(false);
    expect(comparatorSchema.safeParse('closeEnough').success).toBe(false);
  });
});

describe('problemMetaSchema', () => {
  it('fills defaults for comparator, limits and related', () => {
    const meta = problemMetaSchema.parse(functionMeta);
    expect(meta.comparator).toEqual({ kind: 'exact' });
    expect(meta.related).toEqual([]);
    expect(meta.limits).toEqual({});
  });

  it.each([
    ['Easy', 1],
    ['Easy', 3],
    ['Medium', 4],
    ['Medium', 7],
    ['Hard', 8],
    ['Hard', 10],
  ])('accepts %s at rating %i', (tier, rating) => {
    expect(problemMetaSchema.safeParse({ ...functionMeta, tier, rating }).success).toBe(true);
  });

  it.each([
    ['Easy', 4],
    ['Medium', 3],
    ['Medium', 8],
    ['Hard', 7],
  ])('rejects %s at rating %i as out of band', (tier, rating) => {
    const result = problemMetaSchema.safeParse({ ...functionMeta, tier, rating });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'rating')).toBe(true);
    }
  });

  it('rejects a rating outside 1-10 entirely', () => {
    expect(problemMetaSchema.safeParse({ ...functionMeta, rating: 0 }).success).toBe(false);
    expect(problemMetaSchema.safeParse({ ...functionMeta, tier: 'Hard', rating: 11 }).success).toBe(
      false,
    );
    expect(problemMetaSchema.safeParse({ ...functionMeta, rating: 2.5 }).success).toBe(false);
  });

  it('rejects a self-referential related list', () => {
    const result = problemMetaSchema.safeParse({
      ...functionMeta,
      related: ['pair-sum-index'],
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one pattern', () => {
    expect(problemMetaSchema.safeParse({ ...functionMeta, patterns: [] }).success).toBe(false);
  });

  describe('function mode', () => {
    it('accepts every expect mode', () => {
      for (const expectMode of ['return', 'mutatedArgs', 'both'] as const) {
        expect(problemMetaSchema.safeParse({ ...functionMeta, expect: expectMode }).success).toBe(
          true,
        );
      }
    });

    it('rejects an entry that is not an identifier', () => {
      expect(problemMetaSchema.safeParse({ ...functionMeta, entry: 'pair sum' }).success).toBe(
        false,
      );
      expect(problemMetaSchema.safeParse({ ...functionMeta, entry: '2sum' }).success).toBe(false);
    });
  });

  describe('operations mode', () => {
    const opsMeta = {
      ...functionMeta,
      id: 'min-stack',
      slug: 'min-stack',
      title: 'Min Stack',
      topic: 'stack',
      mode: 'operations',
      entry: 'MinStack',
      expect: 'return',
    } as const;

    it('accepts a class-name entry with expect: return', () => {
      expect(problemMetaSchema.safeParse(opsMeta).success).toBe(true);
    });

    it('rejects mutatedArgs, which has no meaning without an argument list', () => {
      expect(problemMetaSchema.safeParse({ ...opsMeta, expect: 'mutatedArgs' }).success).toBe(
        false,
      );
      expect(problemMetaSchema.safeParse({ ...opsMeta, expect: 'both' }).success).toBe(false);
    });

    it('rejects a lowercase entry, which would not be a class name', () => {
      expect(problemMetaSchema.safeParse({ ...opsMeta, entry: 'minStack' }).success).toBe(false);
    });
  });

  it('rejects an unknown mode', () => {
    expect(problemMetaSchema.safeParse({ ...functionMeta, mode: 'stdin' }).success).toBe(false);
  });
});

describe('testCaseSchema', () => {
  it('accepts a bare function-mode case', () => {
    const parsed = testCaseSchema.parse({ args: [[2, 7, 11, 15], 9], expected: [0, 1] });
    expect(parsed.args).toHaveLength(2);
    expect(parsed.ops).toBeUndefined();
  });

  it('accepts an expected value of null without treating it as absent', () => {
    const parsed = testCaseSchema.parse({ args: [[]], expected: null });
    expect('expected' in parsed).toBe(true);
    expect(parsed.expected).toBeNull();
  });

  it('accepts mutated args addressed by index', () => {
    const parsed = testCaseSchema.parse({
      args: [[1, 2, 3], 1],
      expected: 3,
      expectedMutatedArgs: [{ index: 0, value: [3, 1, 2] }],
    });
    expect(parsed.expectedMutatedArgs?.[0]?.index).toBe(0);
  });

  it('rejects a negative mutated-arg index', () => {
    expect(
      testCaseSchema.safeParse({
        args: [[1]],
        expectedMutatedArgs: [{ index: -1, value: [1] }],
      }).success,
    ).toBe(false);
  });

  it('defaults operation args to an empty list for no-arg methods', () => {
    expect(operationSchema.parse({ method: 'pop' })).toEqual({ method: 'pop', args: [] });
  });

  it('rejects an empty method name', () => {
    expect(operationSchema.safeParse({ method: '', args: [] }).success).toBe(false);
  });

  it('rejects an empty explanation string', () => {
    expect(testCaseSchema.safeParse({ args: [], explanation: '' }).success).toBe(false);
  });
});

describe('testsFileSchema', () => {
  it('parses a file with both pools', () => {
    const parsed = testsFileSchema.parse({
      samples: [{ args: [1], expected: 1, explanation: 'identity' }],
      hidden: [{ args: [2], expected: 2 }],
    });
    expect(parsed.samples).toHaveLength(1);
    expect(parsed.hidden).toHaveLength(1);
  });

  it('requires both keys to be present, even when empty', () => {
    expect(testsFileSchema.safeParse({ samples: [] }).success).toBe(false);
  });
});

describe('timeoutFor', () => {
  it('falls back to the per-language default', () => {
    expect(timeoutFor(undefined, 'python')).toBe(DEFAULT_TIMEOUT_MS.python);
    expect(timeoutFor({}, 'java')).toBe(DEFAULT_TIMEOUT_MS.java);
  });

  it('gives Python twice Java by default, per the authoring convention', () => {
    expect(DEFAULT_TIMEOUT_MS.python).toBe(DEFAULT_TIMEOUT_MS.java * 2);
  });

  it('uses a per-problem override when present, per language', () => {
    const limits = { timeoutMs: { python: 8000 } };
    expect(timeoutFor(limits, 'python')).toBe(8000);
    expect(timeoutFor(limits, 'java')).toBe(DEFAULT_TIMEOUT_MS.java);
  });
});

describe('expect-mode helpers', () => {
  it('classifies each mode', () => {
    expect(expectsReturn('return')).toBe(true);
    expect(expectsReturn('mutatedArgs')).toBe(false);
    expect(expectsReturn('both')).toBe(true);
    expect(expectsMutatedArgs('return')).toBe(false);
    expect(expectsMutatedArgs('mutatedArgs')).toBe(true);
    expect(expectsMutatedArgs('both')).toBe(true);
  });
});

describe('tierForRating', () => {
  it('covers 1-10 with no gaps', () => {
    for (let r = 1; r <= 10; r += 1) {
      expect(tierForRating(r)).toBeDefined();
    }
  });

  it('returns undefined outside the scale', () => {
    expect(tierForRating(0)).toBeUndefined();
    expect(tierForRating(11)).toBeUndefined();
  });
});

describe('strictness of the on-disk format', () => {
  it('rejects an unknown key in meta.json, so typos fail loudly', () => {
    const result = problemMetaSchema.safeParse({ ...functionMeta, paterns: ['hash map'] });
    expect(result.success).toBe(false);
  });

  it('allows the $schema pointer used for editor completion', () => {
    expect(
      problemMetaSchema.safeParse({
        ...functionMeta,
        $schema: '../../../docs/schema/meta.schema.json',
      }).success,
    ).toBe(true);
    expect(
      testsFileSchema.safeParse({
        $schema: '../../../docs/schema/tests.schema.json',
        samples: [],
        hidden: [],
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown key in a test case', () => {
    expect(testCaseSchema.safeParse({ args: [1], output: 2 }).success).toBe(false);
  });

  it('rejects an unknown key in tests.json', () => {
    expect(testsFileSchema.safeParse({ samples: [], hidden: [], extra: [] }).success).toBe(false);
  });

  it('rejects an unknown key in an operation', () => {
    expect(operationSchema.safeParse({ method: 'get', arguments: [1] }).success).toBe(false);
  });
});
