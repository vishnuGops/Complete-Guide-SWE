import { paths } from '../config.js';
import { logger } from '../logger.js';
import { discoverProblems, loadProblem } from '../problems/loader.js';
import type { ProblemPackage } from '../problems/types.js';

/**
 * The catalogue the API reads from.
 *
 * Problems are files on disk, not rows in the database, so something has to
 * decide how often to go and look. Two different jobs want different answers: a
 * running app serves a catalogue that cannot change under it, while an author
 * with `npm run dev` open expects an edited `statement.md` to show up on reload.
 * Hence the cache switch, defaulted from NODE_ENV rather than argued about at
 * every call site.
 *
 * A package that does not parse is logged and skipped rather than thrown: the
 * validator (`npm run problems:validate`) is what guarantees the catalogue is
 * sound, and one problem being mid-edit must not take the list page down.
 */
export interface Catalogue {
  /** Every readable problem, in discovery order (topic dir, then slug dir). */
  list(): ProblemPackage[];
  get(slug: string): ProblemPackage | undefined;
  /** Drops the cache; the next read goes back to disk. */
  reload(): void;
}

export interface CatalogueOptions {
  root?: string;
  /** Defaults to caching in production and re-reading everywhere else. */
  cache?: boolean;
}

export function createCatalogue(options: CatalogueOptions = {}): Catalogue {
  const root = options.root ?? paths.problems;
  const cache = options.cache ?? process.env.NODE_ENV === 'production';

  let cached: ProblemPackage[] | undefined;

  function read(): ProblemPackage[] {
    const packages: ProblemPackage[] = [];
    for (const location of discoverProblems(root)) {
      const { pkg, issues } = loadProblem(location);
      if (pkg) {
        packages.push(pkg);
        continue;
      }
      logger.warn(
        { problem: location.relDir, issues: issues.map((i) => `${i.file}: ${i.message}`) },
        'skipping unreadable problem package',
      );
    }
    return packages;
  }

  return {
    list() {
      if (!cache) return read();
      cached ??= read();
      return cached;
    },

    get(slug) {
      if (cache) return this.list().find((pkg) => pkg.meta.slug === slug);

      // Uncached, one problem is read rather than the catalogue: opening a
      // problem in dev should cost one directory, not two hundred.
      const location = discoverProblems(root).find((candidate) => candidate.slugDir === slug);
      if (!location) return undefined;
      const { pkg, issues } = loadProblem(location);
      if (!pkg) {
        logger.warn(
          { problem: location.relDir, issues: issues.map((i) => `${i.file}: ${i.message}`) },
          'skipping unreadable problem package',
        );
      }
      return pkg;
    },

    reload() {
      cached = undefined;
    },
  };
}
