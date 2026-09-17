import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createDatabase, IN_MEMORY, type Repositories } from '../index.js';

let repos: Repositories;

beforeEach(() => {
  repos = createDatabase({ file: IN_MEMORY });
});

afterEach(() => {
  repos.close();
});

describe('drafts', () => {
  it('round-trips a draft', () => {
    const saved = repos.drafts.save('pair-sum-index', 'python', 'print(1)');
    expect(repos.drafts.get('pair-sum-index', 'python')).toEqual(saved);
  });

  it('keeps one draft per language', () => {
    repos.drafts.save('pair-sum-index', 'python', 'python code');
    repos.drafts.save('pair-sum-index', 'java', 'java code');

    expect(repos.drafts.get('pair-sum-index', 'python')?.code).toBe('python code');
    expect(repos.drafts.get('pair-sum-index', 'java')?.code).toBe('java code');
    expect(repos.drafts.listByProblem('pair-sum-index')).toHaveLength(2);
  });

  it('overwrites rather than accumulating', () => {
    repos.drafts.save('pair-sum-index', 'python', 'first');
    repos.drafts.save('pair-sum-index', 'python', 'second');

    expect(repos.drafts.get('pair-sum-index', 'python')?.code).toBe('second');
    expect(repos.drafts.listByProblem('pair-sum-index')).toHaveLength(1);
  });

  it('stores an empty draft rather than deleting it', () => {
    // Clearing the editor is a state worth keeping: reopening the problem must
    // not silently resurrect code the user deleted.
    repos.drafts.save('pair-sum-index', 'python', '');
    expect(repos.drafts.get('pair-sum-index', 'python')?.code).toBe('');
  });

  it('removes a draft on reset-to-starter', () => {
    repos.drafts.save('pair-sum-index', 'python', 'code');

    expect(repos.drafts.remove('pair-sum-index', 'python')).toBe(true);
    expect(repos.drafts.remove('pair-sum-index', 'python')).toBe(false);
    expect(repos.drafts.get('pair-sum-index', 'python')).toBeNull();
  });

  it('never touches progress (D11: saving a draft is not an attempt)', () => {
    repos.drafts.save('pair-sum-index', 'python', 'code');
    expect(repos.progress.get('pair-sum-index', 'python')).toBeNull();
    expect(repos.events.list()).toHaveLength(0);
  });
});
