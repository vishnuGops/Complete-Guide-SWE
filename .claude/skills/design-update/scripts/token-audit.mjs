#!/usr/bin/env node
/**
 * Static token audit of apps/web/src: every place the source reaches past the
 * semantic tokens, with file:line, grouped by the DESIGN.md rule it breaks.
 *
 * The design-update skill's other half. `capture.mjs` sees what the browser
 * paints; this sees what the code asks for, including states no screenshot
 * caught (a hover colour, an error branch, a dialog nobody opened).
 *
 *   node .claude/skills/design-update/scripts/token-audit.mjs            # markdown to stdout
 *   node .claude/skills/design-update/scripts/token-audit.mjs --json
 *   node .claude/skills/design-update/scripts/token-audit.mjs --changed main   # only files changed since <ref>
 *
 * Exit code is 1 when any `error`-severity finding exists, so it can gate a pass.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const SRC = path.join(REPO_ROOT, 'apps', 'web', 'src');

const asJson = process.argv.includes('--json');
const changedAt = process.argv.indexOf('--changed');
const changedRef = changedAt === -1 ? undefined : process.argv[changedAt + 1];

/** Where ramps and raw values are defined on purpose. */
const DEFINITIONS = new Set([path.join(SRC, 'styles', 'tokens.css')]);

const PREFIX =
  '(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|fill|stroke|from|via|to|divide|placeholder|decoration|caret|accent|shadow)';
const TW_PALETTE =
  'slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

/**
 * Each rule: what it matches, the DESIGN.md section it enforces, and severity.
 * `error` breaks a written rule; `warn` needs a person to decide.
 */
const RULES = [
  {
    id: 'ramp-class',
    severity: 'error',
    section: '4',
    why: 'A ramp colour in a component hard-codes one theme. Use the semantic token; add one if none fits.',
    re: new RegExp(
      `(?<![\\w-])(?:[\\w-]+:)*${PREFIX}-(?:neutral|accent|success|warn|danger)-\\d{1,4}(?:\\/\\d+)?\\b`,
      'g',
    ),
  },
  {
    id: 'tailwind-palette',
    severity: 'error',
    section: '3, 4',
    why: "Tailwind's default palette is the look section 3 rules out, and it is not themed.",
    re: new RegExp(
      `(?<![\\w-])(?:[\\w-]+:)*${PREFIX}-(?:${TW_PALETTE})-\\d{2,3}(?:\\/\\d+)?\\b|(?<![\\w-])(?:[\\w-]+:)*${PREFIX}-(?:white|black)\\b`,
      'g',
    ),
  },
  {
    id: 'raw-color',
    severity: 'error',
    section: '4',
    why: 'Raw colour outside tokens.css. Point it at a token (CSS: var(--color-...)).',
    re: /#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(\s*[\d.]/g,
    skipLine: /^\s*(\/\/|\*|\/\*)|&#|href=|url\(/,
  },
  {
    id: 'arbitrary-color',
    severity: 'error',
    section: '4',
    why: 'Arbitrary colour value in a class. Use a semantic token.',
    re: new RegExp(
      `${PREFIX}-\\[(?:#|rgb|hsl|oklch|color:|var\\(--color-(?:neutral|accent|success|warn|danger)-)[^\\]]*\\]`,
      'g',
    ),
  },
  {
    id: 'gradient',
    severity: 'error',
    section: '3, 6',
    why: 'No gradients, except the area fill under a chart line (say so in a comment beside it).',
    re: /\bbg-(?:gradient|linear|radial|conic)-[\w-]+|\b(?:linear|radial|conic)-gradient\(/g,
  },
  {
    id: 'shadow',
    severity: 'warn',
    section: '6',
    why: 'Two shadows only: shadow-card on cards (light theme), shadow-overlay on what floats (tooltip, menu, palette, dialog).',
    re: /(?<![\w-])(?:[\w-]+:)*shadow(?:-(?!overlay\b|card\b|none\b)[\w[\]/.-]+)?(?![\w-])/g,
    skipLine: /box-shadow:\s*none/,
  },
  {
    id: 'radius',
    severity: 'warn',
    section: '6',
    why: 'Radius by size: cards rounded-xl (16px) and nothing rounder; rounded-full only for the primary pill, delta chips, dots and avatars.',
    re: /(?<![\w-])(?:[\w-]+:)*rounded(?:-[trblse]{1,2})?-(?:2xl|3xl|4xl|full|\[[^\]]+\])(?![\w-])/g,
    // A status dot (size-2, size-2.5 ...) is round by definition.
    allowIf: /\bsize-[0-3](?:\.5)?(?![\w.-])/,
  },
  {
    id: 'weight-700',
    severity: 'error',
    section: '5',
    why: '700 only on stat numerals of 28px and up (text-2xl, text-3xl); elsewhere 400 text, 500 controls, 600 headings.',
    // A stat numeral is allowed its 700.
    allowIf: /\btext-(?:2xl|3xl)\b/,
    re: /(?<![\w-])(?:[\w-]+:)*font-(?:bold|extrabold|black)(?![\w-])|font-weight:\s*(?:bold|[7-9]00)/g,
  },
  {
    id: 'arbitrary-type',
    severity: 'warn',
    section: '5',
    why: 'Off-scale type size. Use text-2xs ... text-3xl.',
    re: /(?<![\w-])(?:[\w-]+:)*(?:text|leading)-\[\d[^\]]*\]|(?<![\w-])text-(?:4xl|5xl|6xl|7xl|8xl|9xl)(?![\w-])|font-size:\s*\d+(?:\.\d+)?px/g,
    // The root size in base.css is what rem is measured against, not a text size.
    allowIf: /^\s*font-size:\s*16px;/,
  },
  {
    id: 'arbitrary-space',
    severity: 'warn',
    section: '6',
    why: 'Arbitrary spacing. Use the 4px step; odd steps are the deliberate half-step.',
    re: /(?<![\w-])(?:[\w-]+:)*-?(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|top|right|bottom|left)-\[\d[^\]]*\]/g,
  },
  {
    id: 'spacing-var',
    severity: 'error',
    section: '6',
    why: 'There is no --spacing-N in Tailwind v4; write calc(var(--spacing) * N). The declaration is silently dropped.',
    re: /var\(--spacing-\d+\)/g,
  },
  {
    id: 'motion',
    severity: 'warn',
    section: '1, 11',
    why: 'Motion is 75ms, colour and opacity. No transition-all, no transforms on interaction, no entrance animations.',
    re: /(?<![\w-])(?:[\w-]+:)*(?:transition-all|duration-(?!75\b|0\b)\d+|animate-(?!none\b)[\w-]+|(?:hover|active|focus):(?:scale|translate|rotate)-[\w-]+)(?![\w-])|transition:\s*all\b/g,
  },
  {
    id: 'focus-removed',
    severity: 'error',
    section: '9',
    why: 'The focus ring is never removed. Use focus-ring / focus-ring-inset.',
    re: /(?<![\w-])(?:focus(?:-visible)?:)?(?:outline-none|outline-0|ring-0)(?![\w-])|outline:\s*(?:none|0)\b/g,
    // Allowed when the same line re-adds a ring.
    allowIf: /focus-ring/,
  },
  {
    id: 'dark-variant',
    severity: 'warn',
    section: '4',
    why: 'dark: is the escape hatch. Several in one component means the component is missing a token.',
    re: /(?<![\w-])dark:[\w-[\]/.]+/g,
  },
  {
    id: 'emoji',
    severity: 'error',
    section: '3',
    why: 'No emoji in UI chrome.',
    re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}]/gu,
    skipLine: /^\s*(\/\/|\*|\/\*)/,
  },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

