import fs from 'node:fs';
import path from 'node:path';
import { type z } from 'zod';
import { hintsFileSchema, problemMetaSchema, testsFileSchema } from '@devpromax/shared';
import { paths } from '../config.js';
import type { ProblemLocation, ProblemPackage, ProblemTests, ValidationIssue } from './types.js';

/** Files every problem must ship (ROADMAP D7 / docs/PROBLEM_FORMAT.md §1). */
export const REQUIRED_FILES = [
  'meta.json',
  'statement.md',
  'tests.json',
  'hints.json',
  'editorial.md',
  'starter.py',
  'starter.java',
  'reference.py',
  'reference.java',
] as const;

export const OPTIONAL_FILES = ['generator.py', 'checker.ts'] as const;

function isHidden(name: string): boolean {
  return name.startsWith('.') || name.startsWith('_');
}

/**
 * Walks `problems/<topic>/<slug>/`. Directory names are taken at face value here
 * and checked against `meta.json` during validation, so that a misfiled problem
 * produces a precise message instead of simply not being found.
 */
export function discoverProblems(root: string = paths.problems): ProblemLocation[] {
  if (!fs.existsSync(root)) return [];

  const found: ProblemLocation[] = [];
  for (const topicDir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!topicDir.isDirectory() || isHidden(topicDir.name)) continue;
    const topicPath = path.join(root, topicDir.name);
    for (const slugDir of fs.readdirSync(topicPath, { withFileTypes: true })) {
      if (!slugDir.isDirectory() || isHidden(slugDir.name)) continue;
      const dir = path.join(topicPath, slugDir.name);
      found.push({
        topicDir: topicDir.name,
        slugDir: slugDir.name,
        dir,
        relDir: path.posix.join('problems', topicDir.name, slugDir.name),
      });
    }
  }
  return found.sort((a, b) => a.relDir.localeCompare(b.relDir));
}

/** Repo-relative, forward-slashed path for a file inside a problem, for messages. */
/**
 * Why a cache here may trust a modification time (ROADMAP P3-9).
 *
 * Windows stamps files from a clock that ticks every few milliseconds, so two
 * writes inside one tick leave the same mtime and an mtime cache cannot tell
 * them apart. The fix is git's "racily clean" rule: a cached read is trusted
 * only if what it read was already older than the read by more than a tick.
 * Anything written after that gets a later stamp by construction. A read that
 * is too close to its files' last write is simply not trusted and happens again
 * next time - which is what every read did before these caches existed.
 */
const RACY_MS = 50;

/** A number that changes when the files it covers change, and when it was safe. */
export interface Stamp {
  /** Newest mtime times 16 plus the count of files present; deleting one changes it. */
  key: number;
  /** The newest mtime seen, for the racily-clean check. */
  newest: number;
}

export function stampFiles(dir: string, files: readonly string[]): Stamp {
  let newest = 0;
  let present = 0;
  for (const file of files) {
    try {
      newest = Math.max(newest, fs.statSync(path.join(dir, file)).mtimeMs);
      present += 1;
    } catch {
      // Missing: the loader reports it, and its absence is part of the stamp.
    }
  }
  return { key: newest * 16 + present, newest };
}

/** Whether a read stamped `cached` at `takenAt` still describes files stamped `current`. */
export function stillFresh(cached: Stamp, takenAt: number, current: Stamp): boolean {
  return cached.key === current.key && cached.newest < takenAt - RACY_MS;
}

interface DiscoveryCache {
  locations: ProblemLocation[];
  bySlug: Map<string, ProblemLocation>;
  /** Root and topic directories with their mtimes when they were listed. */
  dirs: Map<string, number>;
  takenAt: number;
}

const discoveries = new Map<string, DiscoveryCache>();

function discoveryIsCurrent(cache: DiscoveryCache): boolean {
  for (const [dir, mtime] of cache.dirs) {
    let now: number;
    try {
      now = fs.statSync(dir).mtimeMs;
    } catch {
      return false;
    }
    if (now !== mtime || now >= cache.takenAt - RACY_MS) return false;
  }
  return true;
}

