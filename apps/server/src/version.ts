import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './config.js';

/**
 * Which build this is (ROADMAP P10-2).
 *
 * One number, in the root `package.json`, with the workspaces following it: the
 * server reads it here for `/health`, the start-up line and Settings › About;
 * the installer (P10-5) and the release tag (P10-8) read the same field. The
 * bundle keeps the repository's layout, so the file is found from `dist/` just
 * as it is from `src/`.
 *
 * Read once, at start-up. A server that cannot say what it is has been
 * assembled wrongly, and failing on the first line says so where a launcher
 * checking the version would only say "not ours".
 */
export function readVersion(root: string = repoRoot): string {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    version?: unknown;
  };
  if (typeof manifest.version !== 'string' || manifest.version === '') {
    throw new Error(`${path.join(root, 'package.json')} has no version.`);
  }
  return manifest.version;
}

export const APP_VERSION = readVersion();
