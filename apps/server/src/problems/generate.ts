import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expectsMutatedArgs,
  expectsReturn,
  testCaseSchema,
  type JsonValue,
  type Language,
  type MutatedArg,
  type TestCase,
} from '@devpromax/shared';
import { runProblemUnqueued, type JudgeTest } from '../judge/index.js';
import { PYTHON_COMMAND } from '../judge/executors/python.js';
import { runProcess } from '../judge/process.js';
import type { ProblemPackage } from './types.js';

/**
 * Regenerating hidden tests (ROADMAP P2-9, D9).
 *
 * The pipeline, and why each step is there:
 *
 *   1. `generator.py` yields **inputs only**. An author who also wrote the
 *      expected output would be asserting what the answer is in two places, and
 *      the two would eventually disagree.
 *   2. The Python reference runs over those inputs as *custom* cases - the judge
 *      mode that reports what the code did instead of grading it - and its
 *      answers become `expected`.
 *   3. The Java reference then runs against those expectations as ordinary
 *      tests, through the real comparator. If the two references disagree, one
 *      of them is wrong, and finding that out now is much cheaper than a user
 *      finding it out mid-solve.
 *
 * Determinism matters as much as randomness: the seed defaults to a hash of the
 * slug, so regenerating without changing anything produces byte-identical tests
 * and a diff only ever shows a real change.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.resolve(HERE, 'generator', 'run_generator.py');

/** A generator that yields forever must not fill the disk. */
export const DEFAULT_CASE_LIMIT = 60;

/** Wall-clock for the generator itself; it is our code, not the user's. */
const GENERATOR_TIMEOUT_MS = 60_000;

export interface GenerateOptions {
  /** Defaults to a stable hash of the slug, so reruns are byte-identical. */
  seed?: number;
  limit?: number;
  /** Check the Java reference against the generated expectations. Default true. */
  crossCheck?: boolean;
  workspaceRoot?: string;
  onProgress?: (message: string) => void;
}

export interface GenerateResult {
  hidden: TestCase[];
  /** Cases the generator produced before duplicates were dropped. */
  generated: number;
  duplicates: number;
  seed: number;
  crossChecked: boolean;
}

export class GenerateError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'GenerateError';
  }
}

/** FNV-1a over the slug: a stable seed that needs no state on disk. */
export function seedFor(slug: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

// ---------------------------------------------------------------------------
// Step 1: run generator.py
// ---------------------------------------------------------------------------

/** One case as the generator wrote it: inputs, and nothing that claims an answer. */
const generatedCaseSchema = testCaseSchema
  .omit({ expected: true, expectedMutatedArgs: true })
  .strict();

export async function runGenerator(
  pkg: ProblemPackage,
  options: GenerateOptions = {},
): Promise<TestCase[]> {
  if (pkg.generatorPython === undefined) {
    throw new GenerateError(
      `${pkg.meta.slug} has no generator.py, so its hidden tests cannot be generated`,
    );
  }

  const seed = options.seed ?? seedFor(pkg.meta.slug);
  const limit = options.limit ?? DEFAULT_CASE_LIMIT;
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'devpromax-gen-'));
  const out = path.join(dir, 'cases.jsonl');

  try {
    const result = await runProcess({
      command: PYTHON_COMMAND,
      // Same flags as the judge: UTF-8 whatever the console code page is, and
      // isolated from the author's site-packages so a generator that works here
      // works in CI.
      args: [
        '-X',
        'utf8',
        '-I',
        RUNNER,
        path.join(pkg.location.dir, 'generator.py'),
        String(seed),
        String(limit),
        out,
      ],
      cwd: dir,
      timeoutMs: GENERATOR_TIMEOUT_MS,
    });

    if (result.killed) {
      throw new GenerateError(
        `generator.py did not finish within ${GENERATOR_TIMEOUT_MS / 1000}s`,
        result.stderr.trim(),
      );
    }
    if (result.code !== 0) {
      throw new GenerateError('generator.py failed', result.stderr.trim() || result.stdout.trim());
    }

    return parseCases(await fsp.readFile(out, 'utf8'));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

function parseCases(raw: string): TestCase[] {
  const cases: TestCase[] = [];
  for (const [index, line] of raw.split('\n').entries()) {
    if (line.trim() === '') continue;

    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new GenerateError(`case ${index} is not valid JSON`, line.slice(0, 200));
    }

    const parsed = generatedCaseSchema.safeParse(value);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const where = first?.path.join('.') ?? '';
      throw new GenerateError(
        `case ${index} is not a usable test case${where ? ` (${where})` : ''}: ${first?.message ?? 'invalid'}`,
        // The most likely mistake by far, so name it rather than leaving the
        // author to infer it from a schema message.
        'generators yield inputs only; the reference computes "expected".',
      );
    }
    cases.push(parsed.data);
  }
  return cases;
}

