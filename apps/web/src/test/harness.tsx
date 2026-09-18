import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderResult } from '@testing-library/react';
import { vi } from 'vitest';
import type {
  ProblemDetail,
  ProblemListResponse,
  ProblemSummary,
  ProgressResponse,
  SettingsView,
} from '@devpromax/shared';
import { ShortcutProvider } from '../shortcuts/ShortcutProvider.js';
import { TooltipProvider } from '../ui/index.js';

/**
 * What a component test needs around it (ROADMAP P4-9's half of P4-2..P4-7).
 *
 * The screens are not standalone: they read the URL, they read server state, and
 * two of them bind shortcuts. Rendering one without its providers tests a
 * different component from the one that ships, so the harness gives all three -
 * and, crucially, gives a *real* query client over a *fake* `fetch`, so the API
 * client's own behaviour (the `X-DevProMax-Client` header, the error envelope)
 * is exercised rather than stubbed out one layer too high.
 */

export function renderApp(
  ui: ReactElement,
  { route = '/' }: { route?: string } = {},
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <TooltipProvider delayDuration={0}>
            <ShortcutProvider>{children}</ShortcutProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}

// ---------------------------------------------------------------------------
// A fake server
// ---------------------------------------------------------------------------

export interface Route {
  /** Matched against the path plus query string, in declaration order. */
  match: (url: URL) => boolean;
  /**
   * The response body, JSON-encoded for you - or a whole `Response`, returned
   * as-is. The second form exists for the coach routes (P5-3), which answer
   * with an event stream rather than JSON; encoding one as JSON would test a
   * shape the server never sends.
   */
  body: (url: URL, init: RequestInit | undefined) => unknown;
}

export interface FakeServer {
  /**
   * Every request that arrived, so a test can assert on what was sent.
   *
   * `body` is the JSON the client posted, parsed - which is what an assertion
   * wants to compare against. It is undefined for a GET, and for a body that is
   * not JSON.
   */
  requests: { method: string; url: URL; body?: unknown }[];
}

function parseBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/** Installs a `fetch` that answers the routes given, and 404s everything else. */
export function fakeServer(routes: Route[]): FakeServer {
  const server: FakeServer = { requests: [] };

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://127.0.0.1');
      server.requests.push({
        method: init?.method ?? 'GET',
        url,
        ...(typeof init?.body === 'string' ? { body: parseBody(init.body) } : {}),
      });

      const route = routes.find((candidate) => candidate.match(url));
      if (!route) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: 'NotFound', message: `No route for ${url.pathname}` }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }

      const body = route.body(url, init);
      if (body instanceof Response) return Promise.resolve(body);

      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  return server;
}

export function path(pathname: string): (url: URL) => boolean {
  return (url) => url.pathname === pathname;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export function aProblem(overrides: Partial<ProblemSummary> = {}): ProblemSummary {
  return {
    id: 'pair-sum-index',
    slug: 'pair-sum-index',
    title: 'Pair Sum Index',
    topic: 'arrays',
    tier: 'Easy',
    rating: 2,
    order: 1,
    patterns: ['hash map', 'two pointers'],
    mode: 'function',
    status: 'not_started',
    statusByLanguage: {},
    attempts: 0,
    lastAttemptedAt: null,
    solvedAt: null,
    hasNote: false,
    ...overrides,
  };
}

export function aList(items: ProblemSummary[]): ProblemListResponse {
  return {
    items,
    matched: items.length,
    total: items.length,
    byStatus: { not_started: items.length, in_progress: 0, solved: 0, mastered: 0 },
    byTopic: [{ topic: 'arrays', total: items.length, solved: 0, mastered: 0, inProgress: 0 }],
  };
}

export function aProgressOverview(): ProgressResponse {
  return {
    rows: [],
    total: 3,
    byStatus: { not_started: 2, in_progress: 0, solved: 1, mastered: 0 },
    byTopic: [{ topic: 'arrays', total: 3, solved: 1, mastered: 0, inProgress: 0 }],
    byTier: [{ tier: 'Easy', total: 3, solved: 1, mastered: 0, inProgress: 0 }],
  };
}

export function someSettings(overrides: Partial<SettingsView> = {}): SettingsView {
  return {
    coach: {
      provider: 'anthropic',
      model: null,
      spendCapUsd: null,
      apiKeyMasked: null,
      apiKeySource: 'none',
    },
    editor: { fontSize: 14, tabSize: 4, vimKeybindings: false, wordWrap: false },
    judge: { timeoutMultiplier: 1, concurrency: 2 },
    theme: 'system',
    lastLanguage: 'python',
    ...overrides,
  };
}

export function aProblemDetail(overrides: Partial<ProblemDetail> = {}): ProblemDetail {
  return {
    summary: aProblem(),
    statement: '## Input\n\nA list of integers.',
    entry: 'pairSumIndex',
    expect: 'return',
    comparator: 'exact',
    version: 1,
    timeoutMs: { python: 4000, java: 2000 },
    samples: [{ args: [[4, 9], 13], expected: [0, 1] }],
    hiddenCount: 12,
    hints: ['Think about what you have already seen.'],
    revealedHints: 0,
    editorial: null,
    editorialUnlocked: false,
    references: null,
    starters: { python: 'class Solution:\n    pass\n', java: 'class Solution {}\n' },
    drafts: {},
    progress: [],
    submissionCount: 0,
    assets: [],
    note: null,
    related: [],
    ...overrides,
  };
}
