import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './client.js';

/**
 * The API client (ROADMAP P4-1).
 *
 * Two things every request needs, and a mistake in either looks like a bug
 * somewhere else entirely: the `X-DevProMax-Client` header, without which the
 * server answers 403 (D15), and errors that say what failed. Screen tests go
 * through this file too, but only ever ask whether the screen worked - so the
 * header could go missing from one call and every one of them would still pass
 * against the fake server, which does not check it.
 */

type Call = [input: string, init?: RequestInit];

function stubFetch(answer: () => Promise<Response>) {
  const fetch = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(answer);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function headersOf(call: Call | undefined): Record<string, string> {
  return (call?.[1]?.headers ?? {}) as Record<string, string>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  const blobUrls = URL as unknown as Record<string, unknown>;
  delete blobUrls['createObjectURL'];
  delete blobUrls['revokeObjectURL'];
});

describe('every request', () => {
  it('carries the client header, and no credentials', async () => {
    const fetch = stubFetch(() => json({}));

    // One of each shape: a read, a write with a body, a bodiless POST, and the
    // two calls that build their own `fetch` rather than going through `request`.
    await api.progress();
    await api.updateSettings({ theme: 'dark' });
    await api.resetProgress();
    await api.saveDraftKeepalive('pair-sum-index', 'python', 'pass');
    // jsdom has neither; added to the real `URL` and removed after (as Progress.test does).
    const blobUrls = URL as unknown as Record<string, unknown>;
    blobUrls['createObjectURL'] = vi.fn(() => 'blob:report');
    blobUrls['revokeObjectURL'] = vi.fn();
    await api.downloadReport('json');

    expect(fetch).toHaveBeenCalledTimes(5);
    for (const call of fetch.mock.calls) {
      expect(headersOf(call)['X-DevProMax-Client']).toBe('devpromax-web');
      expect(call[1]?.credentials).toBe('omit');
    }
  });

  it('saves on the way out with keepalive, unless the body is past what keepalive takes (P4-14)', async () => {
    const fetch = stubFetch(() => json({}));

    await api.saveDraftKeepalive('pair-sum-index', 'python', 'pass');
    await api.saveNoteKeepalive('pair-sum-index', 'a short note');
    // Past the browser's 64 KB keepalive cap the request would be refused
    // outright, so the draft goes as an ordinary request instead.
    await api.saveDraftKeepalive('pair-sum-index', 'python', 'x'.repeat(70_000));

    expect(fetch.mock.calls.map((call) => [call[0], call[1]?.keepalive])).toEqual([
      ['/api/drafts/pair-sum-index/python', true],
      ['/api/notes/pair-sum-index', true],
      ['/api/drafts/pair-sum-index/python', false],
    ]);
    expect(fetch.mock.calls[1]?.[1]?.body).toBe('{"body":"a short note"}');
  });

  it('says JSON only when there is a body to describe', async () => {
    const fetch = stubFetch(() => json({}));

    await api.progress();
    await api.updateSettings({ theme: 'dark' });

    expect(headersOf(fetch.mock.calls[0])).not.toHaveProperty('Content-Type');
    expect(headersOf(fetch.mock.calls[1])['Content-Type']).toBe('application/json');
    expect(fetch.mock.calls[1]?.[1]?.body).toBe('{"theme":"dark"}');
  });
});

describe('failures', () => {
  it('turns an unreachable server into a sentence, and asks once', async () => {
    const fetch = stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const failure = await api.progress().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(0);
    expect((failure as ApiError).tag).toBe('Unreachable');
    expect((failure as ApiError).message).toMatch(/not responding/);
    // No retry in the client: the query client decides that (main.tsx turns
    // it off), and a retry here would double every one of them.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("carries the server's own envelope and status", async () => {
    stubFetch(() =>
      json({ error: 'BadRequest', message: 'editor.fontSize: expected an integer' }, 400),
    );

    const failure = await api
      .updateSettings({ editor: { fontSize: 12 } })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(400);
    expect((failure as ApiError).tag).toBe('BadRequest');
    expect((failure as ApiError).message).toBe('editor.fontSize: expected an integer');
  });

  it('still says something when the error has no envelope', async () => {
    stubFetch(() => Promise.resolve(new Response('<html>Bad Gateway</html>', { status: 502 })));

    const failure = await api.progress().catch((error: unknown) => error);

    expect((failure as ApiError).status).toBe(502);
    expect((failure as ApiError).tag).toBe('Unknown');
    expect((failure as ApiError).message).toMatch(/502/);
  });

  it('never throws from the save made while the page unloads', async () => {
    // Nobody is left to show it to, and an unhandled rejection on the way out
    // is noise in the console of the next page.
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(api.saveDraftKeepalive('pair-sum-index', 'python', 'pass')).resolves.toBe(
      undefined,
    );
  });
});
