#!/usr/bin/env tsx
/**
 * `npm run problems:validate [--static] [slug]`
 *
 * Static rules (P1-2) run always. Without `--static` the validator additionally
 * runs both reference solutions through the judge (P2-7); until that lands,
 * `--static` is the only implemented mode and the command says so rather than
 * quietly passing a check it did not perform.
 */
import { validateCatalogue } from '../validate.js';
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

const useColour = process.stdout.isTTY && !process.env['NO_COLOR'];
const paint = (colour: string, text: string): string =>
  useColour ? `${colour}${text}${RESET}` : text;

function formatIssue(issue: ValidationIssue): string {
  const tag = issue.severity === 'error' ? paint(RED, 'error') : paint(YELLOW, 'warning');
  const where = issue.jsonPath ? `${issue.file} ${paint(DIM, `(${issue.jsonPath})`)}` : issue.file;
  return `  ${tag}  ${where}\n         ${issue.message}`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const report = validateCatalogue(args.slug ? { slug: args.slug } : {});

  if (report.results.length === 0) {
    if (args.slug) {
      console.error(`No problem found with slug "${args.slug}".`);
      process.exit(1);
    }
    console.log('No problems in the catalogue yet.');
    return;
  }

  for (const result of report.results) {
    if (result.issues.length === 0) continue;
    console.log(`\n${result.location.relDir}`);
    for (const issue of result.issues) {
      console.log(formatIssue(issue));
    }
  }

  if (report.crossIssues.length > 0) {
    console.log('\ncatalogue');
    for (const issue of report.crossIssues) {
      console.log(formatIssue(issue));
    }
  }

  const scope = args.slug ? `"${args.slug}"` : `${report.results.length} problem(s)`;
  console.log('');
  if (report.errorCount === 0 && report.warningCount === 0) {
    console.log(paint(GREEN, `${scope}: all static checks passed.`));
  } else {
    console.log(`${scope}: ${report.errorCount} error(s), ${report.warningCount} warning(s).`);
  }

  if (!args.staticOnly) {
    console.log(
      paint(
        DIM,
        'Reference execution is not implemented yet (ROADMAP P2-7); only static checks ran.',
      ),
    );
  }

  if (!report.ok) process.exit(1);
}

main();
