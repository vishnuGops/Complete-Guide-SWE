import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Welcome } from './Welcome.js';
import { fakeServer, path, renderApp, someSettings } from '../test/harness.js';

/**
 * The first-run welcome (ROADMAP P8-3).
 *
 * Three claims worth a test: it is not on screen for someone who has read it,
 * it is not on screen before Settings has arrived, and dismissing it writes to
 * the server rather than to the browser.
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

  it('is not there for someone who has read it', async () => {
    serve(true);
    renderApp(<Welcome />);

    // Waited on rather than asserted immediately, so this cannot pass merely
    // because Settings had not arrived yet.
    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Welcome' })).not.toBeInTheDocument();
    });
  });

  it('shows nothing at all until settings have arrived', () => {
    serve(false);
    renderApp(<Welcome />);

    // A welcome that flashes on every page load for the user who dismissed it
    // last week is worse than no welcome.
    expect(screen.queryByRole('complementary', { name: 'Welcome' })).not.toBeInTheDocument();
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
});
