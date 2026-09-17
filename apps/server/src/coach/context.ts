import {
  VERDICT_LABEL,
  type CoachFeedback,
  type Language,
  type ProblemMeta,
  type RunResult,
  type TestResult,
} from '@devpromax/shared';

/**
 * Building the user turn the coach reads (ROADMAP P5-2, D13).
 *
 * D13 fixes what the coach receives: statement, constraints, target complexity,
 * the editorial approach flagged as secret, the user's code, the latest judge
 * results, revealed hints and a summary of prior attempts. This file assembles
 * exactly that, in a fixed order, and decides what to drop when it does not fit.
 *
 * Two rules shape the whole file:
 *
 *   1. **Order is by importance, not by convenience.** Truncation cuts from the
 *      bottom, so the sections are arranged so that the first thing to go is the
 *      thing the coach can most afford to lose.
 *   2. **The user's code is never truncated.** It is the one input the entire
 *      answer is about; a review of the first half of a function is worse than
 *      no review, because it is confidently wrong about what is missing. If the
 *      code alone is too big, that is an error, not a trim (see `buildContext`).
 */

export interface AttemptMemory {
  /** ISO timestamp of the earlier feedback. */
  at: string;
  feedback: CoachFeedback;
}

export interface ContextInput {
  meta: ProblemMeta;
  statement: string;
  /** Flagged as secret in the prompt; the coach steers by it but must not quote it. */
  editorial: string;
  language: Language;
  code: string;
  /** The most recent Run or Submit, when there has been one this session. */
  lastRun?: RunResult;
  /** Hint rungs the user has already read, in order. The coach must start above them. */
  revealedHints?: readonly string[];
  /** Earlier coach turns on this problem, newest first (P5-5). */
  priorAttempts?: readonly AttemptMemory[];
  masteryCheck?: boolean;
  requestFullSolution?: boolean;
  /** Whether the problem is already solved, which gates the `solution` rung. */
  solved?: boolean;
}

/**
 * The budget, in characters rather than tokens.
 *
 * Counting real tokens would mean a tokeniser per vendor, and the two disagree;
 * this number only has to be conservative enough that the request fits with room
 * for the answer, and characters are something both vendors' limits are safely
 * larger than. Four characters per token is the usual rough ratio for English
 * and code, so this is on the order of 30k tokens - comfortable inside both
 * vendors' context windows while leaving the model room to write.
 */
export const CONTEXT_BUDGET_CHARS = 120_000;

/** Past this, a "statement" is a document and the coach does not need all of it. */
const STATEMENT_CAP = 8_000;
const EDITORIAL_CAP = 4_000;

/** How many failing tests are worth showing. Beyond a few they repeat themselves. */
const MAX_FAILURES_SHOWN = 3;

/** One test's revealed values, capped: a hidden test can be 100k integers. */
const VALUE_CAP = 600;

/** Prior attempts are summaries already; this bounds how many, not how long. */
const MAX_PRIOR_ATTEMPTS = 3;

function truncate(text: string, cap: number, note = 'truncated'): string {
  const trimmed = text.trim();
  if (trimmed.length <= cap) return trimmed;
  return `${trimmed.slice(0, cap)}\n\n[... ${note}, ${trimmed.length - cap} characters omitted]`;
}

function renderValue(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return truncate(text, VALUE_CAP, 'value truncated');
}

/**
 * The judge's verdict, as much of it as helps.
 *
 * Failures are what the coach needs; passing tests are noise. A compile error
 * outranks everything else, because when the code did not build, nothing else
 * in the result means anything.
 */
function renderRun(run: RunResult): string {
  const lines: string[] = [
    `Verdict: ${VERDICT_LABEL[run.verdict]} (${run.verdict}) on ${run.kind === 'submit' ? 'Submit' : 'Run'}`,
    `Tests passed: ${run.passed}/${run.total}`,
  ];

  if (run.verdict === 'CE' && run.compileErrors.length > 0) {
    lines.push('', 'Compile errors:');
    for (const error of run.compileErrors.slice(0, 5)) {
      lines.push(`  line ${error.line}: ${error.message}`);
    }
    return lines.join('\n');
  }

  const failures = run.tests.filter((test) => test.verdict !== 'AC');
  if (failures.length === 0) return lines.join('\n');

  lines.push('', `Failing tests (${failures.length}, showing up to ${MAX_FAILURES_SHOWN}):`);
  for (const test of failures.slice(0, MAX_FAILURES_SHOWN)) {
    lines.push(...renderFailure(test));
  }

  return lines.join('\n');
}

function renderFailure(test: TestResult): string[] {
  const label = test.name ?? `${test.source} test ${test.index}`;
  const lines = [``, `- ${label} — ${test.verdict} (${Math.round(test.timeMs)} ms)`];

  // Hidden tests arrive without their values unless the judge chose to reveal
  // this one (P2-6). Saying so is better than silently showing nothing, or the
  // coach will reason about an input it cannot see.
  if (!test.revealed) {
    lines.push('  (hidden test; input and expected output not revealed)');
  } else {
    if (test.input !== undefined) lines.push(`  input:    ${renderValue(test.input)}`);
    if (test.expected !== undefined) lines.push(`  expected: ${renderValue(test.expected)}`);
    if (test.actual !== undefined) lines.push(`  actual:   ${renderValue(test.actual)}`);
    if (test.expectedMutatedArgs !== undefined) {
      lines.push(`  expected args after call: ${renderValue(test.expectedMutatedArgs)}`);
      lines.push(`  actual args after call:   ${renderValue(test.actualMutatedArgs)}`);
    }
  }

  if (test.message !== undefined && test.message !== '') {
    lines.push(`  note:     ${truncate(test.message, VALUE_CAP, 'message truncated')}`);
  }
  if (test.stderr !== '') {
    lines.push(`  stderr:   ${truncate(test.stderr, VALUE_CAP, 'stderr truncated')}`);
  }

  return lines;
}

