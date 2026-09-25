import fs from 'node:fs';
import path from 'node:path';

/**
 * Where the launcher is, and what came with it (ROADMAP P10-3, D26).
 *
 * The bundle (P10-4) keeps the repository's layout - `apps/server/dist/...`,
 * `apps/web/dist`, `problems/` - and adds the runtimes beside it:
 *
 *     <root>/runtime/node/node.exe
 *     <root>/runtime/python/python.exe      (python-build-standalone)
 *     <root>/runtime/jdk/bin/java.exe       (jlinked Temurin)
 *
 * With `runtime/` present this is an installed copy, and it uses only what it
 * brought. Without, it is a checkout run with `npm run launch`, which uses the
 * machine's runtimes the way `npm start` does.
 */

export interface Runtimes {
  python: string;
  java: string;
  javac: string;
}

export type Layout =
  { mode: 'installed'; root: string; runtimes: Runtimes } | { mode: 'checkout'; root: string };

/** The bundled runtimes under `root`, named the way each platform's archives lay them out. */
export function bundledRuntimes(
  root: string,
  platform: NodeJS.Platform = process.platform,
): Runtimes {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const exe = platform === 'win32' ? '.exe' : '';
  const runtime = paths.join(root, 'runtime');
  return {
    // python-build-standalone's `install_only` puts python.exe at the top on
    // Windows and under bin/ everywhere else.
    python:
      platform === 'win32'
        ? paths.join(runtime, 'python', 'python.exe')
        : paths.join(runtime, 'python', 'bin', 'python3'),
    java: paths.join(runtime, 'jdk', 'bin', `java${exe}`),
    javac: paths.join(runtime, 'jdk', 'bin', `javac${exe}`),
  };
}

/**
 * Installed exactly when the runtimes are there. Half an install - a Python and
 * no JDK - is still an installed copy, and the doctor then says it is damaged,
 * rather than quietly falling back to whatever the machine has on `PATH`.
 */
export function findLayout(root: string, platform: NodeJS.Platform = process.platform): Layout {
  if (!fs.existsSync(path.join(root, 'runtime'))) return { mode: 'checkout', root };
  return { mode: 'installed', root, runtimes: bundledRuntimes(root, platform) };
}

/**
 * Where an installed copy keeps what it writes: outside the program directory,
 * so an upgrade or an uninstall does not take practice history with it (D26).
 */
export function installedDataDir(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
  home: string,
): string {
  if (platform === 'win32') {
    const local = env['LOCALAPPDATA'] ?? path.win32.join(home, 'AppData', 'Local');
    return path.win32.join(local, 'DevProMax', 'data');
  }
  // P10-9: the XDG base directory, as a Linux desktop expects.
  const share = env['XDG_DATA_HOME'] ?? path.posix.join(home, '.local', 'share');
  return path.posix.join(share, 'devpromax', 'data');
}
