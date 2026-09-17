import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { paths } from '../config.js';

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
  dispose(): Promise<void>;
}

export async function createWorkspace(root: string = paths.judgeWorkspaces): Promise<Workspace> {
  const id = randomUUID();
  const dir = path.join(root, id);
  await fs.mkdir(dir, { recursive: true });

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
    async dispose() {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
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
