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

  // The name is what the results panel labels a failing sample with, so a
  // sample without one shows as its index and says nothing. Three of the seed
  // problems had none, found by the P6-7 review pass.
  if (pool === 'samples' && !test.name?.trim()) {
    issues.push(
      error(
        file,
        'every sample needs a name; it is what the results panel labels it with',
        testPath(pool, index, 'name'),
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

  /*
   * A cyclic chain's two argument slots have to be there and have to be
   * numbers (ROADMAP P2-15).
   *
   * The harness consumes the cycle index while building the chain, so a test
   * that omits it, or puts a string where the index goes, fails inside the
   * harness as a runtime error - which reads as the *solution's* fault. Said
   * here instead, where it is the problem author's.
   */
  if (pkg.meta.mode === 'function' && pkg.meta.cycle) {
    const { chain, at } = pkg.meta.cycle;
    const needed = Math.max(chain, at) + 1;
    for (const [pool, tests] of [
      ['samples', samples],
      ['hidden', hidden],
    ] as const) {
      tests.forEach((test, index) => {
        if (test.args.length < needed) {
          issues.push(
            error(
              file,
              `a cyclic chain needs ${String(needed)} argument(s): the values at [${String(chain)}] and the cycle index at [${String(at)}]`,
              testPath(pool, index, 'args'),
            ),
          );
          return;
        }
        const values = test.args[chain];
        const position = test.args[at];
        if (!Array.isArray(values)) {
          issues.push(
            error(
              file,
              `args[${String(chain)}] is the chain's values and must be an array`,
              testPath(pool, index, `args[${String(chain)}]`),
            ),
          );
        }
        if (typeof position !== 'number' || !Number.isInteger(position) || position < -1) {
          issues.push(
            error(
              file,
              `args[${String(at)}] is the cycle index and must be a whole number, or -1 for no cycle`,
              testPath(pool, index, `args[${String(at)}]`),
            ),
          );
        } else if (Array.isArray(values) && position >= values.length) {
          // The harness raises on this, so it would be found - but as a
          // runtime error on every single test rather than as one message.
          issues.push(
            error(
              file,
              `cycle index ${String(position)} is past the end of a chain of ${String(values.length)}`,
              testPath(pool, index, `args[${String(at)}]`),
            ),
          );
        }
      });
    }
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

// ---------------------------------------------------------------------------
// Rules the seed catalogue taught us (ROADMAP P6-0)
// ---------------------------------------------------------------------------

/** Rungs the ladder expects: nudge, concept, approach, pseudocode. */
const EXPECTED_HINT_RUNGS = 4;

/**
 * `tests.json` past this is a file nobody can review in a diff.
 *
 * Two megabytes rather than a tighter figure, because D21 asks for a case at
 * the stated maximum and one array of 10^5 integers is about a megabyte of
 * JSON on its own. Past two, something other than "one big case" is going on -
 * usually two hundred small ones that prove the same thing.
 */
const MAX_TESTS_BYTES = 2 * 1024 * 1024;

/** `<= 10^5`, `≤ 100000`, `up to 10^5` - a bound as a statement writes one. */
const STATED_BOUND = /(?:<=|≤|up to|at most)\s*`?\s*(?:10\^(\d+)|10\*\*(\d+)|([\d][\d_,]*))/i;

/**
 * Names that mean "how much input", as opposed to "how big a value".
 *
 * The distinction is the whole check: `-10^9 <= values[i] <= 10^9` bounds the
 * numbers, and a problem is not expected to test a billion of anything because
 * of it. `values.length <= 10^5` bounds the work, and that is the claim D21 is
 * about.
 */
const SIZE_NAMES =
  /\b(?:n|m|k|q|len|length|size|count|calls|operations|words|rows|cols)\b|\.length/i;

/** A constraint line about the *contents* of the input rather than its size. */
const ELEMENT_NAMES = /\[\s*i\s*\]|\[\s*j\s*\]|\bvalue\b|\bvalues\[|\btarget\b|\bnums\[/i;

/**
 * The largest input any test actually carries, as a count.
 *
 * Lengths and call counts, and - under one careful condition - the magnitude of
 * a scalar argument. Magnitude is deliberately *not* counted in general: that is
 * a different claim, and the reason an earlier version of this check flagged
 * every problem with a `10^9` value range (P6-0).
 *
 * The condition is `bound`. Some problems carry their size in a plain integer
 * rather than in an array - `combinations-of-k` takes `n` and `k` and builds its
 * own data, `generate-brackets` takes a count of pairs - and for those this
 * function saw nothing but scalars and reported 0, so the check fired on every
 * one of them however large the input really was. Counting a scalar only when it
 * is a non-negative integer no larger than the stated bound keeps that from
 * re-opening the value-range hole: a `target` of `10^6` cannot satisfy a size
 * bound of `10^4`, because it exceeds it (P6-5).
 */
function largestInputSize(tests: readonly TestCase[], bound: number | null = null): number {
  let largest = 0;

  const consider = (value: JsonValue): void => {
    if (Array.isArray(value)) {
      largest = Math.max(largest, value.length);
      for (const entry of value) consider(entry);
    } else if (typeof value === 'string') {
      largest = Math.max(largest, value.length);
    } else if (
      bound !== null &&
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= bound
    ) {
      largest = Math.max(largest, value);
    }
  };

  for (const test of tests) {
    for (const arg of test.args) consider(arg);
    // In operations mode the constructor usually takes nothing, and the size of
    // the problem is the sequence: how many calls, and what is in them.
    if (test.ops) {
      largest = Math.max(largest, test.ops.length);
      for (const op of test.ops) {
        for (const arg of op.args ?? []) consider(arg);
      }
    }
  }

  return largest;
}

/** The biggest size bound the Constraints section claims, or null. */
function statedSizeBound(statement: string): number | null {
  const afterHeading = statement.split(/^##\s+Constraints\s*$/m)[1];
  if (afterHeading === undefined) return null;

  const section = afterHeading.split(/^##\s/m)[0] ?? '';
  let largest: number | null = null;

  for (const line of section.split('\n')) {
    if (!SIZE_NAMES.test(line) || ELEMENT_NAMES.test(line)) continue;

    const match = STATED_BOUND.exec(line);
    if (!match) continue;

    const [, power, doubleStarPower, literal] = match;
    const value =
      power !== undefined
        ? 10 ** Number(power)
        : doubleStarPower !== undefined
          ? 10 ** Number(doubleStarPower)
          : Number((literal ?? '').replace(/[_,]/g, ''));

    if (Number.isFinite(value) && value > 1 && (largest === null || value > largest)) {
      largest = value;
    }
  }

  return largest;
}

/**
 * A stated constraint is a tested constraint (D21, ROADMAP P6-0).
 *
 * Three seed problems claimed 10^5 and generated a thousand, so the quadratic
 * solution their own editorials said would time out passed comfortably - and
 * Solved stopped meaning what the statement claims. A warning rather than an
 * error: the honest fix is sometimes to lower the constraint, and a validator
 * that refused to run until someone had rewritten a generator would be a
 * validator people stop running.
 */
function checkStatedConstraints(pkg: ProblemPackage): ValidationIssue[] {
  const bound = statedSizeBound(pkg.statement);
  if (bound === null) return [];

  const largest = largestInputSize(pkg.tests.hidden, bound);
  if (largest >= bound / 2) return [];

  return [
    warning(
      relFile(pkg.location, 'tests.json'),
      `the statement allows up to ${String(bound)} but the largest hidden input is ${String(largest)}; ` +
        'generate at the stated maximum or lower the constraint (D21)',
      'hidden',
    ),
  ];
}

/**
 * The hint ladder is four rungs, and none of them is the answer (P6-0).
 *
 * Rung 4 was the full solution in about half the seed catalogue - one case was
 * the reference's own line - which makes the ladder a formality and the
 * editorial redundant. Detected by looking for what only a solution has: the
 * language's own keywords in the shape of code.
 */
const CODE_IN_HINT: [RegExp, string][] = [
  [/```/, 'a fenced code block'],
  [/\blambda\b/, 'a lambda'],
  [/\.[A-Za-z_]\w*\s*\(/, 'a method call'],
  [/[A-Za-z_]\w*\s*\[[^\]]*\]\s*=/, 'an assignment to an element'],
  [/[A-Za-z_]\w*\s*\([^)]*=[^)=]*\)/, 'a call with named arguments'],
  [/\b(?:for|while|if)\s*\(/, 'a control structure'],
  [/\b(?:def|class)\s+[A-Za-z_]/, 'a declaration'],
  [/;\s*$/m, 'a statement terminator'],
  [/=>|->/, 'an arrow function'],
];

function checkHints(pkg: ProblemPackage): ValidationIssue[] {
  const file = relFile(pkg.location, 'hints.json');
  const issues: ValidationIssue[] = [];
  const { hints } = pkg.hints;

  if (hints.length !== EXPECTED_HINT_RUNGS) {
    issues.push(
      warning(
        file,
        `has ${hints.length} rung(s); the ladder is ${EXPECTED_HINT_RUNGS} (nudge, concept, approach, pseudocode)`,
        'hints',
      ),
    );
  }

  hints.forEach((hint, index) => {
    // Structural markers rather than English keywords: an earlier version
    // matched `\bfor\b.*:` and flagged "being asked for: how often each value
    // occurs", which is a sentence.
    const found = CODE_IN_HINT.find(([pattern]) => pattern.test(hint));
    if (found) {
      issues.push(
        error(
          file,
          `a hint must not contain code (found ${found[1]}); the editorial is where the solution lives`,
          `hints[${String(index)}]`,
        ),
      );
    }
  });

  return issues;
}

/**
 * `Input:` and `Output:` on their own lines (P6-0).
 *
 * Every seed statement joined them with a single newline, which markdown
 * renders as one paragraph - "Input: nums = [1, 2] Output: [0, 1]" - so every
 * example in the catalogue read as a run-on sentence. The scaffold did it too,
 * which is how all twenty got it.
 */
const RUN_ON_EXAMPLE = /^Input:.*\n(?!\n)(?=Output:)/gim;

function checkExampleLayout(pkg: ProblemPackage): ValidationIssue[] {
  const count = pkg.statement.match(RUN_ON_EXAMPLE)?.length ?? 0;
  if (count === 0) return [];

  return [
    error(
      relFile(pkg.location, 'statement.md'),
      `${String(count)} example(s) put Input and Output in one paragraph; separate them with a blank line`,
    ),
  ];
}

/** The editorial is the one file a user reads instead of thinking (P6-0). */
const EDITORIAL_SECTIONS = ['## Approach', '## Complexity'];

function checkEditorial(pkg: ProblemPackage): ValidationIssue[] {
  const file = relFile(pkg.location, 'editorial.md');

  return EDITORIAL_SECTIONS.filter((heading) => !pkg.editorial.includes(heading)).map((heading) =>
    error(file, `missing required section "${heading}"`),
  );
}

/**
 * A sample is not a hidden test (P6-0).
 *
 * `pair-sum-index` had its three samples copied into `hidden[]`, so Submit ran
 * them twice and the hidden count was three higher than the number of cases
 * anyone had actually generated.
 */
function checkNoDuplicateTests(pkg: ProblemPackage): ValidationIssue[] {
  const file = relFile(pkg.location, 'tests.json');

  // Args *and* ops: in operations mode the constructor arguments are usually
  // empty, so args alone would call every test in a design problem a duplicate
  // of the first sample.
  const identity = (test: TestCase): string => JSON.stringify([test.args, test.ops ?? []]);
  const samples = new Set(pkg.tests.samples.map(identity));

  const duplicated = pkg.tests.hidden
    .map((test, index) => ({ index, key: identity(test) }))
    .filter((entry) => samples.has(entry.key));

  return duplicated.map((entry) =>
    error(
      file,
      'this hidden test has the same arguments as a sample, so Submit runs it twice',
      testPath('hidden', entry.index, 'args'),
    ),
  );
}

/** Every `ops[].method` has to exist in both starters (P6-0). */
function checkOpsMethods(pkg: ProblemPackage): ValidationIssue[] {
  if (pkg.meta.mode !== 'operations') return [];

  const file = relFile(pkg.location, 'tests.json');
  const named = new Set(
    [...pkg.tests.samples, ...pkg.tests.hidden].flatMap((test) =>
      (test.ops ?? []).map((op) => op.method),
    ),
  );

  return [...named].flatMap((method) => {
    const inPython = new RegExp(`\\bdef\\s+${method}\\s*\\(`).test(pkg.sources.starterPython);
    const inJava = new RegExp(`\\b${method}\\s*\\(`).test(pkg.sources.starterJava);
    if (inPython && inJava) return [];

    const missing = [!inPython && 'starter.py', !inJava && 'starter.java'].filter(Boolean);
    return [
      error(
        file,
        `tests call "${method}", which ${missing.join(' and ')} does not declare; the harness would fail every test`,
        'samples',
      ),
    ];
  });
}

/** A `tests.json` too big to review is a file nobody reads (P6-0). */
function checkTestsSize(pkg: ProblemPackage): ValidationIssue[] {
  const bytes = Buffer.byteLength(JSON.stringify(pkg.tests), 'utf8');
  if (bytes <= MAX_TESTS_BYTES) return [];

  return [
    warning(
      relFile(pkg.location, 'tests.json'),
      `is ${String(Math.round(bytes / 1024))} KB; past ${String(MAX_TESTS_BYTES / 1024)} KB a diff is unreviewable - ` +
        'generate fewer, larger cases rather than more of them',
    ),
  ];
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
    // The rules the seed catalogue taught us (P6-0). Each one is a defect that
    // shipped in twenty problems before anybody looked.
    ...checkStatedConstraints(pkg),
    ...checkHints(pkg),
    ...checkExampleLayout(pkg),
    ...checkEditorial(pkg),
    ...checkNoDuplicateTests(pkg),
    ...checkOpsMethods(pkg),
    ...checkTestsSize(pkg),
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
  /** `topic:order`, which has to name one problem (ROADMAP P6-1). */
  const byOrder = new Map<string, string[]>();

  for (const result of results) {
    if (!result.pkg) continue;
    const { meta, location } = result.pkg;
    byId.set(meta.id, [...(byId.get(meta.id) ?? []), location.relDir]);
    bySlug.set(meta.slug, [...(bySlug.get(meta.slug) ?? []), location.relDir]);
    knownSlugs.add(meta.slug);

    const key = `${meta.topic}:${String(meta.order)}`;
    byOrder.set(key, [...(byOrder.get(key) ?? []), location.relDir]);
  }

  /*
   * `order` is the learning path (D8), and a tie in it is decided by slug -
   * which is to say alphabetically, which is to say by accident. With twenty
   * problems that is a curiosity; with two hundred it is the difference
   * between a path and a list.
   */
  for (const [key, dirs] of byOrder) {
    if (dirs.length > 1) {
      const [topic, order] = key.split(':');
      issues.push(
        error(
          `${dirs[0]}/meta.json`,
          `order ${String(order)} in ${String(topic)} is also used by ${dirs.slice(1).join(', ')}; ` +
            'ties are broken by slug, which is not an order anyone chose',
          'order',
        ),
      );
    }
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

export interface FullValidateOptions extends ValidateOptions, ReferenceCheckOptions {
  /**
   * Only run the references for these slugs (D23, ROADMAP P2-14).
   *
   * `undefined` means all of them. The static rules always cover the whole
   * catalogue either way - they are milliseconds, and they are where the
   * cross-problem rules live.
   */
  slugs?: readonly string[];
}

/**
 * Static validation plus the merge gate: both reference solutions must pass
 * every one of the problem's own tests, in both languages, and both starters
 * must be compilable programs.
 *
 * A problem whose static structure is already broken is skipped rather than run:
 * spawning six interpreters to confirm that a package missing its tests.json
 * does not work would just bury the real message.
 */
/**
 * How many problems have their references run at once (ROADMAP P2-14).
 *
 * Each problem is two compiles and two runs, and they are serial today: 1.7
 * seconds each, 34 for the seed, six minutes at two hundred on every push and
 * on two operating systems. Four at a time is the number the judge's own queue
 * defaults near, and it keeps timings meaningful - a machine running eight JVMs
 * reports times that say more about the machine than about the solution, and
 * the reference check reads those times.
 */
const REFERENCE_CONCURRENCY = 4;

/** Runs `worker` over `items`, `limit` at a time, keeping input order. */
async function inParallel<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      out[index] = await worker(items[index]!);
    }
  });

  await Promise.all(runners);
  return out;
}

export async function validateCatalogueFull(
  options: FullValidateOptions = {},
): Promise<CatalogueValidation> {
  const staticReport = validateCatalogue(options);

  /*
   * `slugs` narrows the reference runs and nothing else (D23, P2-14).
   *
   * The static rules still cover the whole catalogue, including the
   * cross-problem ones an incremental run cannot see from a diff: a duplicate
   * id, a dangling `related`, two problems claiming one `order`.
   */
  const only = options.slugs ? new Set(options.slugs) : null;

  const results: ProblemValidation[] = await inParallel(
    staticReport.results,
    REFERENCE_CONCURRENCY,
    async (result) => {
      if (only !== null && !only.has(result.location.slugDir)) return result;
      if (!result.pkg || hasErrors(result.issues)) return result;
      const referenceIssues = await checkReferences(result.pkg, options);
      return { ...result, issues: [...result.issues, ...referenceIssues] };
    },
  );

  const everything = [...results.flatMap((r) => r.issues), ...staticReport.crossIssues];
  return {
    results,
    crossIssues: staticReport.crossIssues,
    errorCount: everything.filter((i) => i.severity === 'error').length,
    warningCount: everything.filter((i) => i.severity === 'warning').length,
    ok: !hasErrors(everything),
  };
}
