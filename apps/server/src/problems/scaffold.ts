import fs from 'node:fs';
import path from 'node:path';
import {
  TIER_RATING_RANGE,
  type ExpectMode,
  type Tier,
  type TestMode,
  type Topic,
} from '@devpromax/shared';
import { paths } from '../config.js';

/**
 * Scaffolding a problem package (ROADMAP P2-9).
 *
 * What this writes is a package that **parses** but is deliberately not yet
 * valid: the samples are placeholders and `hidden` is empty, so
 * `problems:validate --static` immediately lists exactly what an author still
 * owes. A scaffold that passed validation would be a scaffold you could forget
 * to finish.
 *
 * The file contents are produced as data rather than written directly, so the
 * tests can check what a scaffold contains - and check that a filled-in one
 * passes the validator - without a directory full of fixtures.
 */

export interface ScaffoldOptions {
  topic: Topic;
  slug: string;
  title?: string;
  mode: TestMode;
  /** Method name in `function` mode, class name in `operations` mode. */
  entry?: string;
  expect?: ExpectMode;
  tier?: Tier;
  rating?: number;
  order?: number;
}

export interface ScaffoldFile {
  /** Path relative to the problem directory; may contain a subdirectory. */
  name: string;
  contents: string;
}

const SAMPLE_COUNT = 3;

function words(slug: string): string[] {
  return slug.split('-').filter(Boolean);
}

