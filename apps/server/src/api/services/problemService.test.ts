import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  problemListQuerySchema,
  type Language,
  type ProblemListQuery,
  type ProgressStatus,
} from '@devpromax/shared';
import { createDatabase, IN_MEMORY, type Repositories } from '../../db/index.js';
import {
  json,
  makeCatalogue,
  VALID_META,
  writeProblem,
} from '../../problems/__fixtures__/factory.js';
import { createCatalogue, type Catalogue } from './catalogue.js';
import { HttpError } from '../errors.js';
import { listProblems, problemDetail, progressOverview, summarise } from './problemService.js';

/**
 * Reading the catalogue (ROADMAP P3-1).
 *
 * The catalogue is written to a temp directory rather than mocked, because the
 * things worth testing here - what the default sort is, what the counts count,
 * when the editorial unlocks - are exactly the things a mock would let us assume
 * instead of check.
 */

let root: string;
let repos: Repositories;
let catalogue: Catalogue;

interface Spec {
  slug: string;
  topic?: string;
  title?: string;
  tier?: string;
  rating?: number;
  order?: number;
  patterns?: string[];
  related?: string[];
}

function write(spec: Spec): void {
  writeProblem(root, {
    topic: spec.topic ?? 'arrays',
    slug: spec.slug,
    files: {
      'meta.json': json({
        ...VALID_META,
        id: spec.slug,
        slug: spec.slug,
        title: spec.title ?? spec.slug,
        topic: spec.topic ?? 'arrays',
        tier: spec.tier ?? 'Easy',
        rating: spec.rating ?? 2,
        order: spec.order ?? 0,
        patterns: spec.patterns ?? ['hash map'],
        ...(spec.related ? { related: spec.related } : {}),
      }),
    },
  });
}

function setStatus(
  slug: string,
  language: Language,
  status: ProgressStatus,
  extra: { attempts?: number; solvedAt?: string; lastAttemptedAt?: string } = {},
): void {
  repos.progress.put({
    slug,
    language,
    status,
    attempts: extra.attempts ?? 0,
    solvedAt: extra.solvedAt ?? null,
    masteredAt: null,
    lastAttemptedAt: extra.lastAttemptedAt ?? null,
  });
}

function query(over: Partial<ProblemListQuery> = {}): ProblemListQuery {
  return { ...problemListQuerySchema.parse({}), ...over };
}

const list = (over: Partial<ProblemListQuery> = {}) =>
  listProblems(query(over), { catalogue, repos });

const slugs = (over: Partial<ProblemListQuery> = {}) => list(over).items.map((item) => item.slug);

beforeEach(() => {
  root = makeCatalogue();
  repos = createDatabase({ file: IN_MEMORY });
  catalogue = createCatalogue({ root, cache: false });
});

