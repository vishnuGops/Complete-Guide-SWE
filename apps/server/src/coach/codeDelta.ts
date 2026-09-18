/**
 * What changed since the last time the coach looked (ROADMAP P5-5).
 *
 * P5-3 already carried past feedback into the prompt, which stops the coach
 * repeating a point it has made. This is the other half: without knowing what
 * the user actually changed, the second review is written as though it were the
 * first, and "you fixed the complement lookup, now handle the empty case" is
 * not something it can say.
 *
 * A diff rather than the previous file verbatim. Sending both versions would let
 * the model work it out itself, but it costs roughly the size of the solution in
 * tokens on every request, and none of it is cacheable - the volatile half of
 * the prompt is exactly the part `cache_control` cannot cover (D12). The diff is
 * usually a few lines.
 */

export interface CodeDelta {
  added: string[];
  removed: string[];
  /** True when the two versions are identical after trimming. */
  unchanged: boolean;
}

/**
 * Longest common subsequence over lines, the usual diff core.
 *
 * Lines rather than characters, because the output is read by a model that
 * thinks in statements; a character diff of renamed variables would be noise.
 * Quadratic in the number of lines, which is fine for a solution to an
 * interview problem and is bounded below in any case.
 */
function lcsTable(a: readonly string[], b: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  return table;
}

/** Lines that are not blank after trimming; blank-line churn is not a change. */
function meaningfulLines(code: string): string[] {
  return code
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');
}

/** How many changed lines are worth naming before the point is made. */
const MAX_LINES = 20;

export function diffCode(before: string, after: string): CodeDelta {
  const a = meaningfulLines(before);
  const b = meaningfulLines(after);
  const table = lcsTable(a, b);

  const added: string[] = [];
  const removed: string[] = [];

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      removed.push(a[i]!);
      i += 1;
    } else {
      added.push(b[j]!);
      j += 1;
    }
  }
  while (i < a.length) removed.push(a[i++]!);
  while (j < b.length) added.push(b[j++]!);

  return {
    added: added.slice(0, MAX_LINES),
    removed: removed.slice(0, MAX_LINES),
    unchanged: added.length === 0 && removed.length === 0,
  };
}

/**
 * The delta as the prompt sees it.
 *
 * "Unchanged" is stated rather than omitted, and it is the most useful thing
 * this function produces: someone who asks twice without editing anything is
 * stuck, and a coach told so can say something different instead of rephrasing
 * the advice they have already read and not acted on.
 */
export function describeDelta(delta: CodeDelta): string {
  if (delta.unchanged) {
    return 'The code has not changed since that feedback. They may be stuck on it - try a different angle rather than restating it.';
  }

  const lines: string[] = ['Changed since that feedback:'];
  for (const line of delta.removed) lines.push(`  - ${line.trim()}`);
  for (const line of delta.added) lines.push(`  + ${line.trim()}`);
  return lines.join('\n');
}
