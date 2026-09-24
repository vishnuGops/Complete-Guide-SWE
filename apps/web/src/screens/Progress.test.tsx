import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DashboardResponse } from '@devpromax/shared';
import { Progress } from './Progress.js';
import { localDay } from './relativeDay.js';
import { fakeServer, path, renderApp } from '../test/harness.js';

/**
 * The progress dashboard (ROADMAP P7-5).
 *
 * The streak calendar is deliberately not asserted square by square: it is
 * `aria-hidden` decoration for the sentence beside it, and a test that read it
 * would be testing a picture. The sentence is what is checked.
 */

function aDashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    total: 10,
    byStatus: { not_started: 6, in_progress: 1, solved: 2, mastered: 1 },
    byTopic: [{ topic: 'arrays', total: 4, solved: 2, mastered: 1, inProgress: 0 }],
    byTier: [{ tier: 'Easy', total: 4, solved: 2, mastered: 1, inProgress: 0 }],
    streak: { current: 3, longest: 9, days: [{ day: '2026-09-18', count: 4 }] },
    solves: [{ day: '2026-09-18', count: 1 }],
    recent: [],
    skills: [],
    editorialsRevealed: 0,
    reviews: { due: [], upcoming: [] },
    driftedSolves: 0,
    generatedAt: '2026-09-18T09:30:00.000Z',
    ...overrides,
  };
}

function serve(data: DashboardResponse = aDashboard()) {
  return fakeServer([{ match: path('/api/dashboard'), body: () => data }]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  const blobUrls = URL as unknown as Record<string, unknown>;
  delete blobUrls['createObjectURL'];
  delete blobUrls['revokeObjectURL'];
});

