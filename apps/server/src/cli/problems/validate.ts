#!/usr/bin/env tsx
/**
 * `npm run problems:validate [--static] [--changed <ref>] [slug]`
 *
 * Static rules (P1-2) always run. Without `--static` the validator additionally
 * runs both reference solutions through the judge and checks that both starters
 * compile (P2-7) — the merge gate that keeps an unsolvable problem out of the
 * catalogue.
 *
 * `--changed <ref>` validates only the problems that differ from `ref` (D23,
 * ROADMAP P2-14). Two hundred problems is six minutes of reference runs per
 * operating system, and a pull request that edits one statement has no business
 * paying for it. The exception is the machinery every problem depends on - the
 * judge, the harnesses, a checker, the shared schemas - where a change can
 * break a problem nobody touched, and everything is validated.
 */
import { execFileSync } from 'node:child_process';
import {
  validateCatalogue,
  validateCatalogueFull,
  type CatalogueValidation,
} from '../../problems/validate.js';
import type { ValidationIssue } from '../../problems/types.js';
import { parseValidateArgs, type ValidateArgs } from './validateArgs.js';

/**
 * Paths whose change invalidates every problem, not just its own.
 *
 * The judge and the harnesses decide what "passes" means; a checker is a
 * problem's own comparator but lives in TypeScript that the validator loads;
 * the shared schemas decide what a package may contain. A change to any of them
 * can break a problem nobody edited, which is exactly the case an incremental
 * run would otherwise miss (D23).
 */
const GLOBAL_PATHS = [
  'apps/server/src/judge/',
  'apps/server/src/problems/',
  'apps/server/src/cli/problems/',
  'packages/shared/',
  'checker.ts',
];

interface ChangedScope {
  /** Slugs to validate, or `null` for "everything". */
  slugs: string[] | null;
  reason: string;
}

/** Which problems differ from `ref`, or `null` when everything must be checked. */
function changedProblems(ref: string): ChangedScope {
  let output: string;
  try {
    // `...` compares against the merge base, which is what a pull request is
    // actually proposing - a plain diff would also flag whatever main gained
    // since the branch started.
    output = execFileSync('git', ['diff', '--name-only', `${ref}...HEAD`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // No git, a shallow clone, an unknown ref: validate everything rather than
    // guess. A slow run is a far better failure than a skipped one.
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error);
    return { slugs: null, reason: `could not diff against ${ref} (${String(detail)})` };
  }

  const files = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const global = files.find((file) => GLOBAL_PATHS.some((prefix) => file.includes(prefix)));
  if (global !== undefined) {
    return { slugs: null, reason: `${global} changed, which every problem depends on` };
  }

  const slugs = new Set<string>();
  for (const file of files) {
    const parts = file.split('/');
    if (parts[0] !== 'problems' || parts.length < 3) continue;
    slugs.add(parts[2]!);
  }

  return {
    slugs: [...slugs].sort(),
    reason: `${String(slugs.size)} problem(s) changed since ${ref}`,
  };
}

const RESET = '[0m';
const RED = '[31m';
const YELLOW = '[33m';
const GREEN = '[32m';
const DIM = '[2m';
const CLEAR_LINE = '[2K';

const useColour = process.stdout.isTTY && !process.env['NO_COLOR'];
const paint = (colour: string, text: string): string =>
  useColour ? `${colour}${text}${RESET}` : text;

function formatIssue(issue: ValidationIssue): string {
  const tag = issue.severity === 'error' ? paint(RED, 'error') : paint(YELLOW, 'warning');
  const where = issue.jsonPath ? `${issue.file} ${paint(DIM, `(${issue.jsonPath})`)}` : issue.file;
  return `  ${tag}  ${where}\n         ${issue.message}`;
}

function report(args: ValidateArgs, result: CatalogueValidation): void {
  for (const problem of result.results) {
    if (problem.issues.length === 0) continue;
    console.log(`\n${problem.location.relDir}`);
    for (const issue of problem.issues) {
      console.log(formatIssue(issue));
    }
  }

  if (result.crossIssues.length > 0) {
    console.log('\ncatalogue');
    for (const issue of result.crossIssues) {
      console.log(formatIssue(issue));
    }
  }

  const scope = args.slug ? `"${args.slug}"` : `${result.results.length} problem(s)`;
  const mode = args.staticOnly ? 'static checks' : 'checks';
  console.log('');
  if (result.errorCount === 0 && result.warningCount === 0) {
    console.log(paint(GREEN, `${scope}: all ${mode} passed.`));
  } else {
    console.log(`${scope}: ${result.errorCount} error(s), ${result.warningCount} warning(s).`);
  }
}

async function main(): Promise<void> {
  const args = parseValidateArgs(process.argv.slice(2));

  /*
   * `--changed` narrows the *reference* runs, never the static rules (D23).
   *
   * The static pass is milliseconds for the whole catalogue and catches the
   * cross-problem rules - a duplicate id, a dangling `related`, two problems
   * claiming one `order` - which an incremental run would be blind to by
   * construction.
   */
  let onlySlugs: string[] | null = null;
  if (args.changedFrom !== undefined) {
    const scopeFound = changedProblems(args.changedFrom);
    onlySlugs = scopeFound.slugs;
    console.log(paint(DIM, `  ${scopeFound.reason}`));
  }

  const scope = args.slug ? { slug: args.slug } : {};

  const preflight = validateCatalogue(scope);
  if (preflight.results.length === 0) {
    if (args.slug) {
      console.error(`No problem found with slug "${args.slug}".`);
      process.exit(1);
    }
    console.log('No problems in the catalogue yet.');
    return;
  }

  if (args.staticOnly) {
    report(args, preflight);
    if (!preflight.ok) process.exit(1);
    return;
  }

  if (onlySlugs !== null && onlySlugs.length === 0) {
    report(args, preflight);
    console.log(paint(GREEN, 'No problem changed; reference runs skipped.'));
    if (!preflight.ok) process.exit(1);
    return;
  }

  // Reference execution spawns interpreters, so say what is happening rather
  // than appearing to hang for a catalogue-sized run.
  const result = await validateCatalogueFull({
    ...scope,
    ...(onlySlugs !== null ? { slugs: onlySlugs } : {}),
    onProgress: (message) => {
      if (process.stdout.isTTY) {
        process.stdout.write(`${CLEAR_LINE}${paint(DIM, `  ${message}`)}\r`);
      }
    },
  });
  if (process.stdout.isTTY) process.stdout.write(CLEAR_LINE);

  report(args, result);
  if (!result.ok) process.exit(1);
}

await main();
