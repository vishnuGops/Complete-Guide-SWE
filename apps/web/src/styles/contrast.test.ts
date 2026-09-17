import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The contrast rule in docs/DESIGN.md, enforced (ROADMAP P0-8).
 *
 * "Text 4.5:1, meaningful borders and icons 3:1, in both themes" is the kind of
 * rule that is true on the day it is written and quietly false six palette
 * tweaks later, because nobody re-measures a colour they only nudged. So the
 * pairs are measured here, from the real token file: change a ramp value and
 * this fails before the screen ships.
 *
 * It reads `tokens.css` rather than a copy of the numbers - a table of colours
 * duplicated into a test is a table that will disagree with the stylesheet.
 */

const TOKENS = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'tokens.css'),
  'utf8',
);

// ---------------------------------------------------------------------------
// Colour maths: OKLCH -> linear sRGB -> WCAG relative luminance.
// ---------------------------------------------------------------------------

interface Oklch {
  l: number;
  c: number;
  h: number;
}

function parseOklch(value: string): Oklch {
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (!match) throw new Error(`not an oklch colour: ${value}`);
  const [, l, c, h] = match as unknown as [string, string, string, string];
  return { l: Number(l), c: Number(c), h: Number(h) };
}

/** Relative luminance, the Y of the WCAG contrast formula. */
function luminance({ l: lightness, c, h }: Oklch): number {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLCH -> OKLab -> LMS -> linear sRGB, then the WCAG luminance weights.
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const red = clamp(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short);
  const green = clamp(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short);
  const blue = clamp(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a: Oklch, b: Oklch): number {
  const first = luminance(a);
  const second = luminance(b);
  const hi = Math.max(first, second);
  const lo = Math.min(first, second);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// Reading the token file
// ---------------------------------------------------------------------------

/** Every `--color-<name>: oklch(...)` in the file: the fixed ramps. */
function readRamps(): Map<string, Oklch> {
  const ramps = new Map<string, Oklch>();
  for (const match of TOKENS.matchAll(/--color-([a-z0-9-]+):\s*(oklch\([^)]+\))/g)) {
    const [, name, value] = match as unknown as [string, string, string];
    ramps.set(name, parseOklch(value));
  }
  return ramps;
}

/**
 * The semantic block for one theme. Light is the `:root` block that opens the
 * theme section; dark is the explicit `[data-theme='dark']` one, which is a copy
 * of what the media query sets - so measuring it measures both.
 */
function readTheme(selector: string): Map<string, string> {
  const start = TOKENS.indexOf(selector);
  expect(start, `${selector} block is missing from tokens.css`).toBeGreaterThan(-1);
  const block = TOKENS.slice(start, TOKENS.indexOf('}', start));

  const aliases = new Map<string, string>();
  for (const match of block.matchAll(/^\s+--([a-z0-9-]+):\s*var\(--color-([a-z0-9-]+)\);/gm)) {
    const [, name, target] = match as unknown as [string, string, string];
    aliases.set(name, target);
  }
  return aliases;
}

const ramps = readRamps();

function themeColours(selector: string): (token: string) => Oklch {
  const aliases = readTheme(selector);
  return (token) => {
    const target = aliases.get(token);
    if (target === undefined) throw new Error(`${selector} does not define --${token}`);
    const colour = ramps.get(target);
    if (colour === undefined) throw new Error(`--color-${target} is not a ramp colour`);
    return colour;
  };
}

const THEMES = {
  // The `:root` that opens the light theme section, not the one Tailwind emits.
  light: themeColours(':root {\n  --bg:'),
  dark: themeColours(":root[data-theme='dark']"),
} as const;

/** WCAG AA: 4.5 for text, 3 for large text and anything else carrying meaning. */
const TEXT = 4.5;
const NON_TEXT = 3;

const SURFACES = ['bg', 'surface', 'surface-raised', 'surface-sunken'] as const;
const TEXT_TOKENS = [
  'fg',
  'fg-muted',
  'fg-subtle',
  'accent-fg',
  'success-fg',
  'warn-fg',
  'danger-fg',
] as const;

describe.each(Object.keys(THEMES) as (keyof typeof THEMES)[])('%s theme', (theme) => {
  const colour = THEMES[theme];

  describe.each(SURFACES)('text on %s', (surface) => {
    it.each(TEXT_TOKENS)(`%s reads at ${TEXT}:1 or better`, (token) => {
      const ratio = contrast(colour(token), colour(surface));
      expect(
        Number(ratio.toFixed(2)),
        `--${token} on --${surface} in ${theme}`,
      ).toBeGreaterThanOrEqual(TEXT);
    });
  });

  it('puts legible text on a filled accent button', () => {
    expect(contrast(colour('fg-on-accent'), colour('accent'))).toBeGreaterThanOrEqual(TEXT);
  });

  it('puts legible text on a filled danger button', () => {
    // `danger-solid`, not `danger`: the button fill and the status fill are
    // different colours on purpose (see tokens.css).
    expect(contrast(colour('fg-on-accent'), colour('danger-solid'))).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(SURFACES)('shows the focus ring against %s', (surface) => {
    // The ring is not text, but it is the only thing telling a keyboard user
    // where they are, so it gets the non-text floor rather than nothing.
    expect(contrast(colour('focus'), colour(surface))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it.each(['success', 'warn', 'danger'] as const)(
    'shows the %s fill against the page',
    (status) => {
      // Status fills are the status dot and the verdict chip: meaning-carrying,
      // so the 3:1 non-text floor applies.
      expect(contrast(colour(status), colour('bg'))).toBeGreaterThanOrEqual(NON_TEXT);
    },
  );

  it('separates panels from the page', () => {
    // Not a WCAG rule - a layout one. If a panel edge is invisible, the panel
    // is not a panel, and 1.5:1 is about where an edge stops reading.
    expect(contrast(colour('border-strong'), colour('surface'))).toBeGreaterThanOrEqual(1.5);
  });
});