export function titleFromSlug(slug: string): string {
  return words(slug)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function camelFromSlug(slug: string): string {
  const [first = 'solve', ...rest] = words(slug);
  return first + rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

export function pascalFromSlug(slug: string): string {
  return words(slug)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/** Middle of the tier's band, so the rating is at least in the right place. */
function defaultRating(tier: Tier): number {
  const [low, high] = TIER_RATING_RANGE[tier];
  return Math.round((low + high) / 2);
}

interface Resolved extends Required<Omit<ScaffoldOptions, 'title' | 'entry'>> {
  title: string;
  entry: string;
}

export function resolveOptions(options: ScaffoldOptions): Resolved {
  const tier = options.tier ?? 'Easy';
  const mode = options.mode;
  return {
    topic: options.topic,
    slug: options.slug,
    title: options.title ?? titleFromSlug(options.slug),
    mode,
    // `operations` problems are judged on a sequence of return values, so the
    // schema allows only `return` there (P0-7); taking the flag anyway and
    // ignoring it would be a silent lie.
    expect: mode === 'operations' ? 'return' : (options.expect ?? 'return'),
    entry:
      options.entry ??
      (mode === 'operations' ? pascalFromSlug(options.slug) : camelFromSlug(options.slug)),
    tier,
    rating: options.rating ?? defaultRating(tier),
    order: options.order ?? 0,
  };
}

// ---------------------------------------------------------------------------
// File bodies
// ---------------------------------------------------------------------------

function metaJson(o: Resolved): string {
  return `${JSON.stringify(
    {
      $schema: '../../../docs/schema/meta.schema.json',
      id: o.slug,
      slug: o.slug,
      title: o.title,
      version: 1,
      topic: o.topic,
      patterns: ['TODO: the pattern this teaches'],
      tier: o.tier,
      rating: o.rating,
      order: o.order,
      mode: o.mode,
      entry: o.entry,
      expect: o.expect,
      comparator: 'exact',
      related: [],
      targetComplexity: { time: 'TODO', space: 'TODO' },
    },
    null,
    2,
  )}\n`;
}

function sampleCase(o: Resolved, index: number): Record<string, unknown> {
  if (o.mode === 'operations') {
    return {
      name: `TODO: what sample ${index + 1} exercises`,
      args: [],
      ops: [{ method: 'TODO', args: [] }],
      expected: [null],
      explanation: 'TODO: why this is the answer. Shown in the statement.',
    };
  }

  const test: Record<string, unknown> = {
    name: `TODO: what sample ${index + 1} exercises`,
    args: ['TODO: one entry per argument'],
    explanation: 'TODO: why this is the answer. Shown in the statement.',
  };
  if (o.expect === 'return' || o.expect === 'both') test['expected'] = null;
  if (o.expect === 'mutatedArgs' || o.expect === 'both') {
    test['expectedMutatedArgs'] = [{ index: 0, value: null }];
  }
  return test;
}

function testsJson(o: Resolved): string {
  return `${JSON.stringify(
    {
      $schema: '../../../docs/schema/tests.schema.json',
      samples: Array.from({ length: SAMPLE_COUNT }, (_, i) => sampleCase(o, i)),
      // Left empty on purpose: `npm run problems:gen <slug>` fills this from
      // generator.py with the reference as the oracle.
      hidden: [],
    },
    null,
    2,
  )}\n`;
}

function hintsJson(): string {
  return `${JSON.stringify(
    {
      hints: [
        'TODO: a nudge — what to notice about the input.',
        'TODO: the concept or data structure this needs.',
        'TODO: the approach, still without code.',
        'TODO: the shape of the loop or recursion.',
      ],
    },
    null,
    2,
  )}\n`;
}

function statementMd(o: Resolved): string {
  const examples = Array.from(
    { length: SAMPLE_COUNT },
    (_, i) =>
      `### Example ${i + 1}\n\n` +
      // A blank line between them, or markdown renders "Input: ... Output: ..."
      // as one run-on paragraph - which is how all twenty seed statements got
      // it wrong (ROADMAP P6-0).
      'Input: `TODO`\n\n' +
      'Output: `TODO`\n\n' +
      'TODO: the explanation from tests.json, in prose.\n',
  ).join('\n');

  return [
    `# ${o.title}`,
    '',
    'TODO: one paragraph in your own words. Say what the input is and what to',
    'return, concretely. No copied wording from anywhere.',
    '',
    '## Input',
    '',
    '- `TODO` — describe each argument, its type and its meaning',
    '',
    '## Output',
    '',
    'TODO: exactly what to return, including what happens in the edge cases.',
    '',
    '## Constraints',
    '',
    '- `TODO: 1 <= n <= 10^5`',
    '- TODO: value ranges, and anything the tests guarantee (uniqueness, sortedness)',
    '',
    '## Examples',
    '',
    examples,
  ].join('\n');
}

function editorialMd(o: Resolved): string {
  return [
    `# ${o.title}`,
    '',
    '## Approach',
    '',
    'TODO: the idea, then why it works.',
    '',
    '## Complexity',
    '',
    '- Time: `TODO`',
    '- Space: `TODO`',
    '',
    '## Pitfalls',
    '',
    '- TODO: the mistake most people make here.',
    '',
  ].join('\n');
}

function starterPy(o: Resolved): string {
  if (o.mode === 'operations') {
    return [
      `class ${o.entry}:`,
      '    def __init__(self) -> None:',
      '        pass',
      '',
      '    def TODO(self) -> None:',
      '        pass',
      '',
    ].join('\n');
  }
  /*
   * A `mutatedArgs` problem returns nothing (ROADMAP P6-0).
   *
   * The scaffold emitted `-> int` and `return 0` whatever the expect mode was,
   * so the first thing an author of an in-place problem had to do was correct
   * the signature the tool had just written for them - and in Java a non-void
   * method whose result is ignored is an invitation to return the answer
   * instead of mutating the argument.
   */
  if (o.expect === 'mutatedArgs') {
    return [
      'from typing import List',
      '',
      '',
      'class Solution:',
      `    def ${o.entry}(self, nums: List[int]) -> None:`,
      '        # Change `nums` in place; nothing is returned.',
      '        pass',
      '',
    ].join('\n');
  }

  return [
    'from typing import List',
    '',
    '',
    'class Solution:',
    `    def ${o.entry}(self, nums: List[int]) -> int:`,
    '        pass',
    '',
  ].join('\n');
}

function referencePy(o: Resolved): string {
  const starter = starterPy(o);
  return `# The reference solution. It must pass every test in this package, and it is\n# the oracle \`problems:gen\` uses to compute expected outputs.\n${starter}`;
}

function starterJava(o: Resolved): string {
  if (o.mode === 'operations') {
    return [
      'import java.util.*;',
      '',
      `class ${o.entry} {`,
      '',
      `    ${o.entry}() {`,
      '',
      '    }',
      '',
      '    public void TODO() {',
      '',
      '    }',
      '}',
      '',
    ].join('\n');
  }
  // Void for `mutatedArgs`, for the reason `starterPy` gives (P6-0).
  const body =
    o.expect === 'mutatedArgs'
      ? [
          `    public void ${o.entry}(int[] nums) {`,
          '        // Change `nums` in place; nothing is returned.',
          '    }',
        ]
      : [`    public int ${o.entry}(int[] nums) {`, '        return 0;', '    }'];

  return ['import java.util.*;', '', 'class Solution {', '', ...body, '}', ''].join('\n');
}

function referenceJava(o: Resolved): string {
  return `// The reference solution. It must pass every test in this package.\n${starterJava(o)}`;
}

function generatorPy(o: Resolved): string {
  const body =
    o.mode === 'operations'
      ? [
          '    yield {',
          '        "args": [],',
          '        "ops": [{"method": "TODO", "args": []}],',
          '        "name": "TODO: the edge case this covers",',
          '    }',
          '',
          '    for length in (8, 40, 200):',
          '        ops: List[Dict[str, Any]] = []',
          '        for _ in range(length):',
          '            ops.append({"method": "TODO", "args": [rng.randint(-1000, 1000)]})',
          '        yield {"args": [], "ops": ops}',
        ]
      : [
          '    yield {"args": [[1]], "name": "single element"}',
          '    yield {"args": [[]], "name": "empty input"}',
          '',
          '    for n in (2, 5, 40):',
          '        yield {"args": [[rng.randint(-1000, 1000) for _ in range(n)]]}',
          '',
          '    for _ in range(4):',
          '        n = rng.randint(100, 500)',
          '        yield {"args": [[rng.randint(-(10**9), 10**9) for _ in range(n)]]}',
        ];

  return [
    `"""Random inputs for ${o.slug}.`,
    '',
    'Yields inputs only - never expected outputs. `npm run problems:gen` runs the',
    'reference over these to compute the answers, so a generator that guessed an',
    'answer would be asserting the reference is wrong.',
    '',
    'Every case must satisfy the constraints in statement.md. If the statement',
    'promises something (a unique answer, a non-empty input), generate it.',
    '"""',
    '',
    'import random',
    'from typing import Any, Dict, Iterator, List',
    '',
    '',
    'def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:',
    '    # TODO: cover the edge cases first - empty, single element, duplicates,',
    '    # negatives, the maximum size the constraints allow - then go random.',
    ...body,
    '',
  ].join('\n');
}

/** Everything a new problem directory contains, as data. */
export function scaffoldFiles(options: ScaffoldOptions): ScaffoldFile[] {
  const o = resolveOptions(options);
  return [
    { name: 'meta.json', contents: metaJson(o) },
    { name: 'statement.md', contents: statementMd(o) },
    { name: 'tests.json', contents: testsJson(o) },
    { name: 'hints.json', contents: hintsJson() },
    { name: 'editorial.md', contents: editorialMd(o) },
    { name: 'starter.py', contents: starterPy(o) },
    { name: 'reference.py', contents: referencePy(o) },
    { name: 'starter.java', contents: starterJava(o) },
    { name: 'reference.java', contents: referenceJava(o) },
    { name: 'generator.py', contents: generatorPy(o) },
  ];
}

export interface ScaffoldResult {
  dir: string;
  relDir: string;
  files: string[];
}

/** Writes the scaffold. Refuses to touch a directory that already exists. */
export function writeScaffold(
  options: ScaffoldOptions,
  root: string = paths.problems,
): ScaffoldResult {
  const dir = path.join(root, options.topic, options.slug);
  if (fs.existsSync(dir)) {
    throw new Error(`${path.relative(process.cwd(), dir)} already exists`);
  }

  const files = scaffoldFiles(options);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const full = path.join(dir, file.name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, file.contents, 'utf8');
  }

  return {
    dir,
    relDir: path.posix.join('problems', options.topic, options.slug),
    files: files.map((file) => file.name),
  };
}
