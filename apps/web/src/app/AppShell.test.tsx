import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { aProgressOverview, fakeServer, path, renderApp, someSettings } from '../test/harness.js';
import { AppShell } from './AppShell.js';
import { PageHeader } from './PageHeader.js';
import { ThemeToggle } from './ThemeToggle.js';
import { useAppTheme } from './useAppTheme.js';

/**
 * The app shell (ROADMAP P4-2; the rail and page headers of P9-6).
 *
 * Three things are true on every screen: where you are (the rail), how far
 * through the catalogue you are (each page's header), and which theme you are
 * in (applied by the shell, chosen in Settings).
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

/** Stands in for Settings > Appearance, where the theme control lives since P9-6. */
function ThemeSetting() {
  const { theme, setTheme } = useAppTheme();
  return <ThemeToggle value={theme} onChange={setTheme} />;
}

function open(route = '/') {
  return renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<PageHeader title="Problems" />} />
        <Route path="/problems/:slug" element={<p>a problem</p>} />
        <Route
          path="/settings"
          element={
            <>
              <PageHeader title="Settings" />
              <ThemeSetting />
            </>
          }
        />
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

  it('is a rail of four named places, Interview among them (P9-6)', () => {
    serve();
    open();

    const rail = screen.getByRole('navigation', { name: 'Main' });
    expect(
      within(rail)
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual(['Problems', 'Progress', 'Interview', 'Settings']);
  });

  it('keeps Problems current inside a problem (P9-6)', () => {
    serve();
    open('/problems/pair-sum-index');

    expect(screen.getByRole('link', { name: 'Problems' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('the page header', () => {
  it('opens the palette from its search pill (P9-6)', async () => {
    serve();
    open();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Search' }));
    expect(
      await screen.findByRole('combobox', { name: 'Search problems and commands' }),
    ).toBeInTheDocument();
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
    open('/settings');

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
    open('/settings');

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'System' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('shows the stored theme as the pressed one', async () => {
    serve(someSettings({ theme: 'light' }));
    open('/settings');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
