import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import type { ProblemListResponse } from '@devpromax/shared';
import { aList, aProblem, fakeServer, path, renderApp } from '../../test/harness.js';
import { ProblemList } from './ProblemList.js';

/**
 * The list and its filters (ROADMAP P4-4, P4-5).
 *
 * Driven through a fake `fetch` rather than a stubbed hook, because half of what
 * these tests are checking *is* the request: a filter that renders a ticked box
 * and sends no `topic` parameter looks perfect and shows the wrong rows.
 */

const PROBLEMS = [
  aProblem({ slug: 'pair-sum-index', title: 'Pair Sum Index', rating: 2 }),
  aProblem({
    id: 'min-value-stack',
    slug: 'min-value-stack',
    title: 'Min Value Stack',
    topic: 'stack',
    tier: 'Medium',
    rating: 5,
    status: 'solved',
    solvedAt: '2026-09-16T10:00:00.000Z',
    lastAttemptedAt: '2026-09-16T10:00:00.000Z',
  }),
];

function serve(response: ProblemListResponse = aList(PROBLEMS)) {
  return fakeServer([{ match: path('/api/problems'), body: () => response }]);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the table', () => {
  it('shows a row per problem with its topic, tier and rating', async () => {
    serve();
    renderApp(<ProblemList />);

    const row = await screen.findByRole('row', { name: /Pair Sum Index/ });
    expect(within(row).getByRole('link', { name: 'Pair Sum Index' })).toHaveAttribute(
      'href',
      '/problems/pair-sum-index',
    );
    expect(row).toHaveTextContent('Arrays');
    expect(row).toHaveTextContent('Easy');
  });

  it('names a status that is not "not started", and leaves the rest quiet', async () => {
    serve();
    renderApp(<ProblemList />);

    const solved = await screen.findByRole('row', { name: /Min Value Stack/ });
    expect(solved).toHaveTextContent('Solved');

    // Two hundred rows printing "Not started" down the left edge is noise, so
    // that one word is visually hidden - and only that one. It stays in the
    // accessible name, because the shape on its own is not a status.
    const unstarted = screen.getByRole('row', { name: /Pair Sum Index/ });
    expect(within(unstarted).getByText('Not started')).toHaveClass('sr-only');
    expect(within(solved).getByText('Solved')).not.toHaveClass('sr-only');
  });

  it('marks a row whose tests changed after it was solved (P7-9)', async () => {
    serve(
      aList([
        aProblem({
          slug: 'pair-sum-index',
          title: 'Pair Sum Index',
          status: 'solved',
          version: 3,
          solvedVersion: 1,
        }),
      ]),
    );
    renderApp(<ProblemList />);

    const row = await screen.findByRole('row', { name: /Pair Sum Index/ });
    // The list is where someone decides what to work on, so a Solved earned
    // against tests that no longer exist is worth saying before they skip past.
    expect(within(row).getByText('tests changed')).toBeInTheDocument();
    expect(row).toHaveTextContent('Solved against version 1');
  });

  it('marks a row with a note (P7-4)', async () => {
    serve(aList([aProblem({ slug: 'pair-sum-index', title: 'Pair Sum Index', hasNote: true })]));
    renderApp(<ProblemList />);

    const row = await screen.findByRole('row', { name: /Pair Sum Index/ });
    expect(within(row).getByText('Has a note')).toBeInTheDocument();
  });

  it('says how many rows are on screen out of the catalogue', async () => {
    // Not the solved count: the top bar carries that on every screen already, and
    // printing it twice on one page makes both copies read like they might mean
    // different things.
    serve({ ...aList(PROBLEMS), matched: 2, total: 20 });
    renderApp(<ProblemList />, { route: '/?tier=Easy' });

    expect(await screen.findByTestId('list-counts')).toHaveTextContent('2 of 20 problems');
  });
});

