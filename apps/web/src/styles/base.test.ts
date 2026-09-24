import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The token-drawn checkboxes and radios in forced-colour mode (ROADMAP P4-17).
 *
 * jsdom evaluates no media queries, so this reads the stylesheet: the claim is
 * that the block exists and says what `base.css` explains, not how Windows
 * paints it. Without the block a ticked box and an empty one draw the same in
 * a contrast theme - the fill and the tick are both backgrounds, and the
 * browser replaces backgrounds there.
 */

const BASE = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'base.css'),
  'utf8',
);

/** The body of the one `@media (forced-colors: active)` block, braces balanced. */
function forcedColorsBlock(css: string): string {
  const start = css.indexOf('@media (forced-colors: active)');
  expect(start, 'base.css has a forced-colors block').toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('unbalanced braces in base.css');
}

/** The declarations of the first rule in `css` whose selector list includes `selector`. */
function rule(css: string, selector: string): string {
  const match = new RegExp(
    `(?:^|[}\\s])([^{}]*${selector.replace(/[[\]()'.*:]/g, '\\$&')}[^{}]*)\\{([^}]*)\\}`,
  ).exec(css);
  return match?.[2] ?? '';
}

describe('forced colours', () => {
  const block = forcedColorsBlock(BASE);

  it('takes the controls out of the override, so the state can be drawn at all', () => {
    expect(rule(block, "input[type='checkbox'],")).toMatch(/forced-color-adjust:\s*none/);
  });

  it('marks checked with the system highlight pair, never a token', () => {
    expect(rule(block, "input[type='checkbox']:checked")).toMatch(/background-color:\s*Highlight;/);
    expect(rule(block, "input[type='checkbox']::before")).toMatch(
      /background-color:\s*HighlightText;/,
    );
    // A token here would be a colour the user's theme never chose.
    expect(block).not.toMatch(/var\(--/);
  });
});