describe('the dashboard', () => {
  it('keeps its header when the dashboard fails, with a way to try again (P9-7)', async () => {
    // Nothing answers /api/dashboard, so the harness says 404.
    fakeServer([]);
    renderApp(<Progress />);

    expect(await screen.findByText('Your progress could not load.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('leads with how much is solved', async () => {
    serve();
    renderApp(<Progress />);

    expect(await screen.findByText(/3 of 10 problems solved/)).toBeInTheDocument();
  });

  it('says how long the streak is in words, not only in squares', async () => {
    serve();
    renderApp(<Progress />);

    const streak = await screen.findByRole('heading', { name: 'Streak' });
    expect(streak.parentElement?.textContent).toContain('3 day');
    expect(streak.parentElement?.textContent).toContain('Longest 9');
  });

  it('counts an opened editorial separately from a solve', async () => {
    serve(aDashboard({ editorialsRevealed: 2 }));
    renderApp(<Progress />);

    // Folding these into the solved count would make the headline a lie.
    expect(await screen.findByText(/2 editorials opened before solving/)).toBeInTheDocument();
  });

  it('counts drifted solves apart from the solved total (P7-9)', async () => {
    serve(aDashboard({ driftedSolves: 2 }));
    renderApp(<Progress />);

    // Apart from, not deducted from: the work was done, and what changed is
    // the bar it was measured against.
    expect(
      await screen.findByText(/2 solved against tests that have since changed/),
    ).toBeInTheDocument();
    expect(screen.getByText(/3 of 10 problems solved/)).toBeInTheDocument();
  });

  it('explains the empty skills table rather than showing an empty table', async () => {
    serve();
    renderApp(<Progress />);

    expect(await screen.findByText(/Nothing scored yet/)).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Reviews' })).not.toBeInTheDocument();
  });

  it('shows each topic score with how many reviews are behind it', async () => {
    serve(
      aDashboard({
        skills: [
          {
            topic: 'graph',
            samples: 2,
            scores: {
              correctness: 1.5,
              timeComplexity: 2,
              spaceComplexity: 2,
              edgeCases: 1,
              readability: 3,
            },
            average: 1.9,
          },
        ],
      }),
    );
    renderApp(<Progress />);

    const table = within(
      await screen.findByRole('table', { name: /Average coach rubric score per topic/ }),
    );
    expect(table.getByRole('rowheader', { name: 'Graph' })).toBeInTheDocument();
    // The count is not optional: an average over one review is an anecdote.
    expect(table.getByText('2')).toBeInTheDocument();
    expect(table.getByText('1.9')).toBeInTheDocument();
  });

  it('links recent activity back to the problem it was about', async () => {
    serve(
      aDashboard({
        recent: [
          {
            kind: 'submit',
            slug: 'pair-sum-index',
            title: 'Pair Sum Index',
            language: 'python',
            verdict: 'AC',
            at: '2026-09-18T09:00:00.000Z',
          },
        ],
      }),
    );
    renderApp(<Progress />);

    expect(await screen.findByText('Submitted')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pair Sum Index' })).toHaveAttribute(
      'href',
      '/problems/pair-sum-index',
    );
  });

  it('says so when the activity was about a problem that is gone', async () => {
    // The event log outlives the catalogue: a renamed or deleted problem leaves
    // its events behind, and a row with a blank where the title should be looks
    // like a bug rather than like history.
    serve(
      aDashboard({
        recent: [
          {
            kind: 'run',
            slug: 'removed-problem',
            title: null,
            language: 'java',
            verdict: null,
            at: '2026-09-18T09:00:00.000Z',
          },
        ],
      }),
    );
    renderApp(<Progress />);

    expect(await screen.findByText(/no longer here/)).toBeInTheDocument();
  });

  it('says there is nothing to make progress through when the catalogue is empty', async () => {
    serve(aDashboard({ total: 0, byTopic: [], byTier: [] }));
    renderApp(<Progress />);

    expect(await screen.findByText(/no problems to make progress through/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Streak' })).not.toBeInTheDocument();
  });

  it('lists what is due for review, and links into review mode (P7-8)', async () => {
    serve(
      aDashboard({
        reviews: {
          due: [
            {
              slug: 'pair-sum-index',
              title: 'Pair Sum Index',
              topic: 'arrays',
              tier: 'Easy',
              status: 'solved',
              lastPassedAt: '2026-09-01T09:00:00.000Z',
              passes: 2,
              dueAt: '2026-09-08T09:00:00.000Z',
              overdueDays: 10,
            },
          ],
          upcoming: [],
        },
      }),
    );
    renderApp(<Progress />);

    // `?review=1` is the point: a review you can look the answer up in is not
    // a review, and the link is what shuts the hints.
    expect(await screen.findByRole('link', { name: 'Pair Sum Index' })).toHaveAttribute(
      'href',
      '/problems/pair-sum-index?review=1',
    );
    expect(screen.getByText('10 days overdue')).toBeInTheDocument();
    expect(screen.getByText('2 passes')).toBeInTheDocument();
  });

  it('shows what is coming even when nothing is due yet (P7-8)', async () => {
    serve(
      aDashboard({
        reviews: {
          due: [],
          upcoming: [
            {
              slug: 'pair-sum-index',
              title: 'Pair Sum Index',
              topic: 'arrays',
              tier: 'Easy',
              status: 'solved',
              lastPassedAt: '2026-09-18T09:00:00.000Z',
              passes: 1,
              dueAt: '2026-09-21T09:00:00.000Z',
              overdueDays: -3,
            },
          ],
        },
      }),
    );
    renderApp(<Progress />);

    expect(await screen.findByText(/Nothing due/)).toBeInTheDocument();
    expect(screen.getByText('1 coming up')).toBeInTheDocument();
  });

  it('says nothing about reviews before anything has been solved (P7-8)', async () => {
    serve();
    renderApp(<Progress />);

    await screen.findByRole('heading', { name: 'Streak' });
    expect(screen.queryByRole('heading', { name: 'Review queue' })).not.toBeInTheDocument();
  });

  it('downloads the report in the format that was clicked', async () => {
    const server = serve();
    // jsdom implements neither of these. They are added to the real `URL`
    // rather than stubbed over it, because the fake server builds `new URL(...)`
    // on every request and a stand-in object is not a constructor.
    const blobUrls = URL as unknown as Record<string, unknown>;
    blobUrls['createObjectURL'] = vi.fn(() => 'blob:report');
    blobUrls['revokeObjectURL'] = vi.fn();

    renderApp(<Progress />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Markdown' }));

    await waitFor(() => {
      expect(
        server.requests.some((request) => request.url.pathname === '/api/dashboard/report'),
      ).toBe(true);
    });
    const asked = server.requests.find(
      (request) => request.url.pathname === '/api/dashboard/report',
    );
    expect(asked?.url.searchParams.get('format')).toBe('markdown');
    // The file counts the same days the screen showed (P7-11).
    expect(asked?.url.searchParams.get('tz')).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  it("asks for the dashboard in this browser's time zone (P7-11)", async () => {
    const server = serve(aDashboard());
    renderApp(<Progress />);

    await waitFor(() => {
      expect(server.requests.some((request) => request.url.pathname === '/api/dashboard')).toBe(
        true,
      );
    });
    const asked = server.requests.find((request) => request.url.pathname === '/api/dashboard');
    expect(asked?.url.searchParams.get('tz')).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});

describe('the dashboard layout (P9-6)', () => {
  it('leads with the solved count and what this week added', async () => {
    // The server sends the viewer's own days (P7-11), so today is the local date.
    const today = localDay();
    serve(aDashboard({ solves: [{ day: today, count: 2 }] }));
    renderApp(<Progress />);

    const solved = await screen.findByRole('region', { name: 'Solved' });
    expect(within(solved).getByText('+2 this week')).toBeInTheDocument();
    expect(within(solved).getByText('of 10 problems')).toBeInTheDocument();
  });

  it('says there is no week yet rather than a red zero', async () => {
    serve(aDashboard({ solves: [] }));
    renderApp(<Progress />);

    expect(await screen.findByText('none this week')).toBeInTheDocument();
  });

  it('gives the coach brief in words taken from the coach marks, and offers the next problem', async () => {
    fakeServer([
      {
        match: path('/api/dashboard'),
        body: () =>
          aDashboard({
            skills: [
              { topic: 'graph', samples: 2, scores: {}, average: 1.5 },
              { topic: 'hashmap', samples: 3, scores: {}, average: 3.5 },
            ],
          }),
      },
      {
        match: path('/api/next'),
        body: () => ({
          problem: {
            id: 'clone-the-graph',
            slug: 'clone-the-graph',
            title: 'Clone The Graph',
            topic: 'graph',
            tier: 'Medium',
            rating: 5,
            order: 0,
            patterns: [],
            mode: 'function',
            status: 'not_started',
            statusByLanguage: {},
            attempts: 0,
            lastAttemptedAt: null,
            solvedAt: null,
            hasNote: false,
            bookmarked: false,
            version: 1,
            solvedVersion: null,
          },
          reason: 'The easiest one left in Graph.',
        }),
      },
    ]);
    renderApp(<Progress />);

    const brief = await screen.findByRole('region', { name: 'Coach brief' });
    expect(
      within(brief).getByText('You are strongest in HashMap and weakest in Graph.'),
    ).toBeInTheDocument();
    expect(await within(brief).findByRole('link', { name: 'Open it' })).toHaveAttribute(
      'href',
      '/problems/clone-the-graph',
    );
  });
});
