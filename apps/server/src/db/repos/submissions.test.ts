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
  // Not timed, which is not the same as solved instantly (P7-6).
  solveMs: null,
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

  it('summarises accepted submissions per problem in one query (P3-9)', () => {
    const insertAt = repos.db.prepare(
      `INSERT INTO submissions (id, slug, language, code, verdict, passed, total, time_ms, problem_version, created_at)
       VALUES (?, ?, ?, '', ?, 1, 1, 1, 1, ?)`,
    );
    const at = (day: number) => `2026-09-0${String(day)}T09:00:00.000Z`;
    insertAt.run('a1', 'pair-sum-index', 'python', 'WA', at(1));
    insertAt.run('a2', 'pair-sum-index', 'python', 'AC', at(2));
    // Either language counts: a Java re-solve is a review of the same idea.
    insertAt.run('a3', 'pair-sum-index', 'java', 'AC', at(4));
    insertAt.run('b1', 'shift-right-in-place', 'python', 'TLE', at(3));

    expect(repos.submissions.acceptedSummary()).toEqual(
      new Map([['pair-sum-index', { count: 2, firstAt: at(2), lastAt: at(4) }]]),
    );
  });

  it('pages past rows that share a timestamp when given the boundary row (P3-10)', () => {
    const insertAt = repos.db.prepare(
      `INSERT INTO submissions (id, slug, language, code, verdict, passed, total, time_ms, problem_version, created_at)
       VALUES (?, 'pair-sum-index', 'python', '', 'AC', 1, 1, 1, 1, ?)`,
    );
    const id = (n: number) => `00000000-0000-4000-8000-00000000000${String(n)}`;
    const tied = '2026-09-01T09:00:00.000Z';
    for (const n of [1, 2, 3]) insertAt.run(id(n), tied);
    insertAt.run(id(0), '2026-08-31T09:00:00.000Z');

    // Newest first, ties by insertion order reversed: 3, 2, 1, then 0.
    const after = repos.submissions.list({ before: tied, beforeId: id(3) }).map((s) => s.id);
    expect(after).toEqual([id(2), id(1), id(0)]);
    // The timestamp alone is still "strictly older".
    expect(repos.submissions.list({ before: tied }).map((s) => s.id)).toEqual([id(0)]);
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
