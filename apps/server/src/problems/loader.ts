import fs from 'node:fs';
import path from 'node:path';
import { type z } from 'zod';
import { hintsFileSchema, problemMetaSchema, testsFileSchema } from '@devpromax/shared';
import { paths } from '../config.js';
import type { ProblemLocation, ProblemPackage, ValidationIssue } from './types.js';

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

/**
 * Reads and parses one problem directory.
 *
 * Returns every structural problem it can see rather than throwing on the first,
 * so an author fixing a new problem sees the whole list at once. `pkg` is only
 * returned when all four parsed files are valid; the semantic rules in
 * `validate.ts` need a real package to run against.
 */
export function loadProblem(location: ProblemLocation): LoadResult {
  const issues: ValidationIssue[] = [];

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
  if (testsRaw !== undefined) {
    const file = relFile(location, 'tests.json');
    const parsed = parseJsonFile(file, testsRaw);
    if (!parsed.ok) {
      issues.push(parsed.issue);
    } else {
      const result = testsFileSchema.safeParse(parsed.value);
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
