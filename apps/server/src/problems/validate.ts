import {
  MAX_SAFE_WIRE_INTEGER,
  MIN_HIDDEN_TESTS,
  MIN_SAMPLE_TESTS,
  expectsMutatedArgs,
  expectsReturn,
  findUnsafeInteger,
  type JsonValue,
  type ProblemMeta,
  type TestCase,
} from '@devpromax/shared';
import { paths } from '../config.js';
import { discoverProblems, loadProblem, relFile } from './loader.js';
import { checkReferences, type ReferenceCheckOptions } from './references.js';
import type { ProblemPackage, ProblemValidation, ValidationIssue } from './types.js';
import { hasErrors } from './types.js';

function error(file: string, message: string, jsonPath?: string): ValidationIssue {
  return { file, message, severity: 'error', ...(jsonPath ? { jsonPath } : {}) };
}

function warning(file: string, message: string, jsonPath?: string): ValidationIssue {
  return { file, message, severity: 'warning', ...(jsonPath ? { jsonPath } : {}) };
}

/** `samples[3]` / `hidden[0]`, used as the JSON path in test-case messages. */
function testPath(pool: 'samples' | 'hidden', index: number, field?: string): string {
  return field ? `${pool}[${index}].${field}` : `${pool}[${index}]`;
}

// ---------------------------------------------------------------------------
// Rule: the directory and meta.json must agree
// ---------------------------------------------------------------------------

