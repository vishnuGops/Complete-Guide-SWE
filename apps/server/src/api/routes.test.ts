import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import {
  COACH_API_KEY_ENV,
  type ProblemDetail,
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

  it('404s an unknown slug and 400s an impossible one', async () => {
    expect((await api('GET', '/api/problems/no-such-problem')).statusCode).toBe(404);
    expect((await api('GET', '/api/problems/NOT_A_SLUG')).statusCode).toBe(400);
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
