import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * `npm start`, as a user would run it (ROADMAP P3-6, D24).
 *
 * Every other spec runs against Vite on 5173 with the API on 5174, which is the
 * development shape and not the shipped one. What this covers is the part only
 * production has: **one process, on one port, serving both.** Until P3-6 that
 * process served no UI at all, so the command CLAUDE.md described as "build and
 * serve" opened nothing - and no test noticed, because no test ran it.
 *
 * It runs the built output rather than building it: a build inside a test is
 * half a minute of Playwright timeout and a second copy of the build command to
 * keep in step. With no build present it skips and says which command to run,
 * which is the honest outcome for a suite that is usually run against a dev
 * server.
 */

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const SERVER_ENTRY = path.join(REPO_ROOT, 'apps', 'server', 'dist', 'start.js');
const WEB_INDEX = path.join(REPO_ROOT, 'apps', 'web', 'dist', 'index.html');

/** Its own port and its own database, so a dev server can keep running. */
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;

const built = fs.existsSync(SERVER_ENTRY) && fs.existsSync(WEB_INDEX);

let server: ChildProcess | undefined;
let output = '';

async function waitForHealth(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    if (Date.now() > deadline) {
      throw new Error(`the production server did not start in ${timeoutMs}ms:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * The status line of a GET sent with a `Host` header of our choosing.
 *
 * `fetch` refuses to set `Host`, so the rebinding defence (D15) is unreachable
 * through any HTTP client - hence 12 lines of socket.
 */
function statusWithHost(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(PORT, '127.0.0.1', () => {
      socket.write(['GET / HTTP/1.1', `Host: ${host}`, 'Connection: close', '', ''].join('\r\n'));
    });
    let response = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      response += chunk;
    });
    socket.on('error', reject);
    socket.on('end', () => {
      const status = /^HTTP\/1\.1 (\d{3})/.exec(response)?.[1];
      if (status === undefined) reject(new Error(`no status line in: ${response.slice(0, 80)}`));
      else resolve(Number(status));
    });
  });
}

test.describe('the production server', () => {
  test.skip(!built, 'run `npm run build` first; this spec runs the built output');
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    server = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEVPROMAX_PORT: String(PORT),
        DEVPROMAX_DB: path.join(REPO_ROOT, 'data', 'e2e.db'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    server.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    await waitForHealth();
  });

  test.afterAll(async () => {
    if (!server || server.exitCode !== null) return;
    server.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  test('prints where it is running', () => {
    expect(output).toContain(`DevProMax is running at ${BASE}`);
    // The other branch of that message is for an API with no UI behind it; a
    // built checkout must not be told to go and build.
    expect(output).not.toContain('No web build found');
  });

  test('serves the app on the same port as the API', async ({ page }) => {
    await page.goto(BASE);

    await expect(page.getByRole('heading', { name: 'Problems' })).toBeVisible();
    // The counts come from the API, so this is also the proof that both halves
    // are answering on one origin - with no CORS anywhere, which is the point
    // of D24.
    await expect(page.getByTestId('global-progress')).toContainText(/Solved \d+ \/ \d+/);
  });

  test('answers a deep link with the app rather than a 404', async ({ page }) => {
    // A router path is not a file. Reloading one is the most ordinary thing a
    // user does, and without the SPA fallback it is a 404.
    await page.goto(`${BASE}/problems/pair-sum-index`);
    await expect(page.getByRole('heading', { name: 'Pair Sum Index' })).toBeVisible();
  });

  test('keeps the API rules it has in development', async () => {
    const withoutHeader = await fetch(`${BASE}/api/problems`);
    expect(withoutHeader.status).toBe(403);

    const withHeader = await fetch(`${BASE}/api/problems`, {
      headers: { 'X-DevProMax-Client': 'devpromax-web' },
    });
    expect(withHeader.status).toBe(200);

    // The Host allow-list covers page loads too, now that pages come from
    // here. Sent down a socket by hand because `fetch` will not let a caller
    // set `Host` - which is also why this could not be tested from the browser.
    const status = await statusWithHost('evil.example.com');
    expect(status).toBe(421);
  });

  test('stops when it is asked to', async () => {
    expect(server).toBeDefined();
    const exited = new Promise<void>((resolve) => {
      server?.once('exit', () => {
        resolve();
      });
    });

    // `process.kill` on Windows does not deliver a signal - it terminates - so
    // what is asserted here is that the process goes away rather than how. The
    // POSIX lane in CI is where the graceful path is exercised.
    server?.kill('SIGINT');

    await expect(
      Promise.race([
        exited,
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('still running')), 10_000),
        ),
      ]),
    ).resolves.toBeUndefined();

    await expect(fetch(`${BASE}/health`)).rejects.toThrow();
  });
});