/**
 * `discoverProblems`, remembered while the directories stay as they were
 * (ROADMAP P3-9).
 *
 * Adding or removing a problem changes its topic directory's mtime, and adding
 * a topic changes the root's, so fifteen stats answer "is the listing still
 * right" where fifteen directory reads and a sort used to. For the server's
 * hot paths; the validator and the CLIs read the tree afresh because they run
 * once.
 */
export function discoverProblemsCached(root: string = paths.problems): ProblemLocation[] {
  return currentDiscovery(root).locations;
}

function currentDiscovery(root: string): DiscoveryCache {
  const cached = discoveries.get(root);
  if (cached && discoveryIsCurrent(cached)) return cached;

  const takenAt = Date.now();
  const dirs = new Map<string, number>();
  const statDir = (dir: string): void => {
    try {
      dirs.set(dir, fs.statSync(dir).mtimeMs);
    } catch {
      // A root that does not exist lists as empty; it is checked again next time.
      dirs.set(dir, Number.NaN);
    }
  };
  // Stamped before listing, so a problem added mid-walk makes the stamp stale
  // rather than slipping in unrecorded.
  statDir(root);
  if (fs.existsSync(root)) {
    for (const topic of fs.readdirSync(root, { withFileTypes: true })) {
      if (topic.isDirectory() && !isHidden(topic.name)) statDir(path.join(root, topic.name));
    }
  }
  const locations = discoverProblems(root);
  const fresh: DiscoveryCache = {
    locations,
    bySlug: new Map(locations.map((location) => [location.slugDir, location])),
    dirs,
    takenAt,
  };
  discoveries.set(root, fresh);
  return fresh;
}

/**
 * One problem's directory by slug, without walking the tree when the answer is
 * already known (ROADMAP P3-9). A remembered location is checked with one stat;
 * a slug not seen before, or a directory that has gone, re-reads the listing.
 */
export function locateProblem(
  slug: string,
  root: string = paths.problems,
): ProblemLocation | undefined {
  const known = discoveries.get(root)?.bySlug.get(slug);
  if (known && fs.existsSync(known.dir)) return known;
  return currentDiscovery(root).bySlug.get(slug);
}

export function relFile(location: ProblemLocation, file: string): string {
  return `${location.relDir}/${file}`;
}

function readText(dir: string, file: string): string | null {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function formatZodPath(issuePath: readonly PropertyKey[]): string | undefined {
  if (issuePath.length === 0) return undefined;
  return issuePath.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc === '' ? String(segment) : `${acc}.${String(segment)}`;
  }, '');
}

/** Turns a zod failure into one issue per problem, each pointing at its JSON path. */
export function issuesFromZod(file: string, error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    file,
    jsonPath: formatZodPath(issue.path),
    message: issue.message,
    severity: 'error' as const,
  }));
}

function parseJsonFile(
  file: string,
  raw: string,
): { ok: true; value: unknown } | { ok: false; issue: ValidationIssue } {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (err) {
    return {
      ok: false,
      issue: {
        file,
        message: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      },
    };
  }
}

export interface LoadResult {
  pkg?: ProblemPackage;
  issues: ValidationIssue[];
}

export interface MetaResult {
  meta?: ProblemPackage['meta'];
  issues: ValidationIssue[];
}

/**
 * Reads one problem's `meta.json` and nothing else (ROADMAP P2-14).
 *
 * The list page needs a title, a tier, a rating and a topic; reading the whole
 * package to get them meant parsing every statement, every editorial and every
 * `tests.json` - which for twenty problems is seven megabytes, and at two
 * hundred is the difference between a list that appears and a list that loads.
 */
export function loadMeta(location: ProblemLocation): MetaResult {
  const file = relFile(location, 'meta.json');
  const raw = readText(location.dir, 'meta.json');
  if (raw === null) {
    return { issues: [{ file, message: 'required file is missing', severity: 'error' }] };
  }

  const parsed = parseJsonFile(file, raw);
  if (!parsed.ok) return { issues: [parsed.issue] };

  const result = problemMetaSchema.safeParse(parsed.value);
  if (!result.success) return { issues: issuesFromZod(file, result.error) };
  return { meta: result.data, issues: [] };
}

export interface TestsResult {
  tests?: ProblemTests;
  issues: ValidationIssue[];
}

