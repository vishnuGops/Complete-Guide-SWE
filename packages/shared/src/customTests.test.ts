import { describe, expect, it } from 'vitest';
import {
  MAX_CUSTOM_TESTS,
  checkCustomTest,
  customTestShape,
  parseCustomTest,
  parseCustomTests,
  type CustomTestShape,
} from './customTests.js';
import { problemMetaSchema, testsFileSchema, type ProblemMeta, type TestsFile } from './problem.js';

const functionMeta: ProblemMeta = problemMetaSchema.parse({
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
});

const functionTests: TestsFile = testsFileSchema.parse({
  samples: [
    { args: [[2, 7, 11], 9], expected: [0, 1], explanation: 'first two' },
    { args: [[3, 3], 6], expected: [0, 1], explanation: 'duplicates' },
    { args: [[1, 2, 3], 5], expected: [1, 2], explanation: 'last two' },
  ],
  hidden: [],
});

const operationsMeta: ProblemMeta = problemMetaSchema.parse({
  id: 'min-value-stack',
  slug: 'min-value-stack',
  title: 'Min Value Stack',
  version: 1,
  topic: 'stack',
  patterns: ['design'],
  tier: 'Medium',
  rating: 5,
  order: 0,
  mode: 'operations',
  entry: 'MinValueStack',
  expect: 'return',
});

const operationsTests: TestsFile = testsFileSchema.parse({
  samples: [
    {
      args: [],
      ops: [
        { method: 'push', args: [3] },
        { method: 'minimum', args: [] },
      ],
      expected: [null, 3],
      explanation: 'push then read',
    },
    {
      args: [],
      ops: [
        { method: 'push', args: [1] },
        { method: 'pop', args: [] },
      ],
      expected: [null, 1],
      explanation: 'push then pop',
    },
  ],
  hidden: [],
});

const functionShape = customTestShape(functionMeta, functionTests);
const operationsShape = customTestShape(operationsMeta, operationsTests);

describe('customTestShape', () => {
  it('takes the argument count from the problem own samples', () => {
    expect(functionShape.argCount).toBe(2);
    expect(functionShape.mode).toBe('function');
  });

  it('offers the first sample as the editor prefill', () => {
    expect(functionShape.example).toEqual(['[2,7,11]', '9']);
  });

  it('collects the methods an operations problem uses, deduplicated and sorted', () => {
    expect(operationsShape.methods).toEqual(['minimum', 'pop', 'push']);
    expect(operationsShape.argCount).toBe(0);
  });

  it('survives a problem with no samples rather than throwing', () => {
    const empty = customTestShape(functionMeta, testsFileSchema.parse({ samples: [], hidden: [] }));
    expect(empty.argCount).toBe(0);
    expect(empty.example).toEqual([]);
  });
});

describe('parseCustomTest: function mode', () => {
  it('parses one JSON value per argument', () => {
    const parsed = parseCustomTest({ args: ['[1, 2, 3]', '5'] }, functionShape);
    expect(parsed).toEqual({ ok: true, test: { args: [[1, 2, 3], 5] } });
  });

  it('accepts every JSON shape the wire format allows', () => {
    const shape: CustomTestShape = { ...functionShape, argCount: 5 };
    const parsed = parseCustomTest(
      { args: ['null', 'true', '"text"', '-0.5', '[[1],[2]]'] },
      shape,
    );
    expect(parsed.ok && parsed.test.args).toEqual([null, true, 'text', -0.5, [[1], [2]]]);
  });

  it('names the argument that failed to parse', () => {
    const parsed = parseCustomTest({ args: ['[1, 2', '5'] }, functionShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]?.argIndex).toBe(0);
    expect(parsed.issues[0]?.message).toMatch(/not valid JSON/);
  });

  it('reports every bad argument at once rather than stopping at the first', () => {
    const parsed = parseCustomTest({ args: ['oops', 'also oops'] }, functionShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.map((i) => i.argIndex)).toEqual([0, 1]);
  });

  it('rejects an empty argument box', () => {
    const parsed = parseCustomTest({ args: ['', '5'] }, functionShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]).toEqual({ argIndex: 0, message: 'is empty' });
  });

  it('rejects the wrong number of arguments', () => {
    const parsed = parseCustomTest({ args: ['[1]'] }, functionShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]?.message).toBe('expected 2 arguments, got 1');
  });

  it('rejects a call list on a problem that has no operations', () => {
    const parsed = parseCustomTest({ args: ['[1]', '2'], ops: '[["push", [1]]]' }, functionShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]?.message).toMatch(/not an operations problem/);
  });
});

