import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config.js';
import { logger } from '../logger.js';
import { discoverProblems, loadMeta, loadProblem } from '../problems/loader.js';
import type { ProblemLocation, ProblemPackage } from '../problems/types.js';
import type { ProblemMeta } from '@devpromax/shared';

/**
 * The catalogue the API reads from.
 *
 * Problems are files on disk, not rows in a database, so something has to
 * decide how often to go and look. Two different jobs want different answers: a
 * running app serves a catalogue that cannot change under it, while an author
 * with `npm run dev` open expects an edited `statement.md` to show up on
 * reload.
 *
 * The answer used to be a switch - cache in production, re-read everything
 * everywhere else - which made every `GET /api/problems` in development parse
 * all nine files of every problem, `tests.json` included. Twenty problems is
 * seven megabytes of test data and about 120ms; two hundred would be a second
 * (ROADMAP P2-14).
 *
 * So there are three changes, and each one is about reading less:
 *
 *   - **The list reads `meta.json` only.** A title, a tier and a topic do not
 *     need the statement, the editorial or the tests.
 *   - **Nothing the API serves reads the hidden tests.** The judge asks for
 *     them by name when someone presses Submit (`loadTests`).
 *   - **Reads are cached against the files' modification times**, in every
 *     environment. An author still sees an edit on reload, because the edit
 *     changes an mtime; a running app still pays for one stat per file rather
 *     than a parse.
 *
 * A package that does not parse is logged and skipped rather than thrown: the
 * validator (`npm run problems:validate`) is what guarantees the catalogue is
 * sound, and one problem being mid-edit must not take the list page down.
 */

export interface CatalogueEntry {
  location: ProblemLocation;
  meta: ProblemMeta;
}

export interface Catalogue {
  /** Every readable problem's metadata, in discovery order. */
  listMeta(): CatalogueEntry[];
  /**
   * Every readable problem, whole.
   *
   * Kept for the callers that genuinely want everything; the list route does
   * not, and uses `listMeta`.
   */
  list(): ProblemPackage[];
  /** One problem, with samples but without the hidden tests (see the note above). */
  get(slug: string): ProblemPackage | undefined;
  /** One problem's metadata, for a caller that only needs a title or a tier. */
  getMeta(slug: string): ProblemMeta | undefined;
  /** Drops the cache; the next read goes back to disk. */
  reload(): void;
}

export interface CatalogueOptions {
  root?: string;
  /**
   * Cache reads at all.
   *
   * On by default now that the cache is invalidated by modification time
   * rather than by environment. `false` is for tests that rewrite a problem
   * directory within the same millisecond, where an mtime cannot tell the
   * difference.
   */
  cache?: boolean;
}

/** Files whose modification time decides whether a cached read is stale. */
const WATCHED = [
  'meta.json',
  'tests.json',
  'hints.json',
  'statement.md',
  'editorial.md',
  'starter.py',
  'starter.java',
  'reference.py',
  'reference.java',
] as const;

/**
 * A number that changes when the problem does.
 *
 * The newest mtime across the files a package is built from, plus the count of
 * those that exist - so deleting a file invalidates the entry even if nothing
 * else was touched. Nine stats per problem is well under a millisecond and is
 * the whole price of never serving a stale statement.
 */
function stampOf(dir: string): number {
  let newest = 0;
  let present = 0;
  for (const file of WATCHED) {
    try {
      newest = Math.max(newest, fs.statSync(path.join(dir, file)).mtimeMs);
      present += 1;
    } catch {
      // Missing: the loader reports it, and its absence is part of the stamp.
    }
  }
  return newest * 16 + present;
}

interface CachedMeta {
  stamp: number;
  entry?: CatalogueEntry;
}

interface CachedPackage {
  stamp: number;
  pkg?: ProblemPackage;
}

export function createCatalogue(options: CatalogueOptions = {}): Catalogue {
  const root = options.root ?? paths.problems;
  const caching = options.cache ?? true;

  const metaCache = new Map<string, CachedMeta>();
  const packageCache = new Map<string, CachedPackage>();

  function readMeta(location: ProblemLocation): CatalogueEntry | undefined {
    const stamp = stampOf(location.dir);
    const cached = metaCache.get(location.dir);
    if (caching && cached && cached.stamp === stamp) return cached.entry;

    const { meta, issues } = loadMeta(location);
    const entry = meta ? { location, meta } : undefined;
    if (!entry) {
      logger.warn(
        { problem: location.relDir, issues: issues.map((i) => `${i.file}: ${i.message}`) },
        'skipping unreadable problem package',
      );
    }
    metaCache.set(location.dir, { stamp, ...(entry ? { entry } : {}) });
    return entry;
  }

  function readPackage(location: ProblemLocation): ProblemPackage | undefined {
    const stamp = stampOf(location.dir);
    const cached = packageCache.get(location.dir);
    if (caching && cached && cached.stamp === stamp) return cached.pkg;

    // `hidden: false`: nothing this catalogue serves needs the hidden cases,
    // and they are most of what a problem weighs (P2-14).
    const { pkg, issues } = loadProblem(location, { hidden: false });
    if (!pkg) {
      logger.warn(
        { problem: location.relDir, issues: issues.map((i) => `${i.file}: ${i.message}`) },
        'skipping unreadable problem package',
      );
    }
    packageCache.set(location.dir, { stamp, ...(pkg ? { pkg } : {}) });
    return pkg;
  }

  function locate(slug: string): ProblemLocation | undefined {
    // Matched on the directory name, which the validator requires to equal the
    // slug: one directory is read rather than the whole catalogue.
    return discoverProblems(root).find((candidate) => candidate.slugDir === slug);
  }

  return {
    listMeta() {
      return discoverProblems(root).flatMap((location) => {
        const entry = readMeta(location);
        return entry ? [entry] : [];
      });
    },

    list() {
      return discoverProblems(root).flatMap((location) => {
        const pkg = readPackage(location);
        return pkg ? [pkg] : [];
      });
    },

    get(slug) {
      const location = locate(slug);
      return location ? readPackage(location) : undefined;
    },

    getMeta(slug) {
      const location = locate(slug);
      return location ? readMeta(location)?.meta : undefined;
    },

    reload() {
      metaCache.clear();
      packageCache.clear();
    },
  };
}
