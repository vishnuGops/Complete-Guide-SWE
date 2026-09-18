import { useMemo } from 'react';
import { diffCounts, diffLines, type DiffKind } from '@devpromax/shared';
import { cn } from '../../ui/index.js';

/**
 * Two versions of a solution, side by side in one column (ROADMAP P7-2).
 *
 * A unified diff rather than two panes. The workspace's statement column is
 * narrow and code is wide; two panes of Java at that width wrap every line, and
 * a wrapped side-by-side diff is unreadable. Built here rather than in `ui/`
 * because it is a workspace thing - P7-3 reuses it for an old submission
 * against the editor, which is the same screen.
 *
 * Colour is never the only signal: every changed row carries a `+` or `-` in
 * the gutter, so the diff survives a colour-blind reader and a monochrome
 * printout. The markers are `aria-hidden` and the row's meaning is announced
 * from a visually hidden word instead, because a screen reader saying "plus" in
 * front of a line of Python is noise.
 */

const ROW: Record<DiffKind, string> = {
  same: '',
  added: 'bg-success-subtle',
  removed: 'bg-danger-subtle',
};

const MARK: Record<DiffKind, string> = { same: ' ', added: '+', removed: '-' };
const ANNOUNCE: Record<DiffKind, string | null> = {
  same: null,
  added: 'Added: ',
  removed: 'Removed: ',
};

export interface CodeDiffProps {
  /** The version being compared against - the reference, or an old submission. */
  before: string;
  /** What is in the editor now. */
  after: string;
  /** Names the two sides in the summary line, e.g. "the reference". */
  beforeLabel: string;
  afterLabel: string;
  className?: string;
}

export function CodeDiff({ before, after, beforeLabel, afterLabel, className }: CodeDiffProps) {
  const lines = useMemo(() => diffLines(before, after), [before, after]);
  const counts = useMemo(() => diffCounts(lines), [lines]);

  if (counts.added === 0 && counts.removed === 0) {
    return (
      <p className={cn('text-fg-muted text-sm', className)}>
        Line for line, {afterLabel} matches {beforeLabel}.
      </p>
    );
  }

  return (
    <div className={className}>
      <p className="text-fg-muted mb-2 text-xs">
        {beforeLabel} against {afterLabel}:{' '}
        <span className="text-success-fg tnum">{counts.added} added</span>,{' '}
        <span className="text-danger-fg tnum">{counts.removed} removed</span>.
      </p>

      {/* Its own scroller: a long line of Java must not widen the page (DESIGN 12). */}
      <div className="border-border overflow-x-auto rounded-md border">
        <table className="w-full border-collapse font-mono text-xs">
          <caption className="sr-only">
            {beforeLabel} compared with {afterLabel}, line by line.
          </caption>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${String(line.before)}-${String(line.after)}-${String(index)}`}>
                <td
                  aria-hidden
                  className="text-fg-subtle tnum w-10 px-2 py-px text-right align-top select-none"
                >
                  {line.before ?? ''}
                </td>
                <td
                  aria-hidden
                  className="text-fg-subtle tnum w-10 px-2 py-px text-right align-top select-none"
                >
                  {line.after ?? ''}
                </td>
                <td className={cn('w-4 px-1 py-px text-center align-top', ROW[line.kind])}>
                  <span aria-hidden className="text-fg-subtle select-none">
                    {MARK[line.kind]}
                  </span>
                </td>
                <td className={cn('py-px pr-3 whitespace-pre', ROW[line.kind])}>
                  {ANNOUNCE[line.kind] !== null ? (
                    <span className="sr-only">{ANNOUNCE[line.kind]}</span>
                  ) : null}
                  {line.text === '' ? '\u00a0' : line.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
