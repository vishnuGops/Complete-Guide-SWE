#!/usr/bin/env tsx
/**
 * `npm run problems:validate [--static] [slug]`
 *
 * Static rules (P1-2) always run. Without `--static` the validator additionally
 * runs both reference solutions through the judge and checks that both starters
 * compile (P2-7) — the merge gate that keeps an unsolvable problem out of the
 * catalogue.
 */
import { validateCatalogue, validateCatalogueFull, type CatalogueValidation } from '../validate.js';
import type { ValidationIssue } from '../types.js';

interface Args {
  staticOnly: boolean;
  slug?: string;
}

function parseArgs(argv: readonly string[]): Args {
  // `npm run problems:validate --static` makes npm swallow the flag into its own
  // config rather than passing it through, so honour both that and the
  // `-- --static` form.
  const staticOnly = argv.includes('--static') || process.env['npm_config_static'] === 'true';
  const slug = argv.find((a) => !a.startsWith('-'));
  return { staticOnly, ...(slug ? { slug } : {}) };
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

function report(args: Args, result: CatalogueValidation): void {
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
  const args = parseArgs(process.argv.slice(2));
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

  // Reference execution spawns interpreters, so say what is happening rather
  // than appearing to hang for a catalogue-sized run.
  const result = await validateCatalogueFull({
    ...scope,
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
