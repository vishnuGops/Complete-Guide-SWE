#!/usr/bin/env tsx
/**
 * `npm run problems:new <topic> <slug> [options]` — scaffolds a problem package
 * (ROADMAP P2-9).
 *
 * What it writes parses but is deliberately incomplete: the samples are
 * placeholders and `hidden` is empty. The last thing it does is run the static
 * validator and print what is still owed, so the first thing an author sees is
 * the list of work rather than a directory that looks finished.
 */
import {
  EXPECT_MODES,
  TEST_MODES,
  TIERS,
  TOPICS,
  slugSchema,
  type ExpectMode,
  type TestMode,
  type Tier,
  type Topic,
} from '@devpromax/shared';
import { validateCatalogue } from '../validate.js';
import { writeScaffold, type ScaffoldOptions } from '../scaffold.js';

const USAGE = `
Usage: npm run problems:new <topic> <slug> -- [options]

  --title "Title"     default: the slug in title case
  --mode <mode>       ${TEST_MODES.join(' | ')} (default: function)
  --expect <expect>   ${EXPECT_MODES.join(' | ')} (default: return; operations is always return)
  --entry <name>      method name, or class name in operations mode
  --tier <tier>       ${TIERS.join(' | ')} (default: Easy)
  --rating <1-10>     default: the middle of the tier's band
  --order <n>         position within the topic's learning path (default: 0)

Topics: ${TOPICS.join(', ')}
`.trim();

function fail(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return process.env[`npm_config_${name}`];
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) fail(`--${name} needs a value`);
  return value;
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  name: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    fail(`--${name} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function main(): void {
  const argv = process.argv.slice(2);
  const positional = argv.filter(
    (arg, i) => !arg.startsWith('--') && !argv[i - 1]?.startsWith('--'),
  );
  const [topic, slug] = positional;

  if (!topic || !slug) fail('A topic and a slug are required.');
  if (!(TOPICS as readonly string[]).includes(topic)) {
    fail(`"${topic}" is not one of the 14 curriculum topics.`);
  }
  const parsedSlug = slugSchema.safeParse(slug);
  if (!parsedSlug.success) {
    fail(`"${slug}" is not a valid slug: ${parsedSlug.error.issues[0]?.message ?? 'invalid'}`);
  }

  const rating = flag(argv, 'rating');
  const order = flag(argv, 'order');
  const options: ScaffoldOptions = {
    topic: topic as Topic,
    slug,
    mode: oneOf<TestMode>(flag(argv, 'mode'), TEST_MODES, 'mode') ?? 'function',
    ...(flag(argv, 'title') ? { title: flag(argv, 'title') as string } : {}),
    ...(flag(argv, 'entry') ? { entry: flag(argv, 'entry') as string } : {}),
    ...(oneOf<ExpectMode>(flag(argv, 'expect'), EXPECT_MODES, 'expect')
      ? { expect: oneOf<ExpectMode>(flag(argv, 'expect'), EXPECT_MODES, 'expect') as ExpectMode }
      : {}),
    ...(oneOf<Tier>(flag(argv, 'tier'), TIERS, 'tier')
      ? { tier: oneOf<Tier>(flag(argv, 'tier'), TIERS, 'tier') as Tier }
      : {}),
    ...(rating !== undefined ? { rating: Number(rating) } : {}),
    ...(order !== undefined ? { order: Number(order) } : {}),
  };

  let written;
  try {
    written = writeScaffold(options);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  console.log(`Created ${written.relDir}`);
  for (const file of written.files) console.log(`  ${file}`);

  const validation = validateCatalogue({ slug });
  const issues = validation.results.flatMap((result) => result.issues);
  console.log(`\nStill to do (${issues.length} from the static validator):`);
  for (const issue of issues.slice(0, 12)) {
    console.log(`  ${issue.file}${issue.jsonPath ? ` (${issue.jsonPath})` : ''}: ${issue.message}`);
  }
  if (issues.length > 12) console.log(`  ... and ${issues.length - 12} more`);

  console.log(
    [
      '',
      'Then, in order:',
      // Named explicitly because it is the one field the scaffold fills with a
      // plausible *wrong* answer rather than a TODO - `patterns` is a closed
      // enum, and a placeholder there would make meta.json unparseable (P6-1).
      '  0. Set `patterns` in meta.json from docs/CURRICULUM.md; the scaffold guesses "one pass".',
      '  1. Write the statement, samples and both references (docs/AUTHORING.md).',
      `  2. npm run problems:gen ${slug}          # hidden tests, reference as oracle`,
      `  3. npm run problems:validate ${slug}     # the merge gate`,
    ].join('\n'),
  );
}

main();
