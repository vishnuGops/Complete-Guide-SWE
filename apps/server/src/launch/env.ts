import path from 'node:path';
import type { Layout } from './layout.js';

/**
 * The environment the server is started with (ROADMAP P10-3).
 *
 * An installed copy **overrides** what the user has set rather than deferring
 * to it. The home server has a global `DEVPROMAX_PYTHON` pointing at uv's 3.14
 * for its checkout; an installed copy that honoured it would judge with a
 * Python nobody tested it against, and the doctor would call that fine. So the
 * three runtimes are the bundled ones, the data directory is the installed
 * one, and the two variables that would send the server somewhere else - a
 * database file of its own, a Docker executor - are removed.
 *
 * A checkout (`npm run launch`) is the developer's own machine, so it keeps
 * their runtimes and their `DEVPROMAX_DATA`, and gets only what makes it
 * behave like the installed copy: production mode, a log file and a port.
 */

export interface LaunchSettings {
  dataDir: string;
  port: number;
}

/** Removed from an installed copy's environment, whatever the user set them to. */
const INSTALLED_REMOVES = [
  'DEVPROMAX_DB',
  'DEVPROMAX_EXECUTOR',
  // The bundled Node is the one CI tested; a `--require` from the user's
  // shell profile is not part of that.
  'NODE_OPTIONS',
] as const;

export function logFileFor(dataDir: string): string {
  return path.join(dataDir, 'logs', 'devpromax.log');
}

export function launchEnv(
  parent: NodeJS.ProcessEnv,
  layout: Layout,
  settings: LaunchSettings,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...parent };

  if (layout.mode === 'installed') {
    for (const name of INSTALLED_REMOVES) delete env[name];
    env['DEVPROMAX_PYTHON'] = layout.runtimes.python;
    env['DEVPROMAX_JAVA'] = layout.runtimes.java;
    env['DEVPROMAX_JAVAC'] = layout.runtimes.javac;
    env['DEVPROMAX_BUNDLED'] = '1';
  } else {
    // A checkout is never the installed copy, whatever a shell left behind.
    delete env['DEVPROMAX_BUNDLED'];
  }

  env['DEVPROMAX_DATA'] = settings.dataDir;
  env['DEVPROMAX_PORT'] = String(settings.port);
  env['DEVPROMAX_LOG_FILE'] = logFileFor(settings.dataDir);
  // Also what keeps `pino-pretty`, a devDependency the bundle does not carry,
  // from being loaded (see start.ts).
  env['NODE_ENV'] = 'production';
  return env;
}