let files = walk(SRC);
if (changedRef) {
  const changed = new Set(
    execFileSync('git', ['diff', '--name-only', changedRef, '--', 'apps/web/src'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .map((f) => path.join(REPO_ROOT, f)),
  );
  files = files.filter((f) => changed.has(f));
}

const findings = [];
for (const file of files) {
  if (DEFINITIONS.has(file)) continue;
  const rel = path.relative(REPO_ROOT, file).replaceAll('\\', '/');
  const devOnly = rel.includes('/src/dev/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let inBlockComment = false;
  lines.forEach((line, i) => {
    // Comments explain rules by naming what they forbid; do not flag the explanation.
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith('/*') && !trimmed.includes('*/')) {
      inBlockComment = true;
      return;
    }
    if (/^(\/\/|\*|\/\*)/.test(trimmed)) return;
    for (const rule of RULES) {
      if (rule.skipLine?.test(line)) continue;
      if (rule.allowIf?.test(line)) continue;
      for (const match of line.matchAll(rule.re)) {
        findings.push({
          rule: rule.id,
          severity: devOnly ? 'info' : rule.severity,
          file: rel,
          line: i + 1,
          match: match[0],
          context: trimmed.slice(0, 140),
        });
      }
    }
  });
}

// dark: is only a finding when a file leans on it; one or two is the hatch working.
const darkPerFile = new Map();
for (const f of findings.filter((f) => f.rule === 'dark-variant'))
  darkPerFile.set(f.file, (darkPerFile.get(f.file) ?? 0) + 1);
const kept = findings.filter(
  (f) => f.rule !== 'dark-variant' || (darkPerFile.get(f.file) ?? 0) > 2,
);

if (asJson) {
  console.log(JSON.stringify({ scanned: files.length, findings: kept }, null, 2));
} else {
  const out = [
    `# Token audit - ${String(files.length)} files in apps/web/src${changedRef ? ` changed since ${changedRef}` : ''}`,
    '',
  ];
  const bySeverity = { error: 0, warn: 0, info: 0 };
  for (const f of kept) bySeverity[f.severity]++;
  out.push(
    `${String(bySeverity.error)} error, ${String(bySeverity.warn)} warn, ${String(bySeverity.info)} info (dev-only screens).`,
    '',
  );
  for (const rule of RULES) {
    const hits = kept.filter((f) => f.rule === rule.id);
    if (!hits.length) continue;
    out.push(
      `## ${rule.id} (${rule.severity}, DESIGN.md section ${rule.section}) - ${String(hits.length)}`,
      '',
      rule.why,
      '',
    );
    for (const h of hits.filter((h) => h.severity !== 'info'))
      out.push(`- \`${h.file}:${String(h.line)}\` \`${h.match}\``);
    // Dev-only screens (the kitchen sink shows the ramps on purpose): a count, not a list.
    const dev = new Map();
    for (const h of hits.filter((h) => h.severity === 'info'))
      dev.set(h.file, (dev.get(h.file) ?? 0) + 1);
    for (const [file, n] of dev) out.push(`- \`${file}\` ${String(n)} (dev only, not a finding)`);
    out.push('');
  }
  if (!kept.length)
    out.push('Nothing found. Every class and declaration goes through a semantic token.');
  console.log(out.join('\n'));
}

process.exitCode = kept.some((f) => f.severity === 'error') ? 1 : 0;
