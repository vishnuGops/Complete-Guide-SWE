import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createDatabase, IN_MEMORY, type Repositories } from '../index.js';

let repos: Repositories;

beforeEach(() => {
  repos = createDatabase({ file: IN_MEMORY });
});

afterEach(() => {
  repos.close();
});

describe('events', () => {
  it('records an event and gives back its assigned id', () => {
    const first = repos.events.record({ type: 'run', slug: 'pair-sum-index', language: 'python' });
    const second = repos.events.record({
      type: 'submit',
      slug: 'pair-sum-index',
      language: 'java',
    });

    expect(second.id).toBeGreaterThan(first.id);
    expect(repos.events.list()).toHaveLength(2);
  });

  it('round-trips a JSON payload', () => {
    repos.events.record({
      type: 'submit',
      slug: 'pair-sum-index',
      language: 'python',
      payload: { verdict: 'AC', timeMs: 12.5 },
    });

    expect(repos.events.list()[0]?.payload).toEqual({ verdict: 'AC', timeMs: 12.5 });
  });

  it('allows an event with no problem attached', () => {
    const record = repos.events.record({ type: 'status_override' });

    expect(record.slug).toBeNull();
    expect(record.language).toBeNull();
    expect(record.payload).toBeNull();
  });

  it('lists newest first', () => {
    repos.events.record({ type: 'run', createdAt: '2026-09-15T10:00:00.000Z' });
    repos.events.record({ type: 'submit', createdAt: '2026-09-17T10:00:00.000Z' });
    repos.events.record({ type: 'run', createdAt: '2026-09-16T10:00:00.000Z' });

    expect(repos.events.list().map((e) => e.createdAt)).toEqual([
      '2026-09-17T10:00:00.000Z',
      '2026-09-16T10:00:00.000Z',
      '2026-09-15T10:00:00.000Z',
    ]);
  });

  it('filters by problem, date and limit', () => {
    repos.events.record({ type: 'run', slug: 'a', createdAt: '2026-09-10T10:00:00.000Z' });
    repos.events.record({ type: 'run', slug: 'a', createdAt: '2026-09-17T10:00:00.000Z' });
    repos.events.record({ type: 'run', slug: 'b', createdAt: '2026-09-17T11:00:00.000Z' });

    expect(repos.events.list({ slug: 'a' })).toHaveLength(2);
    expect(repos.events.list({ since: '2026-09-17T00:00:00.000Z' })).toHaveLength(2);
    expect(repos.events.list({ slug: 'a', since: '2026-09-17T00:00:00.000Z' })).toHaveLength(1);
    expect(repos.events.list({ limit: 1 })).toHaveLength(1);
  });

  it('counts activity per UTC day for the streak calendar', () => {
    repos.events.record({ type: 'run', createdAt: '2026-09-17T01:00:00.000Z' });
    repos.events.record({ type: 'submit', createdAt: '2026-09-17T23:59:59.999Z' });
    repos.events.record({ type: 'run', createdAt: '2026-09-15T12:00:00.000Z' });

    expect(repos.events.dailyCounts()).toEqual([
      { day: '2026-09-17', count: 2 },
      { day: '2026-09-15', count: 1 },
    ]);
    expect(repos.events.dailyCounts('2026-09-16T00:00:00.000Z')).toEqual([
      { day: '2026-09-17', count: 2 },
    ]);
  });

  it('rejects a language value outside the two supported ones', () => {
    expect(() =>
      repos.db
        .prepare(
          `INSERT INTO events (type, slug, language, created_at)
           VALUES ('run', 'a', 'rust', '2026-01-01T00:00:00.000Z')`,
        )
        .run(),
    ).toThrow();
  });

  it('clears the log', () => {
    repos.events.record({ type: 'run' });
    repos.events.clear();
    expect(repos.events.list()).toEqual([]);
  });
});
