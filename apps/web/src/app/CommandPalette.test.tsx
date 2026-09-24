import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell.js';
import { PageHeader } from './PageHeader.js';
import {
  aList,
  aProblem,
  fakeServer,
  path,
  renderApp,
  aProgressOverview,
} from '../test/harness.js';

/**
 * The command palette (ROADMAP P7-7).
 *
 * Rendered inside the real shell rather than on its own: `Ctrl+K` goes through
 * the shortcut registry, and a test that called the component directly would
 * not be testing the thing that has to work from inside the editor.
 */

/**
 * Prints the current path, so navigation can be asserted without a router spy -
 * under a page header, which is where the search pill lives since P9-6.
 */
function Where() {
  const location = useLocation();
  return (
    <>
      <PageHeader title="Somewhere" />
      <span data-testid="where">{location.pathname + location.search}</span>
    </>
  );
}

const PROBLEMS = [
  aProblem({ slug: 'pair-sum-index', title: 'Pair Sum Index', topic: 'arrays' }),
  aProblem({ slug: 'clone-the-graph', title: 'Clone The Graph', topic: 'graph', tier: 'Medium' }),
];

function serve(next: unknown = { problem: PROBLEMS[1], reason: 'Because graph is weakest.' }) {
  return fakeServer([
    { match: path('/api/problems'), body: () => aList(PROBLEMS) },
    { match: path('/api/progress'), body: () => aProgressOverview() },
    { match: path('/api/next'), body: () => next },
  ]);
}

function open() {
  return renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Where />} />
        <Route path="/progress" element={<Where />} />
        <Route path="/problems/:slug" element={<Where />} />
      </Route>
    </Routes>,
  );
}

