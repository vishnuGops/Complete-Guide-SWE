import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  AboutResponse,
  ConnectionTestResponse,
  RuntimeReport,
  SettingsUpdate,
  SettingsView,
} from '@devpromax/shared';
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
/** A checkout's About (P10-2); an installed copy's is `bundled`. */
const CHECKOUT: AboutResponse = {
  version: '1.0.0',
  bundled: false,
  dataDir: 'C:\\dev\\devpromax\\data',
  logFile: null,
};

function settingsServer(
  initial: SettingsView = someSettings(),
  runtimeReport?: RuntimeReport,
  about: AboutResponse = CHECKOUT,
) {
  const state = { view: initial };
  const writes: SettingsUpdate[] = [];
  const runtimes: RuntimeReport = runtimeReport ?? {
    executor: 'local',
    checks: [
      {
        name: 'python',
        command: 'python',
        ok: true,
        version: '3.12',
        problem: null,
        guidance: null,
      },
      {
        name: 'java',
        command: 'java',
        ok: false,
        version: null,
        problem: 'it is not on your PATH.',
        guidance: 'Install a JDK 21 or newer.',
      },
      {
        name: 'javac',
        command: 'javac',
        ok: false,
        version: null,
        problem: 'it is not on your PATH.',
        guidance: 'Install a JDK 21 or newer.',
      },
    ],
    ok: false,
    checkedAt: '2026-09-18T09:00:00.000Z',
  };
  let connection: ConnectionTestResponse = {
    ok: false,
    provider: 'anthropic',
    model: null,
    message: 'That key was rejected.',
  };
  /** When set, every settings write is answered 400 with this message (P3-7). */
  let refusal: string | null = null;

  const server = fakeServer([
    {
      match: path('/api/settings'),
      body: (_url, init) => {
        if (init?.method !== 'PUT') return state.view;

        const patch = JSON.parse(String(init.body)) as SettingsUpdate;
        writes.push(patch);
        if (refusal !== null) {
          return new Response(JSON.stringify({ error: 'BadRequest', message: refusal }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

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
    {
      match: path('/api/settings/reset-progress'),
      body: () => ({
        cleared: {
          submissions: 3,
          progress: 2,
          drafts: 1,
          events: 9,
          coachSessions: 1,
          interviews: 1,
        },
      }),
    },
    {
      // The runtime check (P8-3). Answered from here rather than left to 404,
      // because the section fetches it only when asked and a test that presses
      // the button should see an answer rather than an error.
      match: path('/api/settings/doctor'),
      body: () => runtimes,
    },
    {
      match: path('/api/settings/about'),
      body: () => about,
    },
    {
      // The formatters (P9-5): black found, google-java-format not - until a
      // refresh, which is what someone who has just downloaded the jar does.
      match: path('/api/format'),
      body: (url) => ({
        formatters: [
          {
            language: 'python',
            name: 'black',
            available: true,
            version: '26.5.1',
            command: 'black',
            guidance: null,
          },
          url.searchParams.get('refresh') === '1'
            ? {
                language: 'java',
                name: 'google-java-format',
                available: true,
                version: '1.36.1',
                command: 'java -jar gjf.jar',
                guidance: null,
              }
            : {
                language: 'java',
                name: 'google-java-format',
                available: false,
                version: null,
                command: 'google-java-format',
                guidance: 'Download the jar and set DEVPROMAX_GOOGLE_JAVA_FORMAT.',
              },
        ],
      }),
    },
  ]);

  return {
    server,
    writes,
    setConnection: (next: ConnectionTestResponse) => {
      connection = next;
    },
    refuseWrites: (message: string | null) => {
      refusal = message;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Settings, coach section', () => {
  it('sends the chosen provider, and lets the old vendor model go with it', async () => {
    const { writes } = settingsServer(
      someSettings({ coach: { ...someSettings().coach, model: 'claude-sonnet-5' } }),
    );
    renderApp(<Settings />, { route: '/settings' });

    await userEvent.click(await screen.findByRole('button', { name: 'Gemini' }));

    // A Claude model name sent to Gemini is a failed first turn (P3-7); null
    // is the new provider's own default. Nothing else in the section moves.
    await waitFor(() => {
      expect(writes).toEqual([{ coach: { provider: 'gemini', model: null } }]);
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

  it('cannot test a connection with no key at all, and says why where it can be read', async () => {
    settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    expect(await screen.findByRole('button', { name: 'Test connection' })).toBeDisabled();
    // In the row, not in a tooltip on a button that takes no hover (P3-7).
    expect(screen.getByText(/^Add a key first\./)).toBeVisible();
  });

  it('says a stored key may belong to the provider it was switched from', async () => {
    settingsServer(
      someSettings({
        coach: { ...someSettings().coach, apiKeyMasked: '••••••••3f9a', apiKeySource: 'settings' },
      }),
    );
    renderApp(<Settings />, { route: '/settings' });

    await userEvent.click(await screen.findByRole('button', { name: 'Gemini' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      /Keys are per vendor, and the stored key may be for Anthropic rather than Gemini/,
    );
  });

  it('says nothing about vendors when there is no key to be wrong', async () => {
    settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    await userEvent.click(await screen.findByRole('button', { name: 'Gemini' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Gemini' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(screen.queryByText(/Keys are per vendor/)).not.toBeInTheDocument();
  });

  it('keeps a typed key, and says why, when the server refuses it', async () => {
    const { refuseWrites } = settingsServer();
    refuseWrites('The settings file is read-only.');
    renderApp(<Settings />, { route: '/settings' });

    const field = await screen.findByLabelText('API key');
    await userEvent.type(field, 'sk-ant-secret-value-3f9a');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Emptied only once the server has it (P3-7): a refused save used to throw
    // the paste away as well, and never said why.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That change was not saved: The settings file is read-only.',
    );
    expect(field).toHaveValue('sk-ant-secret-value-3f9a');
  });
});

describe('Settings, refused writes (P3-7)', () => {
  it('says so in the card the change was made in', async () => {
    const { refuseWrites } = settingsServer();
    refuseWrites('concurrency: Too big.');
    renderApp(<Settings />, { route: '/settings' });

    const concurrency = await screen.findByLabelText('Concurrent runs');
    await userEvent.clear(concurrency);
    await userEvent.type(concurrency, '4{Enter}');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('concurrency: Too big.');
    expect(screen.getByRole('region', { name: 'Judge' })).toContainElement(alert);
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

  it('will not send a fraction where the server wants a whole number', async () => {
    const { writes } = settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    // The schema says z.int(); 12.5 used to go out and come back a silent 400.
    const fontSize = await screen.findByLabelText('Editor font size');
    await userEvent.clear(fontSize);
    await userEvent.type(fontSize, '12.5');
    await userEvent.tab();

    expect(writes).toEqual([]);
    expect(fontSize).toHaveValue('14');
  });

  it('still takes a fraction where one is meant', async () => {
    const { writes } = settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    const multiplier = await screen.findByLabelText('Time limit multiplier');
    await userEvent.clear(multiplier);
    await userEvent.type(multiplier, '1.5{Enter}');

    await waitFor(() => {
      expect(writes).toEqual([{ judge: { timeoutMultiplier: 1.5 } }]);
    });
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

describe('the runtime check (P8-3)', () => {
  it('says nothing until it is asked, then names the problem and the fix', async () => {
    settingsServer();
    renderApp(<Settings />);

    // Not fetched with the rest of Settings: it spawns a JVM, and nobody
    // changing the font size should wait for that.
    expect(await screen.findByText(/Python and a JDK 21 or newer/)).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Check now' }));

    // Both `java` and `javac` are missing here, which is the usual shape of
    // "no JDK", so each message appears twice.
    expect(await screen.findAllByText('it is not on your PATH.')).toHaveLength(2);
    expect(screen.getAllByText('Install a JDK 21 or newer.')).toHaveLength(2);
    // The escape hatch, because "install a JDK" is not the answer for someone
    // who has three of them.
    expect(screen.getAllByText('DEVPROMAX_JAVA').length).toBeGreaterThan(0);
    expect(screen.getByText(/Runs and submissions will fail/)).toBeInTheDocument();
  });
});

describe('the runtime check in Docker mode (P9-2)', () => {
  it('names images rather than interpreters, and the variables that change them', async () => {
    settingsServer(someSettings(), {
      executor: 'docker',
      checks: [
        {
          name: 'docker',
          command: 'docker',
          ok: true,
          version: '29.8.0',
          problem: null,
          guidance: null,
        },
        {
          name: 'python',
          command: 'python:3.14-slim',
          ok: true,
          version: '3.14',
          problem: null,
          guidance: null,
        },
        {
          name: 'java',
          command: 'eclipse-temurin:21-jdk',
          ok: false,
          version: null,
          problem: 'The image eclipse-temurin:21-jdk is not on this machine.',
          guidance: 'Run: docker pull eclipse-temurin:21-jdk',
        },
      ],
      ok: false,
      checkedAt: '2026-09-22T09:00:00.000Z',
    });
    renderApp(<Settings />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Check now' }));

    expect(await screen.findByText(/runs your code in Docker containers/)).toBeInTheDocument();
    expect(screen.getByText('Java image')).toBeInTheDocument();
    expect(screen.getByText('Run: docker pull eclipse-temurin:21-jdk')).toBeInTheDocument();
    // The escape hatch in Docker mode is another image, not another JDK.
    expect(screen.getByText('DEVPROMAX_DOCKER_JAVA_IMAGE')).toBeInTheDocument();
    expect(screen.queryByText('DEVPROMAX_JAVA')).not.toBeInTheDocument();
  });
});

describe('formatting (P9-5)', () => {
  it('says which formatters were found, and how to get the one that was not', async () => {
    settingsServer();
    renderApp(<Settings />);

    expect(await screen.findByText('26.5.1')).toBeInTheDocument();
    expect(screen.getByText('not found')).toBeInTheDocument();
    expect(
      screen.getByText('Download the jar and set DEVPROMAX_GOOGLE_JAVA_FORMAT.'),
    ).toBeInTheDocument();
  });

  it('looks again when asked', async () => {
    const { server } = settingsServer();
    renderApp(<Settings />);
    await screen.findByText('not found');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Check again' }));

    expect(await screen.findByText('1.36.1')).toBeInTheDocument();
    expect(screen.queryByText('not found')).not.toBeInTheDocument();
    expect(server.requests.some((request) => request.url.searchParams.get('refresh') === '1')).toBe(
      true,
    );
  });

  it('turns format on save on, as an editor preference and nothing else', async () => {
    const { writes } = settingsServer();
    renderApp(<Settings />);

    await userEvent.setup().click(await screen.findByRole('checkbox', { name: 'Format on save' }));

    await waitFor(() => {
      expect(writes).toEqual([{ editor: { formatOnSave: true } }]);
    });
  });
});

describe('Settings, reset all progress', () => {
  it('says what it deletes and where a backup comes from, and keeps focus on the way back', async () => {
    settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    const user = userEvent.setup();
    const trigger = await screen.findByRole('button', { name: 'Reset…' });
    // Everything reset clears, the coach's conversations and interviews included (P4-17).
    expect(screen.getByText(/coach conversations and mock interviews/)).toBeInTheDocument();

    await user.click(trigger);
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('npm run db:backup');
    await user.click(screen.getByRole('button', { name: 'Delete everything' }));

    // The dialog hands focus back to its trigger, which was disabled while the
    // reset ran - so focus fell to the page instead (P4-17).
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    expect(await screen.findByText(/^Cleared 3 submissions/)).toBeInTheDocument();
  });
});

describe('an installed copy (P10-2)', () => {
  const INSTALLED: AboutResponse = {
    version: '1.2.0',
    bundled: true,
    dataDir: 'C:\\Users\\ada\\AppData\\Local\\DevProMax\\data',
    logFile: 'C:\\Users\\ada\\AppData\\Local\\DevProMax\\data\\logs\\devpromax.log',
  };

  it('says which version this is and where its data and log are', async () => {
    settingsServer(someSettings(), undefined, INSTALLED);
    renderApp(<Settings />, { route: '/settings' });

    expect(await screen.findByText('1.2.0')).toBeInTheDocument();
    expect(screen.getByText(INSTALLED.dataDir)).toBeInTheDocument();
    expect(screen.getByText(INSTALLED.logFile ?? '')).toBeInTheDocument();
    expect(screen.getByText(/Uninstalling asks before it deletes this/)).toBeInTheDocument();
  });

  it('shows a checkout no log file row and no uninstaller', async () => {
    settingsServer();
    renderApp(<Settings />, { route: '/settings' });

    expect(await screen.findByText(CHECKOUT.dataDir)).toBeInTheDocument();
    expect(screen.queryByText('Log file')).not.toBeInTheDocument();
    expect(screen.queryByText(/Uninstalling/)).not.toBeInTheDocument();
  });

  it('does not tell someone with no npm and no runtimes of their own to use either', async () => {
    settingsServer(someSettings(), undefined, INSTALLED);
    renderApp(<Settings />, { route: '/settings' });
    const user = userEvent.setup();

    // The runtimes are the installer's, and the launcher overrides the
    // variables a checkout would set to change them.
    expect(await screen.findByText(/DevProMax brings its own Python and JDK/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check now' }));
    expect(await screen.findAllByText('it is not on your PATH.')).toHaveLength(2);
    expect(screen.queryByText('DEVPROMAX_JAVA')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset…' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Back up DevProMax data in the Start menu');
    expect(dialog).not.toHaveTextContent('npm');
  });
});
