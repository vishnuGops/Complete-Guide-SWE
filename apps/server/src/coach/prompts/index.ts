import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The versioned system prompt (ROADMAP P5-2, CLAUDE.md > Coach prompts).
 *
 * Prose in a `.md` file rather than a template literal in TypeScript, for two
 * reasons. It is the part of this app most likely to be edited by reading it
 * and arguing about a sentence, and a diff of prose is far easier to review
 * than a diff of an escaped string. And it is the largest stable part of every
 * request, so it is what `cache_control` is pointed at (D12) - which only works
 * if it is byte-identical each time, and a file read once at startup is harder
 * to accidentally interpolate into than a string in code.
 *
 * `PROMPT_VERSION` is recorded with stored feedback so an answer can always be
 * traced to the wording that produced it. Bump it whenever `system.md` changes
 * in a way that would change the advice.
 */

export const PROMPT_VERSION = 'v1';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Read once, at module load.
 *
 * Re-reading per request would put a disk read in the hot path and, worse,
 * would let the prompt change mid-session - so two answers in one conversation
 * could come from different instructions with nothing recording which.
 */
const SYSTEM_PROMPT = readFileSync(path.join(here, PROMPT_VERSION, 'system.md'), 'utf8').trim();

export function systemPrompt(): string {
  return SYSTEM_PROMPT;
}
