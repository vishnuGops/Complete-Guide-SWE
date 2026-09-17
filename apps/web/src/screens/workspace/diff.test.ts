import { describe, expect, it } from 'vitest';
import { changedLines, firstDifference, formatValue } from './diff.js';

/**
 * Reading a Wrong Answer (ROADMAP P4-7).
 *
 * `firstDifference` is the assertion that matters: it is the one thing on the
 * results panel that turns "these two hundred-element arrays are not equal" into
 * a sentence, and it is shown as fact, so it has to be right about *where*.
 */

describe('formatValue', () => {
  it('keeps a short value on one line', () => {
    expect(formatValue([0, 1])).toEqual({ lines: ['[0,1]'], truncated: false });
  });

  it('prints a long value one element per line, so the columns line up', () => {
    const value = Array.from({ length: 40 }, (_unused, index) => index);
    const { lines, truncated } = formatValue(value);

    expect(truncated).toBe(false);
    expect(lines[0]).toBe('[');
    expect(lines).toContain('  7,');
  });

  it('truncates a value too large to show', () => {
    const value = Array.from({ length: 20_000 }, (_unused, index) => index);
    const { lines, truncated } = formatValue(value);

    expect(truncated).toBe(true);
    expect(lines.join('\n').length).toBeLessThan(10_000);
  });

  it('has nothing to show for a missing value', () => {
    expect(formatValue(undefined)).toEqual({ lines: [], truncated: false });
  });
});

describe('changedLines', () => {
  it('marks only the lines that differ', () => {
    expect(changedLines(['[', '  1,', '  2', ']'], ['[', '  1,', '  9', ']'])).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('marks the tail when one side is shorter', () => {
    expect(changedLines(['a', 'b'], ['a'])).toEqual([false, true]);
  });
});

describe('firstDifference', () => {
  it('says nothing when the values agree', () => {
    expect(firstDifference([1, [2, 3]], [1, [2, 3]])).toBeNull();
  });

  it('points at the first differing element of an array', () => {
    expect(firstDifference([1, 2, 3], [1, 5, 3])).toEqual({
      path: '[1]',
      expected: '2',
      actual: '5',
    });
  });

  it('reaches into nested arrays', () => {
    expect(
      firstDifference(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [1, 2],
          [3, 9],
        ],
      ),
    ).toEqual({ path: '[1][1]', expected: '4', actual: '9' });
  });

  it('reports a missing element rather than saying the lengths differ', () => {
    // "your answer has three items, not four" is the same information as "there
    // is nothing at index 3", and the second one says where to look.
    expect(firstDifference([1, 2, 3], [1, 2])).toEqual({
      path: '[2]',
      expected: '3',
      actual: 'nothing',
    });
  });

  it('names an object key', () => {
    expect(firstDifference({ count: 2 }, { count: 3 })).toEqual({
      path: '.count',
      expected: '2',
      actual: '3',
    });
  });

  it('calls the root by a name a person would use', () => {
    expect(firstDifference(4, 5)).toEqual({ path: 'the value', expected: '4', actual: '5' });
  });

  it('does not confuse a null with a missing value', () => {
    expect(firstDifference([null], [])).toEqual({
      path: '[0]',
      expected: 'null',
      actual: 'nothing',
    });
  });
});
