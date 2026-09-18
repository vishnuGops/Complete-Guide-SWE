import { describe, expect, it } from 'vitest';
import { PATTERNS, PATTERN_GROUPS, patternSchema } from './patterns.js';

/**
 * The pattern vocabulary (ROADMAP P6-1).
 *
 * A closed list is only worth having if it stays one, so what is tested here is
 * the properties that make it useful rather than its contents: no duplicates,
 * every entry reachable through a group, and a spelling variant rejected.
 */

describe('PATTERNS', () => {
  it('has no duplicates', () => {
    expect(new Set(PATTERNS).size).toBe(PATTERNS.length);
  });

  it('is entirely covered by the groups, and the groups add nothing', () => {
    // The groups are what `docs/CURRICULUM.md` prints and what a grouped filter
    // would read; a pattern missing from them is invisible to both.
    const grouped = Object.values(PATTERN_GROUPS).flat();
    expect([...grouped].sort()).toEqual([...PATTERNS].sort());
  });

  it('reads as an interviewer would say it', () => {
    for (const pattern of PATTERNS) {
      // Words, not identifiers: "monotonic stack", never "monotonic-stack".
      // Hyphens inside a word are fine - "in-place", "depth-first" - so what is
      // banned is the separator, which is the space being replaced.
      expect(pattern, pattern).toMatch(/^[a-z]/);
      expect(pattern, pattern).not.toMatch(/_/);
      // Lower case, except where the notation is: "amortised O(1)".
      expect(pattern.replace(/O\(1\)/, ''), pattern).not.toMatch(/[A-Z]/);
      expect(pattern.length, pattern).toBeLessThan(32);
    }
  });

  it('rejects the spelling variants the seed catalogue had', () => {
    // The four that twenty problems produced for ideas already in the list.
    for (const variant of ['membership', 'running sum', 'single pass', 'sort by start']) {
      expect(patternSchema.safeParse(variant).success, variant).toBe(false);
    }
    for (const canonical of ['hash set', 'running total', 'one pass', 'sorted input']) {
      expect(patternSchema.safeParse(canonical).success, canonical).toBe(true);
    }
  });
});
