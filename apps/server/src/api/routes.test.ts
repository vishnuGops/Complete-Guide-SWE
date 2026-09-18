import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import {
  COACH_API_KEY_ENV,
  type ProblemDetail,
  type DashboardResponse,
  type NextProblemResponse,
  type ProblemListResponse,
  type ProgressResponse,
  type RunResult,
  type SettingsView,
  type SubmissionListResponse,
  type Verdict,
} from '@devpromax/shared';
import type { FetchLike } from '../coach/index.js';
import { serverConfig } from '../config.js';
import { createDatabase, IN_MEMORY, type Repositories } from '../db/index.js';
import { buildServer } from '../index.js';
import { silentLogger } from '../logger.js';
import type { RunProblemOptions } from '../judge/index.js';
import { json, makeCatalogue, VALID_META, writeProblem } from '../problems/__fixtures__/factory.js';

/**
 * The HTTP surface, end to end through `app.inject` (ROADMAP P3-5).
 *
 * Everything below the routes is real - the same repositories, the same status
 * engine, the same problem loader - and only two things are stood in for: the
 * judge, because spawning python per assertion would make this suite minutes
 * long (the judge has its own integration tests), and `fetch`, because CI has no
 * API key and no business calling a vendor.
 */

let app: FastifyInstance;
let repos: Repositories;
let root: string;
let judgeSaw: RunProblemOptions | undefined;
let verdict: Verdict;

const EASY = 'pair-sum-index';
const MEDIUM = 'shift-right-in-place';

function fakeJudge() {
  return async (options: RunProblemOptions): Promise<RunResult> => {
    judgeSaw = options;
    const tests = options.tests.map((entry, index) => ({
      index,
      source: entry.source,
      verdict: index === 0 ? verdict : ('AC' as Verdict),
      timeMs: 5,
      revealed: true,
      stdout: '',
      stderr: '',
    }));
    return {
      slug: options.meta.slug,
      language: options.language,
      kind: options.kind,
      problemVersion: options.meta.version,
      verdict,
      passed: tests.filter((test) => test.verdict === 'AC').length,
      total: tests.length,
      totalTimeMs: 20,
      compileErrors: [],
      tests,
      outputTruncated: false,
      isolationFallback: false,
    };
  };
}

const stubFetch: FetchLike = (async () =>
  new Response(JSON.stringify({ data: [{ id: 'claude-opus-5' }] }), {
    status: 200,
    // The content type matters: without it the SDK does not parse the body, the
    // model list comes back unreadable, and P5-10 says that is not a successful
    // connection - correctly.
    headers: { 'content-type': 'application/json' },
  })) as FetchLike;

/** Every /api call the UI makes carries these two headers; so does every test. */
function api(
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  url: string,
  payload?: object,
  headers: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  return app.inject({
    method,
    url,
    ...(payload !== undefined ? { payload } : {}),
    headers: {
      host: '127.0.0.1:5174',
      [serverConfig.clientHeader]: 'devpromax-web',
      ...headers,
    },
  });
}

