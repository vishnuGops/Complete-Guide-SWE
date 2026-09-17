import type { CoachSkipReason, Language } from '@devpromax/shared';

/**
 * The local pre-check (ROADMAP D13, P5-3).
 *
 * Before any request is made, two questions are answered here for free: is this
 * still the starter we handed them, and is there a solution body at all? Both
 * mean the same thing for the user - there is nothing to review yet - and
 * sending either to a provider spends money to be told so.
 *
 * Everything below is a **heuristic**, and deliberately a conservative one. It
 * is not a parser and must never be mistaken for one: getting this wrong in the
 * strict direction refuses to review real work, which is much worse than
 * occasionally paying for a review of a nearly-empty file. So every rule here is
 * written to say "no meaningful code" only when it is quite sure.
 */

export interface PrecheckInput {
  code: string;
  starter: string;
  language: Language;
}

/** `null` when the request is worth making. */
export type PrecheckResult = Extract<
  CoachSkipReason,
  'unchanged_starter' | 'no_meaningful_code'
> | null;

/**
 * Strips comments and string literals.
 *
 * String literals go because a docstring is a comment wearing a different hat,
 * and because a `#` inside a string would otherwise truncate a real line. They
 * are replaced with an empty quote pair rather than deleted so that a line that
 * was only a string assignment still looks like a statement.
 *
 * Walking character by character rather than running regexes matters: a regex
 * for `#.*$` removes the tail of `s = "#1"`, and a regex for quotes cannot see
 * that the quote in `"it\"s"` is escaped.
 */
function stripCommentsAndStrings(code: string, language: Language): string {
  const out: string[] = [];
  let i = 0;

  const isPython = language === 'python';

  while (i < code.length) {
    const ch = code[i]!;
    const next = code[i + 1];

    // Line comment.
    if ((isPython && ch === '#') || (!isPython && ch === '/' && next === '/')) {
      while (i < code.length && code[i] !== '\n') i += 1;
      continue;
    }

    // Block comment (Java only).
    if (!isPython && ch === '/' && next === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }

    // Triple-quoted string (Python docstrings, and Java text blocks).
    const triple = code.slice(i, i + 3);
    if (triple === '"""' || triple === "'''") {
      i += 3;
      while (i < code.length && code.slice(i, i + 3) !== triple) i += 1;
      i += 3;
      out.push('""');
      continue;
    }

    // Ordinary string.
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < code.length && code[i] !== quote) {
        // A backslash escapes the next character, including the quote.
        i += code[i] === '\\' ? 2 : 1;
      }
      i += 1;
      out.push('""');
      continue;
    }

    out.push(ch);
    i += 1;
  }

  return out.join('');
}

/**
 * The comparable form of a file: no comments, no blank lines, no indentation
 * differences, no trailing whitespace.
 *
 * Indentation is collapsed rather than preserved because the question this
 * answers is "has anything been written", not "is this valid Python". Someone
 * who has only re-indented the starter has not written anything.
 */
export function normalise(code: string, language: Language): string {
  return stripCommentsAndStrings(code, language)
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * Lines that are scaffolding rather than a solution.
 *
 * Kept deliberately narrow: only the shapes our own starters actually contain,
 * plus the placeholder bodies a person leaves behind when they have not started.
 * A line this does not recognise counts as real code, which is the safe way for
 * the list to be incomplete.
 */
const STRUCTURAL = [
  /^(from|import)\b/,
  /^(public|private|protected)?\s*(final\s+)?class\b/,
  /^def\s/,
  /^(public|private|protected|static|final|\s)*[\w<>[\],\s]+\s+\w+\s*\(.*\)\s*\{?$/,
  /^[{}]$/,
  /^@\w+/,
];

const NO_OP_BODY = [
  /^pass$/,
  /^\.\.\.$/,
  /^return$/,
  /^return (None|null|true|false|0|-1|""|''|\[\]|\{\}|new int\[0\])\s*;?$/,
  /^throw new UnsupportedOperationException\(.*\)\s*;?$/,
  /^TODO\b/i,
];

/**
 * Splits normalised code into statement-sized units.
 *
 * A line is the wrong unit: `int f() { return -1; }` is an untouched starter
 * body written on one line, and judged whole it looks like code. Java is split
 * on braces and semicolons, which turns that into a signature and a `return -1`
 * the placeholder list recognises.
 *
 * Python is split on semicolons only. Splitting it on braces would break
 * `seen = {}` into pieces and, worse, make `d = {1: 2}` look like two
 * statements - and Python's block structure is the indentation this has already
 * thrown away, so there is nothing for brace-splitting to gain.
 */
function statements(code: string, language: Language): string[] {
  const separator = language === 'java' ? /[;{}]/ : /;/;
  return normalise(code, language)
    .split('\n')
    .flatMap((line) => line.split(separator))
    .map((unit) => unit.trim())
    .filter((unit) => unit !== '');
}

/**
 * Whether anything here is an attempt at the problem.
 *
 * Structural units are dropped, then what remains is checked against the
 * placeholder bodies. If every remaining unit is a placeholder - or nothing
 * remains at all, which is what a file of pure comments normalises to - there is
 * nothing to review.
 */
export function hasMeaningfulBody(code: string, language: Language): boolean {
  const units = statements(code, language).filter(
    (unit) => !STRUCTURAL.some((pattern) => pattern.test(unit)),
  );

  if (units.length === 0) return false;
  return !units.every((unit) => NO_OP_BODY.some((pattern) => pattern.test(unit)));
}

/**
 * Whether the editor still holds the starter we gave them.
 *
 * Compared after normalisation, so deleting the guidance comments or
 * re-indenting does not count as writing a solution.
 */
export function isUnchangedStarter(code: string, starter: string, language: Language): boolean {
  return normalise(code, language) === normalise(starter, language);
}

/**
 * The reason to refuse, or `null` to go ahead.
 *
 * Order matters for the message the user gets. Someone who has not touched the
 * starter is told "write some code first", which is true and actionable;
 * telling them instead that their code has no meaningful body reads as a
 * judgement on work they have not done yet.
 */
export function precheck({ code, starter, language }: PrecheckInput): PrecheckResult {
  if (code.trim() === '') return 'no_meaningful_code';
  if (isUnchangedStarter(code, starter, language)) return 'unchanged_starter';
  if (!hasMeaningfulBody(code, language)) return 'no_meaningful_code';
  return null;
}
