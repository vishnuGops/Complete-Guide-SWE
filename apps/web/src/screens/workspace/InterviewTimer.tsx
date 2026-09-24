import { useCallback, useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { Button, Tooltip, cn } from '../../ui/index.js';

/**
 * Interview mode (ROADMAP P7-6).
 *
 * A stopwatch or a countdown, and while either is running the hints and the
 * editorial are not on screen. That is the whole point: the timer is not a
 * productivity gadget, it is a way of practising the conditions - no help, and
 * a clock you can see.
 *
 * The elapsed time is recorded on the submission, so P7-10 can eventually
 * calibrate the ratings against how long problems actually take.
 */

/** Countdowns on offer. Two lengths, because an interview is one or the other. */
const COUNTDOWNS = [
  { label: '30 min', ms: 30 * 60_000 },
  { label: '45 min', ms: 45 * 60_000 },
] as const;

export interface InterviewTimer {
  running: boolean;
  /** `Date.now()` when the clock started, or null while it is not running. */
  startedAt: number | null;
  /** The countdown length, or null for a stopwatch. */
  budgetMs: number | null;
  /**
   * Milliseconds since the timer was started, read when it is asked for.
   *
   * A function rather than a number that ticks (ROADMAP P4-18). The ticking
   * lives in the clock on screen (`RunningClock`), so it re-renders one span a
   * second instead of the whole workspace - editor, panels and all - which is
   * what a ticking value held here used to do. The only other reader is a
   * submit, which wants the time at the moment it is sent anyway.
   */
  elapsedMs: () => number;
  start: (budgetMs: number | null) => void;
  stop: () => void;
}

export function useInterviewTimer(): InterviewTimer {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [budgetMs, setBudgetMs] = useState<number | null>(null);

  const start = useCallback((budget: number | null) => {
    setBudgetMs(budget);
    setStartedAt(Date.now());
  }, []);

  const stop = useCallback(() => {
    setStartedAt(null);
    setBudgetMs(null);
  }, []);

  const elapsedMs = useCallback(
    () => (startedAt === null ? 0 : Date.now() - startedAt),
    [startedAt],
  );

  return { running: startedAt !== null, startedAt, budgetMs, elapsedMs, start, stop };
}

/** `m:ss`, or `h:mm:ss` once it has been an hour. Never a bare number. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = String(total % 60).padStart(2, '0');
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  if (hours === 0) return `${String(minutes)}:${seconds}`;
  return `${String(hours)}:${String(minutes).padStart(2, '0')}:${seconds}`;
}

/**
 * The clock itself, and the only thing that re-renders when it ticks.
 *
 * Elapsed is computed from the start time rather than accumulated, so a tab
 * that was backgrounded - and whose interval the browser throttled - still
 * reads right the moment it comes back. It starts at zero rather than at
 * `Date.now() - startedAt`, so a fresh 30-minute countdown reads 30:00 and not
 * 29:59 on the frame it appears.
 */
function RunningClock({ startedAt, budgetMs }: { startedAt: number; budgetMs: number | null }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1_000);
    return () => {
      clearInterval(timer);
    };
  }, [startedAt]);

  const over = budgetMs !== null && elapsedMs >= budgetMs;
  const shown = budgetMs === null ? elapsedMs : Math.abs(budgetMs - elapsedMs);

  return (
    /*
      `role="timer"` with `aria-live="off"`: it is a clock, and a clock that
      announced itself every second would make the screen unusable. The value
      is still reachable on demand, which is what a clock should be.
    */
    <span
      role="timer"
      aria-live="off"
      aria-label={budgetMs === null ? 'Elapsed time' : over ? 'Time over by' : 'Time remaining'}
      className={cn('tnum text-sm font-medium', over ? 'text-warn-fg' : 'text-fg')}
    >
      {over ? '+' : ''}
      {formatClock(shown)}
    </span>
  );
}

export function InterviewTimerControl({ timer }: { timer: InterviewTimer }) {
  const [choosing, setChoosing] = useState(false);

  // Escape closes the choice, because it is a menu in all but name and a
  // keyboard user who opened it by accident needs a way back out.
  useEffect(() => {
    if (!choosing) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setChoosing(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [choosing]);

  if (timer.startedAt !== null) {
    return (
      <div className="flex items-center gap-1.5">
        <RunningClock startedAt={timer.startedAt} budgetMs={timer.budgetMs} />
        <Button
          variant="secondary"
          onClick={() => {
            timer.stop();
          }}
        >
          Stop
        </Button>
      </div>
    );
  }

  if (!choosing) {
    /*
     * Its icon alone below 1280px (P9-7), so the toolbar has room for AI Help's
     * key chips at 1024 - the shortcut is on the pill because it is the one
     * nobody guesses, while this button is used once a sitting. The word stays
     * as the accessible name and in the tooltip (DESIGN.md 3).
     */
    return (
      <Tooltip content="Interview mode">
        <Button
          variant="secondary"
          onClick={() => {
            setChoosing(true);
          }}
        >
          <Timer aria-hidden size={14} strokeWidth={1.5} />
          <span className="max-[1279px]:sr-only">Interview mode</span>
        </Button>
      </Tooltip>
    );
  }

  return (
    <div role="group" aria-label="Start interview mode" className="flex items-center gap-1">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setChoosing(false);
          timer.start(null);
        }}
      >
        Stopwatch
      </Button>
      {COUNTDOWNS.map((option) => (
        <Button
          key={option.label}
          size="sm"
          variant="secondary"
          onClick={() => {
            setChoosing(false);
            timer.start(option.ms);
          }}
        >
          {option.label}
        </Button>
      ))}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setChoosing(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}