beforeEach(async () => {
  root = makeCatalogue();
  writeProblem(root, {
    topic: 'arrays',
    slug: EASY,
    files: {
      'meta.json': json({ ...VALID_META, related: [MEDIUM] }),
      'assets/diagram.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    },
  });
  writeProblem(root, {
    topic: 'arrays',
    slug: MEDIUM,
    files: {
      'meta.json': json({
        ...VALID_META,
        id: MEDIUM,
        slug: MEDIUM,
        title: 'Shift Right In Place',
        tier: 'Medium',
        rating: 4,
        order: 1,
        patterns: ['in-place', 'reversal'],
      }),
    },
  });

  repos = createDatabase({ file: IN_MEMORY });
  verdict = 'AC';
  judgeSaw = undefined;

  app = await buildServer({
    logger: silentLogger,
    repositories: repos,
    problemsRoot: root,
    judge: fakeJudge(),
    env: {},
    provider: { fetch: stubFetch },
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  repos.close();
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------

describe('hardening applies to real routes', () => {
  it('refuses an /api request without the client header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/problems',
      headers: { host: '127.0.0.1:5174' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'Forbidden' });
  });

  it('refuses a request addressed to somebody else’s host', async () => {
    const response = await api('GET', '/api/problems', undefined, {
      host: 'rebind.attacker.test',
    });

    expect(response.statusCode).toBe(421);
  });

  it('leaves /health alone, so a check does not need the header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { host: '127.0.0.1:5174' },
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('error envelope', () => {
  it('answers an unknown route in the same shape as everything else', async () => {
    const response = await api('GET', '/api/nope');

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'NotFound', message: expect.any(String) });
  });

  it('answers a malformed JSON body without a stack trace', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/run',
      headers: {
        host: '127.0.0.1:5174',
        [serverConfig.clientHeader]: 'devpromax-web',
        'content-type': 'application/json',
      },
      payload: '{ "slug": ',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('BadRequest');
  });

  it('points at the offending field when validation fails', async () => {
    const response = await api('POST', '/api/run', { slug: EASY, language: 'cobol', code: '' });

    expect(response.statusCode).toBe(400);
    expect(response.json().issues).toContainEqual(expect.objectContaining({ path: 'language' }));
  });
});

describe('GET /api/problems', () => {
  it('lists the catalogue in the default order with catalogue-wide counts', async () => {
    const body = (await api('GET', '/api/problems')).json() as ProblemListResponse;

    expect(body.items.map((item) => item.slug)).toEqual([EASY, MEDIUM]);
    expect(body.total).toBe(2);
    expect(body.matched).toBe(2);
    expect(body.byStatus.not_started).toBe(2);
    expect(body.byTopic).toEqual([
      { topic: 'arrays', total: 2, solved: 0, mastered: 0, inProgress: 0 },
    ]);
  });

  it('filters, and keeps the totals over the whole catalogue', async () => {
    const body = (await api('GET', '/api/problems?tier=Medium')).json() as ProblemListResponse;

    expect(body.items.map((item) => item.slug)).toEqual([MEDIUM]);
    expect(body.matched).toBe(1);
    expect(body.total).toBe(2);
  });

  it('accepts a repeated parameter and a comma-separated one alike', async () => {
    const repeated = (
      await api('GET', '/api/problems?tier=Easy&tier=Medium')
    ).json() as ProblemListResponse;
    const commas = (
      await api('GET', '/api/problems?tier=Easy,Medium')
    ).json() as ProblemListResponse;

    expect(repeated.matched).toBe(2);
    expect(commas.matched).toBe(2);
  });

  it('sorts on request', async () => {
    const body = (
      await api('GET', '/api/problems?sort=rating&dir=desc')
    ).json() as ProblemListResponse;

    expect(body.items.map((item) => item.slug)).toEqual([MEDIUM, EASY]);
  });

  it('rejects a filter value that is not a real topic', async () => {
    const response = await api('GET', '/api/problems?topic=not-a-topic');

    expect(response.statusCode).toBe(400);
    expect(response.json().issues?.[0]?.path).toBe('topic[0]');
  });
});

describe('GET /api/problems/:slug', () => {
  it('returns the workspace payload', async () => {
    const body = (await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail;

    expect(body.summary.slug).toBe(EASY);
    expect(body.statement).toContain('Constraints');
    expect(body.samples).toHaveLength(3);
    expect(body.hiddenCount).toBe(10);
    expect(body.starters.python).toContain('class Solution');
    expect(body.assets).toEqual(['diagram.svg']);
    expect(body.related.map((item) => item.slug)).toEqual([MEDIUM]);
  });

  it('withholds the editorial until the problem is solved', async () => {
    expect(
      ((await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail).editorial,
    ).toBeNull();

    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'x = 1' });

    const after = (await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail;
    expect(after.editorialUnlocked).toBe(true);
    expect(after.editorial).toContain('Approach');
  });

  it('sends the reference solutions only once the editorial is unlocked (P7-2)', async () => {
    expect(
      ((await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail).references,
    ).toBeNull();

    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'x = 1' });

    const after = (await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail;
    expect(after.references?.python).toContain('seen[v] = i');
    expect(after.references?.java).toContain('HashMap');
  });

  it('404s an unknown slug and 400s an impossible one', async () => {
    expect((await api('GET', '/api/problems/no-such-problem')).statusCode).toBe(404);
    expect((await api('GET', '/api/problems/NOT_A_SLUG')).statusCode).toBe(400);
  });
});

describe('POST /api/problems/:slug/editorial', () => {
  it('unlocks the editorial without solving, and records that it did', async () => {
    const body = (await api('POST', `/api/problems/${EASY}/editorial`)).json() as ProblemDetail;

    expect(body.editorialUnlocked).toBe(true);
    expect(body.editorial).toContain('Approach');
    expect(body.references?.python).toContain('class Solution');

    const [event] = repos.events.list({ slug: EASY });
    expect(event?.type).toBe('editorial_revealed');
    // Revealing is not attempting. The status ratchet (D11) is untouched.
    expect(repos.progress.listByProblem(EASY)).toEqual([]);
  });

  it('stays unlocked on the next read', async () => {
    await api('POST', `/api/problems/${EASY}/editorial`);

    const detail = (await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail;
    expect(detail.editorialUnlocked).toBe(true);
  });

  it('records nothing when the editorial was not locked to begin with', async () => {
    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'x = 1' });
    await api('POST', `/api/problems/${EASY}/editorial`);

    expect(
      repos.events.list({ slug: EASY }).filter((e) => e.type === 'editorial_revealed'),
    ).toEqual([]);
  });

  it('records one reveal however many times it is pressed', async () => {
    await api('POST', `/api/problems/${EASY}/editorial`);
    await api('POST', `/api/problems/${EASY}/editorial`);

    expect(
      repos.events.list({ slug: EASY }).filter((e) => e.type === 'editorial_revealed'),
    ).toHaveLength(1);
  });

  it('locks again when progress is reset', async () => {
    await api('POST', `/api/problems/${EASY}/editorial`);
    await api('POST', '/api/settings/reset-progress');

    const detail = (await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail;
    expect(detail.editorialUnlocked).toBe(false);
    expect(detail.references).toBeNull();
  });

  it('404s an unknown problem', async () => {
    expect((await api('POST', '/api/problems/no-such-problem/editorial')).statusCode).toBe(404);
  });
});

describe('POST /api/problems/:slug/hints', () => {
  async function reveal(slug: string, revealed: number) {
    return api('POST', `/api/problems/${slug}/hints`, { revealed });
  }

  it('starts at zero and remembers what was revealed', async () => {
    expect(
      ((await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail).revealedHints,
    ).toBe(0);

    expect((await reveal(EASY, 1)).json()).toEqual({ revealed: 1 });
    expect((await reveal(EASY, 2)).json()).toEqual({ revealed: 2 });

    expect(
      ((await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail).revealedHints,
    ).toBe(2);
  });

  it('is idempotent, and a stale tab cannot take a hint back', async () => {
    await reveal(EASY, 3);

    // The same click sent twice, then an older tab that still thinks it is on
    // rung 1. Neither moves the ladder.
    expect((await reveal(EASY, 3)).json()).toEqual({ revealed: 3 });
    expect((await reveal(EASY, 1)).json()).toEqual({ revealed: 3 });
    expect(
      repos.events.list({ slug: EASY }).filter((e) => e.type === 'hint_revealed'),
    ).toHaveLength(1);
  });

  it('refuses a rung the ladder does not have', async () => {
    // The fixture's ladder is four rungs; a fifth is a client that has drifted
    // from the problem, not a hint.
    const response = await reveal(EASY, 5);

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('4 hint(s)');
  });

  it('rejects a body that is not a rung', async () => {
    expect((await reveal(EASY, 0)).statusCode).toBe(400);
    expect((await api('POST', `/api/problems/${EASY}/hints`, {})).statusCode).toBe(400);
  });

  it('404s an unknown problem', async () => {
    expect((await reveal('no-such-problem', 1)).statusCode).toBe(404);
  });

  it('records the reveal as activity without touching progress', async () => {
    await reveal(EASY, 1);

    const [event] = repos.events.list({ slug: EASY });
    expect(event?.type).toBe('hint_revealed');
    expect(event?.payload).toEqual({ revealed: 1 });
    // Reading a hint is not an attempt (D11).
    expect(repos.progress.listByProblem(EASY)).toEqual([]);
  });

  it('forgets the reveals when progress is reset', async () => {
    await reveal(EASY, 4);
    await api('POST', '/api/settings/reset-progress');

    expect(
      ((await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail).revealedHints,
    ).toBe(0);
  });
});

describe('GET /api/problems/:slug/assets/*', () => {
  it('serves an asset with a locked-down content type', async () => {
    const response = await api('GET', `/api/problems/${EASY}/assets/diagram.svg`);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/svg+xml');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.body).toContain('<svg');
  });

  it('will not walk out of the assets directory', async () => {
    for (const attempt of ['../reference.py', '..%2freference.py', '../../arrays/meta.json']) {
      const response = await api('GET', `/api/problems/${EASY}/assets/${attempt}`);
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain('class Solution');
    }
  });

  it('404s a file that is not there', async () => {
    expect((await api('GET', `/api/problems/${EASY}/assets/missing.png`)).statusCode).toBe(404);
  });
});

describe('POST /api/run', () => {
  it('runs the samples and marks the problem in progress without recording a submission', async () => {
    const response = await api('POST', '/api/run', {
      slug: EASY,
      language: 'python',
      code: 'class Solution: pass',
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as RunResult).kind).toBe('run');
    expect(new Set(judgeSaw?.tests.map((test) => test.source))).toEqual(new Set(['sample']));
    expect(repos.progress.get(EASY, 'python')?.status).toBe('in_progress');
    expect(repos.submissions.list()).toEqual([]);
  });

  it('runs the user’s own cases alongside the samples', async () => {
    await api('POST', '/api/run', {
      slug: EASY,
      language: 'python',
      code: 'class Solution: pass',
      customTests: [{ args: [[1, 2], 3] }],
    });

    expect(judgeSaw?.tests.filter((test) => test.source === 'custom')).toHaveLength(1);
  });

  it('says which custom case does not fit and why', async () => {
    const response = await api('POST', '/api/run', {
      slug: EASY,
      language: 'python',
      code: 'class Solution: pass',
      customTests: [{ args: [[1, 2]] }],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().issues?.[0]?.path).toBe('customTests[0]');
  });

  it('404s a run against a problem that does not exist', async () => {
    const response = await api('POST', '/api/run', {
      slug: 'no-such-problem',
      language: 'python',
      code: 'x = 1',
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('POST /api/submit', () => {
  it('runs every hidden test, records the submission and moves the status to solved', async () => {
    const response = await api('POST', '/api/submit', {
      slug: EASY,
      language: 'python',
      code: 'class Solution: solved',
    });

    expect(response.statusCode).toBe(200);
    expect(judgeSaw?.tests.filter((test) => test.source === 'hidden')).toHaveLength(10);

    const [submission] = repos.submissions.list();
    expect(submission).toMatchObject({ slug: EASY, language: 'python', verdict: 'AC' });
    expect(repos.progress.get(EASY, 'python')).toMatchObject({ status: 'solved', attempts: 1 });
  });

  it('records a rejected submit as an attempt without demoting an earlier solve', async () => {
    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'good' });
    verdict = 'WA';
    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'worse' });

    expect(repos.progress.get(EASY, 'python')).toMatchObject({ status: 'solved', attempts: 2 });
  });

  it('ignores custom cases: a submit faces the problem’s own tests', async () => {
    await api('POST', '/api/submit', {
      slug: EASY,
      language: 'python',
      code: 'x = 1',
      customTests: [{ args: [[1, 2], 3] }],
    });

    expect(judgeSaw?.tests.some((test) => test.source === 'custom')).toBe(false);
  });

  it('flips the list row to solved without a reload', async () => {
    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'x = 1' });

    const body = (await api('GET', '/api/problems')).json() as ProblemListResponse;
    expect(body.items.find((item) => item.slug === EASY)?.status).toBe('solved');
    expect(body.byStatus.solved).toBe(1);
  });
});

describe('submissions and progress', () => {
  beforeEach(async () => {
    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'first' });
    await api('POST', '/api/submit', { slug: EASY, language: 'java', code: 'second' });
  });

  it('lists a problem’s submissions newest first', async () => {
    const body = (
      await api('GET', `/api/problems/${EASY}/submissions`)
    ).json() as SubmissionListResponse;

    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.code).toBe('second');
  });

  it('filters submissions by language and honours a limit', async () => {
    const byLanguage = (
      await api('GET', `/api/problems/${EASY}/submissions?language=python`)
    ).json() as SubmissionListResponse;
    expect(byLanguage.items).toHaveLength(1);

    const limited = (
      await api('GET', `/api/problems/${EASY}/submissions?limit=1`)
    ).json() as SubmissionListResponse;
    expect(limited.items).toHaveLength(1);
  });

  it('rejects a limit outside the allowed range', async () => {
    expect((await api('GET', `/api/problems/${EASY}/submissions?limit=0`)).statusCode).toBe(400);
  });

  it('reports progress across the catalogue', async () => {
    const body = (await api('GET', '/api/progress')).json() as ProgressResponse;

    expect(body.total).toBe(2);
    expect(body.rows).toHaveLength(2);
    expect(body.byStatus).toMatchObject({ solved: 1, not_started: 1 });
  });

  it('lets the user override a status downwards, and records that they did', async () => {
    const response = await api('PUT', `/api/progress/${EASY}/python`, { status: 'in_progress' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'in_progress', solvedAt: null });
    expect(repos.events.list({ slug: EASY })[0]?.type).toBe('status_override');
  });
});

describe('drafts', () => {
  it('round-trips a draft and leaves the status alone', async () => {
    const saved = await api('PUT', `/api/drafts/${EASY}/python`, { code: 'work in progress' });

    expect(saved.statusCode).toBe(200);
    expect(saved.json().draft).toMatchObject({ slug: EASY, language: 'python' });
    expect(repos.progress.get(EASY, 'python')).toBeNull();

    const detail = (await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail;
    expect(detail.drafts.python?.code).toBe('work in progress');
  });

  it('deletes a draft on reset-to-starter', async () => {
    await api('PUT', `/api/drafts/${EASY}/python`, { code: 'scribbles' });
    const removed = await api('DELETE', `/api/drafts/${EASY}/python`);

    expect(removed.json()).toEqual({ draft: null });
    expect(repos.drafts.get(EASY, 'python')).toBeNull();
  });

  it('rejects a language we do not run and a problem we do not have', async () => {
    expect((await api('PUT', `/api/drafts/${EASY}/rust`, { code: '' })).statusCode).toBe(400);
    expect((await api('PUT', '/api/drafts/no-such-problem/python', { code: '' })).statusCode).toBe(
      404,
    );
  });
});

describe('bookmarks and what to do next (P7-7)', () => {
  it('stars a problem and says so on the row', async () => {
    expect((await api('PUT', `/api/bookmarks/${EASY}`)).json()).toEqual({
      slug: EASY,
      bookmarked: true,
    });

    const list = (await api('GET', '/api/problems')).json() as ProblemListResponse;
    expect(list.items.find((item) => item.slug === EASY)?.bookmarked).toBe(true);
    expect(list.items.find((item) => item.slug === MEDIUM)?.bookmarked).toBe(false);
  });

  it('keeps the original date when starred twice', async () => {
    await api('PUT', `/api/bookmarks/${EASY}`);
    const first = repos.bookmarks.list()[0]?.createdAt;
    await api('PUT', `/api/bookmarks/${EASY}`);

    // A second click on an already-starred problem must not reorder the list.
    expect(repos.bookmarks.list()).toHaveLength(1);
    expect(repos.bookmarks.list()[0]?.createdAt).toBe(first);
  });

  it('unstars one, including a problem that is no longer in the catalogue', async () => {
    await api('PUT', `/api/bookmarks/${EASY}`);
    expect((await api('DELETE', `/api/bookmarks/${EASY}`)).json()).toEqual({
      slug: EASY,
      bookmarked: false,
    });

    // Someone with a stale bookmark has to be able to get rid of it.
    expect((await api('DELETE', '/api/bookmarks/no-such-problem')).statusCode).toBe(200);
    expect((await api('PUT', '/api/bookmarks/no-such-problem')).statusCode).toBe(404);
  });

  it('filters the list down to starred problems', async () => {
    await api('PUT', `/api/bookmarks/${MEDIUM}`);

    const starred = (
      await api('GET', '/api/problems?bookmarked=true')
    ).json() as ProblemListResponse;
    expect(starred.items.map((item) => item.slug)).toEqual([MEDIUM]);

    // Absent means all of them, and the catalogue-wide totals do not move.
    const all = (await api('GET', '/api/problems')).json() as ProblemListResponse;
    expect(all.items).toHaveLength(2);
    expect(starred.total).toBe(2);
  });

  it('survives a progress reset, like a note does', async () => {
    await api('PUT', `/api/bookmarks/${EASY}`);
    await api('POST', '/api/settings/reset-progress');

    expect(repos.bookmarks.has(EASY)).toBe(true);
  });

  it('recommends the lowest-rated unsolved problem, with a reason', async () => {
    const body = (await api('GET', '/api/next')).json() as NextProblemResponse;

    // The fixture's Easy problem is rated 2 and the Medium one 4.
    expect(body.problem?.slug).toBe(EASY);
    expect(body.reason.length).toBeGreaterThan(20);
  });

  it('does not recommend something already solved', async () => {
    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'x = 1' });

    expect(((await api('GET', '/api/next')).json() as NextProblemResponse).problem?.slug).toBe(
      MEDIUM,
    );
  });

  it('says so when there is nothing left to suggest', async () => {
    for (const slug of [EASY, MEDIUM]) {
      await api('POST', '/api/submit', { slug, language: 'python', code: 'x = 1' });
    }

    const body = (await api('GET', '/api/next')).json() as NextProblemResponse;
    expect(body.problem).toBeNull();
    expect(body.reason).toContain('Every problem');
  });

  it('picks an unsolved problem at random, and says that is what it did', async () => {
    const body = (await api('GET', '/api/next?mode=random')).json() as NextProblemResponse;

    expect([EASY, MEDIUM]).toContain(body.problem?.slug);
    expect(body.reason).toContain('at random');
  });

  it('rejects a mode it does not have', async () => {
    expect((await api('GET', '/api/next?mode=hardest')).statusCode).toBe(400);
  });
});

describe('the review queue (P7-8)', () => {
  /**
   * An accepted submission dated in the past.
   *
   * Written with SQL rather than through the repository, which stamps the
   * current time - the whole point here is a pass that happened weeks ago, and
   * a `createdAt` parameter on `insert` would exist only for this test.
   */
  let n = 0;
  function passed(slug: string, at: string) {
    n += 1;
    repos.db
      .prepare(
        `INSERT INTO submissions
           (id, slug, language, code, verdict, passed, total, time_ms, problem_version, created_at)
         VALUES (?, ?, 'python', 'x = 1', 'AC', 3, 3, 1, 1, ?)`,
      )
      .run(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, slug, at);
  }

  async function dashboard() {
    return (await api('GET', '/api/dashboard')).json() as DashboardResponse;
  }

  it('is empty until something has been solved', async () => {
    expect((await dashboard()).reviews).toEqual({ due: [], upcoming: [] });
  });

  it('puts a problem solved weeks ago in the due list', async () => {
    passed(EASY, '2026-09-01T09:00:00.000Z');

    const { reviews } = await dashboard();
    expect(reviews.due.map((item) => item.slug)).toEqual([EASY]);
    expect(reviews.due[0]?.passes).toBe(1);
    expect(reviews.due[0]?.overdueDays).toBeGreaterThan(0);
  });

  it('keeps a problem solved an hour ago out of it', async () => {
    passed(EASY, new Date(Date.now() - 60 * 60 * 1000).toISOString());

    const { reviews } = await dashboard();
    expect(reviews.due).toEqual([]);
    // Still on the calendar, though: a queue that only shows what is due is a
    // nag, and one that also shows what is coming is a schedule.
    expect(reviews.upcoming.map((item) => item.slug)).toEqual([EASY]);
  });

  it('counts a re-solve as a pass and pushes the next review further out', async () => {
    passed(EASY, '2026-09-01T09:00:00.000Z');
    const first = (await dashboard()).reviews.due[0];

    passed(EASY, '2026-09-02T09:00:00.000Z');
    const second = (await dashboard()).reviews.due[0];

    expect(second?.passes).toBe(2);
    // One day later and one rung up the ladder: 1 September plus three days
    // against 2 September plus seven.
    expect((second?.dueAt ?? '') > (first?.dueAt ?? '')).toBe(true);
  });

  it('ignores a failed submission - it is not a pass', async () => {
    passed(EASY, '2026-09-01T09:00:00.000Z');
    repos.db
      .prepare(
        `INSERT INTO submissions
           (id, slug, language, code, verdict, passed, total, time_ms, problem_version, created_at)
         VALUES ('00000000-0000-4000-8000-999999999999', ?, 'python', 'x = 1', 'WA', 1, 3, 1, 1, ?)`,
      )
      .run(MEDIUM, '2026-09-01T09:00:00.000Z');

    const { reviews } = await dashboard();
    expect([...reviews.due, ...reviews.upcoming].map((item) => item.slug)).toEqual([EASY]);
  });

  it('sends the most overdue problem when asked for a review', async () => {
    passed(EASY, '2026-08-01T09:00:00.000Z');
    passed(MEDIUM, '2026-09-10T09:00:00.000Z');

    const body = (await api('GET', '/api/next?mode=review')).json() as NextProblemResponse;
    expect(body.problem?.slug).toBe(EASY);
    expect(body.reason).toContain('overdue');
  });

  it('says so when nothing is due for review', async () => {
    const body = (await api('GET', '/api/next?mode=review')).json() as NextProblemResponse;
    expect(body.problem).toBeNull();
    expect(body.reason).toContain('Nothing is due');
  });
});

describe('the interview timer (P7-6)', () => {
  it('records the elapsed time on a submit', async () => {
    await api('POST', '/api/submit', {
      slug: EASY,
      language: 'python',
      code: 'x = 1',
      solveMs: 754_000,
    });

    expect(repos.submissions.list({ slug: EASY })[0]?.solveMs).toBe(754_000);
  });

  it('records null when the clock was not running', async () => {
    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'x = 1' });

    // Not zero. "Not timed" and "solved instantly" are different facts, and
    // P7-10 calibrates ratings against these.
    expect(repos.submissions.list({ slug: EASY })[0]?.solveMs).toBeNull();
  });

  it('ignores it on a run, which is not an attempt at anything', async () => {
    await api('POST', '/api/run', {
      slug: EASY,
      language: 'python',
      code: 'x = 1',
      solveMs: 1_000,
    });

    expect(repos.submissions.list({ slug: EASY })).toEqual([]);
  });

  it('refuses a timer that has been left running for a day', async () => {
    const response = await api('POST', '/api/submit', {
      slug: EASY,
      language: 'python',
      code: 'x = 1',
      solveMs: 90_000_000,
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('the dashboard (P7-5)', () => {
  it('answers with the counts, the streak and the recent list', async () => {
    await api('POST', '/api/run', { slug: EASY, language: 'python', code: 'x = 1' });
    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'x = 1' });

    const body = (await api('GET', '/api/dashboard')).json() as DashboardResponse;

    expect(body.total).toBe(2);
    expect(body.byStatus.solved + body.byStatus.mastered).toBe(1);
    // Two events today, so today is an active day and the streak has started.
    expect(body.streak.current).toBe(1);
    expect(body.recent[0]?.kind).toBe('submit');
    expect(body.recent[0]?.title).toBe('Pair Sum Index');
    expect(body.recent[0]?.verdict).toBe('AC');
  });

  it('counts the editorials that were opened rather than earned', async () => {
    await api('POST', `/api/problems/${EASY}/editorial`);

    expect(
      ((await api('GET', '/api/dashboard')).json() as DashboardResponse).editorialsRevealed,
    ).toBe(1);
  });

  it('has no skills to report before the coach has scored anything', async () => {
    expect(((await api('GET', '/api/dashboard')).json() as DashboardResponse).skills).toEqual([]);
  });

  it('downloads the report in each format, as a file', async () => {
    for (const [format, type] of [
      ['json', 'application/json'],
      ['markdown', 'text/markdown'],
      ['html', 'text/html'],
    ] as const) {
      const response = await api('GET', `/api/dashboard/report?format=${format}`);

      expect(response.statusCode, format).toBe(200);
      expect(response.headers['content-type']).toContain(type);
      expect(response.headers['content-disposition']).toContain('attachment; filename=');
      expect(response.body.length).toBeGreaterThan(50);
    }
  });

  it('defaults to markdown and rejects a format it does not have', async () => {
    const response = await api('GET', '/api/dashboard/report');
    expect(response.headers['content-type']).toContain('text/markdown');
    expect(response.body).toContain('# DSA practice report');

    expect((await api('GET', '/api/dashboard/report?format=pdf')).statusCode).toBe(400);
  });
});

describe('notes (P7-4)', () => {
  it('saves a note, and sends it back with the problem', async () => {
    const response = await api('PUT', `/api/notes/${EASY}`, { body: 'The window shrinks left.' });

    expect(response.statusCode).toBe(200);
    expect(response.json().note.body).toBe('The window shrinks left.');

    const detail = (await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail;
    expect(detail.note).toBe('The window shrinks left.');
    expect(detail.summary.hasNote).toBe(true);
  });

  it('treats a blank body as no note at all', async () => {
    await api('PUT', `/api/notes/${EASY}`, { body: 'something' });
    const cleared = await api('PUT', `/api/notes/${EASY}`, { body: '   ' });

    expect(cleared.json()).toEqual({ note: null });
    expect(((await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail).note).toBeNull();
  });

  it('changes no progress row - writing something down is not an attempt', async () => {
    await api('PUT', `/api/notes/${EASY}`, { body: 'note' });

    expect(repos.progress.listByProblem(EASY)).toEqual([]);
    expect(repos.events.list({ slug: EASY })).toEqual([]);
  });

  it('deletes one', async () => {
    await api('PUT', `/api/notes/${EASY}`, { body: 'note' });
    expect((await api('DELETE', `/api/notes/${EASY}`)).json()).toEqual({ note: null });
    expect(((await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail).note).toBeNull();
  });

  it('404s an unknown problem and 400s an oversized note', async () => {
    expect((await api('PUT', '/api/notes/no-such-problem', { body: 'x' })).statusCode).toBe(404);
    expect((await api('PUT', `/api/notes/${EASY}`, { body: 'x'.repeat(100_001) })).statusCode).toBe(
      400,
    );
  });

  it('finds a problem by what was written about it', async () => {
    await api('PUT', `/api/notes/${MEDIUM}`, { body: 'the one where the window shrinks left' });

    const found = (
      await api('GET', '/api/problems?q=window%20shrinks')
    ).json() as ProblemListResponse;

    // The title and patterns say nothing of the sort; the note is the only
    // reason this row matched.
    expect(found.items.map((item) => item.slug)).toEqual([MEDIUM]);
    expect(found.items[0]?.hasNote).toBe(true);
  });

  it('reads the search term as text, not as a LIKE pattern', async () => {
    await api('PUT', `/api/notes/${MEDIUM}`, { body: 'the one that shrinks' });

    // Through LIKE these would match every note there is. They match none.
    for (const pattern of ['%25', '_']) {
      const response = (
        await api('GET', `/api/problems?q=${pattern}`)
      ).json() as ProblemListResponse;
      expect(response.items, `q=${pattern}`).toEqual([]);
    }
  });

  it('survives a progress reset, unlike the record of practice around it', async () => {
    // Deliberate, and older than this task: reset-all-progress clears what the
    // app recorded about the user, not what the user wrote. The hint count and
    // the editorial unlock are derived from events and do go (P7-1, P7-2); a
    // note is the user's own writing and stays.
    await api('PUT', `/api/notes/${EASY}`, { body: 'note' });
    await api('POST', '/api/settings/reset-progress');

    expect(((await api('GET', `/api/problems/${EASY}`)).json() as ProblemDetail).note).toBe('note');
  });
});

describe('settings', () => {
  it('returns settings with the key masked and never present', async () => {
    await api('PUT', '/api/settings', { coach: { apiKey: 'sk-ant-api03-abcdefghijklmnop' } });

    const response = await api('GET', '/api/settings');
    const body = response.json() as SettingsView;

    expect(response.body).not.toContain('abcdefghijklmnop');
    expect(body.coach.apiKeyMasked).toBe('••••••••mnop');
    expect(body.coach.apiKeySource).toBe('settings');
  });

  it('reports an environment key as coming from the environment', async () => {
    const withEnv = await buildServer({
      logger: silentLogger,
      repositories: repos,
      problemsRoot: root,
      env: { [COACH_API_KEY_ENV]: 'sk-ant-env-key' },
      provider: { fetch: stubFetch },
    });
    await withEnv.ready();

    const body = (
      await withEnv.inject({
        method: 'GET',
        url: '/api/settings',
        headers: { host: '127.0.0.1:5174', [serverConfig.clientHeader]: 'web' },
      })
    ).json() as SettingsView;

    expect(body.coach.apiKeySource).toBe('env');
    await withEnv.close();
  });

  it('rejects an out-of-range preference', async () => {
    const response = await api('PUT', '/api/settings', { editor: { fontSize: 200 } });

    expect(response.statusCode).toBe(400);
    expect(response.json().issues?.[0]?.path).toBe('editor.fontSize');
  });

  it('tests the connection through the provider adapter', async () => {
    await api('PUT', '/api/settings', { coach: { apiKey: 'sk-ant-api03-abcdefghijklmnop' } });

    const response = await api('POST', '/api/settings/test-connection');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, provider: 'anthropic' });
  });

  it('accepts a bodyless POST that still declares JSON', async () => {
    // What a client that always sets Content-Type sends for a POST with no
    // arguments. Fastify rejects an empty JSON body by default.
    const response = await app.inject({
      method: 'POST',
      url: '/api/settings/reset-progress',
      headers: {
        host: '127.0.0.1:5174',
        [serverConfig.clientHeader]: 'devpromax-web',
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('says so when there is no key to test', async () => {
    const response = await api('POST', '/api/settings/test-connection');

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('NoApiKey');
  });

  it('resets progress without touching notes or settings', async () => {
    await api('POST', '/api/submit', { slug: EASY, language: 'python', code: 'x = 1' });
    repos.notes.save(EASY, 'my own notes');

    const response = await api('POST', '/api/settings/reset-progress');

    expect(response.json().cleared).toMatchObject({ submissions: 1, progress: 1 });
    expect(((await api('GET', '/api/progress')).json() as ProgressResponse).rows).toEqual([]);
    expect(repos.notes.get(EASY)?.body).toBe('my own notes');
  });
});
