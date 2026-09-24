import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '../../ui/index.js';
import { InterviewTimerControl, useInterviewTimer } from './InterviewTimer.js';

/**
 * Who re-renders when the interview clock ticks (ROADMAP P4-18).
 *
 * The owner of the timer is the whole workspace - editor, both panels, the
 * statement - and it used to re-render every second for as long as the clock
 * ran. Now only the clock does, and a submit reads the elapsed time when it
 * is sent.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe('the interview clock', () => {
  it('ticks without re-rendering the component that owns the timer', () => {
    vi.useFakeTimers();
    let renders = 0;
    let elapsed: () => number = () => -1;

    function Owner() {
      renders += 1;
      const timer = useInterviewTimer();
      elapsed = timer.elapsedMs;
      return <InterviewTimerControl timer={timer} />;
    }

    render(
      <TooltipProvider>
        <Owner />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Interview mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stopwatch' }));
    expect(screen.getByRole('timer')).toHaveTextContent('0:00');
    const settled = renders;

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('0:05');
    expect(renders).toBe(settled);
    // And the time is still there for a submit to read.
    expect(elapsed()).toBeGreaterThanOrEqual(5_000);
  });
});
