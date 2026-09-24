#!/usr/bin/env node
/**
 * Check a redesign proposal - a candidate replacement for
 * apps/web/src/styles/tokens.css - against everything that is not taste.
 *
 * A redesign may change how the app looks. It may not change what the tokens
 * are for: every component names semantic tokens, contrast.test.ts parses the
 * file by its shape, verdicts are read by hue, and dark mode is two identical
 * blocks. This fails a proposal that would break any of that, before a single
 * screenshot is spent on it.
 *
 *   node .claude/skills/design-update/scripts/check-proposal.mjs <proposal tokens.css>
 *   node .claude/skills/design-update/scripts/check-proposal.mjs <proposal> --json
 *
 * The contrast pairs are the ones in apps/web/src/styles/contrast.test.ts, with
 * the same maths. If that test gains a pair, add it to PAIRS here as well.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const CURRENT = path.join(REPO_ROOT, 'apps', 'web', 'src', 'styles', 'tokens.css');

const file = process.argv[2];
if (!file) {
  console.error('usage: check-proposal.mjs <proposal tokens.css> [--json]');
  process.exit(2);
}
const asJson = process.argv.includes('--json');
const proposal = fs.readFileSync(path.resolve(file), 'utf8');
const current = fs.readFileSync(CURRENT, 'utf8');

const checks = [];
const check = (group, name, ok, detail = '') => checks.push({ group, name, ok, detail });

// ---------------------------------------------------------------------------
// Colour maths, as contrast.test.ts has it.

function parseOklch(value) {
  const m = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (!m) return undefined;
  return { l: Number(m[1]) / (m[2] ? 100 : 1), c: Number(m[3]), h: Number(m[4]) };
}
function luminance({ l: lightness, c, h }) {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const red = clamp(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short);
  const green = clamp(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short);
  const blue = clamp(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const hueDistance = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// ---------------------------------------------------------------------------
// Reading a token file by the same landmarks contrast.test.ts uses.

function blockAt(text, marker) {
  const start = text.indexOf(marker);
  if (start === -1) return undefined;
  return text.slice(start, text.indexOf('}', start));
}
function declarations(block) {
  const out = new Map();
  for (const m of (block ?? '').matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}
function read(text) {
  const ramps = new Map();
  for (const m of text.matchAll(/--color-([a-z0-9-]+):\s*(oklch\([^)]+\))/g)) {
    ramps.set(m[1], parseOklch(m[2]));
  }
  const inline = declarations(blockAt(text, '@theme inline {'));
  const light = declarations(blockAt(text, ':root {\n  --bg:'));
  // The media-query block is nested; its inner selector is the landmark.
  const media = declarations(blockAt(text, ":root:not([data-theme='light']) {"));
  const dark = declarations(blockAt(text, ":root[data-theme='dark'] {"));
  return { ramps, inline, light, media, dark };
}

const cur = read(current);
const next = read(proposal);

// ---------------------------------------------------------------------------
// 1. Shape: what components and contrast.test.ts rely on.

const semanticNames = [...cur.light.keys()].filter((k) => k !== 'color-scheme');
check(
  'shape',
  'light block found at the contrast-test landmark (`:root {` then `--bg:`)',
  next.light.size > 0,
);
check(
  'shape',
  "media-query dark block found (`:root:not([data-theme='light'])`)",
  next.media.size > 0,
);
check('shape', "explicit dark block found (`:root[data-theme='dark']`)", next.dark.size > 0);

for (const [label, block] of [
  ['light', next.light],
  ['media dark', next.media],
  ['explicit dark', next.dark],
]) {
  const missing = semanticNames.filter((n) => !block.has(n));
  check(
    'shape',
    `${label} defines every current semantic token`,
    !missing.length,
    missing.join(', '),
  );
}
const inlineMissing = [...cur.inline.keys()].filter((n) => !next.inline.has(n));
check(
  'shape',
  '`@theme inline` maps every current semantic token',
  !inlineMissing.length,
  inlineMissing.join(', '),
);

const darkDiff = [...new Set([...next.media.keys(), ...next.dark.keys()])].filter(
  (k) => next.media.get(k) !== next.dark.get(k),
);
check('shape', 'the two dark blocks are identical', !darkDiff.length, darkDiff.join(', '));

// New semantic tokens must be complete too: in all three blocks and mapped.
const added = [...next.light.keys()].filter((n) => !cur.light.has(n) && n !== 'color-scheme');
for (const name of added) {
  check(
    'shape',
    `new token --${name} is in both dark blocks and @theme inline`,
    next.media.has(name) && next.dark.has(name) && next.inline.has(`color-${name}`),
  );
}

// Aliases must point at oklch ramp colours, or contrast.test.ts cannot read them.
for (const [label, block] of [
  ['light', next.light],
  ['explicit dark', next.dark],
]) {
  const bad = [];
  for (const [name, value] of block) {
    const alias = /^var\(--color-([a-z0-9-]+)\)$/.exec(value);
    if (alias && !next.ramps.has(alias[1])) bad.push(`--${name} -> ${alias[1]}`);
  }
  check('shape', `${label} aliases resolve to oklch ramp colours`, !bad.length, bad.join(', '));
}
const needAlias = [
  'bg',
  'surface',
  'surface-raised',
  'surface-sunken',
  'fg',
  'fg-muted',
  'fg-subtle',
  'fg-on-accent',
  'border-strong',
  'accent',
  'accent-fg',
  'success',
  'success-fg',
  'success-subtle',
  'warn',
  'warn-fg',
  'danger',
  'danger-fg',
  'danger-subtle',
  'danger-solid',
  'focus',
  'surface-selected',
  'code-keyword',
  'border-input',
];
for (const [label, block] of [
  ['light', next.light],
  ['explicit dark', next.dark],
]) {
  const raw = needAlias.filter((n) => !/^var\(--color-/.test(block.get(n) ?? ''));
  check(
    'shape',
    `${label}: tokens contrast.test.ts measures are ramp aliases, not raw values`,
    !raw.length,
    raw.join(', '),
  );
}

// Utilities and variants the components call by name.
for (const name of ['focus-ring', 'focus-ring-inset', 'tnum', 'skeleton']) {
  check('shape', `@utility ${name} still exists`, proposal.includes(`@utility ${name} {`));
}
check('shape', '@custom-variant dark still exists', proposal.includes('@custom-variant dark'));
for (const name of [
  '--text-2xs',
  '--text-xs',
  '--text-sm',
  '--text-base',
  '--text-md',
  '--text-lg',
  '--text-xl',
  '--text-2xl',
  '--text-3xl',
  '--radius-xs',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--shadow-card',
  '--shadow-overlay',
  '--font-sans',
  '--font-mono',
  '--font-serif',
  '--spacing',
]) {
  check('shape', `${name} is still defined`, new RegExp(`${name}:`).test(proposal));
}

// ---------------------------------------------------------------------------
// 2. Contrast: the pairs contrast.test.ts measures, same floors.

const SURFACES = ['bg', 'surface', 'surface-raised', 'surface-sunken'];
const TEXT_TOKENS = [
  'fg',
  'fg-muted',
  'fg-subtle',
  'accent-fg',
  'success-fg',
  'warn-fg',
  'danger-fg',
  'code-keyword',
];
const PAIRS = [
  ...SURFACES.flatMap((s) => TEXT_TOKENS.map((t) => [t, s, 4.5])),
  ['fg-on-accent', 'accent', 4.5],
  ['fg-on-accent', 'danger-solid', 4.5],
  ...SURFACES.map((s) => ['focus', s, 3]),
  ['success', 'bg', 3],
  ['warn', 'bg', 3],
  ['danger', 'bg', 3],
  ['fg', 'success-subtle', 4.5],
  ['fg', 'danger-subtle', 4.5],
  ['border-strong', 'surface', 1.5],
  // Version 2 (P9-6): the card edge, the selected step, the Callout.
  ['border', 'surface', 1.2],
  ['border-input', 'surface', 3],
  ['border-input', 'surface-sunken', 3],
  ['surface', 'bg', 1.05],
  ['fg', 'surface-selected', 4.5],
  ['fg-muted', 'surface-selected', 4.5],
  ['success-fg', 'surface-selected', 4.5],
  ['warn-fg', 'surface-selected', 4.5],
  ['danger-fg', 'surface-selected', 4.5],
  ['success', 'surface-selected', 3],
  ['warn', 'surface-selected', 3],
  ['danger', 'surface-selected', 3],
  ['surface-selected', 'surface', 1.2],
  ['fg-subtle', 'bg', 3],
  ['fg', 'accent-subtle', 4.5],
  ['fg-muted', 'accent-subtle', 4.5],
];

function colourOf(theme, token) {
  const alias = /^var\(--color-([a-z0-9-]+)\)$/.exec(theme.get(token) ?? '');
  return alias ? next.ramps.get(alias[1]) : parseOklch(theme.get(token) ?? '');
}
const ratios = [];
for (const [themeName, theme] of [
  ['light', next.light],
  ['dark', next.dark],
]) {
  for (const [fg, bg, floor] of PAIRS) {
    const a = colourOf(theme, fg);
    const b = colourOf(theme, bg);
    if (!a || !b) {
      check('contrast', `${themeName}: --${fg} on --${bg}`, false, 'unresolvable');
      continue;
    }
    const ratio = Number(contrast(a, b).toFixed(2));
    ratios.push({ theme: themeName, fg, bg, ratio, floor });
    check(
      'contrast',
      `${themeName}: --${fg} on --${bg} >= ${String(floor)}`,
      ratio >= floor,
      `${String(ratio)}:1`,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Meaning: verdicts are read by hue (DESIGN.md sections 4 and 7).

for (const [themeName, theme] of [
  ['light', next.light],
  ['dark', next.dark],
]) {
  const hue = (t) => colourOf(theme, t)?.h;
  const accent = hue('accent');
  for (const status of ['success', 'warn', 'danger']) {
    const d = hueDistance(accent ?? 0, hue(status) ?? 0);
    check(
      'meaning',
      `${themeName}: accent hue is >= 45 deg from ${status}, so a status dot is never mistaken for the accent`,
      d >= 45,
      `${d.toFixed(0)} deg`,
    );
  }
  for (const [x, y] of [
    ['success', 'warn'],
    ['warn', 'danger'],
    ['success', 'danger'],
  ]) {
    const d = hueDistance(hue(x) ?? 0, hue(y) ?? 0);
    check(
      'meaning',
      `${themeName}: ${x} and ${y} are >= 30 deg apart`,
      d >= 30,
      `${d.toFixed(0)} deg`,
    );
  }
  const chroma = colourOf(theme, 'accent')?.c ?? 0;
  check(
    'meaning',
    `${themeName}: the accent is a colour (chroma >= 0.08), not a grey`,
    chroma >= 0.08,
    chroma.toFixed(3),
  );
}

// ---------------------------------------------------------------------------
// 4. Platform: offline fonts, reduced motion.

const fontsCss = fs.readFileSync(
  path.join(REPO_ROOT, 'apps', 'web', 'src', 'styles', 'index.css'),
  'utf8',
);
const families = /--font-sans:\s*([^;]+);/.exec(proposal)?.[1] ?? '';
const firstFamily = families.split(',')[0].replaceAll(/["']/g, '').trim();
const selfHosted =
  /Inter|JetBrains/.test(firstFamily) ||
  fontsCss.toLowerCase().includes(
    firstFamily
      .toLowerCase()
      .replace(/ variable$/, '')
      .replaceAll(' ', '-'),
  );
check(
  'platform',
  `--font-sans leads with a self-hosted family (${firstFamily || 'none'})`,
  selfHosted,
  selfHosted
    ? ''
    : 'add @fontsource-variable/<family> and import it in apps/web/src/styles/index.css when applying',
);

// ---------------------------------------------------------------------------
// 5. The editor. Monaco paints code in its stock `vs` / `vs-dark` themes unless
// CodeEditor.tsx defines its own, and an accent on the keyword hue turns "this is
// the action" into "this is code". Held to 20 deg, or at least no closer than today.

const editorSource = fs.readFileSync(
  path.join(REPO_ROOT, 'apps', 'web', 'src', 'editor', 'CodeEditor.tsx'),
  'utf8',
);
if (/'vs-dark'/.test(editorSource) && !/defineTheme/.test(editorSource)) {
  const hexHue = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [lr, lg, lb] = [r, g, b].map(lin);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  };
  // Keyword colours of Monaco's built-in themes.
  const keyword = { light: hexHue('#0000ff'), dark: hexHue('#569cd6') };
  for (const [themeName, nextTheme, curTheme] of [
    ['light', next.light, cur.light],
    ['dark', next.dark, cur.dark],
  ]) {
    const hueIn = (theme, ramps) => {
      const alias = /^var\(--color-([a-z0-9-]+)\)$/.exec(theme.get('accent') ?? '');
      return alias ? ramps.get(alias[1])?.h : undefined;
    };
    const now = hueDistance(hueIn(nextTheme, next.ramps) ?? 0, keyword[themeName]);
    const before = hueDistance(hueIn(curTheme, cur.ramps) ?? 0, keyword[themeName]);
    check(
      'meaning',
      `${themeName}: accent stays clear of Monaco's stock keyword hue (>= 20 deg, or no closer than today)`,
      now >= 20 || now >= before - 0.5,
      `${now.toFixed(0)} deg (today ${before.toFixed(0)}); or define a Monaco theme from the tokens`,
    );
  }
}

// ---------------------------------------------------------------------------
// 6. Rules this proposal lifts. Not failures by themselves - lifting rules is
// what a redesign is for - but each one must be named in the brief, or the
// proposal is quietly changing a decision nobody agreed to change.

const valueOf = (text, name) => new RegExp(`${name}:\\s*([^;]+);`).exec(text)?.[1].trim();
const lifted = [];
const compare = (name, rule, keywords) => {
  const [a, b] = [valueOf(current, name), valueOf(proposal, name)];
  if (a !== b) lifted.push({ name, from: a, to: b, rule, keywords });
};
compare('--spacing', 'DESIGN.md 6: 8-pt rhythm on a 4px step', ['spacing', 'grid', 'density']);
for (const r of ['xs', 'sm', 'md', 'lg']) {
  compare(`--radius-${r}`, 'DESIGN.md 6: radius by size', ['radius', 'corner']);
}
for (const t of ['2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl']) {
  compare(`--text-${t}`, 'DESIGN.md 5: the type scale, 14px base', ['type', 'size', 'scale']);
}
compare('--font-sans', 'DESIGN.md 5: Inter for the interface', ['font', 'typeface', 'inter']);
compare('--font-mono', 'DESIGN.md 5: JetBrains Mono for code', ['font', 'mono', 'jetbrains']);
compare('--shadow-overlay', 'DESIGN.md 6: elevation levels', ['shadow', 'elevation']);
const accentHue = (text) =>
  /--color-accent-600:\s*oklch\([\d.]+\s+[\d.]+\s+([\d.]+)/.exec(text)?.[1];
const [hueBefore, hueAfter] = [accentHue(current), accentHue(proposal)];
if (hueBefore && hueAfter && hueDistance(Number(hueBefore), Number(hueAfter)) > 10) {
  lifted.push({
    name: 'accent hue',
    from: hueBefore,
    to: hueAfter,
    rule: 'DESIGN.md 4: the accent',
    keywords: ['accent', 'hue', 'blue', 'indigo', 'violet'],
  });
}

// With --brief, each lifted rule must appear in its "Settled rules to lift" section.
const briefAt = process.argv.indexOf('--brief');
if (briefAt !== -1) {
  const brief = fs.readFileSync(path.resolve(process.argv[briefAt + 1]), 'utf8');
  const section = (
    /##\s*Settled rules to lift([\s\S]*?)(\n##\s|$)/i.exec(brief)?.[1] ?? ''
  ).toLowerCase();
  const seen = new Set();
  for (const l of lifted) {
    if (seen.has(l.rule)) continue;
    seen.add(l.rule);
    check(
      'brief',
      `the brief lifts "${l.rule}"`,
      l.keywords.some((k) => section.includes(k)),
      `${l.name}: ${String(l.from)} -> ${String(l.to)}; add it to "Settled rules to lift" with the owner's yes, or revert it`,
    );
  }
}

// ---------------------------------------------------------------------------

const failed = checks.filter((c) => !c.ok);
if (asJson) {
  console.log(JSON.stringify({ ok: !failed.length, checks, ratios, lifted }, null, 2));
} else {
  const lines = [`# Proposal check - ${path.relative(REPO_ROOT, path.resolve(file))}`, ''];
  lines.push(
    failed.length
      ? `**${String(failed.length)} failed** of ${String(checks.length)}.`
      : `All ${String(checks.length)} checks pass.`,
    '',
  );
  for (const group of ['shape', 'contrast', 'meaning', 'platform', 'brief']) {
    if (group === 'brief' && !checks.some((c) => c.group === 'brief')) continue;
    const inGroup = checks.filter((c) => c.group === group);
    const bad = inGroup.filter((c) => !c.ok);
    lines.push(`## ${group}: ${String(inGroup.length - bad.length)}/${String(inGroup.length)}`);
    for (const c of bad) lines.push(`- FAIL ${c.name}${c.detail ? ` - ${c.detail}` : ''}`);
    lines.push('');
  }
  // The tightest pairs are where a redesign usually breaks next; show them.
  const tight = ratios
    .map((r) => ({ ...r, margin: r.ratio / r.floor }))
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 6);
  lines.push('## Tightest contrast pairs', '');
  for (const r of tight)
    lines.push(
      `- ${r.theme}: --${r.fg} on --${r.bg} = ${String(r.ratio)}:1 (floor ${String(r.floor)})`,
    );
  lines.push('', '## Rules this proposal lifts', '');
  if (!lifted.length)
    lines.push('None: every scale, font, shadow and the accent hue are as today.');
  for (const l of lifted) {
    lines.push(`- ${l.name}: \`${String(l.from)}\` -> \`${String(l.to)}\` (${l.rule})`);
  }
  if (lifted.length && briefAt === -1) {
    lines.push('', 'Run again with `--brief <brief.md>` to check each is agreed in the brief.');
  }
  console.log(lines.join('\n'));
}
process.exitCode = failed.length ? 1 : 0;
