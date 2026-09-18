#!/usr/bin/env tsx
/**
 * `npm run problems:gen <slug> [options]` — (re)builds hidden tests from
 * generator.py with the reference solutions as the oracle (ROADMAP P2-9, D9).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PYTHON_COMMAND } from '../../judge/executors/python.js';
import { paths } from '../../config.js';
import { GenerateError, generateHiddenTests, writeHiddenTests } from '../generate.js';
import { discoverProblems, loadProblemBySlug } from '../loader.js';
import { validateCatalogue } from '../validate.js';

const USAGE = `
Usage: npm run problems:gen <slug> -- [options]

  --seed <n>         default: a stable hash of the slug, so reruns are identical
  --limit <n>        maximum cases to take from the generator (default: 60)
  --no-cross-check   skip running the Java reference against the result
  --dry-run          report what would change without writing
  --keep-version     do not bump meta.version even if the tests changed
  --check [slug]     regenerate and fail if the checked-in tests differ (CI)
`.trim();

/**
 * The Python minor the catalogue was generated with.
 *
 * `random.Random`'s sequence methods are not stable across minors, so a
 * regeneration on a different one produces different - still valid - tests, and
 * a `--check` there would report a difference that means nothing. Recorded in
 * `problems/GENERATED_WITH` rather than assumed (ROADMAP P2-14).
 */
function generatedWith(): string {
  const file = path.join(paths.problems, 'GENERATED_WITH');
  const body = fs.readFileSync(file, 'utf8');
  const line = body
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry !== '' && !entry.startsWith('#'));
  if (line === undefined) fail(`${file} names no version`);
  return line;
}

/** `3.14` from whatever `python` is on PATH. */
function pythonMinor(): string {
  const output = execFileSync(
    PYTHON_COMMAND,
    ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'],
    {
      encoding: 'utf8',
    },
  );
  return output.trim();
}

/**
 * Regenerates every problem (or one) and fails if the result differs.
 *
 * The gap this closes: an edited `generator.py` with a stale `tests.json`
 * passes every check today, because nothing re-runs the generator. The tests
 * that ship would then be the ones somebody generated before the edit, and the
 * editorial's claims about them would quietly stop being true.
 */
async function check(only: string | undefined): Promise<void> {
  const wanted = generatedWith();
  const running = pythonMinor();
  if (running !== wanted) {
    fail(
      `this check needs Python ${wanted}, and ${running} is on PATH`,
      'Generated tests are not reproducible across Python minors; see problems/GENERATED_WITH.',
    );
  }

  const slugs = only ? [only] : discoverProblems().map((location) => location.slugDir);

  const stale: string[] = [];
  for (const slug of slugs) {
    const pkg = loadProblemBySlug(slug);
    if (!pkg) fail(`No problem found with slug "${slug}".`);
    if (!pkg.generatorPython) continue;

    const result = await generateHiddenTests(pkg, { crossCheck: false });
    const same = JSON.stringify(pkg.tests.hidden) === JSON.stringify(result.hidden);
    console.log(`  ${same ? paint(GREEN, 'ok  ') : paint(RED, 'stale')}  ${slug}`);
    if (!same) stale.push(slug);
  }

  if (stale.length === 0) {
    console.log(paint(GREEN, `${String(slugs.length)} problem(s): tests match their generators.`));
    return;
  }

  console.error(
    [
      '',
      `${String(stale.length)} problem(s) have tests their generator no longer produces:`,
      ...stale.map((slug) => `  npm run problems:gen ${slug}`),
    ].join('\n'),
  );
  process.exit(1);
}

const RESET = '[0m';
const DIM = '[2m';
const RED = '[31m';
const GREEN = '[32m';
const CLEAR_LINE = '[2K';

const useColour = process.stdout.isTTY && !process.env['NO_COLOR'];
const paint = (colour: string, text: string): string =>
  useColour ? `${colour}${text}${RESET}` : text;

