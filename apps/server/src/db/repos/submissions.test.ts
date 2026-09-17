import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createDatabase, IN_MEMORY, type Repositories } from '../index.js';
import type { NewSubmission } from './submissions.js';

let repos: Repositories;

const base: NewSubmission = {
  slug: 'pair-sum-index',
  language: 'python',
  code: 'class Solution: ...',
  verdict: 'AC',
  passed: 12,
  total: 12,
  timeMs: 34.5,
  problemVersion: 1,
};

beforeEach(() => {
  repos = createDatabase({ file: IN_MEMORY });
});

afterEach(() => {
  repos.close();
});

describe('submissions', () => {
  it('assigns an id and timestamp, and reads back exactly what went in', () => {
    const inserted = repos.submissions.insert(base);

    expect(inserted.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(inserted.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(repos.submissions.get(inserted.id)).toEqual(inserted);
  });

  it('returns null for an unknown id', () => {
    expect(repos.submissions.get('4f1b9d1e-0000-4000-8000-000000000000')).toBeNull();
  });

  it('lists newest first, breaking ties by insertion order', () => {
    const first = repos.submissions.insert({ ...base, verdict: 'WA', passed: 3 });
    const second = repos.submissions.insert({ ...base, verdict: 'TLE', passed: 7 });
    const third = repos.submissions.insert(base);

    expect(repos.submissions.list().map((s) => s.id)).toEqual([third.id, second.id, first.id]);
  });

  it('filters by problem and language', () => {
    repos.submissions.insert(base);
    repos.submissions.insert({ ...base, language: 'java' });
    repos.submissions.insert({ ...base, slug: 'min-value-stack' });

    expect(repos.submissions.list({ slug: 'pair-sum-index' })).toHaveLength(2);
    expect(repos.submissions.list({ slug: 'pair-sum-index', language: 'java' })).toHaveLength(1);
    expect(repos.submissions.list({ language: 'python' })).toHaveLength(2);
  });

  it('honours a limit', () => {
    for (let i = 0; i < 5; i += 1) repos.submissions.insert(base);
    expect(repos.submissions.list({ limit: 2 })).toHaveLength(2);
    expect(repos.submissions.list({ slug: 'pair-sum-index', limit: 3 })).toHaveLength(3);
  });

  it('finds the latest accepted submission for a language', () => {
    repos.submissions.insert(base);
    const newerAccepted = repos.submissions.insert(base);
    repos.submissions.insert({ ...base, verdict: 'WA', passed: 1 });
    repos.submissions.insert({ ...base, language: 'java' });

    expect(repos.submissions.latestAccepted('pair-sum-index', 'python')?.id).toBe(newerAccepted.id);
  });

  it('has no latest accepted submission when none was accepted', () => {
    repos.submissions.insert({ ...base, verdict: 'WA', passed: 0 });
    expect(repos.submissions.latestAccepted('pair-sum-index', 'python')).toBeNull();
  });

  it('counts submissions across languages for a problem', () => {
    repos.submissions.insert(base);
    repos.submissions.insert({ ...base, language: 'java' });
    repos.submissions.insert({ ...base, slug: 'min-value-stack' });

    expect(repos.submissions.countByProblem('pair-sum-index')).toBe(2);
    expect(repos.submissions.countByProblem('never-attempted')).toBe(0);
  });

  it('keeps the problem version the submission actually faced', () => {
    const old = repos.submissions.insert({ ...base, problemVersion: 2 });
    repos.submissions.insert({ ...base, problemVersion: 5 });

    expect(repos.submissions.get(old.id)?.problemVersion).toBe(2);
  });

  it('rejects a verdict the domain does not define', () => {
    // The CHECK constraint is the backstop for a bug upstream of the repository.
    expect(() =>
      repos.db
        .prepare(
          `INSERT INTO submissions (id, slug, language, code, verdict, passed, total, time_ms, problem_version, created_at)
           VALUES ('x', 'a', 'python', '', 'NOPE', 0, 0, 0, 1, '2026-01-01T00:00:00.000Z')`,
        )
        .run(),
    ).toThrow();
  });
});
