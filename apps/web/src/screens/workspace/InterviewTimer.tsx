import { useCallback, useEffect, useState } from 'react';
import { Button, cn } from '../../ui/index.js';

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
  /** Milliseconds since the timer was started. */
  elapsedMs: number;
  /** The countdown length, or null for a stopwatch. */
  budgetMs: number | null;
  start: (budgetMs: number | null) => void;
  stop: () => void;
}

export function useInterviewTimer(): InterviewTimer {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [budgetMs, setBudgetMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  /*
   * Elapsed is computed from the start time rather than accumulated, so a tab
   * that was backgrounded - and whose interval the browser throttled - still
   * reads right the moment it comes back. `start` sets it to zero, so the first
   * tick has nothing to correct.
   */
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1_000);
    return () => {
      clearInterval(timer);
    };
  }, [startedAt]);

  const start = useCallback((budget: number | null) => {
    setBudgetMs(budget);
    setElapsedMs(0);
    setStartedAt(Date.now());
  }, []);

  const stop = useCallback(() => {
    setStartedAt(null);
    setBudgetMs(null);
    setElapsedMs(0);
  }, []);

  return { running: startedAt !== null, elapsedMs, budgetMs, start, stop };
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

  if (timer.running) {
    const over = timer.budgetMs !== null && timer.elapsedMs >= timer.budgetMs;
    const shown =
      timer.budgetMs === null ? timer.elapsedMs : Math.abs(timer.budgetMs - timer.elapsedMs);

    return (
      <div className="flex items-center gap-1.5">
        {/*
          `role="timer"` with `aria-live="off"`: it is a clock, and a clock that
          announced itself every second would make the screen unusable. The
          value is still reachable on demand, which is what a clock should be.
        */}
        <span
          role="timer"
          aria-live="off"
          aria-label={
            timer.budgetMs === null ? 'Elapsed time' : over ? 'Time over by' : 'Time remaining'
          }
          className={cn('tnum text-sm font-medium', over ? 'text-warn-fg' : 'text-fg')}
        >
          {over ? '+' : ''}
          {formatClock(shown)}
        </span>
        <Button
          size="sm"
          variant="ghost"
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
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setChoosing(true);
        }}
      >
        Interview mode
      </Button>
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
