import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ConnectionTestResponse, SettingsUpdate, SettingsView } from '@devpromax/shared';
import { Settings } from './Settings.js';
import { fakeServer, path, renderApp, someSettings } from '../../test/harness.js';

/**
 * Settings, and the coach's corner of it (ROADMAP P5-8).
 *
 * The test this file exists for is the last one: after saving a key, nothing on
 * screen is the key. Everything else here is a cheap check that a write leaves
 * as the right patch, because the server merges patches and a field that sends
 * `{ coach: { model } }` when it meant `{ coach: { apiKey } }` would quietly
 * overwrite the wrong setting.
 */

/** A fake `PUT /api/settings` that merges like the real one, so the view updates. */
function settingsServer(initial: SettingsView = someSettings()) {
  const state = { view: initial };
  const writes: SettingsUpdate[] = [];
  let connection: ConnectionTestResponse = {
    ok: false,
    provider: 'anthropic',
    model: null,
    message: 'That key was rejected.',
  };

  const server = fakeServer([
    {
      match: path('/api/settings'),
      body: (_url, init) => {
        if (init?.method !== 'PUT') return state.view;

        const patch = JSON.parse(String(init.body)) as SettingsUpdate;
        writes.push(patch);

        const coach = { ...state.view.coach };
        if (patch.coach?.provider !== undefined) coach.provider = patch.coach.provider;
        if (patch.coach && 'model' in patch.coach) coach.model = patch.coach.model ?? null;
        if (patch.coach && 'spendCapUsd' in patch.coach)
          coach.spendCapUsd = patch.coach.spendCapUsd ?? null;
        if (patch.coach && 'apiKey' in patch.coach) {
          // What the server does: mask it, and never send it back (P3-4).
          const key = patch.coach.apiKey?.trim() ?? '';
          coach.apiKeyMasked = key === '' ? null : `${'•'.repeat(8)}${key.slice(-4)}`;
          coach.apiKeySource = key === '' ? 'none' : 'settings';
        }
        state.view = { ...state.view, coach };
        return state.view;
      },
    },
    {
      match: path('/api/settings/test-connection'),
      body: () => connection,
    },
  ]);

  return {
    server,
    writes,
    setConnection: (next: ConnectionTestResponse) => {
      connection = next;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Settings, coach section', () => {
  it('sends the chosen provider and nothing else', async () => {
    const { writes } = settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    await userEvent.click(await screen.findByRole('button', { name: 'Gemini' }));

    await waitFor(() => {
      expect(writes).toEqual([{ coach: { provider: 'gemini' } }]);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Gemini' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  it('shows the provider default as the model placeholder and commits on blur', async () => {
    const { writes } = settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    const model = await screen.findByLabelText('Coach model');
    expect(model).toHaveAttribute('placeholder', 'claude-opus-5');

    await userEvent.type(model, 'claude-sonnet-5');
    // Still nothing sent: a model is typed, and one PUT per keystroke is not a
    // thing this screen does.
    expect(writes).toEqual([]);

    await userEvent.tab();
    await waitFor(() => {
      expect(writes).toEqual([{ coach: { model: 'claude-sonnet-5' } }]);
    });
  });

  it('treats an emptied spend cap as no cap', async () => {
    const { writes } = settingsServer(
      someSettings({ coach: { ...someSettings().coach, spendCapUsd: 2 } }),
    );
    renderApp(<Settings />, { route: '/settings' });

    const cap = await screen.findByLabelText('Spend cap in US dollars');
    expect(cap).toHaveValue('2');

    await userEvent.clear(cap);
    await userEvent.tab();

    await waitFor(() => {
      expect(writes).toEqual([{ coach: { spendCapUsd: null } }]);
    });
  });

  it('never shows the key that was typed', async () => {
    const { writes } = settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    const field = await screen.findByLabelText('API key');
    expect(screen.getByTestId('api-key-status')).toHaveTextContent('No key configured.');

    await userEvent.type(field, 'sk-ant-secret-value-3f9a');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(writes).toEqual([{ coach: { apiKey: 'sk-ant-secret-value-3f9a' } }]);
    });

    // The three things that must hold afterwards: the field is empty, the status
    // is a mask, and the typed value is nowhere in the rendered document.
    await waitFor(() => {
      expect(screen.getByTestId('api-key-status')).toHaveTextContent('••••••••3f9a');
    });
    expect(field).toHaveValue('');
    expect(document.body.textContent).not.toContain('sk-ant-secret-value-3f9a');
    expect(screen.getByTestId('api-key-status')).not.toHaveTextContent('secret');
  });

  it('offers Clear key only for a stored key, and clears with an empty string', async () => {
    const { writes } = settingsServer(
      someSettings({
        coach: {
          ...someSettings().coach,
          apiKeyMasked: '••••••••3f9a',
          apiKeySource: 'settings',
        },
      }),
    );
    renderApp(<Settings />, { route: '/settings' });

    await userEvent.click(await screen.findByRole('button', { name: 'Clear key' }));

    await waitFor(() => {
      expect(writes).toEqual([{ coach: { apiKey: '' } }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Clear key' })).not.toBeInTheDocument();
    });
  });

  it('says where an environment key came from, and does not offer to clear it', async () => {
    settingsServer(
      someSettings({
        coach: { ...someSettings().coach, apiKeyMasked: '••••••••3f9a', apiKeySource: 'env' },
      }),
    );
    renderApp(<Settings />, { route: '/settings' });

    expect(await screen.findByTestId('api-key-status')).toHaveTextContent(
      'from the COACH_API_KEY environment variable',
    );
    expect(screen.queryByRole('button', { name: 'Clear key' })).not.toBeInTheDocument();
  });

  it('reports a failed connection test honestly', async () => {
    const { setConnection } = settingsServer(
      someSettings({
        coach: {
          ...someSettings().coach,
          apiKeyMasked: '••••••••beef',
          apiKeySource: 'settings',
        },
      }),
    );
    setConnection({
      ok: false,
      provider: 'anthropic',
      model: 'claude-opus-5',
      message: 'The key was rejected (401).',
    });

    renderApp(<Settings />, { route: '/settings' });

    await userEvent.click(await screen.findByRole('button', { name: 'Test connection' }));

    expect(await screen.findByText(/The key was rejected \(401\)\./)).toBeInTheDocument();
  });

  it('cannot test a connection with no key at all', async () => {
    settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    expect(await screen.findByRole('button', { name: 'Test connection' })).toBeDisabled();
  });
});

/**
 * Number fields (ROADMAP P4-13).
 *
 * The version these replace wrote straight into a controlled input and only
 * accepted in-range values, so typing "1" on the way to "12" snapped back -
 * 1 being below the minimum - and every accepted keystroke was its own PUT.
 */
describe('Settings, number fields', () => {
  it('lets a number be typed through an out-of-range prefix', async () => {
    const { writes } = settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    const fontSize = await screen.findByLabelText('Editor font size');
    await userEvent.clear(fontSize);
    // "1" is below the minimum of 10; the old field refused it and put 14 back.
    await userEvent.type(fontSize, '1');
    expect(fontSize).toHaveValue('1');
    await userEvent.type(fontSize, '2');
    expect(fontSize).toHaveValue('12');

    // And nothing was written on the way: one field, one PUT, on commit.
    expect(writes).toEqual([]);
    await userEvent.tab();
    await waitFor(() => {
      expect(writes).toEqual([{ editor: { fontSize: 12 } }]);
    });
  });

  it('puts the stored value back when what was typed cannot be saved', async () => {
    const { writes } = settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    const tabSize = await screen.findByLabelText('Editor tab size');
    await userEvent.clear(tabSize);
    await userEvent.type(tabSize, '99');
    await userEvent.tab();

    // 99 is outside 2..8, so it is not sent and the field stops lying about it.
    expect(writes).toEqual([]);
    expect(tabSize).toHaveValue('4');
  });

  it('commits on Enter as well as on blur', async () => {
    const { writes } = settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    const concurrency = await screen.findByLabelText('Concurrent runs');
    await userEvent.clear(concurrency);
    await userEvent.type(concurrency, '4{Enter}');

    await waitFor(() => {
      expect(writes).toEqual([{ judge: { concurrency: 4 } }]);
    });
  });
});
