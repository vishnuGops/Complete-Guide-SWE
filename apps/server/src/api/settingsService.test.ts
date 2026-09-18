import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COACH_API_KEY_ENV } from '@devpromax/shared';
import type { FetchLike } from '../coach/index.js';
import { createDatabase, IN_MEMORY, type Repositories } from '../db/index.js';
import { HttpError } from './errors.js';
import {
  readSettings,
  resetProgress,
  resolveApiKey,
  testConnection,
  updateSettings,
} from './settingsService.js';

/**
 * Settings, the API key and reset-all-progress (ROADMAP P3-4).
 *
 * Most of what follows is one rule stated several ways: the raw key is not in
 * anything this module hands back. It is worth that many tests because there is
 * no way to notice the leak by using the app - the key would simply be sitting
 * in a response body nobody looked at.
 */

let repos: Repositories;

const KEY = 'sk-ant-api03-abcdefghijklmnop';

function stubFetch(seen: { apiKey?: string } = {}): FetchLike {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    // The Anthropic SDK builds a `Headers`; our own Gemini code passes an object
    // literal. Which one arrives is the caller's business, so read both - the
    // assertion is about the key being sent, not about how it was spelled.
    const raw = init?.headers;
    const headers = Object.fromEntries(
      (raw instanceof Headers
        ? [...raw.entries()]
        : Object.entries((raw ?? {}) as Record<string, string>)
      ).map(([name, value]) => [name.toLowerCase(), String(value)]),
    );
    seen.apiKey = headers['x-api-key'] ?? headers['x-goog-api-key'];
    // The content type matters: without it the SDK does not parse the body,
    // the model list comes back unreadable, and P5-10 says that is not a
    // successful connection - correctly.
    return new Response(JSON.stringify({ data: [{ id: 'claude-opus-5' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as FetchLike;
}

beforeEach(() => {
  repos = createDatabase({ file: IN_MEMORY });
});

afterEach(() => {
  repos.close();
});

describe('reading settings', () => {
  it('returns defaults on a first run, with no key configured', () => {
    const view = readSettings({ repos, env: {} });

    expect(view.coach.provider).toBe('anthropic');
    expect(view.coach.apiKeyMasked).toBeNull();
    expect(view.coach.apiKeySource).toBe('none');
    expect(view.editor.tabSize).toBe(4);
    expect(view.judge.timeoutMultiplier).toBe(1);
    expect(view.lastLanguage).toBe('python');
  });

  it('never carries the key, masked or otherwise', () => {
    updateSettings({ coach: { apiKey: KEY } }, { repos, env: {} });
    const view = readSettings({ repos, env: {} });

    expect('apiKey' in view.coach).toBe(false);
    expect(JSON.stringify(view)).not.toContain(KEY);
    expect(view.coach.apiKeyMasked).toBe('••••••••mnop');
    expect(view.coach.apiKeySource).toBe('settings');
  });

  it('lets the environment override a stored key', () => {
    updateSettings({ coach: { apiKey: KEY } }, { repos, env: {} });

    const view = readSettings({ repos, env: { [COACH_API_KEY_ENV]: 'sk-ant-from-the-env' } });
    expect(view.coach.apiKeySource).toBe('env');
    expect(view.coach.apiKeyMasked).toBe('••••••••-env');
  });

  it('ignores an environment variable that is only whitespace', () => {
    expect(resolveApiKey(repos, { [COACH_API_KEY_ENV]: '   ' }).source).toBe('none');
  });
});

describe('updating settings', () => {
  it('merges a partial patch without dropping the untouched sections', () => {
    updateSettings({ editor: { fontSize: 18 } }, { repos, env: {} });
    const view = updateSettings({ theme: 'dark' }, { repos, env: {} });

    expect(view.editor.fontSize).toBe(18);
    expect(view.editor.tabSize).toBe(4);
    expect(view.theme).toBe('dark');
  });

  it('keeps the stored key when the patch does not mention it', () => {
    updateSettings({ coach: { apiKey: KEY } }, { repos, env: {} });
    updateSettings({ coach: { model: 'claude-opus-5' } }, { repos, env: {} });

    expect(repos.settings.get().coach.apiKey).toBe(KEY);
    expect(readSettings({ repos, env: {} }).coach.model).toBe('claude-opus-5');
  });

  it('treats an empty key as "remove my key"', () => {
    updateSettings({ coach: { apiKey: KEY } }, { repos, env: {} });
    const view = updateSettings({ coach: { apiKey: '  ' } }, { repos, env: {} });

    expect(repos.settings.get().coach.apiKey).toBeNull();
    expect(view.coach.apiKeySource).toBe('none');
  });

  it('rejects a value outside its range before it reaches the database', () => {
    expect(() =>
      updateSettings({ judge: { timeoutMultiplier: 99 } }, { repos, env: {} }),
    ).toThrow();
    expect(repos.settings.get().judge.timeoutMultiplier).toBe(1);
  });
});

describe('the connection test', () => {
  it('refuses to guess when nothing is configured', async () => {
    await expect(testConnection({ repos, env: {} })).rejects.toBeInstanceOf(HttpError);
    await expect(testConnection({ repos, env: {} })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('sends the stored key to the configured provider', async () => {
    const seen: { apiKey?: string } = {};
    updateSettings({ coach: { apiKey: KEY, model: 'claude-opus-5' } }, { repos, env: {} });

    const result = await testConnection({
      repos,
      env: {},
      provider: { fetch: stubFetch(seen) },
    });

    expect(seen.apiKey).toBe(KEY);
    expect(result).toMatchObject({ ok: true, provider: 'anthropic', model: 'claude-opus-5' });
  });

  it('uses the environment key when one is set', async () => {
    const seen: { apiKey?: string } = {};
    updateSettings({ coach: { apiKey: KEY } }, { repos, env: {} });

    await testConnection({
      repos,
      env: { [COACH_API_KEY_ENV]: 'sk-ant-from-the-env' },
      provider: { fetch: stubFetch(seen) },
    });

    expect(seen.apiKey).toBe('sk-ant-from-the-env');
  });
});

describe('reset all progress', () => {
  beforeEach(() => {
    repos.submissions.insert({
      slug: 'pair-sum-index',
      language: 'python',
      code: 'print(1)',
      verdict: 'AC',
      passed: 3,
      total: 3,
      timeMs: 12,
      problemVersion: 1,
    });
    repos.progress.put({
      slug: 'pair-sum-index',
      language: 'python',
      status: 'solved',
      attempts: 1,
      solvedAt: '2026-09-17T09:00:00.000Z',
      masteredAt: null,
      lastAttemptedAt: '2026-09-17T09:00:00.000Z',
    });
    repos.drafts.save('pair-sum-index', 'python', 'draft code');
    repos.events.record({ type: 'submit', slug: 'pair-sum-index', language: 'python' });
    const session = repos.coach.createSession('pair-sum-index', 'python');
    repos.coach.addMessage(session.id, { role: 'user', content: 'help' });
    repos.notes.save('pair-sum-index', 'my own notes');
    updateSettings({ coach: { apiKey: KEY } }, { repos, env: {} });
  });

  it('clears the record of practice and reports what went', () => {
    const result = resetProgress(repos);

    expect(result.cleared).toEqual({
      submissions: 1,
      progress: 1,
      drafts: 1,
      events: 1,
      coachSessions: 1,
    });
    expect(repos.submissions.list()).toEqual([]);
    expect(repos.progress.list()).toEqual([]);
    expect(repos.drafts.get('pair-sum-index', 'python')).toBeNull();
    expect(repos.events.list()).toEqual([]);
    expect(repos.coach.listSessions('pair-sum-index')).toEqual([]);
  });

  it('keeps what the user wrote and what they configured', () => {
    resetProgress(repos);

    expect(repos.notes.get('pair-sum-index')?.body).toBe('my own notes');
    expect(repos.settings.get().coach.apiKey).toBe(KEY);
  });
});