describe('sorting', () => {
  it('asks the server for the column and reverses it on a second click', async () => {
    const server = serve();
    renderApp(<ProblemList />);
    await screen.findByRole('row', { name: /Pair Sum Index/ });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Rating/ }));
    await waitFor(() => {
      expect(server.requests.at(-1)?.url.searchParams.get('sort')).toBe('rating');
    });
    expect(server.requests.at(-1)?.url.searchParams.get('dir')).toBeNull();

    await user.click(screen.getByRole('button', { name: /^Rating/ }));
    await waitFor(() => {
      expect(server.requests.at(-1)?.url.searchParams.get('dir')).toBe('desc');
    });
  });

  it('marks the sorted column for screen readers', async () => {
    serve();
    renderApp(<ProblemList />);
    await screen.findByRole('row', { name: /Pair Sum Index/ });

    await userEvent.setup().click(screen.getByRole('button', { name: /^Tier/ }));
    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /Tier/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
    });
  });
});

describe('filters', () => {
  it('sends the ticked topic and shows it in the URL', async () => {
    const server = serve();
    renderApp(<ProblemList />);
    await screen.findByRole('row', { name: /Pair Sum Index/ });

    await userEvent.setup().click(screen.getByRole('checkbox', { name: /Arrays/ }));

    await waitFor(() => {
      expect(server.requests.at(-1)?.url.searchParams.getAll('topic')).toEqual(['arrays']);
    });
  });

  it('starts from the filters already in the URL', async () => {
    const server = serve();
    renderApp(<ProblemList />, { route: '/?tier=Hard&status=solved' });

    await waitFor(() => {
      // By path, not by position: the page header's solved counter asks
      // /api/progress first (P9-6).
      const list = server.requests.find((request) => request.url.pathname === '/api/problems');
      expect(list?.url.searchParams.getAll('tier')).toEqual(['Hard']);
    });
    expect(screen.getByRole('checkbox', { name: /Hard/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Solved' })).toBeChecked();
  });

  it('switches between All, Due and Starred as one filter (P9-6)', async () => {
    const server = serve({ ...aList(PROBLEMS), due: 2 });
    renderApp(<ProblemList />);
    await screen.findByRole('row', { name: /Pair Sum Index/ });
    const user = userEvent.setup();

    expect(await screen.findByText(/problems · 2 due for review/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Due' }));
    await waitFor(() => {
      expect(server.requests.at(-1)?.url.searchParams.get('due')).toBe('true');
    });

    // Exclusive: Starred replaces Due rather than adding to it.
    await user.click(screen.getByRole('button', { name: 'Starred' }));
    await waitFor(() => {
      const last = server.requests.at(-1)?.url.searchParams;
      expect(last?.get('bookmarked')).toBe('true');
      expect(last?.get('due')).toBeNull();
    });
  });

  it('narrows progress to one language when asked', async () => {
    const server = serve();
    renderApp(<ProblemList />);
    await screen.findByRole('row', { name: /Pair Sum Index/ });

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Java' }));
    await waitFor(() => {
      expect(server.requests.at(-1)?.url.searchParams.get('language')).toBe('java');
    });
  });

  it('clears every filter but keeps the sort', async () => {
    const server = serve();
    renderApp(<ProblemList />, { route: '/?tier=Hard&sort=rating&dir=desc' });
    await screen.findByRole('row', { name: /Pair Sum Index/ });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear all' }));

    await waitFor(() => {
      expect(server.requests.at(-1)?.url.searchParams.getAll('tier')).toEqual([]);
    });
    expect(server.requests.at(-1)?.url.searchParams.get('sort')).toBe('rating');
  });

  it('searches after the typing stops, not on every keystroke', async () => {
    const server = serve();
    renderApp(<ProblemList />);
    await screen.findByRole('row', { name: /Pair Sum Index/ });
    const before = server.requests.length;

    await userEvent
      .setup()
      .type(screen.getByRole('searchbox', { name: 'Search problems' }), 'stack');

    await waitFor(() => {
      expect(server.requests.at(-1)?.url.searchParams.get('q')).toBe('stack');
    });
    // Five characters must not be five requests.
    expect(server.requests.length - before).toBeLessThan(5);
  });
});

describe('per-topic progress (P4-8)', () => {
  it('draws a bar in proportion to how much of the topic is solved', async () => {
    serve({
      ...aList(PROBLEMS),
      byTopic: [
        { topic: 'arrays', total: 4, solved: 1, mastered: 0, inProgress: 1 },
        { topic: 'stack', total: 2, solved: 2, mastered: 1, inProgress: 0 },
      ],
    });
    renderApp(<ProblemList />);

    // The number is the answer and the bar is its shape, so both are checked:
    // a bar that disagreed with the count beside it would be worse than none.
    // The name is the spelled-out one, not "Arrays1/4" (P4-10).
    expect(
      await screen.findByRole('checkbox', { name: 'Arrays, 1 of 4 solved' }),
    ).toBeInTheDocument();

    const bars = screen.getAllByTestId('topic-progress');
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveStyle({ width: '25%' });
    expect(bars[1]).toHaveStyle({ width: '100%' });
  });

  it('draws nothing for a topic with no problems in it', async () => {
    // Thirteen of the fourteen topics are empty until P6 fills them, and a
    // zero-width bar under each is thirteen rules for no information - and a
    // division by zero on the way there.
    serve({
      ...aList(PROBLEMS),
      byTopic: [{ topic: 'arrays', total: 0, solved: 0, mastered: 0, inProgress: 0 }],
    });
    renderApp(<ProblemList />);

    await screen.findByRole('row', { name: /Pair Sum Index/ });
    expect(screen.queryByTestId('topic-progress')).not.toBeInTheDocument();
  });
});

describe('the error state (P4-10)', () => {
  it('says what failed and recovers when the retry works', async () => {
    // The first request fails, the second succeeds - which is what a restarted
    // dev server looks like from the browser, and the reason the retry exists.
    let attempts = 0;
    fakeServer([
      {
        match: path('/api/problems'),
        body: () => {
          attempts += 1;
          if (attempts === 1) throw new Error('unreachable');
          return aList(PROBLEMS);
        },
      },
    ]);
    renderApp(<ProblemList />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The problem list could not load.');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('row', { name: /Pair Sum Index/ })).toBeInTheDocument();
  });
});

describe('empty states', () => {
  it('explains an empty filtered list and offers a way out', async () => {
    serve({ ...aList([]), total: 20, matched: 0 });
    renderApp(<ProblemList />, { route: '/?tier=Hard' });

    expect(await screen.findByText('No problem matches these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });

  it('says something different when the catalogue itself is empty', async () => {
    serve(aList([]));
    renderApp(<ProblemList />);

    expect(await screen.findByText(/The catalogue is empty/)).toBeInTheDocument();
  });
});

/**
 * The search box and the URL (ROADMAP P4-13).
 *
 * The box was seeded once, at mount, so Back and Forward through `?q=` moved
 * the list and left the text sitting there - the filter and the box saying two
 * different things.
 */
describe('the search box follows the URL', () => {
  it('shows the query the URL arrived with', async () => {
    serve();
    renderApp(<ProblemList />, { route: '/?q=window' });

    expect(await screen.findByRole('searchbox', { name: /search/i })).toHaveValue('window');
  });

  it('re-seeds when the URL changes under it', async () => {
    serve();
    const user = userEvent.setup();
    renderApp(
      <>
        <BackAndForward />
        <ProblemList />
      </>,
      { route: '/?q=window' },
    );

    const box = await screen.findByRole('searchbox', { name: /search/i });
    expect(box).toHaveValue('window');

    // A second entry in the history, then back to the first.
    await user.click(screen.getByRole('button', { name: 'go to prefix' }));
    await waitFor(() => {
      expect(box).toHaveValue('prefix');
    });

    await user.click(screen.getByRole('button', { name: 'go back' }));
    await waitFor(() => {
      expect(box).toHaveValue('window');
    });
  });
});

/** Two buttons that move the URL, for the test above. */
function BackAndForward() {
  const navigate = useNavigate();
  return (
    <>
      <button
        onClick={() => {
          void navigate('/?q=prefix');
        }}
      >
        go to prefix
      </button>
      <button
        onClick={() => {
          void navigate(-1);
        }}
      >
        go back
      </button>
    </>
  );
}
