import type {
  ApiError as ApiErrorBody,
  Language,
  ProblemDetail,
  ProblemListResponse,
  RunResult,
  SettingsView,
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
}

export const api = {
  problems: (): Promise<ProblemListResponse> => request('/api/problems'),
  problem: (slug: string): Promise<ProblemDetail> =>
    request(`/api/problems/${encodeURIComponent(slug)}`),
  settings: (): Promise<SettingsView> => request('/api/settings'),

  run: (body: RunBody): Promise<RunResult> =>
    request('/api/run', { method: 'POST', body: JSON.stringify(body) }),
  submit: (body: RunBody): Promise<RunResult> =>
    request('/api/submit', { method: 'POST', body: JSON.stringify(body) }),
};