function checkLocation(pkg: ProblemPackage): ValidationIssue[] {
  const { location, meta } = pkg;
  const file = relFile(location, 'meta.json');
  const issues: ValidationIssue[] = [];

  if (meta.slug !== location.slugDir) {
    issues.push(
      error(file, `slug "${meta.slug}" does not match its directory "${location.slugDir}"`, 'slug'),
    );
  }
  if (meta.topic !== location.topicDir) {
    issues.push(
      error(
        file,
        `topic "${meta.topic}" does not match its parent directory "${location.topicDir}"`,
        'topic',
      ),
    );
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Rule: test pools are big enough and shaped correctly for the problem's mode
// ---------------------------------------------------------------------------

/**
 * Every number in a test, checked against what the wire can carry (D22, P2-12).
 *
 * The judge parses results with `JSON.parse`, so an integer past 2^53 - 1 is
 * not the integer it was written as: two different 64-bit answers can compare
 * equal, and Java's reader throws on a Node-stringified 2^63. Rejected at
 * authoring time, where it is a typo to fix, rather than at run time, where it
 * is a verdict nobody can explain.
 */
function checkWireIntegers(
  file: string,
  pool: 'samples' | 'hidden',
  index: number,
  test: TestCase,
): ValidationIssue[] {
  const fields: [string, JsonValue | undefined][] = [
    ['args', test.args],
    ['expected', test.expected],
    ['ops', test.ops as JsonValue | undefined],
    ['expectedMutatedArgs', test.expectedMutatedArgs as JsonValue | undefined],
  ];

  return fields.flatMap(([field, value]) => {
    if (value === undefined) return [];
    const found = findUnsafeInteger(value);
    if (!found) return [];
    return [
      error(
        file,
        `${String(found.value)} is too large to survive JSON (D22: |n| <= ${String(MAX_SAFE_WIRE_INTEGER)}); ` +
          'phrase the problem modulo 10^9+7, or shrink the input',
        testPath(pool, index, `${field}${found.path}`),
      ),
    ];
  });
}

function checkTestCase(
  meta: ProblemMeta,
  file: string,
  pool: 'samples' | 'hidden',
  index: number,
  test: TestCase,
): ValidationIssue[] {
  const issues: ValidationIssue[] = checkWireIntegers(file, pool, index, test);

  if (pool === 'samples' && !test.explanation) {
    issues.push(
      error(
        file,
        'every sample needs an explanation; it is shown in the statement',
        testPath(pool, index, 'explanation'),
      ),
    );
  }

  if (meta.mode === 'operations') {
    if (!test.ops || test.ops.length === 0) {
      issues.push(
        error(
          file,
          'operations-mode tests need a non-empty "ops" list',
          testPath(pool, index, 'ops'),
        ),
      );
    }
    if (!Array.isArray(test.expected)) {
      issues.push(
        error(
          file,
          'operations-mode "expected" must be an array with one entry per op (null for void methods)',
          testPath(pool, index, 'expected'),
        ),
      );
    } else if (test.ops && test.expected.length !== test.ops.length) {
      issues.push(
        error(
          file,
          `expected has ${test.expected.length} entries but there are ${test.ops.length} ops; void methods still contribute null`,
          testPath(pool, index, 'expected'),
        ),
      );
    }
    if (test.expectedMutatedArgs) {
      issues.push(
        error(
          file,
          'operations mode has no argument list to mutate; remove expectedMutatedArgs',
          testPath(pool, index, 'expectedMutatedArgs'),
        ),
      );
    }
    return issues;
  }

  // function mode
  if (test.ops) {
    issues.push(
      error(file, '"ops" is only meaningful in operations mode', testPath(pool, index, 'ops')),
    );
  }

  if (expectsReturn(meta.expect) && test.expected === undefined) {
    issues.push(
      error(
        file,
        `expect is "${meta.expect}", so every test needs an "expected" value`,
        testPath(pool, index, 'expected'),
      ),
    );
  }
  if (!expectsReturn(meta.expect) && test.expected !== undefined) {
    issues.push(
      warning(
        file,
        'expect is "mutatedArgs", so "expected" is ignored by the judge',
        testPath(pool, index, 'expected'),
      ),
    );
  }

  if (expectsMutatedArgs(meta.expect)) {
    const mutated = test.expectedMutatedArgs;
    if (!mutated || mutated.length === 0) {
      issues.push(
        error(
          file,
          `expect is "${meta.expect}", so every test needs a non-empty "expectedMutatedArgs"`,
          testPath(pool, index, 'expectedMutatedArgs'),
        ),
      );
    } else {
      const seen = new Set<number>();
      for (const entry of mutated) {
        if (entry.index >= test.args.length) {
          issues.push(
            error(
              file,
              `expectedMutatedArgs index ${entry.index} is out of range; the test passes ${test.args.length} argument(s)`,
              testPath(pool, index, 'expectedMutatedArgs'),
            ),
          );
        }
        if (seen.has(entry.index)) {
          issues.push(
            error(
              file,
              `expectedMutatedArgs names argument ${entry.index} twice`,
              testPath(pool, index, 'expectedMutatedArgs'),
            ),
          );
        }
        seen.add(entry.index);
      }
    }
  } else if (test.expectedMutatedArgs) {
    issues.push(
      warning(
        file,
        'expect is "return", so "expectedMutatedArgs" is ignored by the judge',
        testPath(pool, index, 'expectedMutatedArgs'),
      ),
    );
  }

  return issues;
}

function checkTests(pkg: ProblemPackage): ValidationIssue[] {
  const file = relFile(pkg.location, 'tests.json');
  const { samples, hidden } = pkg.tests;
  const issues: ValidationIssue[] = [];

  if (samples.length < MIN_SAMPLE_TESTS) {
    issues.push(
      error(file, `needs at least ${MIN_SAMPLE_TESTS} samples, found ${samples.length}`, 'samples'),
    );
  }
  if (hidden.length < MIN_HIDDEN_TESTS) {
    issues.push(
      error(
        file,
        `needs at least ${MIN_HIDDEN_TESTS} hidden tests, found ${hidden.length}; generate them with npm run problems:gen ${pkg.meta.slug}`,
        'hidden',
      ),
    );
  }

  samples.forEach((test, i) => issues.push(...checkTestCase(pkg.meta, file, 'samples', i, test)));
  hidden.forEach((test, i) => issues.push(...checkTestCase(pkg.meta, file, 'hidden', i, test)));

  const arity = new Set([...samples, ...hidden].map((t) => t.args.length));
  if (pkg.meta.mode === 'function' && arity.size > 1) {
    issues.push(
      error(
        file,
        `tests disagree on how many arguments ${pkg.meta.entry} takes (${[...arity].sort().join(', ')})`,
        'samples',
      ),
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Rule: comparator and checker agree
// ---------------------------------------------------------------------------

function checkComparator(pkg: ProblemPackage): ValidationIssue[] {
  const file = relFile(pkg.location, 'meta.json');
  const issues: ValidationIssue[] = [];
  const isChecker = pkg.meta.comparator.kind === 'checker';

  if (isChecker && !pkg.hasChecker) {
    issues.push(
      error(file, 'comparator is "checker" but the problem has no checker.ts', 'comparator'),
    );
  }
  if (!isChecker && pkg.hasChecker) {
    issues.push(
      warning(
        relFile(pkg.location, 'checker.ts'),
        `checker.ts is present but the comparator is "${pkg.meta.comparator.kind}", so it is never loaded`,
      ),
    );
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Rule: the statement documents every sample, and referenced assets exist
// ---------------------------------------------------------------------------

const EXAMPLE_HEADING = /^###\s+Example\b/gim;
const MARKDOWN_ASSET = /!\[[^\]]*\]\(([^)\s]+)/g;

function checkProse(pkg: ProblemPackage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const statementFile = relFile(pkg.location, 'statement.md');

  const exampleCount = pkg.statement.match(EXAMPLE_HEADING)?.length ?? 0;
  if (exampleCount !== pkg.tests.samples.length) {
    issues.push(
      error(
        statementFile,
        `has ${exampleCount} "### Example" heading(s) but tests.json declares ${pkg.tests.samples.length} sample(s); they must correspond 1:1`,
      ),
    );
  }

  for (const heading of ['## Input', '## Output', '## Constraints', '## Examples']) {
    if (!pkg.statement.includes(heading)) {
      issues.push(error(statementFile, `missing required section "${heading}"`));
    }
  }

  for (const [file, body] of [
    [statementFile, pkg.statement],
    [relFile(pkg.location, 'editorial.md'), pkg.editorial],
  ] as const) {
    for (const match of body.matchAll(MARKDOWN_ASSET)) {
      const ref = match[1];
      if (!ref || /^(https?:)?\/\//.test(ref)) continue;
      if (!ref.startsWith('assets/')) {
        issues.push(error(file, `image "${ref}" must live under assets/`));
        continue;
      }
      const name = ref.slice('assets/'.length);
      if (!pkg.assets.includes(name)) {
        issues.push(
          error(file, `image "${ref}" does not exist in the problem's assets/ directory`),
        );
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Rule: starters and references declare what the harness will look for
// ---------------------------------------------------------------------------

function checkSources(pkg: ProblemPackage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { meta } = pkg;
  const pythonClass = meta.mode === 'operations' ? meta.entry : 'Solution';

  const pythonFiles = [
    ['starter.py', pkg.sources.starterPython],
    ['reference.py', pkg.sources.referencePython],
  ] as const;
  for (const [name, body] of pythonFiles) {
    const file = relFile(pkg.location, name);
    if (!new RegExp(`^\\s*class\\s+${pythonClass}\\b`, 'm').test(body)) {
      issues.push(
        error(file, `must declare "class ${pythonClass}", which the harness instantiates`),
      );
    }
    if (meta.mode === 'function' && !new RegExp(`\\bdef\\s+${meta.entry}\\s*\\(`).test(body)) {
      issues.push(error(file, `must define the entry method "${meta.entry}"`));
    }
    if (/^\s*class\s+(ListNode|TreeNode)\b/m.test(body)) {
      issues.push(
        error(
          file,
          'ListNode and TreeNode are injected by the harness; redefining them breaks deserialisation',
        ),
      );
    }
  }

  const javaFiles = [
    ['starter.java', pkg.sources.starterJava],
    ['reference.java', pkg.sources.referenceJava],
  ] as const;
  for (const [name, body] of javaFiles) {
    const file = relFile(pkg.location, name);
    if (!new RegExp(`\\bclass\\s+${pythonClass}\\b`).test(body)) {
      issues.push(
        error(file, `must declare "class ${pythonClass}", which the harness instantiates`),
      );
    }
    if (new RegExp(`\\bpublic\\s+(final\\s+|abstract\\s+)?class\\s+${pythonClass}\\b`).test(body)) {
      issues.push(
        error(
          file,
          `class ${pythonClass} must not be public; it is compiled alongside the harness's own Main`,
        ),
      );
    }
    if (meta.mode === 'function' && !new RegExp(`\\b${meta.entry}\\s*\\(`).test(body)) {
      issues.push(error(file, `must define the entry method "${meta.entry}"`));
    }
    if (/\bclass\s+Main\b/.test(body)) {
      issues.push(error(file, 'a class named Main collides with the judge harness'));
    }
  }

  if (!pkg.generatorPython) {
    issues.push(
      warning(
        `${pkg.location.relDir}/generator.py`,
        'no generator.py; hidden tests cannot be regenerated or differentially re-checked (ROADMAP D9)',
      ),
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rule: a scaffold is not a problem
// ---------------------------------------------------------------------------

/** The marker `problems:new` leaves behind (P2-9). Exact case, so prose is safe. */
const PLACEHOLDER = /\bTODO\b/g;

/**
 * Nothing in a problem package may still say TODO.
 *
 * `problems:new` fills every file with placeholders on purpose, which makes this
 * the rule that turns "the scaffold parses" into "the scaffold is not finished".
 * Without it a half-written problem is one `problems:gen` away from looking
 * valid, and the thing it would be missing is the part only a human can write.
 */
function checkPlaceholders(pkg: ProblemPackage): ValidationIssue[] {
  const bodies: [string, string][] = [
    ['meta.json', JSON.stringify(pkg.meta)],
    ['tests.json', JSON.stringify(pkg.tests)],
    ['hints.json', JSON.stringify(pkg.hints)],
    ['statement.md', pkg.statement],
    ['editorial.md', pkg.editorial],
    ['starter.py', pkg.sources.starterPython],
    ['reference.py', pkg.sources.referencePython],
    ['starter.java', pkg.sources.starterJava],
    ['reference.java', pkg.sources.referenceJava],
    ...(pkg.generatorPython !== undefined
      ? ([['generator.py', pkg.generatorPython]] as [string, string][])
      : []),
  ];

  return bodies.flatMap(([name, body]) => {
    const count = body.match(PLACEHOLDER)?.length ?? 0;
    if (count === 0) return [];
    return [
      error(
        relFile(pkg.location, name),
        `still has ${count} TODO placeholder(s) from the scaffold`,
      ),
    ];
  });
}

/** Every rule that needs only one problem package. */
export function validateProblemPackage(pkg: ProblemPackage): ValidationIssue[] {
  return [
    ...checkLocation(pkg),
    ...checkTests(pkg),
    ...checkComparator(pkg),
    ...checkProse(pkg),
    ...checkSources(pkg),
    ...checkPlaceholders(pkg),
  ];
}

export interface ValidateOptions {
  /** Root of the catalogue; overridden by tests. */
  root?: string;
  /** Validate one problem by slug instead of the whole catalogue. */
  slug?: string;
}

export interface CatalogueValidation {
  results: ProblemValidation[];
  /** Catalogue-wide issues (duplicate ids, dangling `related`) that belong to no single file. */
  crossIssues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  ok: boolean;
}

/**
 * Static validation of the catalogue: everything that can be decided without
 * spawning an interpreter. Reference execution is layered on top in P2-7.
 *
 * Cross-problem rules always look at every problem, even when `slug` narrows the
 * report, because uniqueness and `related` cannot be judged from one directory.
 */
export function validateCatalogue(options: ValidateOptions = {}): CatalogueValidation {
  const root = options.root ?? paths.problems;
  const locations = discoverProblems(root);

  const all: ProblemValidation[] = locations.map((location) => {
    const { pkg, issues } = loadProblem(location);
    const semantic = pkg ? validateProblemPackage(pkg) : [];
    return { location, ...(pkg ? { pkg } : {}), issues: [...issues, ...semantic] };
  });

  const crossIssues = checkCatalogue(all);

  const results = options.slug
    ? all.filter((r) => r.pkg?.meta.slug === options.slug || r.location.slugDir === options.slug)
    : all;

  const scopedCross = options.slug ? [] : crossIssues;
  const everything = [...results.flatMap((r) => r.issues), ...scopedCross];

  return {
    results,
    crossIssues: scopedCross,
    errorCount: everything.filter((i) => i.severity === 'error').length,
    warningCount: everything.filter((i) => i.severity === 'warning').length,
    ok: !hasErrors(everything),
  };
}

/** Rules that need the whole catalogue: uniqueness and cross-references. */
function checkCatalogue(results: readonly ProblemValidation[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map<string, string[]>();
  const bySlug = new Map<string, string[]>();
  const knownSlugs = new Set<string>();

  for (const result of results) {
    if (!result.pkg) continue;
    const { meta, location } = result.pkg;
    byId.set(meta.id, [...(byId.get(meta.id) ?? []), location.relDir]);
    bySlug.set(meta.slug, [...(bySlug.get(meta.slug) ?? []), location.relDir]);
    knownSlugs.add(meta.slug);
  }

  for (const [id, dirs] of byId) {
    if (dirs.length > 1) {
      issues.push(
        error(
          `${dirs[0]}/meta.json`,
          `id "${id}" is also used by ${dirs.slice(1).join(', ')}`,
          'id',
        ),
      );
    }
  }
  for (const [slug, dirs] of bySlug) {
    if (dirs.length > 1) {
      issues.push(
        error(
          `${dirs[0]}/meta.json`,
          `slug "${slug}" is also used by ${dirs.slice(1).join(', ')}`,
          'slug',
        ),
      );
    }
  }

  for (const result of results) {
    if (!result.pkg) continue;
    const { meta, location } = result.pkg;
    for (const [i, related] of meta.related.entries()) {
      if (!knownSlugs.has(related)) {
        issues.push(
          error(
            relFile(location, 'meta.json'),
            `related problem "${related}" does not exist in the catalogue`,
            `related[${i}]`,
          ),
        );
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Full validation: static rules plus reference execution (ROADMAP P2-7)
// ---------------------------------------------------------------------------

export interface FullValidateOptions extends ValidateOptions, ReferenceCheckOptions {}

/**
 * Static validation plus the merge gate: both reference solutions must pass
 * every one of the problem's own tests, in both languages, and both starters
 * must be compilable programs.
 *
 * A problem whose static structure is already broken is skipped rather than run:
 * spawning six interpreters to confirm that a package missing its tests.json
 * does not work would just bury the real message.
 */
export async function validateCatalogueFull(
  options: FullValidateOptions = {},
): Promise<CatalogueValidation> {
  const staticReport = validateCatalogue(options);

  const results: ProblemValidation[] = [];
  for (const result of staticReport.results) {
    if (!result.pkg || hasErrors(result.issues)) {
      results.push(result);
      continue;
    }
    const referenceIssues = await checkReferences(result.pkg, options);
    results.push({ ...result, issues: [...result.issues, ...referenceIssues] });
  }

  const everything = [...results.flatMap((r) => r.issues), ...staticReport.crossIssues];
  return {
    results,
    crossIssues: staticReport.crossIssues,
    errorCount: everything.filter((i) => i.severity === 'error').length,
    warningCount: everything.filter((i) => i.severity === 'warning').length,
    ok: !hasErrors(everything),
  };
}
