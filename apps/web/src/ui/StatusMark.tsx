import { PROGRESS_LABEL, type ProgressStatus } from '@devpromax/shared';
import { cn } from './cn.js';

/**
 * A problem's status (ROADMAP P4-4, promoted here by P4-8).
 *
 * Shape first, colour second (docs/DESIGN.md section 6). Solved and Mastered are
 * both `success` green - Mastered *is* solved - so the only thing separating
 * them is the ring, and anyone who cannot tell the greens apart still reads two
 * different marks. Not started is an empty outline: the absence of work, drawn
 * as the absence of fill.
 *
 * Lived in `screens/problems/` until the workspace header became its second
 * caller, which is when section 7 says to promote something: two real uses in
 * front of you, not one use and a guess.
 *
 * The word is shown for everything except Not started, which is most of a fresh
 * catalogue and would otherwise print "Not started" two hundred times down the
 * left edge. It is still in the accessible name.
 *
 * `label` overrides the word for a caller with somewhere to put a longer one -
 * the workspace says "Solved in Python", because the language the user solved it
 * in is the question a second language switch immediately raises. It is a
 * longer spelling of the status and not a replacement for it: the word stays in
 * the string, because this is the only text the mark has.
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

export interface StatusMarkProps {
  status: ProgressStatus;
  /** Shown instead of the status word. Must still name the status; see above. */
  label?: string;
}

export function StatusMark({ status, label }: StatusMarkProps) {
  const hidden = status === 'not_started' && label === undefined;
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn('block size-2.5 shrink-0 rounded-full border', MARK[status])}
      />
      <span className={cn('text-xs font-medium', WORD[status])}>
        {hidden ? (
          <span className="sr-only">{PROGRESS_LABEL[status]}</span>
        ) : (
          (label ?? PROGRESS_LABEL[status])
        )}
      </span>
    </span>
  );
}