afterEach(() => {
  repos.close();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('summarise', () => {
  beforeEach(() => {
    write({ slug: 'pair-sum-index' });
  });

  it('reports a problem nobody has touched as not started', () => {
    const [summary] = list().items;
    expect(summary?.status).toBe('not_started');
    expect(summary?.statusByLanguage).toEqual({});
    expect(summary?.attempts).toBe(0);
  });

  it('takes the best status across languages', () => {
    setStatus('pair-sum-index', 'python', 'solved');
    setStatus('pair-sum-index', 'java', 'in_progress');

    const [summary] = list().items;
    expect(summary?.status).toBe('solved');
    expect(summary?.statusByLanguage).toEqual({ python: 'solved', java: 'in_progress' });
  });

  it('reports the one language when the query names one', () => {
    setStatus('pair-sum-index', 'python', 'solved');
    setStatus('pair-sum-index', 'java', 'in_progress');

    expect(list({ language: 'java' }).items[0]?.status).toBe('in_progress');
    // Both languages are still reported, so the list can show where it was
    // solved even while filtering on the other one.
    expect(list({ language: 'java' }).items[0]?.statusByLanguage).toEqual({
      python: 'solved',
      java: 'in_progress',
    });
  });

  it('sums attempts and takes the newest attempt and the first solve', () => {
    setStatus('pair-sum-index', 'python', 'solved', {
      attempts: 2,
      solvedAt: '2026-09-01T10:00:00.000Z',
      lastAttemptedAt: '2026-09-01T10:00:00.000Z',
    });
    setStatus('pair-sum-index', 'java', 'solved', {
      attempts: 3,
      solvedAt: '2026-09-05T10:00:00.000Z',
      lastAttemptedAt: '2026-09-05T10:00:00.000Z',
    });

    const [summary] = list().items;
    expect(summary?.attempts).toBe(5);
    expect(summary?.lastAttemptedAt).toBe('2026-09-05T10:00:00.000Z');
    expect(summary?.solvedAt).toBe('2026-09-01T10:00:00.000Z');
  });

  it('is a pure function of the meta and the rows', () => {
    const rows = repos.progress.list();
    const meta = catalogue.get('pair-sum-index')?.meta;
    expect(meta).toBeDefined();
    if (meta) expect(summarise(meta, rows).slug).toBe('pair-sum-index');
  });
});

describe('sorting', () => {
  beforeEach(() => {
    // Deliberately written in an order that is neither the default nor
    // alphabetical, so a passing test cannot be an accident of insertion order.
    write({ slug: 'stack-design', topic: 'stack', title: 'Zebra', tier: 'Medium', rating: 5 });
    write({ slug: 'array-easy', topic: 'arrays', title: 'Apple', tier: 'Easy', rating: 2 });
    write({ slug: 'hash-medium', topic: 'hashmap', title: 'Mango', tier: 'Medium', rating: 5 });
  });

  it('defaults to rating, then the curriculum path', () => {
    // hashmap comes before stack in the 14-topic order, so the two 5s are not
    // tied on rating alone.
    expect(slugs()).toEqual(['array-easy', 'hash-medium', 'stack-design']);
  });

  it('sorts by a named column', () => {
    expect(slugs({ sort: 'title' })).toEqual(['array-easy', 'hash-medium', 'stack-design']);
    expect(slugs({ sort: 'title', dir: 'desc' })).toEqual([
      'stack-design',
      'hash-medium',
      'array-easy',
    ]);
  });

  it('breaks ties with the default order rather than leaving them arbitrary', () => {
    // Every row is Medium or Easy; the two Mediums tie and fall back to rating
    // then curriculum order.
    expect(slugs({ sort: 'tier' })).toEqual(['array-easy', 'hash-medium', 'stack-design']);
  });

  it('keeps never-attempted problems last whichever way lastAttempted is sorted', () => {
    setStatus('hash-medium', 'python', 'in_progress', {
      lastAttemptedAt: '2026-09-02T10:00:00.000Z',
    });
    setStatus('stack-design', 'python', 'in_progress', {
      lastAttemptedAt: '2026-09-09T10:00:00.000Z',
    });

    expect(slugs({ sort: 'lastAttempted' })).toEqual(['hash-medium', 'stack-design', 'array-easy']);
    expect(slugs({ sort: 'lastAttempted', dir: 'desc' })).toEqual([
      'stack-design',
      'hash-medium',
      'array-easy',
    ]);
  });
});

describe('filters', () => {
  beforeEach(() => {
    write({ slug: 'array-easy', topic: 'arrays', title: 'Sliding Sum', rating: 2 });
    write({
      slug: 'hash-medium',
      topic: 'hashmap',
      title: 'Group Words',
      tier: 'Medium',
      rating: 5,
      patterns: ['frequency map', 'grouping'],
    });
    write({ slug: 'stack-hard', topic: 'stack', title: 'Deep Stack', tier: 'Hard', rating: 9 });
  });

  it('filters by topic, tier and status', () => {
    expect(slugs({ topic: ['hashmap'] })).toEqual(['hash-medium']);
    expect(slugs({ tier: ['Hard'] })).toEqual(['stack-hard']);

    setStatus('stack-hard', 'python', 'solved');
    expect(slugs({ status: ['solved'] })).toEqual(['stack-hard']);
  });

  it('accepts several values for one filter', () => {
    expect(slugs({ topic: ['arrays', 'stack'] })).toEqual(['array-easy', 'stack-hard']);
  });

  it('searches title, slug and patterns, case-insensitively', () => {
    expect(slugs({ q: 'sliding' })).toEqual(['array-easy']);
    expect(slugs({ q: 'GROUPING' })).toEqual(['hash-medium']);
    expect(slugs({ q: 'stack-hard' })).toEqual(['stack-hard']);
    expect(slugs({ q: 'nothing matches this' })).toEqual([]);
  });

  it('reads status and language together as "solved in that language"', () => {
    setStatus('array-easy', 'python', 'solved');
    setStatus('hash-medium', 'java', 'solved');

    expect(slugs({ status: ['solved'], language: 'python' })).toEqual(['array-easy']);
    expect(slugs({ status: ['solved'], language: 'java' })).toEqual(['hash-medium']);
    expect(slugs({ status: ['solved'] })).toEqual(['array-easy', 'hash-medium']);
  });

  it('counts the whole catalogue, not the filtered rows', () => {
    setStatus('array-easy', 'python', 'solved');

    const response = list({ topic: ['stack'] });
    expect(response.matched).toBe(1);
    expect(response.total).toBe(3);
    expect(response.byStatus).toEqual({
      not_started: 2,
      in_progress: 0,
      solved: 1,
      mastered: 0,
    });
    expect(response.byTopic).toEqual([
      { topic: 'arrays', total: 1, solved: 1, mastered: 0, inProgress: 0 },
      { topic: 'hashmap', total: 1, solved: 0, mastered: 0, inProgress: 0 },
      { topic: 'stack', total: 1, solved: 0, mastered: 0, inProgress: 0 },
    ]);
  });

  it('counts a mastered problem as solved as well', () => {
    setStatus('array-easy', 'python', 'mastered');

    const byTopic = list().byTopic.find((entry) => entry.topic === 'arrays');
    expect(byTopic).toMatchObject({ solved: 1, mastered: 1 });
  });
});

describe('problem detail', () => {
  beforeEach(() => {
    write({ slug: 'pair-sum-index', related: ['shift-right-in-place', 'never-written'] });
    write({ slug: 'shift-right-in-place', title: 'Shift Right', tier: 'Medium', rating: 4 });
  });

  const detail = (slug = 'pair-sum-index') => problemDetail(slug, { catalogue, repos });

  it('404s on a slug that names nothing', () => {
    expect(() => detail('no-such-problem')).toThrow(HttpError);
    try {
      detail('no-such-problem');
    } catch (error) {
      expect((error as HttpError).statusCode).toBe(404);
    }
  });

  it('sends the samples and the hidden count, never the hidden tests', () => {
    const result = detail();
    expect(result.samples).toHaveLength(3);
    expect(result.hiddenCount).toBe(10);
    expect(JSON.stringify(result)).not.toContain('"hidden"');
  });

  it('withholds the editorial until the problem is solved', () => {
    expect(detail().editorial).toBeNull();
    expect(detail().editorialUnlocked).toBe(false);

    setStatus('pair-sum-index', 'python', 'solved');
    expect(detail().editorialUnlocked).toBe(true);
    expect(detail().editorial).toContain('Approach');
  });

  it('sends the hints whatever the status: they are the no-key fallback', () => {
    expect(detail().hints.length).toBeGreaterThan(0);
  });

  it('carries the starters and any saved drafts', () => {
    repos.drafts.save('pair-sum-index', 'python', 'class Solution:\n    pass\n');

    const result = detail();
    expect(result.starters.python).toContain('class Solution');
    expect(result.starters.java).toContain('class Solution');
    expect(result.drafts.python?.code).toContain('pass');
    expect(result.drafts.java).toBeUndefined();
  });

  it('applies the judge timeout multiplier from settings', () => {
    expect(detail().timeoutMs).toEqual({ python: 4000, java: 2000 });

    repos.settings.update({ judge: { timeoutMultiplier: 1.5 } });
    expect(detail().timeoutMs).toEqual({ python: 6000, java: 3000 });
  });

  it('resolves related problems and drops the ones not written yet', () => {
    expect(detail().related).toEqual([
      { slug: 'shift-right-in-place', title: 'Shift Right', tier: 'Medium', rating: 4 },
    ]);
  });
});

describe('progress overview', () => {
  beforeEach(() => {
    write({ slug: 'array-easy', topic: 'arrays', rating: 2 });
    write({ slug: 'hash-medium', topic: 'hashmap', tier: 'Medium', rating: 5 });
  });

  it('counts every problem, including the ones never opened', () => {
    setStatus('array-easy', 'python', 'solved');

    const overview = progressOverview({ catalogue, repos });
    expect(overview.total).toBe(2);
    expect(overview.rows).toHaveLength(1);
    expect(overview.byStatus).toEqual({
      not_started: 1,
      in_progress: 0,
      solved: 1,
      mastered: 0,
    });
    expect(overview.byTier).toEqual([
      { tier: 'Easy', total: 1, solved: 1, mastered: 0, inProgress: 0 },
      { tier: 'Medium', total: 1, solved: 0, mastered: 0, inProgress: 0 },
    ]);
  });
});