function fail(message: string, detail?: string): never {
  console.error(`${paint(RED, 'error')}  ${message}`);
  if (detail) console.error(detail.replace(/^/gm, '        '));
  process.exit(1);
}

function numberFlag(argv: readonly string[], name: string): number | undefined {
  const index = argv.indexOf(`--${name}`);
  const raw = index === -1 ? process.env[`npm_config_${name}`] : argv[index + 1];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) fail(`--${name} must be a number`);
  return value;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const slug = argv.find((arg, i) => !arg.startsWith('--') && !argv[i - 1]?.startsWith('--'));

  if (argv.includes('--check') || process.env['npm_config_check'] === 'true') {
    // `--check <slug>` reads as a flag with a value to the slug detection
    // above, so the one problem case is read here instead.
    const after = argv[argv.indexOf('--check') + 1];
    const only = after !== undefined && !after.startsWith('--') ? after : slug;
    await check(only);
    return;
  }

  if (!slug) {
    console.error(USAGE);
    process.exit(1);
  }

  // npm swallows bare `--flag` into its own config, so honour both spellings.
  const has = (name: string) =>
    argv.includes(`--${name}`) || process.env[`npm_config_${name}`] === 'true';
  const dryRun = has('dry-run');
  const seed = numberFlag(argv, 'seed');
  const limit = numberFlag(argv, 'limit');

  const pkg = loadProblemBySlug(slug);
  if (!pkg) fail(`No problem found with slug "${slug}".`);

  let result;
  try {
    result = await generateHiddenTests(pkg, {
      crossCheck: !has('no-cross-check'),
      ...(seed !== undefined ? { seed } : {}),
      ...(limit !== undefined ? { limit } : {}),
      onProgress: (message) => {
        if (process.stdout.isTTY)
          process.stdout.write(`${CLEAR_LINE}${paint(DIM, `  ${message}`)}\r`);
      },
    });
  } catch (error) {
    if (process.stdout.isTTY) process.stdout.write(CLEAR_LINE);
    if (error instanceof GenerateError) fail(error.message, error.detail);
    throw error;
  }
  if (process.stdout.isTTY) process.stdout.write(CLEAR_LINE);

  const summary = [
    `${result.hidden.length} hidden test(s) from ${result.generated} generated case(s)`,
    result.duplicates > 0 ? `${result.duplicates} duplicate(s) dropped` : '',
    `seed ${result.seed}`,
    result.crossChecked ? 'both references agree' : 'cross-check skipped',
  ].filter(Boolean);
  console.log(`${pkg.meta.slug}: ${summary.join(' · ')}`);

  if (dryRun) {
    const changed = JSON.stringify(pkg.tests.hidden) !== JSON.stringify(result.hidden);
    console.log(changed ? 'Would rewrite tests.json.' : 'tests.json is already up to date.');
    return;
  }

  const written = writeHiddenTests(pkg, result.hidden, { bumpVersion: !has('keep-version') });
  if (!written.changed) {
    console.log('tests.json was already up to date; nothing written.');
  } else {
    console.log(
      `Wrote tests.json: ${written.previous} -> ${written.next} hidden test(s)` +
        (written.version !== undefined ? `, meta.version -> ${written.version}` : ''),
    );
  }

  // The static rules are cheap and catch the things generation cannot know
  // about - a sample count that no longer matches the statement, say.
  const validation = validateCatalogue({ slug });
  const issues = validation.results.flatMap((r) => r.issues);
  if (issues.length === 0) {
    console.log(paint(GREEN, `Static checks pass. Run: npm run problems:validate ${slug}`));
    return;
  }
  console.log(`\nStatic validator (${issues.length} issue(s)):`);
  for (const issue of issues.slice(0, 10)) {
    console.log(`  ${issue.file}${issue.jsonPath ? ` (${issue.jsonPath})` : ''}: ${issue.message}`);
  }
  if (validation.errorCount > 0) process.exit(1);
}

await main();