/**
 * Reads one problem's `tests.json`, hidden cases and all (ROADMAP P2-14).
 *
 * Separate from `loadProblem` because the hidden tests have exactly two
 * readers - the judge, when someone presses Submit, and the validator - and
 * both know they want them. Everything else (the list, the workspace, the
 * coach) wants the samples, which is a few hundred bytes rather than a
 * megabyte, so the catalogue can cache what it serves without holding the whole
 * test suite of two hundred problems in memory.
 */
export function loadTests(location: ProblemLocation): TestsResult {
  const file = relFile(location, 'tests.json');
  const raw = readText(location.dir, 'tests.json');
  if (raw === null) {
    return { issues: [{ file, message: 'required file is missing', severity: 'error' }] };
  }

  const parsed = parseJsonFile(file, raw);
  if (!parsed.ok) return { issues: [parsed.issue] };

  const result = testsFileSchema.safeParse(parsed.value);
  if (!result.success) return { issues: issuesFromZod(file, result.error) };
  return { tests: result.data, issues: [] };
}

/**
 * Reads and parses one problem directory.
 *
 * Returns every structural problem it can see rather than throwing on the first,
 * so an author fixing a new problem sees the whole list at once. `pkg` is only
 * returned when all four parsed files are valid; the semantic rules in
 * `validate.ts` need a real package to run against.
 */
export interface LoadOptions {
  /**
   * Read the hidden tests too (ROADMAP P2-14).
   *
   * Off for anything the API serves: the list, the workspace and the coach all
   * want the samples, and the hidden cases are the megabyte. The judge and the
   * validator turn it on, because they are the two readers that genuinely need
   * them - and `hiddenCount` is filled either way, so a caller can tell the
   * difference between "no hidden tests" and "did not ask for them".
   */
  hidden?: boolean;
}

export function loadProblem(location: ProblemLocation, options: LoadOptions = {}): LoadResult {
  const issues: ValidationIssue[] = [];
  const wantHidden = options.hidden !== false;

  const contents = new Map<string, string>();
  for (const file of REQUIRED_FILES) {
    const raw = readText(location.dir, file);
    if (raw === null) {
      issues.push({
        file: relFile(location, file),
        message: 'required file is missing',
        severity: 'error',
      });
      continue;
    }
    if (raw.trim() === '') {
      issues.push({ file: relFile(location, file), message: 'file is empty', severity: 'error' });
      continue;
    }
    contents.set(file, raw);
  }

  const metaRaw = contents.get('meta.json');
  const testsRaw = contents.get('tests.json');
  const hintsRaw = contents.get('hints.json');

  let meta: ProblemPackage['meta'] | undefined;
  if (metaRaw !== undefined) {
    const file = relFile(location, 'meta.json');
    const parsed = parseJsonFile(file, metaRaw);
    if (!parsed.ok) {
      issues.push(parsed.issue);
    } else {
      const result = problemMetaSchema.safeParse(parsed.value);
      if (result.success) meta = result.data;
      else issues.push(...issuesFromZod(file, result.error));
    }
  }

  let tests: ProblemPackage['tests'] | undefined;
  let hiddenCount = 0;
  if (testsRaw !== undefined) {
    const file = relFile(location, 'tests.json');
    const parsed = parseJsonFile(file, testsRaw);
    if (!parsed.ok) {
      issues.push(parsed.issue);
    } else {
      /*
       * The hidden pool is dropped *before* validation, not after (P2-14).
       *
       * Parsing a megabyte of JSON is a few milliseconds; running two hundred
       * test cases through zod is most of the cost of loading a problem, and
       * nothing that serves a page needs them checked. The count is taken from
       * the raw array so `hiddenCount` is still true.
       */
      const value = parsed.value as { hidden?: unknown };
      hiddenCount = Array.isArray(value.hidden) ? value.hidden.length : 0;
      const toCheck = wantHidden ? parsed.value : { ...(parsed.value as object), hidden: [] };

      const result = testsFileSchema.safeParse(toCheck);
      if (result.success) tests = result.data;
      else issues.push(...issuesFromZod(file, result.error));
    }
  }

  let hints: ProblemPackage['hints'] | undefined;
  if (hintsRaw !== undefined) {
    const file = relFile(location, 'hints.json');
    const parsed = parseJsonFile(file, hintsRaw);
    if (!parsed.ok) {
      issues.push(parsed.issue);
    } else {
      const result = hintsFileSchema.safeParse(parsed.value);
      if (result.success) hints = result.data;
      else issues.push(...issuesFromZod(file, result.error));
    }
  }

  const statement = contents.get('statement.md');
  const editorial = contents.get('editorial.md');
  const starterPython = contents.get('starter.py');
  const starterJava = contents.get('starter.java');
  const referencePython = contents.get('reference.py');
  const referenceJava = contents.get('reference.java');

  if (
    !meta ||
    !tests ||
    !hints ||
    statement === undefined ||
    editorial === undefined ||
    starterPython === undefined ||
    starterJava === undefined ||
    referencePython === undefined ||
    referenceJava === undefined
  ) {
    return { issues };
  }

  const assetsDir = path.join(location.dir, 'assets');
  const assets = fs.existsSync(assetsDir)
    ? fs
        .readdirSync(assetsDir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name)
    : [];

  const generatorPython = readText(location.dir, 'generator.py');

  const pkg: ProblemPackage = {
    location,
    meta,
    tests,
    hiddenCount,
    hints,
    statement,
    editorial,
    sources: { starterPython, starterJava, referencePython, referenceJava },
    ...(generatorPython !== null ? { generatorPython } : {}),
    hasChecker: fs.existsSync(path.join(location.dir, 'checker.ts')),
    assets,
  };

  return { pkg, issues };
}

