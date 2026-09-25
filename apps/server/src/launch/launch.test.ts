import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { launchEnv, logFileFor } from './env.js';
import { bundledRuntimes, findLayout, installedDataDir, type Layout } from './layout.js';
import { openerCommand } from './open.js';
import { choosePort, probePort, readRememberedPort, rememberPort, type PortState } from './port.js';

/**
 * The launcher's decisions (ROADMAP P10-3), each on its own. Starting a real
 * server twice is `launch.integration.test.ts`.
 */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-launch-'));
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('the environment', () => {
  const installed: Layout = {
    mode: 'installed',
    root: 'C:\\Program Files\\DevProMax',
    runtimes: bundledRuntimes('C:\\Program Files\\DevProMax', 'win32'),
  };
  /** The home server's shell, and then some. */
  const polluted: NodeJS.ProcessEnv = {
    PATH: 'C:\\Windows',
    COACH_API_KEY: 'sk-kept',
    DEVPROMAX_PYTHON: 'C:\\Users\\me\\AppData\\Roaming\\uv\\python\\python.exe',
    DEVPROMAX_JAVA: 'C:\\jdk-17\\bin\\java.exe',
    DEVPROMAX_JAVAC: 'C:\\jdk-17\\bin\\javac.exe',
    DEVPROMAX_DATA: 'D:\\sync\\devpromax',
    DEVPROMAX_DB: 'D:\\other.db',
    DEVPROMAX_EXECUTOR: 'docker',
    DEVPROMAX_PORT: '9999',
    DEVPROMAX_LOG_FILE: 'D:\\elsewhere.log',
    NODE_OPTIONS: '--require C:\\hook.js',
    NODE_ENV: 'development',
  };
  const settings = { dataDir: 'C:\\Users\\me\\AppData\\Local\\DevProMax\\data', port: 5174 };

  it('overrides everything an installed copy owns, whatever the user set', () => {
    const env = launchEnv(polluted, installed, settings);

    expect(env['DEVPROMAX_PYTHON']).toBe(
      'C:\\Program Files\\DevProMax\\runtime\\python\\python.exe',
    );
    expect(env['DEVPROMAX_JAVA']).toBe('C:\\Program Files\\DevProMax\\runtime\\jdk\\bin\\java.exe');
    expect(env['DEVPROMAX_JAVAC']).toBe(
      'C:\\Program Files\\DevProMax\\runtime\\jdk\\bin\\javac.exe',
    );
    expect(env['DEVPROMAX_DATA']).toBe(settings.dataDir);
    expect(env['DEVPROMAX_PORT']).toBe('5174');
    expect(env['DEVPROMAX_LOG_FILE']).toBe(logFileFor(settings.dataDir));
    expect(env['DEVPROMAX_BUNDLED']).toBe('1');
    expect(env['NODE_ENV']).toBe('production');
    for (const gone of ['DEVPROMAX_DB', 'DEVPROMAX_EXECUTOR', 'NODE_OPTIONS']) {
      expect(env).not.toHaveProperty(gone);
    }
  });

  it('keeps what is the user’s own business', () => {
    const env = launchEnv(polluted, installed, settings);
    expect(env['PATH']).toBe('C:\\Windows');
    expect(env['COACH_API_KEY']).toBe('sk-kept');
  });

  it('leaves a checkout on the machine’s runtimes, and never calls it installed', () => {
    const env = launchEnv(
      { ...polluted, DEVPROMAX_BUNDLED: '1' },
      { mode: 'checkout', root: 'C:\\dev\\devpromax' },
      settings,
    );

    expect(env['DEVPROMAX_PYTHON']).toBe(polluted['DEVPROMAX_PYTHON']);
    expect(env['DEVPROMAX_EXECUTOR']).toBe('docker');
    expect(env).not.toHaveProperty('DEVPROMAX_BUNDLED');
    expect(env['NODE_ENV']).toBe('production');
    expect(env['DEVPROMAX_DATA']).toBe(settings.dataDir);
  });

  it('does not touch the environment it was given', () => {
    const before = { ...polluted };
    launchEnv(polluted, installed, settings);
    expect(polluted).toEqual(before);
  });
});

