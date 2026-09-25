import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { askHealth, readRememberedPort } from './port.js';

/**
 * The launcher against a real server (ROADMAP P10-3), run from source through
 * tsx the way `node dist/launch/main.js` runs it compiled: the launcher starts
 * its children with its own `execArgv`, so they are loaded the same way.
 *
 * From a checkout, so on this machine's runtimes, with `DEVPROMAX_DATA` in a
 * temporary directory and a port nothing else is using. The browser is not
 * opened (`DEVPROMAX_NO_BROWSER`); the address it would have opened is printed
 * instead, which is what the assertions read.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const MAIN = path.join(HERE, 'main.ts');

const data = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-launcher-'));
const running: ChildProcess[] = [];

/** A port free right now, from the OS. */
function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

/**
 * This process's environment without Vitest's markers. The server refuses to
 * open a database under Vitest unless a test hands it one (P3-8), and a real
 * launch has no Vitest above it.
 */
function outsideVitest(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !name.startsWith('VITEST') && name !== 'NODE_ENV'),
  );
}

function launch(args: string[], env: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, ['--import', 'tsx', MAIN, ...args], {
    cwd: REPO,
    env: {
      ...outsideVitest(process.env),
      TSX_TSCONFIG_PATH: path.join(REPO, 'tsconfig.json'),
      DEVPROMAX_DATA: data,
      DEVPROMAX_NO_BROWSER: '1',
      DEVPROMAX_NO_DOCTOR: '1',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Its own process group on POSIX, so the whole tree can be stopped.
    detached: process.platform !== 'win32',
  });
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
  return { child, output: () => output, exited };
}

async function until(
  condition: () => boolean,
  output: () => string,
  timeoutMs = 45_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline)
      throw new Error(`timed out; the launcher said:
${output()}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** The launcher and the server under it: TerminateProcess would leave the server behind. */
function stopTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  }
}

afterEach(() => {
  for (const child of running.splice(0)) stopTree(child);
});

afterAll(() => {
  fs.rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe('the launcher', () => {
  it('starts one server, and a second launch only opens it', async () => {
    const port = await freePort();
    const first = launch([], { DEVPROMAX_PORT: String(port) });
    running.push(first.child);

    await until(
      () => first.output().includes('Close this window to stop DevProMax.'),
      first.output,
    );
    expect(first.output()).toContain(`is running at http://127.0.0.1:${String(port)}`);
    expect(first.output()).toContain(`Open http://127.0.0.1:${String(port)} in your browser.`);
    expect(await askHealth(port)).toMatchObject({ ok: true, app: 'devpromax' });
    expect(readRememberedPort(data)).toBe(port);
    // The log went to the file, not to this window.
    expect(fs.existsSync(path.join(data, 'logs', 'devpromax.log'))).toBe(true);

    // No DEVPROMAX_PORT this time: the remembered port is what it tries.
    const second = launch([]);
    running.push(second.child);
    expect(await second.exited).toBe(0);
    expect(second.output()).toContain(`already running at http://127.0.0.1:${String(port)}`);
    // It started nothing of its own.
    expect(second.output()).not.toContain('is running at');
    expect(first.child.exitCode).toBeNull();
  }, 90_000);

  it('steps past a program that holds its port, and remembers where it went', async () => {
    const port = await freePort();
    const squatter = net.createServer((socket) => socket.destroy());
    await new Promise<void>((resolve) => squatter.listen(port, '127.0.0.1', resolve));

    try {
      const launched = launch([], { DEVPROMAX_PORT: String(port) });
      running.push(launched.child);
      await until(
        () =>
          launched.output().includes('Close this window') ||
          launched.output().includes('could not start'),
        launched.output,
      );

      const moved = readRememberedPort(data);
      expect(moved).not.toBe(port);
      expect(moved).toBeGreaterThan(port);
      expect(launched.output()).toContain(`is running at http://127.0.0.1:${String(moved)}`);
    } finally {
      await new Promise((resolve) => squatter.close(resolve));
    }
  }, 90_000);

  it('says it could not start, and exits non-zero, when the server does not come up', async () => {
    const port = await freePort();
    // A checkout keeps the user's variables, and this one stops the server at
    // import - which is the failure the window must not flash shut on.
    const launched = launch([], {
      DEVPROMAX_PORT: String(port),
      DEVPROMAX_EXECUTOR: 'sideways',
    });
    running.push(launched.child);

    expect(await launched.exited).toBe(1);
    expect(launched.output()).toContain('DEVPROMAX_EXECUTOR must be "local" or "docker"');
    expect(launched.output()).toContain('DevProMax could not start.');
  }, 90_000);

  it('answers a subcommand it does not know with its usage', async () => {
    const launched = launch(['sideways']);
    running.push(launched.child);
    expect(await launched.exited).toBe(2);
    expect(launched.output()).toContain('Usage: DevProMax');
  }, 60_000);
});