describe('parseCustomTest: operations mode', () => {
  it('parses the constructor arguments and the call list', () => {
    const parsed = parseCustomTest(
      { args: [], ops: '[["push", [4]], ["minimum", []]]' },
      operationsShape,
    );
    expect(parsed).toEqual({
      ok: true,
      test: {
        args: [],
        ops: [
          { method: 'push', args: [4] },
          { method: 'minimum', args: [] },
        ],
      },
    });
  });

  it('requires a call list, since a constructed object alone proves nothing', () => {
    const parsed = parseCustomTest({ args: [] }, operationsShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]?.message).toMatch(/needs a list of calls/);
  });

  it('rejects an empty call list', () => {
    const parsed = parseCustomTest({ args: [], ops: '[]' }, operationsShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]?.message).toMatch(/nothing to run/);
  });

  it('rejects a method the problem does not have, and says which it does', () => {
    const parsed = parseCustomTest({ args: [], ops: '[["puhs", [1]]]' }, operationsShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]?.message).toContain('no method "puhs"');
    expect(parsed.issues[0]?.message).toContain('minimum, pop, push');
  });

  it('rejects a call that is not a [method, args] pair', () => {
    const parsed = parseCustomTest({ args: [], ops: '["push"]' }, operationsShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]?.message).toMatch(/\[method, args\] pair/);
  });

  it('rejects arguments that are not an array', () => {
    const parsed = parseCustomTest({ args: [], ops: '[["push", 1]]' }, operationsShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]?.message).toMatch(/must be an array/);
  });

  it('rejects a call list that is not JSON at all', () => {
    const parsed = parseCustomTest({ args: [], ops: 'push(1)' }, operationsShape);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]?.message).toMatch(/not valid JSON/);
  });
});

describe('parseCustomTests', () => {
  it('parses a whole panel', () => {
    const parsed = parseCustomTests(
      [{ args: ['[1]', '1'] }, { args: ['[2]', '2'] }],
      functionShape,
    );
    expect(parsed.ok && parsed.tests).toHaveLength(2);
  });

  it('says which case each issue belongs to', () => {
    const parsed = parseCustomTests(
      [{ args: ['[1]', '1'] }, { args: ['nope', '2'] }],
      functionShape,
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]).toMatchObject({ case: 1, argIndex: 0 });
  });

  it('caps the number of cases', () => {
    const many = Array.from({ length: MAX_CUSTOM_TESTS + 1 }, () => ({ args: ['[1]', '1'] }));
    expect(parseCustomTests(many, functionShape).ok).toBe(false);
  });
});

describe('checkCustomTest', () => {
  it('accepts a case that fits the problem', () => {
    expect(checkCustomTest({ args: [[1, 2], 3] }, functionShape)).toEqual([]);
  });

  it('rejects the wrong arity, whatever the editor thought', () => {
    expect(checkCustomTest({ args: [[1, 2]] }, functionShape)).toHaveLength(1);
  });

  it('refuses a case that carries its own expected output', () => {
    // Otherwise the page, not the problem, would decide what counts as correct.
    const issues = checkCustomTest({ args: [[1, 2], 3], expected: [0, 1] }, functionShape);
    expect(issues[0]?.message).toMatch(/cannot carry its own expected output/);

    const mutated = checkCustomTest(
      { args: [[1, 2], 3], expectedMutatedArgs: [{ index: 0, value: [2, 1] }] },
      functionShape,
    );
    expect(mutated[0]?.message).toMatch(/cannot carry its own expected output/);
  });

  it('rejects an unknown method in operations mode', () => {
    const issues = checkCustomTest(
      { args: [], ops: [{ method: 'drop', args: [] }] },
      operationsShape,
    );
    expect(issues[0]?.message).toContain('no method "drop"');
  });

  it('rejects an operations case with no calls', () => {
    expect(checkCustomTest({ args: [] }, operationsShape)).toHaveLength(1);
  });

  it('rejects calls on a function-mode problem', () => {
    const issues = checkCustomTest(
      { args: [[1], 1], ops: [{ method: 'push', args: [] }] },
      functionShape,
    );
    expect(issues[0]?.message).toMatch(/not an operations problem/);
  });
});
