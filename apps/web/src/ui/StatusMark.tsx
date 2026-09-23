import { PROGRESS_LABEL, type ProgressStatus } from '@devpromax/shared';
import { cn } from './cn.js';

/**
 * A problem's status (ROADMAP P4-4, promoted here by P4-8; glyphs by P9-6).
 *
 * Shape first, colour second (docs/DESIGN.md 7). Four glyphs, each readable
 * without its colour:
 *
 *   - Not started: an empty ring - the absence of work, drawn as the absence of fill.
 *   - In progress: a ring half filled, in `fg-muted`. Not blue: since P9-6 the
 *     accent means "act here" or "you are here", and a hundred half-done rows in
 *     the accent would turn the list into a wall of buttons.
 *   - Solved: a filled disc in `success`.
 *   - Mastered: the same disc inside a ring. Mastered *is* solved, so both are
 *     green, and the ring is the only thing separating them - anyone who cannot
 *     tell the greens apart still reads two different marks.
 *
 * Lived in `screens/problems/` until the workspace header became its second
 * caller, which is when DESIGN.md 10 says to promote something.
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

const GLYPH_COLOUR: Record<ProgressStatus, string> = {
  not_started: 'text-fg-subtle',
  in_progress: 'text-fg-muted',
  solved: 'text-success',
  mastered: 'text-success',
};

const WORD: Record<ProgressStatus, string> = {
  not_started: 'text-fg-subtle',
  in_progress: 'text-fg-muted',
  solved: 'text-success-fg',
  mastered: 'text-success-fg',
};

/** 12px, drawn in `currentColor` so the glyph takes its colour from the class above. */
function Glyph({ status }: { status: ProgressStatus }) {
  return (
    <svg
      aria-hidden
      fill="none"
      viewBox="0 0 12 12"
      className={cn('size-3 shrink-0', GLYPH_COLOUR[status])}
      data-status={status}
    >
      {status === 'not_started' && (
        <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      )}
      {status === 'in_progress' && (
        <>
          <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {/* The left half, filled: work begun, not finished. */}
          <path d="M6 1.25 A4.75 4.75 0 0 0 6 10.75 Z" fill="currentColor" />
        </>
      )}
      {status === 'solved' && <circle cx="6" cy="6" r="5" fill="currentColor" />}
      {status === 'mastered' && (
        <>
          <circle cx="6" cy="6" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="6" cy="6" r="2.75" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export interface StatusMarkProps {
  status: ProgressStatus;
  /** Shown instead of the status word. Must still name the status; see above. */
  label?: string;
}

export function StatusMark({ status, label }: StatusMarkProps) {
  const hidden = status === 'not_started' && label === undefined;
  return (
    <span className="flex items-center gap-2">
      <Glyph status={status} />
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
