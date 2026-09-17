import { describe, it, expect } from 'vitest';
import {
  MAX_CODE_BYTES,
  VERDICTS,
  isAccepted,
  runRequestSchema,
  runResultSchema,
  testResultSchema,
  worstVerdict,
} from './judge.js';

describe('worstVerdict', () => {
  it('reports AC only when every test passed', () => {
    expect(worstVerdict(['AC', 'AC', 'AC'])).toBe('AC');
    expect(worstVerdict([])).toBe('AC');
  });

  it('does not let a WA hide a TLE in the same batch', () => {
    expect(worstVerdict(['WA', 'TLE', 'WA'])).toBe('TLE');
  });

  it('ranks CE above everything, since nothing else ran', () => {
    expect(worstVerdict(['CE', 'AC'])).toBe('CE');
    expect(worstVerdict(['RE', 'CE', 'MLE'])).toBe('CE');
  });

  it('ranks MLE above RE and RE above TLE', () => {
    expect(worstVerdict(['RE', 'MLE'])).toBe('MLE');
    expect(worstVerdict(['TLE', 'RE'])).toBe('RE');
  });

  it('is order-independent', () => {
    expect(worstVerdict(['AC', 'WA', 'TLE'])).toBe(worstVerdict(['TLE', 'WA', 'AC']));
  });

  it('assigns a severity to every declared verdict', () => {
    for (const v of VERDICTS) {
      expect(worstVerdict([v])).toBe(v);
    }
  });
});

describe('isAccepted', () => {
  it('is true only for AC', () => {
    expect(isAccepted('AC')).toBe(true);
    for (const v of VERDICTS.filter((x) => x !== 'AC')) {
      expect(isAccepted(v)).toBe(false);
    }
  });
});

describe('runRequestSchema', () => {
  const base = { slug: 'two-sum', language: 'python', code: 'pass', kind: 'run' } as const;

  it('accepts a minimal run request', () => {
    expect(runRequestSchema.parse(base).customTests).toBeUndefined();
  });

  it('accepts an empty code string, so the coach pre-check can reject it later', () => {
    expect(runRequestSchema.safeParse({ ...base, code: '' }).success).toBe(true);
  });

  it('rejects source beyond the size cap', () => {
    const tooBig = 'x'.repeat(MAX_CODE_BYTES + 1);
    expect(runRequestSchema.safeParse({ ...base, code: tooBig }).success).toBe(false);
  });

  it('rejects an unknown language or kind', () => {
    expect(runRequestSchema.safeParse({ ...base, language: 'rust' }).success).toBe(false);
    expect(runRequestSchema.safeParse({ ...base, kind: 'debug' }).success).toBe(false);
  });

  it('caps the number of custom tests', () => {
    const many = Array.from({ length: 21 }, () => ({ args: [1] }));
    expect(runRequestSchema.safeParse({ ...base, customTests: many }).success).toBe(false);
  });
});

describe('testResultSchema', () => {
  it('defaults stdout, stderr and revealed', () => {
    const parsed = testResultSchema.parse({
      index: 0,
      source: 'sample',
      verdict: 'AC',
      timeMs: 1.5,
    });
    expect(parsed.stdout).toBe('');
    expect(parsed.stderr).toBe('');
    expect(parsed.revealed).toBe(true);
  });

  it('allows a hidden test to withhold its input and expectation', () => {
    const parsed = testResultSchema.parse({
      index: 4,
      source: 'hidden',
      verdict: 'WA',
      timeMs: 3,
      revealed: false,
    });
    expect(parsed.input).toBeUndefined();
    expect(parsed.expected).toBeUndefined();
  });

  it('rejects a negative timing', () => {
    expect(
      testResultSchema.safeParse({ index: 0, source: 'sample', verdict: 'AC', timeMs: -1 }).success,
    ).toBe(false);
  });
});

describe('runResultSchema', () => {
  it('defaults the flags a clean run leaves unset', () => {
    const parsed = runResultSchema.parse({
      slug: 'two-sum',
      language: 'java',
      kind: 'submit',
      problemVersion: 1,
      verdict: 'AC',
      passed: 13,
      total: 13,
      totalTimeMs: 820,
      tests: [],
    });
    expect(parsed.compileErrors).toEqual([]);
    expect(parsed.outputTruncated).toBe(false);
    expect(parsed.isolationFallback).toBe(false);
  });

  it('requires a problem version, so history stays interpretable', () => {
    expect(
      runResultSchema.safeParse({
        slug: 'two-sum',
        language: 'java',
        kind: 'submit',
        verdict: 'AC',
        passed: 0,
        total: 0,
        totalTimeMs: 0,
        tests: [],
      }).success,
    ).toBe(false);
  });
});
