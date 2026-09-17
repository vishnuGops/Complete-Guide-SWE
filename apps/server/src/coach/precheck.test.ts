import { describe, expect, it } from 'vitest';
import { hasMeaningfulBody, isUnchangedStarter, normalise, precheck } from './precheck.js';

/**
 * The local pre-check (ROADMAP D13, P5-3).
 *
 * The asymmetry in these tests is the point. Refusing to review real work is a
 * much worse failure than paying for a review of an almost-empty file, so the
 * "this is real code" cases below are the ones that matter, and several of them
 * are deliberately minimal - one line of actual logic has to be enough.
 */

const PY_STARTER = `from typing import List


class Solution:
    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:
        # Write your solution here.
        pass
`;

const JAVA_STARTER = `import java.util.*;

class Solution {
    public int[] pairSumIndex(int[] nums, int target) {
        // Write your solution here.
        return new int[0];
    }
}
`;

describe('normalise', () => {
  it('drops comments, blank lines and indentation', () => {
    const a = normalise('def f():\n    # a comment\n\n    return 1\n', 'python');
    const b = normalise('def f():\n        return 1', 'python');
    expect(a).toBe(b);
  });

  it('does not truncate a line at a # inside a string', () => {
    // A regex for `#.*$` eats the rest of this line and loses the call.
    expect(normalise('x = compute("#1")', 'python')).toContain('compute');
  });

  it('handles an escaped quote inside a string', () => {
    expect(normalise('s = "it\\"s"; y = z()', 'java')).toContain('z()');
  });

  it('drops Java block comments and Python docstrings', () => {
    expect(normalise('/* gone */ int x = 1;', 'java')).not.toContain('gone');
    expect(normalise('"""gone"""\nx = 1', 'python')).not.toContain('gone');
  });
});

describe('isUnchangedStarter', () => {
  it('recognises the starter returned verbatim', () => {
    expect(isUnchangedStarter(PY_STARTER, PY_STARTER, 'python')).toBe(true);
    expect(isUnchangedStarter(JAVA_STARTER, JAVA_STARTER, 'java')).toBe(true);
  });

  it('recognises the starter with the guidance comment deleted', () => {
    const stripped = PY_STARTER.replace('        # Write your solution here.\n', '');
    expect(isUnchangedStarter(stripped, PY_STARTER, 'python')).toBe(true);
  });

  it('recognises the starter with different indentation and blank lines', () => {
    const reindented = PY_STARTER.replace(/ {4}/g, '  ').replace(/\n\n/g, '\n\n\n');
    expect(isUnchangedStarter(reindented, PY_STARTER, 'python')).toBe(true);
  });

  it('does not call it unchanged once a line of logic is added', () => {
    const attempted = PY_STARTER.replace('        pass', '        seen = {}');
    expect(isUnchangedStarter(attempted, PY_STARTER, 'python')).toBe(false);
  });
});

describe('hasMeaningfulBody', () => {
  it('says no to the bare starters', () => {
    expect(hasMeaningfulBody(PY_STARTER, 'python')).toBe(false);
    expect(hasMeaningfulBody(JAVA_STARTER, 'java')).toBe(false);
  });

  it('says no to a body that is only a placeholder', () => {
    expect(hasMeaningfulBody('def f():\n    pass', 'python')).toBe(false);
    expect(hasMeaningfulBody('def f():\n    ...', 'python')).toBe(false);
    expect(hasMeaningfulBody('def f():\n    return None', 'python')).toBe(false);
    expect(hasMeaningfulBody('int f() { return -1; }\n', 'java')).toBe(false);
    expect(
      hasMeaningfulBody('int f() {\n throw new UnsupportedOperationException();\n}', 'java'),
    ).toBe(false);
  });

  it('says no to a file of nothing but comments', () => {
    expect(hasMeaningfulBody('# thinking about it\n# maybe a hash map?\n', 'python')).toBe(false);
  });

  it('says yes to one real line', () => {
    // The case that must not regress: someone who has written a single
    // statement has started, and is exactly who AI Help is for.
    expect(hasMeaningfulBody('def f(nums):\n    seen = {}', 'python')).toBe(true);
  });

  it('says yes to a wrong but real attempt', () => {
    const attempt = PY_STARTER.replace(
      '        pass',
      '        for i in range(len(nums)):\n            return [i, i]',
    );
    expect(hasMeaningfulBody(attempt, 'python')).toBe(true);
  });

  it('says yes to a Java body that returns a computed value', () => {
    const attempt = JAVA_STARTER.replace(
      '        return new int[0];',
      '        return new int[] {0, nums.length - 1};',
    );
    expect(hasMeaningfulBody(attempt, 'java')).toBe(true);
  });

  it('does not mistake a helper method for scaffolding', () => {
    const attempt = 'class Solution:\n    def helper(self, x):\n        return x * 2';
    expect(hasMeaningfulBody(attempt, 'python')).toBe(true);
  });
});

describe('precheck', () => {
  it('lets a real attempt through', () => {
    const attempt = PY_STARTER.replace('        pass', '        return sorted(nums)[:2]');
    expect(precheck({ code: attempt, starter: PY_STARTER, language: 'python' })).toBeNull();
  });

  it('prefers "unchanged starter" over "no meaningful code"', () => {
    // Both are true of the bare starter. Told they have written nothing
    // meaningful, someone who has not started reads it as a judgement on work
    // they have not done; "write some code first" is the true one.
    expect(precheck({ code: PY_STARTER, starter: PY_STARTER, language: 'python' })).toBe(
      'unchanged_starter',
    );
  });

  it('calls an empty editor no meaningful code, not an unchanged starter', () => {
    expect(precheck({ code: '   \n\n', starter: PY_STARTER, language: 'python' })).toBe(
      'no_meaningful_code',
    );
  });

  it('refuses a body the user emptied out themselves', () => {
    const emptied = 'class Solution:\n    def pairSumIndex(self, nums, target):\n        pass';
    expect(precheck({ code: emptied, starter: PY_STARTER, language: 'python' })).toBe(
      'no_meaningful_code',
    );
  });
});
