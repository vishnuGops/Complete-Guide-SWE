import { describe, expect, it } from 'vitest';
import { describeDelta, diffCode } from './codeDelta.js';

/**
 * The code delta (ROADMAP P5-5).
 *
 * The case that earns this file is the last one: someone who asks twice without
 * changing anything is stuck, and the coach needs to know that so it can try a
 * different angle instead of rephrasing advice they have already read.
 */

const BEFORE = ['def f(nums):', '    for i in range(len(nums)):', '        return i', ''].join(
  '\n',
);

describe('diffCode', () => {
  it('reports an added line as added and nothing else', () => {
    const after = BEFORE.replace('def f(nums):', 'def f(nums):\n    seen = {}');
    const delta = diffCode(BEFORE, after);

    expect(delta.added).toEqual(['    seen = {}']);
    expect(delta.removed).toEqual([]);
    expect(delta.unchanged).toBe(false);
  });

  it('reports a replaced line as one removal and one addition', () => {
    const after = BEFORE.replace('        return i', '        return [i, i + 1]');
    const delta = diffCode(BEFORE, after);

    expect(delta.removed).toEqual(['        return i']);
    expect(delta.added).toEqual(['        return [i, i + 1]']);
  });

  it('calls identical code unchanged', () => {
    expect(diffCode(BEFORE, BEFORE).unchanged).toBe(true);
  });

  it('ignores blank-line and trailing-whitespace churn', () => {
    // Reformatting is not a revision, and reporting it as one would have the
    // coach comment on changes the user did not make.
    const reformatted = BEFORE.replace(/\n/g, '\n\n').replace('def f(nums):', 'def f(nums):   ');
    expect(diffCode(BEFORE, reformatted).unchanged).toBe(true);
  });

  it('does not report a whole rewrite as an edit of every line', () => {
    const rewritten = 'def f(nums):\n    return sorted(nums)';
    const delta = diffCode(BEFORE, rewritten);

    // The signature is common to both, so it is not in either list.
    expect(delta.added).not.toContain('def f(nums):');
    expect(delta.removed).not.toContain('def f(nums):');
    expect(delta.added).toEqual(['    return sorted(nums)']);
  });

  it('caps how much of an enormous rewrite it reports', () => {
    const huge = Array.from({ length: 500 }, (_, i) => `    x${i} = ${i}`).join('\n');
    const delta = diffCode(BEFORE, huge);

    expect(delta.added.length).toBeLessThanOrEqual(20);
    expect(delta.removed.length).toBeLessThanOrEqual(20);
  });
});

describe('describeDelta', () => {
  it('says plainly when nothing changed, and why that matters', () => {
    const text = describeDelta(diffCode(BEFORE, BEFORE));

    expect(text).toMatch(/has not changed/i);
    // The instruction is the point of detecting it at all.
    expect(text).toMatch(/stuck/i);
    expect(text).toMatch(/different angle/i);
  });

  it('marks removals and additions so the direction is unambiguous', () => {
    const after = BEFORE.replace('        return i', '        return -1');
    const text = describeDelta(diffCode(BEFORE, after));

    expect(text).toContain('- return i');
    expect(text).toContain('+ return -1');
  });
});
