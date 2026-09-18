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

  describe('highestHintRevealed (P7-1)', () => {
    it('is zero for a problem nobody has asked for a hint on', () => {
      repos.events.record({ type: 'run', slug: 'pair-sum-index' });
      expect(repos.events.highestHintRevealed('pair-sum-index')).toBe(0);
    });

    it('reports the highest rung, not how many times one was recorded', () => {
      repos.events.record({
        type: 'hint_revealed',
        slug: 'pair-sum-index',
        payload: { revealed: 1 },
      });
      repos.events.record({
        type: 'hint_revealed',
        slug: 'pair-sum-index',
        payload: { revealed: 2 },
      });
      // The same rung twice - a double click, or a request that was retried.
      repos.events.record({
        type: 'hint_revealed',
        slug: 'pair-sum-index',
        payload: { revealed: 2 },
      });

      expect(repos.events.highestHintRevealed('pair-sum-index')).toBe(2);
    });

    it('is not moved backwards by a later record of a lower rung', () => {
      repos.events.record({
        type: 'hint_revealed',
        slug: 'pair-sum-index',
        payload: { revealed: 3 },
      });
      repos.events.record({
        type: 'hint_revealed',
        slug: 'pair-sum-index',
        payload: { revealed: 1 },
      });

      expect(repos.events.highestHintRevealed('pair-sum-index')).toBe(3);
    });

    it('counts each problem separately', () => {
      repos.events.record({
        type: 'hint_revealed',
        slug: 'pair-sum-index',
        payload: { revealed: 4 },
      });
      expect(repos.events.highestHintRevealed('other-problem')).toBe(0);
    });

    it('goes back to zero when the log is cleared', () => {
      // Reset-all-progress clears events, and this count is derived from them
      // rather than stored beside them, so it resets with no extra code.
      repos.events.record({
        type: 'hint_revealed',
        slug: 'pair-sum-index',
        payload: { revealed: 2 },
      });
      repos.events.clear();

      expect(repos.events.highestHintRevealed('pair-sum-index')).toBe(0);
    });
  });

  describe('wasEditorialRevealed (P7-2)', () => {
    it('is false until the user asks to see it, and does not expire', () => {
      expect(repos.events.wasEditorialRevealed('pair-sum-index')).toBe(false);

      repos.events.record({ type: 'editorial_revealed', slug: 'pair-sum-index' });

      expect(repos.events.wasEditorialRevealed('pair-sum-index')).toBe(true);
      expect(repos.events.wasEditorialRevealed('other-problem')).toBe(false);
    });

    it('is not confused by other activity on the same problem', () => {
      repos.events.record({ type: 'run', slug: 'pair-sum-index' });
      repos.events.record({
        type: 'hint_revealed',
        slug: 'pair-sum-index',
        payload: { revealed: 4 },
      });

      expect(repos.events.wasEditorialRevealed('pair-sum-index')).toBe(false);
    });

    it('locks again when the log is cleared', () => {
      repos.events.record({ type: 'editorial_revealed', slug: 'pair-sum-index' });
      repos.events.clear();

      expect(repos.events.wasEditorialRevealed('pair-sum-index')).toBe(false);
    });
  });

  it('clears the log', () => {
    repos.events.record({ type: 'run' });
    repos.events.clear();
    expect(repos.events.list()).toEqual([]);
  });
});
