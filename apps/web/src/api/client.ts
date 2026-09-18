import type {
  ApiError as ApiErrorBody,
  ConnectionTestResponse,
  DraftResponse,
  HintRevealResponse,
  Language,
  ProblemDetail,
  ProblemListQuery,
  ProblemListResponse,
  ProgressResponse,
  ResetProgressResponse,
  RunResult,
  SettingsUpdate,
  SettingsView,
  SubmissionListResponse,
  TestCase,
} from '@devpromax/shared';

/**
 * The one place the web app talks to the server (ROADMAP P4-1).
 *
 * Two things every request needs, and getting either wrong looks like a bug
 * somewhere else entirely:
 *
 *   - the `X-DevProMax-Client` header, without which the server answers 403. It
 *     is not authentication - it is what makes a cross-origin request
 *     non-simple, so a page in another tab cannot fire one at the judge (D15).
 *   - `credentials: 'omit'`, because there is nothing to send and nothing to
 *     receive; the server is local and unauthenticated by design.
 *
 * Responses are typed from `@devpromax/shared`, the same schemas the server
 * validates with, so a shape cannot drift between the two sides.
 */

const CLIENT_HEADER = 'X-DevProMax-Client';
const CLIENT_NAME = 'devpromax-web';

/** A non-2xx response, carrying the server's error envelope. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }

  /** The machine-readable tag, for UI that branches on the kind of failure. */
  get tag(): string {
    return this.body.error;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'omit',
      headers: {
        [CLIENT_HEADER]: CLIENT_NAME,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    // The server not running at all is the most likely failure in development,
    // and `TypeError: Failed to fetch` says nothing useful about it.
    throw new ApiError(0, {
      error: 'Unreachable',
      message: 'The DevProMax server is not responding. Is `npm run dev` still running?',
    });
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      error: 'Unknown',
      message: `The server answered ${response.status} with no explanation.`,
    }))) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }

  return (await response.json()) as T;
}

export interface RunBody {
  slug: string;
  language: Language;
  code: string;
  /** Ignored by `/api/submit`, which runs the problem's own tests only. */
  customTests?: TestCase[];
}

/**
 * The list query as a URL.
 *
 * Repeated keys rather than a comma-joined value: that is what a
 * `URLSearchParams` round trip produces, so the address bar and this agree
 * character for character, and the server accepts both anyway (`multi()` in
 * `shared/api.ts`).
 *
 * Defaults are omitted, so the tidy URL is the unfiltered one - `/` rather than
 * `/?sort=default&dir=asc`.
 */
export function problemQueryString(query: Partial<ProblemListQuery>): string {
  const params = new URLSearchParams();
  for (const topic of query.topic ?? []) params.append('topic', topic);
  for (const tier of query.tier ?? []) params.append('tier', tier);
  for (const status of query.status ?? []) params.append('status', status);
  if (query.q) params.set('q', query.q);
  if (query.language) params.set('language', query.language);
  if (query.sort && query.sort !== 'default') params.set('sort', query.sort);
  if (query.dir && query.dir !== 'asc') params.set('dir', query.dir);
  return params.toString();
}

export const api = {
  problems: (query: Partial<ProblemListQuery> = {}): Promise<ProblemListResponse> => {
    const search = problemQueryString(query);
    return request(search ? `/api/problems?${search}` : '/api/problems');
  },
  problem: (slug: string): Promise<ProblemDetail> =>
    request(`/api/problems/${encodeURIComponent(slug)}`),
  submissions: (slug: string): Promise<SubmissionListResponse> =>
    request(`/api/problems/${encodeURIComponent(slug)}/submissions`),
  progress: (): Promise<ProgressResponse> => request('/api/progress'),
  revealHint: (slug: string, revealed: number): Promise<HintRevealResponse> =>
    request(`/api/problems/${encodeURIComponent(slug)}/hints`, {
      method: 'POST',
      body: JSON.stringify({ revealed }),
    }),

  settings: (): Promise<SettingsView> => request('/api/settings'),
  updateSettings: (patch: SettingsUpdate): Promise<SettingsView> =>
    request('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  /**
   * Checks the configured key against the provider (P5-8). A POST because it
   * spends a network round trip, and must never be retried on its own.
   */
  testConnection: (): Promise<ConnectionTestResponse> =>
    request('/api/settings/test-connection', { method: 'POST' }),
  /** Destructive, and confirmed in the UI before it is ever called (P3-4). */
  resetProgress: (): Promise<ResetProgressResponse> =>
    request('/api/settings/reset-progress', { method: 'POST' }),

  saveDraft: (slug: string, language: Language, code: string): Promise<DraftResponse> =>
    request(`/api/drafts/${encodeURIComponent(slug)}/${language}`, {
      method: 'PUT',
      body: JSON.stringify({ code }),
    }),
  /**
   * The same save, for a page that is going away (ROADMAP P4-11).
   *
   * `keepalive` is what lets the request outlive the document: a normal fetch
   * started from a `pagehide` handler is cancelled along with the page, which
   * is exactly the moment the last few hundred milliseconds of typing needed to
   * be written. Errors are swallowed on purpose - there is nothing left to show
   * one to, and the alternative is an unhandled rejection on the way out.
   */
  saveDraftKeepalive: async (slug: string, language: Language, code: string): Promise<void> => {
    try {
      await fetch(`/api/drafts/${encodeURIComponent(slug)}/${language}`, {
        method: 'PUT',
        credentials: 'omit',
        keepalive: true,
        headers: { [CLIENT_HEADER]: CLIENT_NAME, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
    } catch {
      // The page is unloading; there is no one to tell.
    }
  },
  /** Reset-to-starter: deleting the draft is what makes the reset survive a reload. */
  deleteDraft: (slug: string, language: Language): Promise<DraftResponse> =>
    request(`/api/drafts/${encodeURIComponent(slug)}/${language}`, { method: 'DELETE' }),

  run: (body: RunBody): Promise<RunResult> =>
    request('/api/run', { method: 'POST', body: JSON.stringify(body) }),
  submit: (body: RunBody): Promise<RunResult> =>
    request('/api/submit', { method: 'POST', body: JSON.stringify(body) }),
};
