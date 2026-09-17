import { describe, expect, it } from 'vitest';
import { HINT_LEVELS, RUBRIC_DIMENSIONS } from '@devpromax/shared';
import { PROMPT_VERSION, systemPrompt } from './index.js';

/**
 * The system prompt (ROADMAP P5-2, P5-7's prompt snapshot half).
 *
 * A prompt cannot be tested for producing good advice without calling a model,
 * which CI does not do (D17). What *can* be pinned is that the prompt still
 * contains the rules the rest of the app depends on being obeyed - the ones
 * where a silent edit would change behaviour that other code assumes. Each
 * assertion below corresponds to a decision recorded elsewhere, so an edit that
 * drops one fails here rather than in someone's practice session.
 */

describe('the system prompt', () => {
  const prompt = systemPrompt();

  it('is a real prompt, read from the versioned file', () => {
    expect(PROMPT_VERSION).toBe('v1');
    expect(prompt.length).toBeGreaterThan(1_000);
    // Trimmed at load: trailing whitespace would change the cached bytes for
    // no reason, and the prefix has to be identical to be cacheable (D12).
    expect(prompt).toBe(prompt.trim());
  });

  it('names every rubric dimension the schema scores', () => {
    // The UI renders a card per dimension and the status engine reads them; a
    // dimension the prompt never mentions would come back guessed.
    for (const dimension of RUBRIC_DIMENSIONS) {
      expect(prompt).toContain(dimension);
    }
  });

  it('names every rung of the hint ladder', () => {
    for (const level of HINT_LEVELS) {
      expect(prompt).toContain(`\`${level}\``);
    }
  });

  it('gates the full solution on both facts, not either one (D13)', () => {
    expect(prompt).toMatch(/`solution` is only available when .*already solved AND/);
    expect(prompt).toMatch(/highest rung you may use is `pseudocode`/);
  });

  it('forbids routing around the ladder by writing the solution into the prose', () => {
    expect(prompt).toMatch(/Never write out the full working solution in `feedbackMarkdown`/);
  });

  it('ties mastery to every dimension, matching MASTERY_THRESHOLD', () => {
    expect(prompt).toMatch(/Set `mastered` to `true` only when \*\*every\*\* dimension is 4/);
  });

  it('tells the coach the editorial is secret', () => {
    expect(prompt).toMatch(/Never quote it, never mention that you have it/);
  });

  it('asks for the one-line summary the panel shows collapsed', () => {
    expect(prompt).toContain('280');
    expect(prompt).toContain('400');
  });
});