function renderPriorAttempts(attempts: readonly AttemptMemory[]): string {
  const lines = [
    'Earlier feedback on this problem, newest first. Do not repeat it; say what has changed since.',
  ];

  for (const attempt of attempts.slice(0, MAX_PRIOR_ATTEMPTS)) {
    const s = attempt.feedback.scores;
    lines.push(
      '',
      `- ${attempt.at}: ${attempt.feedback.summary}`,
      `  scores — correctness ${s.correctness}, time ${s.timeComplexity}, space ${s.spaceComplexity}, edge cases ${s.edgeCases}, readability ${s.readability}`,
    );
    if (attempt.feedback.nextStep !== undefined) {
      lines.push(`  asked them to: ${attempt.feedback.nextStep}`);
    }
  }

  return lines.join('\n');
}

interface Section {
  title: string;
  body: string;
  /** Sections are dropped lowest-priority first when the budget is exceeded. */
  droppable: boolean;
}

/**
 * Assembles the user turn.
 *
 * The order below is the truncation order in reverse: prior attempts go first
 * because the coach can still give good feedback without knowing what it said
 * last week, then the editorial, then the statement's tail. Code, constraints
 * and judge results are not droppable - without any one of them the answer would
 * be confidently wrong rather than merely less informed.
 */
export function buildContext(input: ContextInput): string {
  const sections: Section[] = [];

  sections.push({
    title: 'Problem',
    body: [
      `Title: ${input.meta.title}`,
      `Topic: ${input.meta.topic}`,
      `Difficulty: ${input.meta.tier} (rating ${input.meta.rating}/10)`,
      `Patterns: ${input.meta.patterns.join(', ')}`,
      input.meta.targetComplexity
        ? `Target complexity: time ${input.meta.targetComplexity.time}, space ${input.meta.targetComplexity.space}`
        : 'Target complexity: not specified; judge it against what this problem allows.',
    ].join('\n'),
    droppable: false,
  });

  sections.push({
    title: 'Statement',
    body: truncate(input.statement, STATEMENT_CAP, 'statement truncated'),
    droppable: false,
  });

  sections.push({
    title: `The user's code (${input.language})`,
    body: `\`\`\`${input.language}\n${input.code.trim()}\n\`\`\``,
    droppable: false,
  });

  if (input.lastRun) {
    sections.push({
      title: 'Latest judge result',
      body: renderRun(input.lastRun),
      droppable: false,
    });
  } else {
    sections.push({
      title: 'Latest judge result',
      body: 'They have not run this code yet, so there is no judge result. Do not assume it passes.',
      droppable: false,
    });
  }

  if (input.revealedHints && input.revealedHints.length > 0) {
    sections.push({
      title: 'Hints the user has already read',
      body: input.revealedHints.map((hint, i) => `${i + 1}. ${hint}`).join('\n'),
      droppable: false,
    });
  }

  // The gate the prompt's hint-ladder rules refer to. Stated as two independent
  // facts rather than one conclusion so the prompt's rule stays the thing that
  // decides, and this stays the thing that reports.
  sections.push({
    title: 'Request',
    body: [
      `Problem already solved by this user: ${input.solved ? 'yes' : 'no'}`,
      `User explicitly asked for the full solution: ${input.requestFullSolution ? 'yes' : 'no'}`,
      `This is a mastery check: ${input.masteryCheck ? 'yes' : 'no'}`,
    ].join('\n'),
    droppable: false,
  });

  sections.push({
    title: 'Editorial approach (SECRET — steer by it, never quote or mention it)',
    body: truncate(input.editorial, EDITORIAL_CAP, 'editorial truncated'),
    droppable: true,
  });

  if (input.priorAttempts && input.priorAttempts.length > 0) {
    sections.push({
      title: 'Prior coaching on this problem',
      body: renderPriorAttempts(input.priorAttempts),
      droppable: true,
    });
  }

  return fitToBudget(sections);
}

function render(sections: readonly Section[]): string {
  return sections.map((s) => `## ${s.title}\n\n${s.body}`).join('\n\n');
}

/**
 * Drops droppable sections, lowest priority last-in-first-out, until it fits.
 *
 * If it still does not fit after everything droppable is gone, the request goes
 * out oversized rather than being silently mangled: the remaining sections are
 * the ones whose absence would make the answer wrong, and a provider rejecting
 * an over-long request is a clear failure the user can be told about, where a
 * half-sent statement is a subtly bad answer they cannot detect.
 */
function fitToBudget(sections: Section[]): string {
  const kept = [...sections];

  while (render(kept).length > CONTEXT_BUDGET_CHARS) {
    const index = kept.map((s) => s.droppable).lastIndexOf(true);
    if (index === -1) break;
    kept.splice(index, 1);
  }

  return render(kept);
}
