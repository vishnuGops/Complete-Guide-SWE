import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { aProgressOverview, fakeServer, path, renderApp, someSettings } from '../test/harness.js';
import { AppShell } from './AppShell.js';

/**
 * The app shell (ROADMAP P4-2).
 *
 * Three things are true on every screen, and this is where they are true: where
 * you are, how far through the catalogue you are, and which theme you are in.
 * The theme assertions check the `data-theme` attribute rather than a colour,
 * because that attribute is the whole mechanism (`styles/tokens.css`) and the
 * colours are measured by `contrast.test.ts` instead.
 */

function serve(settings = someSettings()) {
  return fakeServer([
    { match: path('/api/progress'), body: () => aProgressOverview() },
    {
      match: path('/api/settings'),
      body: (_url, init) =>
        init?.method === 'PUT'
          ? { ...settings, ...(JSON.parse(String(init.body)) as object) }
          : settings,
    },
  ]);
}

function open(route = '/') {
  return renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<p>the list</p>} />
        <Route path="/settings" element={<p>the settings</p>} />
      </Route>
    </Routes>,
    { route },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
});

describe('navigation', () => {
  it('marks the screen you are on', () => {
    serve();
    open('/settings');

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Problems' })).not.toHaveAttribute('aria-current');
  });
});

describe('global progress', () => {
  it('counts the whole catalogue, not the filtered list', async () => {
    serve();
    open();

    // `/api/progress` is the unfiltered source; the list endpoint is not even
    // called here, which is the point.
    expect(await screen.findByText('Solved 1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Problems solved' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
  });
});

describe('the theme toggle', () => {
  it('applies the choice to the document and saves it', async () => {
    const server = serve();
    open();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Dark' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await waitFor(() => {
      expect(
        server.requests.some(
          (request) => request.method === 'PUT' && request.url.pathname === '/api/settings',
        ),
      ).toBe(true);
    });
  });

  it('removes the attribute for System, so the OS keeps deciding', async () => {
    serve(someSettings({ theme: 'dark' }));
    open();

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'System' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('shows the stored theme as the pressed one', async () => {
    serve(someSettings({ theme: 'light' }));
    open();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