/**
 * Finds and reads one problem by slug.
 *
 * Matches on the directory name rather than on `meta.slug`, because the two are
 * required to agree (the validator enforces it) and matching on the directory
 * means one problem is read instead of the whole catalogue.
 *
 * Returns null when there is no such problem, and throws when the problem exists
 * but does not parse - a broken package is a bug in the catalogue, not a missing
 * page, and the two must not be reported the same way.
 */
export function loadProblemBySlug(
  slug: string,
  root: string = paths.problems,
  options: LoadOptions = {},
): ProblemPackage | null {
  const location = locateProblem(slug, root);
  if (!location) return null;

  const wantHidden = options.hidden !== false;
  const cacheKey = JSON.stringify([location.dir, wantHidden]);
  const stamp = stampFiles(location.dir, REQUIRED_FILES);
  const cached = packages.get(cacheKey);
  if (cached && stillFresh(cached.stamp, cached.takenAt, stamp)) {
    // Most recently used goes to the back, so the front is what to evict.
    packages.delete(cacheKey);
    packages.set(cacheKey, cached);
    return cached.pkg;
  }

  const takenAt = Date.now();
  const { pkg, issues } = loadProblem(location, { hidden: wantHidden });
  if (!pkg) {
    const detail = issues.map((issue) => `${issue.file}: ${issue.message}`).join('; ');
    throw new Error(`problem "${slug}" could not be read (${detail})`);
  }
  packages.set(cacheKey, { stamp, takenAt, pkg });
  while (packages.size > PACKAGE_CACHE_SIZE) {
    const oldest = packages.keys().next().value;
    if (oldest === undefined) break;
    packages.delete(oldest);
  }
  return pkg;
}

/**
 * Parsed packages, hidden tests included, for the judge (ROADMAP P3-9).
 *
 * Submit used to read and zod-check the whole of `tests.json` every time -
 * over a second for the largest problems on the slower machine - and someone
 * iterating on a solution submits the same problem again and again. A handful
 * of entries covers that; the catalogue's own cache deliberately holds no
 * hidden tests, and this one holds few, because two hundred problems' worth is
 * memory nobody needs. Keyed on the same stamp as the catalogue, so a
 * regenerated `tests.json` is read afresh.
 */
const PACKAGE_CACHE_SIZE = 8;
const packages = new Map<string, { stamp: Stamp; takenAt: number; pkg: ProblemPackage }>();

/** Forgets every remembered listing and package. For tests. */
export function clearLoaderCaches(): void {
  discoveries.clear();
  packages.clear();
}
