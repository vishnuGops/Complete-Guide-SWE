/**
 * A line diff, used by the editorial's "compare with my code" (ROADMAP P7-2)
 * and by restoring an old submission (P7-3).
 *
 * Hand-written rather than a dependency, for the same reason the SQL is (D8):
 * this is forty lines of a textbook algorithm over two files of code that a
 * person wrote by hand, and a package would bring word-level diffing, patch
 * parsing and a renderer that none of this needs.
 *
 * It diffs whole lines. Character-level marking inside a changed line is a real
 * improvement and deliberately not here: the thing being compared is a solution
 * against another solution, where the interesting differences are structural -
 * a loop that is not there, a map that is a list - and a row of highlighted
 * characters inside a line that was rewritten says nothing useful.
 */

export type DiffKind = 'same' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffKind;
  text: string;
  /** 1-based line number in the left-hand text, or null for an added line. */
  before: number | null;
  /** 1-based line number in the right-hand text, or null for a removed line. */
  after: number | null;
}

/**
 * Above this many lines on either side, the quadratic table is skipped.
 *
 * The common prefix and suffix are trimmed first, so what is left is only the
 * part that genuinely differs; a solution to one of these problems that still
 * has thousands of differing lines is not a diff anyone is going to read. The
 * fallback is honest - everything removed, then everything added - rather than
 * a heuristic that would quietly produce a worse alignment.
 */
const MAX_LINES = 1_500;

function split(text: string): string[] {
  // No text is no lines, not one empty one. An empty editor against a reference
  // solution should read as "all of this is new", with nothing removed.
  if (text === '') return [];
  // A trailing newline is a line terminator, not an empty last line: without
  // this, every file that ends properly shows a phantom blank row. A file that
  // is only a newline still has the one blank line in it.
  const lines = text.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const left = split(before);
  const right = split(after);

  // Identical head and tail, which is most of two versions of the same file.
  // Trimming them is what keeps the table below small enough to be free.
  let head = 0;
  while (head < left.length && head < right.length && left[head] === right[head]) head += 1;

  let tail = 0;
  while (
    tail < left.length - head &&
    tail < right.length - head &&
    left[left.length - 1 - tail] === right[right.length - 1 - tail]
  ) {
    tail += 1;
  }

  const out: DiffLine[] = [];
  for (let i = 0; i < head; i += 1) {
    out.push({ kind: 'same', text: left[i] as string, before: i + 1, after: i + 1 });
  }

  const midLeft = left.slice(head, left.length - tail);
  const midRight = right.slice(head, right.length - tail);
  out.push(...align(midLeft, midRight, head));

  for (let i = 0; i < tail; i += 1) {
    const l = left.length - tail + i;
    const r = right.length - tail + i;
    out.push({ kind: 'same', text: left[l] as string, before: l + 1, after: r + 1 });
  }
  return out;
}

/** The differing middles, aligned by longest common subsequence. */
function align(left: string[], right: string[], offset: number): DiffLine[] {
  if (left.length === 0 && right.length === 0) return [];

  if (left.length > MAX_LINES || right.length > MAX_LINES) {
    return [
      ...left.map((text, i) => ({
        kind: 'removed' as const,
        text,
        before: offset + i + 1,
        after: null,
      })),
      ...right.map((text, i) => ({
        kind: 'added' as const,
        text,
        before: null,
        after: offset + i + 1,
      })),
    ];
  }

  // lcs[i][j] = length of the longest common subsequence of left[i:] and
  // right[j:]. Filled backwards so the walk below reads forwards, which is the
  // order the diff has to come out in.
  const width = right.length + 1;
  const lcs = new Uint32Array((left.length + 1) * width);
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        left[i] === right[j]
          ? (lcs[(i + 1) * width + j + 1] as number) + 1
          : Math.max(lcs[(i + 1) * width + j] as number, lcs[i * width + j + 1] as number);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      out.push({
        kind: 'same',
        text: left[i] as string,
        before: offset + i + 1,
        after: offset + j + 1,
      });
      i += 1;
      j += 1;
    } else if ((lcs[(i + 1) * width + j] as number) >= (lcs[i * width + j + 1] as number)) {
      // Removals before additions at the same position, so a rewritten line
      // reads as "this was here, this is there" in that order.
      out.push({ kind: 'removed', text: left[i] as string, before: offset + i + 1, after: null });
      i += 1;
    } else {
      out.push({ kind: 'added', text: right[j] as string, before: null, after: offset + j + 1 });
      j += 1;
    }
  }
  while (i < left.length) {
    out.push({ kind: 'removed', text: left[i] as string, before: offset + i + 1, after: null });
    i += 1;
  }
  while (j < right.length) {
    out.push({ kind: 'added', text: right[j] as string, before: null, after: offset + j + 1 });
    j += 1;
  }
  return out;
}

/** How many lines differ, for a one-line summary above the diff. */
export function diffCounts(lines: readonly DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((line) => line.kind === 'added').length,
    removed: lines.filter((line) => line.kind === 'removed').length,
  };
}
