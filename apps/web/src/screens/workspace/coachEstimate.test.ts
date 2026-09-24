import { describe, expect, it } from 'vitest';
import { aProblemDetail } from '../../test/harness.js';
import { SYSTEM_PROMPT_CHARS, coachPromptChars } from './coachEstimate.js';

/**
 * The input side of the AI Help estimate (ROADMAP P4-15, after the coach
 * audit's C8): it has to count what the server actually sends.
 */
describe('coachPromptChars', () => {
  it('counts more than the statement and the code', () => {
    const problem = aProblemDetail();
    const chars = coachPromptChars(problem, 'x = 1', 0);

    expect(chars).toBeGreaterThan(SYSTEM_PROMPT_CHARS + problem.statement.length + 'x = 1'.length);
  });

  it('counts the editorial once the client has it, up to the server’s cap', () => {
    const locked = aProblemDetail({ editorial: null, editorialUnlocked: false });
    const unlocked = aProblemDetail({ editorial: 'e'.repeat(300), editorialUnlocked: true });
    const long = aProblemDetail({ editorial: 'e'.repeat(50_000), editorialUnlocked: true });

    expect(coachPromptChars(unlocked, '', 0) - coachPromptChars(locked, '', 0)).toBe(300);
    // The server truncates the editorial at 4,000 characters, so the estimate does too.
    expect(coachPromptChars(long, '', 0) - coachPromptChars(locked, '', 0)).toBe(4_000);
  });

  it('counts the hints read so far and the next one', () => {
    const problem = aProblemDetail({ hints: ['a'.repeat(100), 'b'.repeat(200), 'c'.repeat(400)] });

    expect(coachPromptChars(problem, '', 1) - coachPromptChars(problem, '', 0)).toBe(200);
  });

  it('grows with the code, character for character', () => {
    const problem = aProblemDetail();

    expect(coachPromptChars(problem, 'x'.repeat(1_000), 0) - coachPromptChars(problem, '', 0)).toBe(
      1_000,
    );
  });
});
