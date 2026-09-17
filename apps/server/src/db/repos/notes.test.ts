import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createDatabase, IN_MEMORY, type Repositories } from '../index.js';

let repos: Repositories;

beforeEach(() => {
  repos = createDatabase({ file: IN_MEMORY });
});

afterEach(() => {
  repos.close();
});

describe('notes', () => {
  it('round-trips a note', () => {
    const saved = repos.notes.save('pair-sum-index', 'Remember the complement trick.');
    expect(repos.notes.get('pair-sum-index')).toEqual(saved);
  });

  it('overwrites the existing note for a problem', () => {
    repos.notes.save('pair-sum-index', 'first');
    repos.notes.save('pair-sum-index', 'second');

    expect(repos.notes.get('pair-sum-index')?.body).toBe('second');
    expect(repos.notes.list()).toHaveLength(1);
  });

  it('deletes rather than storing a blank note', () => {
    repos.notes.save('pair-sum-index', 'something');
    expect(repos.notes.save('pair-sum-index', '   \n  ')).toBeNull();
    expect(repos.notes.get('pair-sum-index')).toBeNull();
  });

  it('searches bodies case-insensitively', () => {
    repos.notes.save('pair-sum-index', 'Use a Frequency map');
    repos.notes.save('min-value-stack', 'monotonic stack');

    expect(repos.notes.search('frequency').map((n) => n.slug)).toEqual(['pair-sum-index']);
    expect(repos.notes.search('STACK').map((n) => n.slug)).toEqual(['min-value-stack']);
    expect(repos.notes.search('nothing here')).toEqual([]);
  });

  it('treats search wildcards as literal text', () => {
    // LIKE would read these as "match anything"; instr does not.
    repos.notes.save('pair-sum-index', 'runs in 100% of cases');
    repos.notes.save('min-value-stack', 'plain text');

    expect(repos.notes.search('100%').map((n) => n.slug)).toEqual(['pair-sum-index']);
    expect(repos.notes.search('%')).toHaveLength(1);
    expect(repos.notes.search('_')).toEqual([]);
  });

  it('removes a note', () => {
    repos.notes.save('pair-sum-index', 'body');
    expect(repos.notes.remove('pair-sum-index')).toBe(true);
    expect(repos.notes.remove('pair-sum-index')).toBe(false);
  });
});