describe('the layout', () => {
  it('is installed exactly when runtime/ is there', () => {
    const checkout = path.join(tmp, 'checkout');
    const install = path.join(tmp, 'install');
    fs.mkdirSync(checkout);
    fs.mkdirSync(path.join(install, 'runtime'), { recursive: true });

    expect(findLayout(checkout).mode).toBe('checkout');
    expect(findLayout(install).mode).toBe('installed');
  });

  it('names each platform’s runtimes where their archives put them', () => {
    expect(bundledRuntimes('/opt/devpromax', 'linux')).toEqual({
      python: '/opt/devpromax/runtime/python/bin/python3',
      java: '/opt/devpromax/runtime/jdk/bin/java',
      javac: '/opt/devpromax/runtime/jdk/bin/javac',
    });
  });

  it('keeps an installed copy’s data outside the program directory', () => {
    expect(
      installedDataDir({ LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' }, 'win32', 'C:\\Users\\me'),
    ).toBe('C:\\Users\\me\\AppData\\Local\\DevProMax\\data');
    expect(installedDataDir({}, 'win32', 'C:\\Users\\me')).toBe(
      'C:\\Users\\me\\AppData\\Local\\DevProMax\\data',
    );
    expect(installedDataDir({}, 'linux', '/home/me')).toBe('/home/me/.local/share/devpromax/data');
    expect(installedDataDir({ XDG_DATA_HOME: '/data' }, 'linux', '/home/me')).toBe(
      '/data/devpromax/data',
    );
  });
});

describe('choosing a port', () => {
  const health = { ok: true as const, app: 'devpromax' as const, version: '1.0.0' };
  const probeFrom =
    (states: Record<number, PortState>) =>
    (port: number): Promise<PortState> =>
      Promise.resolve(states[port] ?? { kind: 'free' });

  it('takes the preferred port when it is free', async () => {
    expect(await choosePort(5174, probeFrom({}))).toEqual({ port: 5174, running: false });
  });

  it('only opens a server that is already ours', async () => {
    expect(await choosePort(5174, probeFrom({ 5174: { kind: 'ours', health } }))).toEqual({
      port: 5174,
      running: true,
      health,
    });
  });

  it('steps past a stranger to the next free port', async () => {
    const choice = await choosePort(
      5174,
      probeFrom({ 5174: { kind: 'taken' }, 5175: { kind: 'taken' } }),
    );
    expect(choice).toEqual({ port: 5176, running: false });
  });

  it('gives up with a sentence rather than searching forever', async () => {
    await expect(choosePort(5174, () => Promise.resolve({ kind: 'taken' }))).rejects.toThrow(
      /all in use by other programs/,
    );
  });

  it('remembers the port it chose, and ignores a file it cannot trust', () => {
    const data = path.join(tmp, 'data');
    expect(readRememberedPort(data)).toBeNull();
    rememberPort(data, 5181);
    expect(readRememberedPort(data)).toBe(5181);

    fs.writeFileSync(path.join(data, 'launcher.json'), '{"port": "5174"}');
    expect(readRememberedPort(data)).toBeNull();
    fs.writeFileSync(path.join(data, 'launcher.json'), 'not json');
    expect(readRememberedPort(data)).toBeNull();
  });
});

describe('probing a port', () => {
  function listening(server: net.Server): Promise<number> {
    return new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve((server.address() as net.AddressInfo).port);
      });
    });
  }

  it('tells our own server, a stranger and nothing apart', async () => {
    const ours = http.createServer((_request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ ok: true, app: 'devpromax', version: '9.9.9' }));
    });
    // Answers HTTP, and even says ok - but it is not DevProMax.
    const stranger = http.createServer((_request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ ok: true }));
    });
    const oursPort = await listening(ours);
    const strangerPort = await listening(stranger);
    const closed = net.createServer();
    const freePort = await listening(closed);
    await new Promise((resolve) => closed.close(resolve));

    try {
      expect(await probePort(oursPort)).toEqual({
        kind: 'ours',
        health: { ok: true, app: 'devpromax', version: '9.9.9' },
      });
      expect(await probePort(strangerPort)).toEqual({ kind: 'taken' });
      expect(await probePort(freePort)).toEqual({ kind: 'free' });
    } finally {
      await new Promise((resolve) => ours.close(resolve));
      await new Promise((resolve) => stranger.close(resolve));
    }
  });
});

describe('opening the browser', () => {
  const url = 'http://127.0.0.1:5174/problems?topic=arrays&tier=Easy';

  it('hands Windows the URL as one argument, with no shell to split it at &', () => {
    expect(openerCommand(url, 'win32')).toEqual({
      command: 'rundll32',
      args: ['url.dll,FileProtocolHandler', url],
    });
  });

  it('uses each platform’s own opener elsewhere', () => {
    expect(openerCommand(url, 'darwin')).toEqual({ command: 'open', args: [url] });
    expect(openerCommand(url, 'linux')).toEqual({ command: 'xdg-open', args: [url] });
  });
});
