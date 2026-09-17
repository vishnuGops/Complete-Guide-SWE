import { PROGRESS_LABEL, type ProgressStatus } from '@devpromax/shared';
import { cn } from '../../ui/index.js';

/**
 * A problem's status, in a table cell (ROADMAP P4-4).
 *
 * Shape first, colour second (docs/DESIGN.md section 6). Solved and Mastered are
 * both `success` green - Mastered *is* solved - so the only thing separating
 * them is the ring, and anyone who cannot tell the greens apart still reads two
 * different marks. Not started is an empty outline: the absence of work, drawn
 * as the absence of fill.
 *
 * The word is shown for everything except Not started, which is most of a fresh
 * catalogue and would otherwise print "Not started" two hundred times down the
 * left edge. It is still in the accessible name.
 */

const MARK: Record<ProgressStatus, string> = {
  not_started: 'border-border-hover',
  in_progress: 'border-accent border-[3px]',
  solved: 'border-success bg-success',
  mastered: 'border-success bg-success ring-1 ring-success ring-offset-2 ring-offset-bg',
};

const WORD: Record<ProgressStatus, string> = {
  not_started: 'text-fg-subtle',
  in_progress: 'text-accent-fg',
  solved: 'text-success-fg',
  mastered: 'text-success-fg',
};

export function StatusMark({ status }: { status: ProgressStatus }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn('block size-2.5 shrink-0 rounded-full border', MARK[status])}
      />
      <span className={cn('text-xs font-medium', WORD[status])}>
        {status === 'not_started' ? (
          <span className="sr-only">{PROGRESS_LABEL[status]}</span>
        ) : (
          PROGRESS_LABEL[status]
        )}
      </span>
    </span>
  );
}
