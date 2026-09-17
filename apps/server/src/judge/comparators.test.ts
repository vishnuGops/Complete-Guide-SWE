import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { TestCase } from '@devpromax/shared';
import {
  clearCheckerCache,
  compareUnorderedList,
  compareUnorderedListOfLists,
  compareValues,
  compareWithTolerance,
  deepEquals,
  loadChecker,
  numbersClose,
  preview,
} from './comparators.js';

const test: TestCase = { args: [] };

async function compare(
  expected: unknown,
  actual: unknown,
  comparator: Parameters<typeof compareValues>[2]['comparator'] = { kind: 'exact' },
) {
  return compareValues(expected as never, actual as never, { comparator, test });
}

describe('deepEquals', () => {
  it.each([
    ['primitives', 1, 1],
    ['strings', 'a', 'a'],
    ['booleans', true, true],
    ['nulls', null, null],
    ['empty arrays', [], []],
    ['nested arrays', [[1, [2]], []], [[1, [2]], []]],
    ['objects regardless of key order', { a: 1, b: 2 }, { b: 2, a: 1 }],
  ])('treats equal %s as equal', (_label, a, b) => {
    expect(deepEquals(a as never, b as never)).toBe(true);
  });

  it.each([
    ['different lengths', [1, 2], [1, 2, 3]],
    ['different order', [1, 2], [2, 1]],
    ['number vs string', 1, '1'],
    ['null vs zero', null, 0],
    ['null vs empty array', null, []],
    ['extra key', { a: 1 }, { a: 1, b: 2 }],
    ['nested difference', [[1, 2]], [[1, 3]]],
  ])('treats different %s as different', (_label, a, b) => {
    expect(deepEquals(a as never, b as never)).toBe(false);
  });

  it('treats -0 and 0 as equal, since they are the same number', () => {
    expect(deepEquals(-0, 0)).toBe(true);
    expect(deepEquals([-0], [0])).toBe(true);
  });

  it('distinguishes a missing value from null', () => {
    expect(deepEquals(undefined, null)).toBe(false);
    expect(deepEquals(undefined, undefined)).toBe(true);
  });

  it('handles large integers exactly', () => {
    expect(deepEquals(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(deepEquals(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1)).toBe(false);
  });
});

describe('exact comparator messages', () => {
  it('names the index of the first difference', async () => {
    const result = await compare([1, 2, 3], [1, 9, 3]);
    expect(result.pass).toBe(false);
    expect(result.message).toContain('[1]');
    expect(result.message).toContain('9');
  });

  it('reports a length mismatch as such', async () => {
    const result = await compare([1, 2, 3], [1, 2]);
    expect(result.message).toMatch(/length 2, expected 3/);
  });

  it('reports a type mismatch as such', async () => {
    const result = await compare([1], 'nope');
    expect(result.message).toMatch(/is string, expected array/);
  });

  it('describes a missing result', async () => {
    const result = await compare([1], undefined);
    expect(result.pass).toBe(false);
    expect(result.message).toContain('nothing');
  });

  it('descends into nested structures', async () => {
    const result = await compare(
      [
        [1, 2],
        [3, 4],
      ],
      [
        [1, 2],
        [3, 5],
      ],
    );
    expect(result.message).toContain('[1][1]');
  });

  it('passes on a match', async () => {
    expect((await compare({ a: [1, null] }, { a: [1, null] })).pass).toBe(true);
  });
});

describe('unorderedList', () => {
  it('ignores order', () => {
    expect(compareUnorderedList([1, 2, 3] as never, [3, 1, 2] as never).pass).toBe(true);
  });

  it('respects multiplicity', () => {
    expect(compareUnorderedList([1, 1, 2] as never, [1, 2, 2] as never).pass).toBe(false);
    expect(compareUnorderedList([1, 1, 2] as never, [2, 1, 1] as never).pass).toBe(true);
  });

  it('still requires nested order to match', () => {
    expect(compareUnorderedList([[1, 2]] as never, [[2, 1]] as never).pass).toBe(false);
  });

  it('reports what is missing', () => {
    const result = compareUnorderedList([1, 2] as never, [1, 3] as never);
    expect(result.message).toContain('missing 2');
  });

  it('rejects a non-list actual with a readable message', () => {
    const result = compareUnorderedList([1] as never, 5 as never);
    expect(result.message).toMatch(/expected a list of 1 item/);
  });

  it('handles empty lists', () => {
    expect(compareUnorderedList([] as never, [] as never).pass).toBe(true);
  });
});

describe('unorderedListOfLists', () => {
  it('ignores both outer and inner order', () => {
    expect(compareUnorderedListOfLists([[1, 2], [3]] as never, [[3], [2, 1]] as never).pass).toBe(
      true,
    );
  });

  it('respects inner multiplicity', () => {
    expect(compareUnorderedListOfLists([[1, 1]] as never, [[1]] as never).pass).toBe(false);
  });

  it('is the comparator subsets problems need', () => {
    const expected = [[], [1], [2], [1, 2]];
    const actual = [[2, 1], [], [2], [1]];
    expect(compareUnorderedListOfLists(expected as never, actual as never).pass).toBe(true);
  });

  it('rejects a missing group', () => {
    const result = compareUnorderedListOfLists([[1], [2]] as never, [[1], [3]] as never);
    expect(result.pass).toBe(false);
    expect(result.message).toContain('missing');
  });
});

describe('floatTolerance', () => {
  it('accepts values inside the absolute tolerance', () => {
    expect(numbersClose(0, 1e-9, 1e-6)).toBe(true);
    expect(compareWithTolerance(1.0 as never, 1.0000001 as never, 1e-6).pass).toBe(true);
  });

  it('rejects values outside it', () => {
    expect(compareWithTolerance(1.0 as never, 1.01 as never, 1e-6).pass).toBe(false);
  });

  it('uses a relative arm so large answers stay matchable', () => {
    expect(numbersClose(1e9, 1e9 + 100, 1e-6)).toBe(true);
    expect(numbersClose(1e9, 1.1e9, 1e-6)).toBe(false);
  });

  it('works near zero, where a relative test alone would not', () => {
    expect(numbersClose(0, 0, 1e-6)).toBe(true);
    expect(numbersClose(0, 1e-3, 1e-6)).toBe(false);
  });

  it('descends into lists', () => {
    expect(compareWithTolerance([1.0, 2.0] as never, [1.0000001, 2.0] as never, 1e-6).pass).toBe(
      true,
    );
    const bad = compareWithTolerance([1.0, 2.0] as never, [1.0, 2.5] as never, 1e-6);
    expect(bad.pass).toBe(false);
    expect(bad.message).toContain('[1]');
  });

  it('rejects a non-number where a number was expected', () => {
    const result = compareWithTolerance(1.5 as never, 'x' as never, 1e-6);
    expect(result.message).toMatch(/expected a number/);
  });

  it('compares non-numeric leaves exactly', () => {
    expect(compareWithTolerance(['a', 1.0] as never, ['a', 1.0] as never, 1e-6).pass).toBe(true);
    expect(compareWithTolerance(['a'] as never, ['b'] as never, 1e-6).pass).toBe(false);
  });

  it('treats -0 and 0 as equal', () => {
    expect(numbersClose(-0, 0, 1e-9)).toBe(true);
  });
});

describe('checker', () => {
  const dirs: string[] = [];

  afterEach(() => {
    clearCheckerCache();
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function writeChecker(body: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-checker-'));
    dirs.push(dir);
    const file = path.join(dir, 'checker.ts');
    fs.writeFileSync(file, body, 'utf8');
    return file;
  }

  it('loads a default-exported checker and uses its verdict', async () => {
    const file = writeChecker(
      `import type { CheckerFn } from '@devpromax/shared';
       const check: CheckerFn = ({ actual }) =>
         Array.isArray(actual) && actual.length === 2
           ? { pass: true }
           : { pass: false, message: 'expected exactly two items' };
       export default check;
      `,
    );
    const checker = await loadChecker(file);
    const good = await compareValues(null as never, [1, 2] as never, {
      comparator: { kind: 'checker' },
      test,
      checker,
    });
    expect(good.pass).toBe(true);

    const bad = await compareValues(null as never, [1] as never, {
      comparator: { kind: 'checker' },
      test,
      checker,
    });
    expect(bad.pass).toBe(false);
    expect(bad.message).toBe('expected exactly two items');
  });

  it('passes the authored test through, so a checker can re-derive the answer', async () => {
    const file = writeChecker(
      `export default ({ input, actual }: { input: { args: unknown[] }; actual: unknown }) => {
         const values = input.args[0] as number[];
         return actual === values.length
           ? { pass: true }
           : { pass: false, message: 'expected the length of the input' };
       };
      `,
    );
    const checker = await loadChecker(file);
    const result = await compareValues(null as never, 3 as never, {
      comparator: { kind: 'checker' },
      test: { args: [[7, 8, 9]] },
      checker,
    });
    expect(result.pass).toBe(true);
  });

  it('supports an async checker', async () => {
    const file = writeChecker('export default async () => ({ pass: true });\n');
    const checker = await loadChecker(file);
    expect((await checker({ input: test, expected: null, actual: null })).pass).toBe(true);
  });

  it('rejects a module with no default export', async () => {
    const file = writeChecker('export const check = () => ({ pass: true });\n');
    await expect(loadChecker(file)).rejects.toThrow(/default export/);
  });

  it('caches by path, so a checker is loaded once per run', async () => {
    const file = writeChecker('export default () => ({ pass: true });\n');
    const first = await loadChecker(file);
    const second = await loadChecker(file);
    expect(second).toBe(first);
  });

  it('fails loudly when the comparator is checker but none was loaded', async () => {
    await expect(compare(1, 1, { kind: 'checker' })).rejects.toThrow(/no checker was loaded/);
  });
});

describe('preview', () => {
  it('renders compact JSON', () => {
    expect(preview([1, 2] as never)).toBe('[1,2]');
    expect(preview(undefined)).toBe('(nothing)');
  });

  it('elides a long value rather than flooding the panel', () => {
    const long = Array.from({ length: 500 }, (_, i) => i);
    const text = preview(long as never);
    expect(text.length).toBeLessThan(260);
    expect(text).toContain('…');
    expect(text).toContain('chars)');
  });
});

describe('unknown comparators', () => {
  it('fails loudly rather than returning undefined', async () => {
    // Reaching this means unparsed meta.json got in: `"comparator": "exact"` is
    // a legal shorthand on disk but only becomes {kind:'exact'} via the schema.
    await expect(
      compareValues(1 as never, 1 as never, {
        comparator: 'exact' as never,
        test,
      }),
    ).rejects.toThrow(/unknown comparator/);
  });
});
