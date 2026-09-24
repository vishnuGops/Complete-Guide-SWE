import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { paths } from '../config.js';
import { logger } from '../logger.js';

/**
 * An isolated scratch directory for one judge run.
 *
 * The name is a UUID the judge generates. Nothing about the path is ever derived
 * from user input (ROADMAP P2-5) - not the slug, not the language, not a file
 * name from the request - so there is no path to traverse out of.
 */
export interface Workspace {
  id: string;
  dir: string;
  file(name: string): string;
  write(name: string, contents: string): Promise<string>;
  read(name: string): Promise<string>;
  /** Never rejects: a workspace that outlives its run is a sweeper's problem. */
  dispose(): Promise<void>;
}

export async function createWorkspace(root: string = paths.judgeWorkspaces): Promise<Workspace> {
  const id = randomUUID();
  // Resolved, not joined: every path handed to a harness has to be absolute.
  // The subprocess runs with its cwd set to the workspace, so a relative path
  // would resolve against the workspace itself rather than against ours.
  const dir = path.resolve(root, id);
  await fs.mkdir(dir, { recursive: true });
  return workspaceAt(id, dir);
}

/**
 * A workspace over a directory the caller already made - the scratch directory
 * the shared Java harness is built in (ROADMAP P2-18), which a launcher has to be
 * able to mount exactly as it mounts a run's.
 */
export function workspaceAt(id: string, dir: string): Workspace {
  const file = (name: string): string => path.join(dir, name);

  return {
    id,
    dir,
    file,
    async write(name, contents) {
      const full = file(name);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, contents, 'utf8');
      return full;
    },
    async read(name) {
      try {
        return await fs.readFile(file(name), 'utf8');
      } catch {
        // A harness that died before creating the file is a normal outcome, not
        // an error: the caller reads an empty result stream and reports on it.
        return '';
      }
    },
    /**
     * Deletes the workspace, and never fails doing it (ROADMAP P2-11).
     *
     * `runProblem` disposes in a `finally`, so a rejection here replaced a
     * finished verdict with a 500 - the user's code ran, passed, and they were
     * told the server broke. On Windows this is not hypothetical: `javac` has
     * just written `.class` files and an antivirus scanner or the loader can
     * still hold one open for a few hundred milliseconds, and `fs.rm` reports
     * that as EBUSY or EPERM.
     *
     * So: more retries over a longer window, and whatever is left is logged and
     * swallowed. `sweepStaleWorkspaces` removes it at the next startup, which is
     * the right owner for a directory nothing is using any more.
     */
    async dispose() {
      try {
        await fs.rm(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
      } catch (error) {
        logger.warn(
          { workspace: id, err: error },
          'judge workspace could not be removed; leaving it for the startup sweep',
        );
      }
    },
  };
}

/**
 * Removes workspaces left behind by a process that died before disposing of its
 * own. Called at startup; never removes a directory younger than the cutoff, so
 * it cannot race a run happening right now.
 */
export async function sweepStaleWorkspaces(
  root: string = paths.judgeWorkspaces,
  olderThanMs = 60 * 60 * 1000,
): Promise<number> {
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch {
    return 0;
  }

  const cutoff = Date.now() - olderThanMs;
  let removed = 0;
  for (const entry of entries) {
    const full = path.join(root, entry);
    try {
      const stat = await fs.stat(full);
      if (!stat.isDirectory() || stat.mtimeMs > cutoff) continue;
      await fs.rm(full, { recursive: true, force: true });
      removed += 1;
    } catch {
      // Raced with something else removing it; nothing to do.
    }
  }
  return removed;
}