/** Identity of a case for de-duplication: its inputs, nothing else. */
function caseKey(test: TestCase): string {
  return JSON.stringify({ args: test.args, ops: test.ops ?? null });
}

// ---------------------------------------------------------------------------
// Step 2: the reference answers
// ---------------------------------------------------------------------------

/**
 * Which arguments to record as mutated.
 *
 * The harness reports every argument back; recording all of them would put a
 * problem's `k` and `target` into every test for no reason. Arrays and objects
 * are the only things either language can mutate in place, so those are the
 * ones worth asserting - including one the solution is *not* supposed to touch,
 * which then gets checked for staying put.
 */
function mutatedArgsToKeep(test: TestCase, reported: readonly MutatedArg[]): MutatedArg[] {
  const mutable = reported.filter((arg) => {
    const original = test.args[arg.index];
    return typeof original === 'object' && original !== null;
  });
  return mutable.length > 0 ? mutable : [...reported];
}

async function answersFrom(
  pkg: ProblemPackage,
  language: Language,
  cases: readonly TestCase[],
  options: GenerateOptions,
): Promise<TestCase[]> {
  const code = language === 'python' ? pkg.sources.referencePython : pkg.sources.referenceJava;
  const result = await runProblemUnqueued({
    meta: pkg.meta,
    problemDir: pkg.location.dir,
    language,
    code,
    // `custom` is the source the judge reports rather than grades, which is
    // exactly what an oracle needs.
    tests: cases.map((test) => ({ source: 'custom' as const, test })),
    kind: 'run',
    revealAll: true,
    ...(options.workspaceRoot !== undefined ? { workspaceRoot: options.workspaceRoot } : {}),
  });

  if (result.verdict === 'CE') {
    throw new GenerateError(
      `the ${language} reference does not compile`,
      result.compileErrors.map((e) => e.message).join('\n'),
    );
  }

  const answered: TestCase[] = [];
  for (const [index, test] of result.tests.entries()) {
    const input = cases[index];
    if (input === undefined) continue;

    if (test.verdict !== 'AC') {
      throw new GenerateError(
        `the ${language} reference failed on generated case ${index} (${test.verdict})`,
        [
          test.message ?? '',
          `input: ${JSON.stringify(input.args).slice(0, 300)}`,
          'either the generator produced input outside the stated constraints, or the reference is wrong.',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    const built: TestCase = { ...input };
    if (expectsReturn(pkg.meta.expect)) {
      if (test.actual === undefined) {
        throw new GenerateError(
          `the ${language} reference returned nothing on generated case ${index}`,
          `expect is "${pkg.meta.expect}", so every case needs a return value.`,
        );
      }
      built.expected = test.actual as JsonValue;
    }
    if (expectsMutatedArgs(pkg.meta.expect)) {
      const reported = test.actualMutatedArgs ?? [];
      const kept = mutatedArgsToKeep(input, reported);
      if (kept.length === 0) {
        throw new GenerateError(
          `the ${language} reference reported no arguments back on generated case ${index}`,
          `expect is "${pkg.meta.expect}", so at least one argument must be checked.`,
        );
      }
      built.expectedMutatedArgs = kept;
    }
    answered.push(built);
  }

  return answered;
}

// ---------------------------------------------------------------------------
// Step 3: the other reference has to agree
// ---------------------------------------------------------------------------

async function crossCheck(
  pkg: ProblemPackage,
  hidden: readonly TestCase[],
  options: GenerateOptions,
): Promise<void> {
  const result = await runProblemUnqueued({
    meta: pkg.meta,
    problemDir: pkg.location.dir,
    language: 'java',
    code: pkg.sources.referenceJava,
    // Graded this time, and through the problem's own comparator: an unordered
    // answer must be allowed to differ in order without being called a
    // disagreement.
    tests: hidden.map((test) => ({ source: 'hidden' as const, test })) as JudgeTest[],
    kind: 'submit',
    revealAll: true,
    ...(options.workspaceRoot !== undefined ? { workspaceRoot: options.workspaceRoot } : {}),
  });

  if (result.verdict === 'AC') return;

  if (result.verdict === 'CE') {
    throw new GenerateError(
      'the Java reference does not compile, so the generated tests could not be cross-checked',
      result.compileErrors.map((e) => e.message).join('\n'),
    );
  }

  const failed = result.tests.filter((test) => test.verdict !== 'AC').slice(0, 3);
  throw new GenerateError(
    `the two references disagree on ${result.total - result.passed} generated case(s)`,
    failed
      .map((test) =>
        [
          `case ${test.index} (${test.verdict})`,
          `  input:    ${JSON.stringify(test.input?.args).slice(0, 200)}`,
          `  python:   ${JSON.stringify(test.expected ?? test.expectedMutatedArgs).slice(0, 200)}`,
          `  java:     ${JSON.stringify(test.actual ?? test.actualMutatedArgs).slice(0, 200)}`,
          test.message ? `  ${test.message}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n'),
  );
}

// ---------------------------------------------------------------------------
// The whole pipeline
// ---------------------------------------------------------------------------

export async function generateHiddenTests(
  pkg: ProblemPackage,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const seed = options.seed ?? seedFor(pkg.meta.slug);
  const crossChecking = options.crossCheck !== false;

  options.onProgress?.(`${pkg.meta.slug}: running generator.py (seed ${seed})`);
  const generated = await runGenerator(pkg, { ...options, seed });

  const seen = new Set<string>();
  const unique = generated.filter((test) => {
    const key = caseKey(test);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  options.onProgress?.(
    `${pkg.meta.slug}: answering ${unique.length} case(s) with the Python reference`,
  );
  const hidden = await answersFrom(pkg, 'python', unique, options);

  if (crossChecking) {
    options.onProgress?.(`${pkg.meta.slug}: cross-checking against the Java reference`);
    await crossCheck(pkg, hidden, options);
  }

  return {
    hidden,
    generated: generated.length,
    duplicates: generated.length - unique.length,
    seed,
    crossChecked: crossChecking,
  };
}

// ---------------------------------------------------------------------------
// Writing the result back
// ---------------------------------------------------------------------------

export interface WriteResult {
  changed: boolean;
  previous: number;
  next: number;
  version?: number;
}

/**
 * Writes `hidden` into tests.json, keeping the samples exactly as authored.
 *
 * `meta.version` is bumped only when the tests actually changed, because the
 * version is what lets an old submission still be read as a verdict against the
 * tests it actually faced (P3-2). Bumping on a no-op regeneration would make
 * that history meaningless.
 */
export function writeHiddenTests(
  pkg: ProblemPackage,
  hidden: readonly TestCase[],
  options: { bumpVersion?: boolean } = {},
): WriteResult {
  const previous = pkg.tests.hidden;
  const changed = JSON.stringify(previous) !== JSON.stringify(hidden);

  const testsPath = path.join(pkg.location.dir, 'tests.json');
  const body: Record<string, unknown> = {
    ...(pkg.tests.$schema !== undefined ? { $schema: pkg.tests.$schema } : {}),
    samples: pkg.tests.samples,
    hidden,
  };
  fs.writeFileSync(testsPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');

  const result: WriteResult = { changed, previous: previous.length, next: hidden.length };
  if (!changed || options.bumpVersion === false) return result;

  const metaPath = path.join(pkg.location.dir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
  const version = (typeof meta['version'] === 'number' ? meta['version'] : 0) + 1;
  meta['version'] = version;
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  result.version = version;
  return result;
}
