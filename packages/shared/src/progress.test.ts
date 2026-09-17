import { describe, it, expect } from 'vitest';
import {
  PROGRESS_STATUSES,
  bestStatus,
  problemProgressSchema,
  statusRank,
  submissionSchema,
} from './progress.js';

describe('status ordering', () => {
  it('ranks the four states weakest to strongest', () => {
    expect(PROGRESS_STATUSES).toEqual(['not_started', 'in_progress', 'solved', 'mastered']);
    expect(statusRank('not_started')).toBeLessThan(statusRank('in_progress'));
    expect(statusRank('in_progress')).toBeLessThan(statusRank('solved'));
    expect(statusRank('solved')).toBeLessThan(statusRank('mastered'));
  });
});

describe('bestStatus', () => {
  it('rolls up across languages by taking the strongest', () => {
    expect(bestStatus(['in_progress', 'solved'])).toBe('solved');
    expect(bestStatus(['mastered', 'not_started'])).toBe('mastered');
  });

  it('returns not_started for an empty roll-up', () => {
    expect(bestStatus([])).toBe('not_started');
  });

  it('is order-independent', () => {
    expect(bestStatus(['solved', 'in_progress'])).toBe(bestStatus(['in_progress', 'solved']));
  });
});

describe('problemProgressSchema', () => {
  it('defaults timestamps to null and attempts to zero', () => {
    const parsed = problemProgressSchema.parse({
      slug: 'two-sum',
      language: 'python',
      status: 'in_progress',
    });
    expect(parsed.attempts).toBe(0);
    expect(parsed.solvedAt).toBeNull();
    expect(parsed.masteredAt).toBeNull();
    expect(parsed.lastAttemptedAt).toBeNull();
  });

  it('rejects a non-ISO timestamp', () => {
    expect(
      problemProgressSchema.safeParse({
        slug: 'two-sum',
        language: 'python',
        status: 'solved',
        solvedAt: '16/09/2026',
      }).success,
    ).toBe(false);
  });
});

describe('submissionSchema', () => {
  const base = {
    id: '4b1e2c5a-0f0c-4a3d-9c2a-4a5b6c7d8e9f',
    slug: 'two-sum',
    language: 'python',
    code: 'class Solution: pass',
    verdict: 'WA',
    passed: 3,
    total: 13,
    timeMs: 42,
    problemVersion: 2,
    createdAt: '2026-09-16T10:00:00.000Z',
  };

  it('accepts a complete submission', () => {
    expect(submissionSchema.parse(base).problemVersion).toBe(2);
  });

  it('requires a uuid id', () => {
    expect(submissionSchema.safeParse({ ...base, id: 'sub-1' }).success).toBe(false);
  });

  it('records the problem version so a later test change cannot rewrite history', () => {
    const { problemVersion: _omitted, ...withoutVersion } = base;
    expect(submissionSchema.safeParse(withoutVersion).success).toBe(false);
  });
});
