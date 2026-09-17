import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { bestStatus, type ProblemProgress } from '@devpromax/shared';
import { createDatabase, IN_MEMORY, type Repositories } from '../index.js';

let repos: Repositories;

const row = (over: Partial<ProblemProgress> = {}): ProblemProgress => ({
  slug: 'pair-sum-index',
  language: 'python',
  status: 'in_progress',
  attempts: 1,
  solvedAt: null,
  masteredAt: null,
  lastAttemptedAt: '2026-09-17T09:00:00.000Z',
  ...over,
});

beforeEach(() => {
  repos = createDatabase({ file: IN_MEMORY });
});

afterEach(() => {
  repos.close();
});

describe('problem progress', () => {
  it('round-trips a row including its null timestamps', () => {
    const written = repos.progress.put(row());
    expect(repos.progress.get('pair-sum-index', 'python')).toEqual(written);
  });

  it('returns null for a problem never attempted', () => {
    expect(repos.progress.get('never-touched', 'java')).toBeNull();
  });

  it('keeps status per language', () => {
    repos.progress.put(row({ status: 'solved', solvedAt: '2026-09-17T09:00:00.000Z' }));
    repos.progress.put(row({ language: 'java', status: 'not_started', attempts: 0 }));

    const both = repos.progress.listByProblem('pair-sum-index');
    expect(both.map((p) => [p.language, p.status])).toEqual([
      ['java', 'not_started'],
      ['python', 'solved'],
    ]);
    // The headline status is derived, never stored (P3-3 owns the rule).
    expect(bestStatus(both.map((p) => p.status))).toBe('solved');
  });

  it('updates in place rather than inserting a second row', () => {
    repos.progress.put(row());
    repos.progress.put(
      row({ status: 'solved', attempts: 2, solvedAt: '2026-09-17T10:00:00.000Z' }),
    );

    const stored = repos.progress.get('pair-sum-index', 'python');
    expect(stored?.status).toBe('solved');
    expect(stored?.attempts).toBe(2);
    expect(repos.progress.list()).toHaveLength(1);
  });

  it('writes exactly what it is given, including a demotion', () => {
    // The repository must not second-guess the caller: the rule that a later
    // Wrong Answer never demotes Solved belongs to the status engine, and a
    // manual override is allowed to move a status down.
    repos.progress.put(row({ status: 'solved', solvedAt: '2026-09-17T09:00:00.000Z' }));
    repos.progress.put(row({ status: 'in_progress', solvedAt: null }));

    expect(repos.progress.get('pair-sum-index', 'python')?.status).toBe('in_progress');
  });

  it('lists every row in a stable order', () => {
    repos.progress.put(row({ slug: 'min-value-stack', language: 'java' }));
    repos.progress.put(row({ slug: 'pair-sum-index', language: 'python' }));
    repos.progress.put(row({ slug: 'min-value-stack', language: 'python' }));

    expect(repos.progress.list().map((p) => `${p.slug}:${p.language}`)).toEqual([
      'min-value-stack:java',
      'min-value-stack:python',
      'pair-sum-index:python',
    ]);
  });

  it('removes and clears', () => {
    repos.progress.put(row());
    repos.progress.put(row({ language: 'java' }));

    expect(repos.progress.remove('pair-sum-index', 'python')).toBe(true);
    expect(repos.progress.remove('pair-sum-index', 'python')).toBe(false);
    expect(repos.progress.list()).toHaveLength(1);

    repos.progress.clear();
    expect(repos.progress.list()).toEqual([]);
  });

  it('rejects a status outside the four the domain defines', () => {
    expect(() =>
      repos.db
        .prepare(
          `INSERT INTO problem_progress (slug, language, status, attempts)
           VALUES ('a', 'python', 'almost', 0)`,
        )
        .run(),
    ).toThrow();
  });
});
