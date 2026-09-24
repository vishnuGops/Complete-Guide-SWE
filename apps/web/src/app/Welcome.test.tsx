import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Welcome } from './Welcome.js';
import { fakeServer, path, renderApp, someSettings } from '../test/harness.js';

/**
 * The first-run welcome (ROADMAP P8-3).
 *
 * Three claims worth a test: it is not on screen for someone who has read it,
 * the first paint already knows whether it is there (so the page does not jump
 * when Settings arrives), and dismissing it writes to the server - the browser's
 * copy is only a mirror for that first paint.
 */

function serve(welcomeDismissed: boolean) {
  let dismissed = welcomeDismissed;
  return fakeServer([
    {
      match: path('/api/settings'),
      body: (_url, init) => {
        if (init?.method === 'PUT') {
          const patch = JSON.parse(String(init.body ?? '{}')) as { welcomeDismissed?: boolean };
          if (patch.welcomeDismissed !== undefined) dismissed = patch.welcomeDismissed;
        }
        return someSettings({ welcomeDismissed: dismissed });
      },
    },
  ]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('the welcome', () => {
  it('explains Run, Submit and AI Help, with their shortcuts', async () => {
    serve(false);
    renderApp(<Welcome />);

    const panel = await screen.findByRole('complementary', { name: 'Welcome' });
    expect(panel).toHaveTextContent('Run');
    expect(panel).toHaveTextContent('Ctrl+Enter');
    expect(panel).toHaveTextContent('Ctrl+Shift+Enter');
    // The one thing about AI Help someone has to know before pressing it.
    expect(panel).toHaveTextContent(/your own API key/);
    expect(panel).toHaveTextContent(/never called on its own/);
  });

  it('does not claim a Run records nothing', async () => {
    // A first Run marks the problem In progress (D11); the welcome said
    // otherwise until P4-17.
    serve(false);
    renderApp(<Welcome />);

    const panel = await screen.findByRole('complementary', { name: 'Welcome' });
    expect(panel).not.toHaveTextContent(/records nothing/);
    expect(panel).toHaveTextContent(/marks the problem In progress/);
  });

  it('is not there for someone who has read it', async () => {
    serve(true);
    renderApp(<Welcome />);

    // Waited on rather than asserted immediately, so this cannot pass merely
    // because Settings had not arrived yet.
    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Welcome' })).not.toBeInTheDocument();
    });
  });

  it('is there from the first paint for someone new, so nothing moves when settings arrive', () => {
    serve(false);
    renderApp(<Welcome />);

    // Synchronously, before the settings fetch has answered: a card inserted
    // later pushes the whole page down (the workspace's Lighthouse score).
    expect(screen.getByRole('complementary', { name: 'Welcome' })).toBeInTheDocument();
  });

  it('is absent from the first paint for someone this browser saw dismiss it', () => {
    localStorage.setItem('devpromax.welcomeDismissed', '1');
    serve(true);
    renderApp(<Welcome />);

    // A welcome that flashes on every page load for the user who dismissed it
    // last week is worse than no welcome.
    expect(screen.queryByRole('complementary', { name: 'Welcome' })).not.toBeInTheDocument();
  });

  it('remembers a dismissal the server reports, for the next first paint', async () => {
    serve(true);
    renderApp(<Welcome />);

    await waitFor(() => {
      expect(localStorage.getItem('devpromax.welcomeDismissed')).toBe('1');
    });
  });

  it('dismisses itself for good, on the server', async () => {
    const server = serve(false);
    renderApp(<Welcome />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Got it' }));

    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Welcome' })).not.toBeInTheDocument();
    });
    const written = server.requests.filter((request) => request.method === 'PUT');
    expect(written).toHaveLength(1);
    expect(written[0]?.body).toEqual({ welcomeDismissed: true });
  });

  it('hands focus to the page heading as it goes, rather than to nothing', async () => {
    serve(false);
    renderApp(
      <main>
        <Welcome />
        <h1>Problems</h1>
      </main>,
    );

    // The button that had focus leaves with the card (P4-17).
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Got it' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Problems' })).toHaveFocus();
    });
  });
});
