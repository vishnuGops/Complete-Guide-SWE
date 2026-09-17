import type { Verdict } from '@devpromax/shared';

/**
 * How a verdict is drawn (ROADMAP P4-7, docs/DESIGN.md section 6).
 *
 * Three hues for six verdicts, because there are only three things that can have
 * happened: it was accepted, it ran but outside its budget, or it failed. Here
 * rather than in a component because the results panel and the submission
 * history have to agree - a TLE that is amber in one place and red in the other
 * teaches the wrong thing twice.
 */

export const VERDICT_TONE: Record<Verdict, string> = {
  AC: 'text-success-fg',
  WA: 'text-danger-fg',
  RE: 'text-danger-fg',
  CE: 'text-danger-fg',
  TLE: 'text-warn-fg',
  MLE: 'text-warn-fg',
};

/** The dot beside the word: the second signal, so colour is never alone. */
export const VERDICT_MARK: Record<Verdict, string> = {
  AC: 'bg-success',
  WA: 'bg-danger',
  RE: 'bg-danger',
  CE: 'bg-danger',
  TLE: 'bg-warn',
  MLE: 'bg-warn',
};
