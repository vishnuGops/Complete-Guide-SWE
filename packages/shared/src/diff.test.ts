import { describe, expect, it } from 'vitest';
import { diffCounts, diffLines } from './diff.js';

/** `before|after|text` for each row, which is the whole of what a row is. */
function rows(before: string, after: string): string[] {
  return diffLines(before, after).map(
    (line) => `${line.before ?? '-'}|${line.after ?? '-'}|${line.kind[0]}|${line.text}`,
  );
}

describe('diffLines', () => {
  it('reports no changes for identical text', () => {
    const lines = diffLines('a\nb\nc\n', 'a\nb\nc\n');
    expect(lines.every((line) => line.kind === 'same')).toBe(true);
    expect(diffCounts(lines)).toEqual({ added: 0, removed: 0 });
  });

  it('does not invent a blank last line from the trailing newline', () => {
    // The file ends properly; without this, every diff of every real file
    // showed a phantom empty row at the bottom.
    expect(diffLines('a\n', 'a\n')).toHaveLength(1);
    // A genuinely blank last line is still a line.
    expect(diffLines('a\n\n', 'a\n\n')).toHaveLength(2);
  });

  it('numbers both sides, leaving the number off the side a line is absent from', () => {
    expect(rows('a\nb\n', 'a\nx\nb\n')).toEqual(['1|1|s|a', '-|2|a|x', '2|3|s|b']);
  });

  it('shows the removal before the addition when a line was rewritten', () => {
    // So it reads "this was here, this is there" rather than the reverse.
    expect(rows('a\nold\nb\n', 'a\nnew\nb\n')).toEqual([
      '1|1|s|a',
      '2|-|r|old',
      '-|2|a|new',
      '3|3|s|b',
    ]);
  });

  it('handles one side being empty', () => {
    expect(diffCounts(diffLines('', 'a\nb\n'))).toEqual({ added: 2, removed: 0 });
    expect(diffCounts(diffLines('a\nb\n', ''))).toEqual({ added: 0, removed: 2 });
    // No text is no lines: an empty editor against a reference reads as all
    // new, with nothing removed above it.
    expect(diffLines('', '')).toEqual([]);
    expect(diffLines('\n', '\n')).toEqual([{ kind: 'same', text: '', before: 1, after: 1 }]);
  });

  it('keeps the moved block rather than rewriting everything around it', () => {
    // The naive line-by-line comparison marks all four lines changed here; the
    // longest common subsequence keeps `keep` and moves the one line that moved.
    const lines = diffLines('one\nkeep\ntwo\n', 'keep\ntwo\none\n');
    expect(diffCounts(lines)).toEqual({ added: 1, removed: 1 });
    expect(lines.filter((line) => line.kind === 'same').map((line) => line.text)).toEqual([
      'keep',
      'two',
    ]);
  });

  it('every same-line appears in both texts, and the two sides reconstruct', () => {
    const before =
      'def f(x):\n    total = 0\n    for v in x:\n        total += v\n    return total\n';
    const after = 'def f(x):\n    return sum(x)\n';
    const lines = diffLines(before, after);

    // The invariant that makes a diff a diff: dropping the additions gives back
    // the left text, dropping the removals gives back the right.
    const left = lines.filter((line) => line.kind !== 'added').map((line) => line.text);
    const right = lines.filter((line) => line.kind !== 'removed').map((line) => line.text);
    expect(left.join('\n')).toBe(before.trimEnd());
    expect(right.join('\n')).toBe(after.trimEnd());
  });

  it('falls back to remove-all-then-add-all past the size cap', () => {
    // Nothing in common, so the trimming cannot help and the table would be
    // 4 million cells. The answer is honest rather than clever.
    const before = Array.from({ length: 1_600 }, (_, i) => `left ${i}`).join('\n');
    const after = Array.from({ length: 1_600 }, (_, i) => `right ${i}`).join('\n');
    const lines = diffLines(before, after);

    expect(diffCounts(lines)).toEqual({ added: 1_600, removed: 1_600 });
    expect(lines[0]?.kind).toBe('removed');
    expect(lines[lines.length - 1]?.kind).toBe('added');
  });

  it('is still cheap when two long files share their head and tail', () => {
    // The realistic shape: a long file with one line changed in the middle.
    const head = Array.from({ length: 3_000 }, (_, i) => `line ${i}`).join('\n');
    const tail = Array.from({ length: 3_000 }, (_, i) => `tail ${i}`).join('\n');
    const lines = diffLines(`${head}\nold\n${tail}\n`, `${head}\nnew\n${tail}\n`);

    expect(diffCounts(lines)).toEqual({ added: 1, removed: 1 });
  });
});
