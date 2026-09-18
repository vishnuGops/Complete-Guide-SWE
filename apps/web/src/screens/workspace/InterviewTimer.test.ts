import { describe, expect, it } from 'vitest';
import { formatClock } from './InterviewTimer.js';

/**
 * The clock's formatting (ROADMAP P7-6).
 *
 * Small enough to test on its own, and worth it: the seconds are the part a
 * person reads at a glance, and "3:7" instead of "3:07" is the kind of thing
 * that is obvious once and invisible afterwards.
 */
describe('formatClock', () => {
  it('pads the seconds', () => {
    expect(formatClock(7_000)).toBe('0:07');
    expect(formatClock(67_000)).toBe('1:07');
  });

  it('drops the hour until there is one', () => {
    expect(formatClock(59 * 60_000 + 59_000)).toBe('59:59');
    expect(formatClock(60 * 60_000)).toBe('1:00:00');
    expect(formatClock(75 * 60_000 + 5_000)).toBe('1:15:05');
  });

  it('rounds down, so the clock never shows a second it has not reached', () => {
    expect(formatClock(1_999)).toBe('0:01');
  });

  it('shows zero rather than a negative time', () => {
    // A countdown that has run out is rendered as "+" plus the overrun, so a
    // negative can only arrive here by mistake - and a mistake that prints
    // "-1:-30" is worse than one that prints "0:00".
    expect(formatClock(-5_000)).toBe('0:00');
  });
});