async function openPalette() {
  const user = userEvent.setup();
  await user.keyboard('{Control>}k{/Control}');
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the command palette', () => {
  it('opens on Ctrl+K from anywhere, with the field focused', async () => {
    serve();
    open();
    await openPalette();

    const field = await screen.findByRole('combobox', { name: 'Search problems and commands' });
    expect(field).toHaveFocus();
  });

  it('opens from the button, which says its own shortcut', async () => {
    serve();
    open();

    const button = screen.getByRole('button', { name: /Search/ });
    // One chip per key (P9-6), hidden from the button's name, which stays "Search".
    expect([...button.querySelectorAll('kbd')].map((key) => key.textContent)).toEqual([
      'Ctrl',
      'K',
    ]);

    await userEvent.setup().click(button);
    expect(await screen.findByRole('listbox', { name: 'Results' })).toBeInTheDocument();
  });

  it('filters problems by title, topic and slug', async () => {
    serve();
    open();
    const user = await openPalette();

    const field = await screen.findByRole('combobox', { name: 'Search problems and commands' });
    await user.type(field, 'graph');

    const results = within(screen.getByRole('listbox', { name: 'Results' }));
    expect(results.getByText('Clone The Graph')).toBeInTheDocument();
    expect(results.queryByText('Pair Sum Index')).not.toBeInTheDocument();
  });

  it('groups its rows under Commands and Problems, and drops a group with nothing in it', async () => {
    serve();
    open();
    const user = await openPalette();

    const results = within(await screen.findByRole('listbox', { name: 'Results' }));
    const commands = results.getByRole('group', { name: 'Commands' });
    const problems = results.getByRole('group', { name: 'Problems' });
    expect(within(commands).getByRole('option', { name: /Settings/ })).toBeInTheDocument();
    expect(
      await within(problems).findByRole('option', { name: /Pair Sum Index/ }),
    ).toBeInTheDocument();

    // No command says "graph", so only the problems are left - under their label.
    await user.type(screen.getByRole('combobox'), 'graph');
    expect(results.queryByRole('group', { name: 'Commands' })).not.toBeInTheDocument();
    expect(results.getByRole('group', { name: 'Problems' })).toBeInTheDocument();
  });

  it('opens the highlighted problem on Enter', async () => {
    serve();
    open();
    const user = await openPalette();

    const field = await screen.findByRole('combobox', { name: 'Search problems and commands' });
    await user.type(field, 'pair');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent('/problems/pair-sum-index');
    });
  });

  it('walks the list with the arrows, keeping focus in the field', async () => {
    serve();
    open();
    const user = await openPalette();

    const field = await screen.findByRole('combobox', { name: 'Search problems and commands' });
    expect(field).toHaveAttribute('aria-activedescendant', 'palette-row-0');

    await user.keyboard('{ArrowDown}');
    expect(field).toHaveAttribute('aria-activedescendant', 'palette-row-1');
    // The combo box pattern: the highlight moves, the focus does not.
    expect(field).toHaveFocus();

    await user.keyboard('{ArrowUp}{ArrowUp}');
    // Wraps rather than sticking at the top, so the last row is one key away.
    expect(field.getAttribute('aria-activedescendant')).not.toBe('palette-row-0');
  });

  it('goes to the recommended problem, which the server chooses', async () => {
    serve();
    open();
    const user = await openPalette();

    await user.click(await screen.findByText('Next recommended problem'));

    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent('/problems/clone-the-graph');
    });
  });

  it('stays open and says why when there is nothing to suggest', async () => {
    serve({ problem: null, reason: 'Every problem in the catalogue is solved.' });
    open();
    const user = await openPalette();

    await user.click(await screen.findByText('Random unsolved problem'));

    // Closing on an empty answer would look like a dead key.
    expect(await screen.findByText(/Every problem in the catalogue is solved/)).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Results' })).toBeInTheDocument();
  });

  it('says why when the server fails, rather than doing nothing (P4-15)', async () => {
    fakeServer([
      { match: path('/api/problems'), body: () => aList(PROBLEMS) },
      { match: path('/api/progress'), body: () => aProgressOverview() },
      {
        match: path('/api/next'),
        body: () =>
          new Response(JSON.stringify({ error: 'Internal', message: 'The server fell over.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      },
    ]);
    open();
    const user = await openPalette();

    await user.click(await screen.findByText('Random unsolved problem'));

    expect(await screen.findByText('The server fell over.')).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Results' })).toBeInTheDocument();
  });

  it('asks the server once, however fast Enter is pressed (P4-15)', async () => {
    let answer: (() => void) | undefined;
    const server = fakeServer([
      { match: path('/api/problems'), body: () => aList(PROBLEMS) },
      { match: path('/api/progress'), body: () => aProgressOverview() },
      {
        match: path('/api/next'),
        body: () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                answer = () => {
                  controller.enqueue(
                    new TextEncoder().encode(
                      JSON.stringify({ problem: PROBLEMS[1], reason: 'Because.' }),
                    ),
                  );
                  controller.close();
                };
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      },
    ]);
    open();
    const user = await openPalette();

    // The first row is "Next recommended problem"; Enter on it, twice.
    await screen.findByRole('combobox', { name: 'Search problems and commands' });
    await user.keyboard('{Enter}{Enter}');
    answer?.();

    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent('/problems/clone-the-graph');
    });
    expect(server.requests.filter((request) => request.url.pathname === '/api/next')).toHaveLength(
      1,
    );
  });

  it('filters the list down to bookmarks', async () => {
    serve();
    open();
    const user = await openPalette();

    await user.click(await screen.findByText('Bookmarked problems'));

    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent('/?bookmarked=true');
    });
  });

  it('says so rather than showing an empty list', async () => {
    serve();
    open();
    const user = await openPalette();

    const field = await screen.findByRole('combobox', { name: 'Search problems and commands' });
    await user.type(field, 'zzzznothing');

    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
    expect(field).not.toHaveAttribute('aria-activedescendant');
  });

  it('closes on Escape', async () => {
    serve();
    open();
    const user = await openPalette();

    await screen.findByRole('listbox', { name: 'Results' });
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: 'Results' })).not.toBeInTheDocument();
    });
  });
});
