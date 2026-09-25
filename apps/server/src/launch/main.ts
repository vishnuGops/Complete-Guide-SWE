#!/usr/bin/env node
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchEnv } from './env.js';
import { findLayout, installedDataDir } from './layout.js';
import { openBrowser } from './open.js';
import {
  DEFAULT_PORT,
  askHealth,
  choosePort,
  probePort,
  readRememberedPort,
  rememberPort,
} from './port.js';

/**
 * The launcher: from a Start menu shortcut to the app in the browser
 * (ROADMAP P10-3, D26).
 *
 *     main              start the server if it is not running, then open it
 *     main backup [file] [--include-key]
 *     main restore <file>
 *     main doctor
 *
 * The three subcommands are `npm run db:backup`, `db:restore` and `doctor` for
 * someone who has no `npm`: they run the same compiled CLIs with the same
 * environment the server gets, so they find the same data and runtimes.
 * `--pause` keeps the window open for a key at the end, for a shortcut whose
 * console would otherwise vanish with the answer in it.
 *
 * Deliberately imports nothing of the server's: `config.ts` throws on a bad
 * `DEVPROMAX_PORT` and `logger.ts` loads a devDependency outside production,
 * and the launcher is what has to work when the environment is wrong.
 */

const SELF = fileURLToPath(import.meta.url);
/** `.js` when compiled; `.ts` when a test runs it through tsx, so the children are too. */
const EXT = path.extname(SELF);
/** `apps/server/dist` (or `src`). */
const SERVER_DIR = path.resolve(path.dirname(SELF), '..');
const ROOT = path.resolve(SERVER_DIR, '..', '..', '..');

/** How long a cold start on a slow machine may take before the launcher gives up. */
const START_TIMEOUT_MS = 30_000;

const CLI: Record<string, { script: string; args: (rest: string[]) => string[] | null }> = {
  backup: { script: path.join('cli', `db${EXT}`), args: (rest) => ['backup', ...rest] },
  restore: {
    script: path.join('cli', `db${EXT}`),
    args: (rest) => (rest.length === 0 ? null : ['restore', ...rest]),
  },
  doctor: { script: path.join('cli', `doctor${EXT}`), args: (rest) => rest },
};

const USAGE = [
  'Usage: DevProMax [backup [file] [--include-key] | restore <file> | doctor] [--pause]',
  '',
].join('\n');

function explicitPort(env: NodeJS.ProcessEnv): number | null {
  const value = env['DEVPROMAX_PORT'];
  if (value === undefined || value.trim() === '') return null;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

async function waitForKey(): Promise<void> {
  if (!process.stdin.isTTY) return;
  process.stdout.write('\nPress any key to close this window.\n');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  await once(process.stdin, 'data');
  process.stdin.setRawMode(false);
  process.stdin.pause();
}

/** A node child running one of the server's own entry points, in this console. */
function runNode(script: string, args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(process.execPath, [...process.execArgv, path.join(SERVER_DIR, script), ...args], {
    env,
    stdio: 'inherit',
    windowsHide: false,
  });
}

async function open(url: string): Promise<void> {
  if (process.env['DEVPROMAX_NO_BROWSER'] === '1' || !(await openBrowser(url))) {
    process.stdout.write(`Open ${url} in your browser.\n`);
  }
}

/** Resolves true once `/health` answers as ours, false if the child exits or time runs out. */
async function waitUntilHealthy(port: number, child: ChildProcess): Promise<boolean> {
  let exited = child.exitCode !== null;
  child.once('exit', () => {
    exited = true;
  });
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (!exited && Date.now() < deadline) {
    if ((await askHealth(port, 1000)) !== null) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function main(): Promise<number> {
  process.title = 'DevProMax';
  const [command, ...rawRest] = process.argv.slice(2);
  const pause = rawRest.includes('--pause') || command === '--pause';
  const rest = rawRest.filter((arg) => arg !== '--pause');

  const layout = findLayout(ROOT);
  const dataDir =
    layout.mode === 'installed'
      ? installedDataDir(process.env, process.platform, os.homedir())
      : path.resolve(process.env['DEVPROMAX_DATA'] ?? path.join(ROOT, 'data'));
  const remembered = readRememberedPort(dataDir);
  const preferred = explicitPort(process.env) ?? remembered ?? DEFAULT_PORT;

  if (command !== undefined && command !== '--pause') {
    const cli = CLI[command];
    const args = cli?.args(rest) ?? null;
    if (cli === undefined || args === null) {
      process.stderr.write(USAGE);
      return 2;
    }
    // The port the server would be on, so `restore` asks the right one
    // whether it is running.
    const env = launchEnv(process.env, layout, { dataDir, port: preferred });
    const child = runNode(cli.script, args, env);
    const [code] = (await once(child, 'exit')) as [number | null];
    if (pause) await waitForKey();
    return code ?? 1;
  }

  const choice = await choosePort(preferred, probePort);
  const url = `http://127.0.0.1:${String(choice.port)}`;

  if (choice.running) {
    // A second click on the shortcut: one server, and a new tab on it.
    process.stdout.write(`DevProMax is already running at ${url}.\n`);
    await open(url);
    return 0;
  }

  const env = launchEnv(process.env, layout, { dataDir, port: choice.port });
  const server = runNode(`start${EXT}`, [], env);
  const exited = once(server, 'exit') as Promise<[number | null, NodeJS.Signals | null]>;

  /*
   * Closing the window reaches the server itself as SIGHUP and Ctrl+C as
   * SIGINT - it shares this console - and it shuts down properly on both
   * (P3-10). Passing them on as well would be its second signal, which it
   * takes as "exit now, skip the clean-up". So the launcher only outlives
   * them, and waits for the server to finish. SIGTERM is sent to one process,
   * so that one is passed on.
   */
  process.on('SIGINT', () => undefined);
  process.on('SIGHUP', () => undefined);
  process.on('SIGTERM', () => {
    server.kill('SIGTERM');
  });

  if (!(await waitUntilHealthy(choice.port, server))) {
    if (server.exitCode === null) server.kill();
    process.stderr.write(
      '\nDevProMax could not start. The lines above say why; if they do not, the log is in\n' +
        `${path.join(dataDir, 'logs')}\n`,
    );
    await waitForKey();
    return 1;
  }

  if (choice.port !== remembered) rememberPort(dataDir, choice.port);
  await open(url);
  process.stdout.write('Close this window to stop DevProMax.\n');

  const [code] = await exited;
  return code ?? 0;
}

process.exitCode = await main().catch((error: unknown) => {
  process.stderr.write(
    `\nDevProMax could not start: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  return waitForKey().then(() => 1);
});
