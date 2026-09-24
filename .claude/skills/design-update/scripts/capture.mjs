#!/usr/bin/env node
/**
 * Capture every screen of the built app, in both themes and at two widths, and
 * measure what it actually paints against the tokens in `tokens.css`.
 *
 * The design-update skill's eyes. `apps/web/scripts/screenshots.mjs` takes four
 * pictures for the README; this takes all of them, plus the states a README
 * never shows (empty, failed, first run, a dialog open), and for each one
 * writes down every colour, size, radius, shadow and duration on screen and
 * whether a token accounts for it. A screenshot says something looks off; the
 * inventory says which element and which value.
 *
 * Output goes under `data/` because it is gitignored and is where everything
 * this project writes lives. Its own database, so a run never touches the
 * developer's practice history.
 *
 *   node .claude/skills/design-update/scripts/capture.mjs
 *   node .claude/skills/design-update/scripts/capture.mjs --only workspace,settings --widths 1440
 *   node .claude/skills/design-update/scripts/capture.mjs --url http://127.0.0.1:5173   # dev server (adds /dev/kitchen-sink)
 *   node .claude/skills/design-update/scripts/capture.mjs --out data/design-audit/after --no-axe
 *
 * Redesign previews (see reference/redesign.md) - the same app, the same
 * screens, with a proposed token file laid over the built CSS at load time, so
 * nothing in the source changes until a proposal is approved:
 *
 *   capture.mjs --out <run>/r1/capture --inject-tokens <run>/r1/tokens.css [--inject-css <run>/r1/extra.css] [--scale <run>/r1/scale.json]
 *
 * `--inject-tokens` takes a full candidate tokens.css and keeps only its
 * variable blocks (the @utility and @custom-variant blocks need a build).
 * `--inject-css` adds plain CSS on top, e.g. an @font-face for a font under
 * node_modules, reachable at `/__design-preview/node_modules/...`.
 * `--scale` is JSON `{ "fontWeight": [...], "durationMs": [...] }` when the
 * proposal changes those; type sizes and radii are read from the page.
 */

/* `inventory` below runs inside the page, where these exist. */
/* global document, getComputedStyle */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const SERVER_ENTRY = path.join(REPO_ROOT, 'apps', 'server', 'dist', 'start.js');
const WEB_INDEX = path.join(REPO_ROOT, 'apps', 'web', 'dist', 'index.html');
const CLIENT_HEADERS = { 'X-DevProMax-Client': 'devpromax-web' };

function arg(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}
const flag = (name) => process.argv.includes(name);

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT_DIR = path.resolve(REPO_ROOT, arg('--out') ?? path.join('data', 'design-audit', stamp));
const PORT = Number(arg('--port') ?? 5196);
const external = arg('--url');
const base = external ?? `http://127.0.0.1:${String(PORT)}`;
const ONLY = arg('--only')?.split(',');
const WIDTHS = (arg('--widths') ?? '1440,1024').split(',').map(Number);
const HEIGHT_FOR = { 1440: 900, 1024: 768 };
const THEMES = (arg('--themes') ?? 'light,dark').split(',');
const AXE = !flag('--no-axe');
const INJECT_TOKENS = arg('--inject-tokens');
const INJECT_CSS = arg('--inject-css');
const SCALE_FILE = arg('--scale');

/**
 * A tokens.css reduced to what a browser can apply on top of the built CSS:
 * `@theme` / `@theme inline` become `:root`, the theme blocks and the
 * dark-mode media query stay, and Tailwind-only at-rules (@utility,
 * @custom-variant, @keyframes) are dropped because they only mean something to
 * the compiler. Utilities read `var(--color-*)`, `var(--text-*)`,
 * `var(--radius-*)`, `var(--spacing)` and `var(--font-*)` at runtime, so
 * colour, type, density, radius and font all preview faithfully; shadows are
 * compiled into their utilities and need the build step to show.
 */
function previewCss(source) {
  const text = source.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open === -1) break;
    const selector = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1);
    if (/^@theme\b/.test(selector)) out.push(`:root {${body}}`);
    else if (/^(:root|@media)/.test(selector)) out.push(`${selector} {${body}}`);
    i = j;
  }
  return out.join('\n');
}

let injected = '';
if (INJECT_TOKENS) injected += previewCss(fs.readFileSync(path.resolve(INJECT_TOKENS), 'utf8'));
if (INJECT_CSS) injected += `\n${fs.readFileSync(path.resolve(INJECT_CSS), 'utf8')}`;

/** Solved, with a draft and a note, so the list, workspace and dashboard have content. */
const SOLVED = 'balance-point';
/** Left on its starter, so Run shows a failing verdict. */
const UNSOLVED = 'pair-sum-index';
const ALSO_SOLVED = [
  ['arrays', 'running-maximum'],
  ['hashmap', 'first-unique-symbol'],
  ['binary-search', 'insert-position'],
  ['stack', 'bracket-balance'],
];

/*
 * Answers the browser is given for states the audit server cannot produce on
 * its own: a coach reply needs a vendor, and a loading or failed screen needs a
 * server that is slow or broken. Fulfilled in the page, never written to the
 * audit database.
 */
const SERVER_ERROR = {
  status: 500,
  json: { error: 'Internal', message: 'The server could not read the database.' },
};

/** A text/event-stream body in the coach's framing (`api/coachStream.ts`). */
function sse(events) {
  return {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
  };
}

const COACH_SESSION = '6f1c2a4e-8d3b-4c7a-9e2f-1b5d7c9a3e60';
const COACH_BODY = [
  'The running total is the right idea, and the loop reads cleanly.',
  '',
  'You compute `sum(values)` once and then walk left to right, which keeps it **O(n)**. The one',
  'thing to check is the empty row: `range(len(values))` never runs, and the function returns',
  '`-1` - which is what the statement asks for, so say so in a comment.',
].join('\n');
const COACH_TURN = [
  { type: 'start', sessionId: COACH_SESSION },
  { type: 'markdown', delta: COACH_BODY },
  {
    type: 'done',
    feedback: {
      summary: 'Linear, correct, and one comment away from finished.',
      scores: {
        correctness: 4,
        timeComplexity: 4,
        spaceComplexity: 4,
        edgeCases: 3,
        readability: 4,
      },
      feedbackMarkdown: COACH_BODY,
      nextHintLevel: null,
      nextStep: 'Add a line saying why an empty row returns -1.',
      mastered: false,
    },
  },
];

const CANDIDATE_TURN =
  'I would keep a map from each value to its index, and for each new value look up target minus it.';
const INTERVIEWER_TURN =
  'That works for the pair. What does the map hold when the same value appears twice, and does the order you insert in change the answer?';

/** An interview forty minutes from its end, on two problems nobody has solved. */
async function runningSitting() {
  const response = await fetch(`${base}/api/problems?status=not_started`, {
    headers: CLIENT_HEADERS,
  });
  const { items } = await response.json();
  return {
    id: '3b9e5c1d-2f4a-4e8b-a7c6-5d0e1f2a3b4c',
    problems: items.slice(0, 2).map((problem) => ({
      slug: problem.slug,
      title: problem.title,
      topic: problem.topic,
      tier: problem.tier,
      rating: problem.rating,
      attempted: false,
      solved: false,
    })),
    budgetMs: 45 * 60_000,
    at: 0,
    stage: 'approach',
    sessionId: COACH_SESSION,
    debrief: null,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    endedAt: null,
    remainingMs: 45 * 60_000,
  };
}

/*
 * The token scale, in pixels, as tokens.css and DESIGN.md sections 4-5 define it.
 * Colours are not listed here: they are read from the running page, so a token
 * edit is picked up without touching this file.
 */
const SCALE = {
  fontSize: [11, 12, 13, 14, 16, 18, 22, 28, 36],
  // 700 is allowed on stat numerals of 28px and up (DESIGN.md 5, version 2).
  fontWeight: [400, 500, 600, 700],
  radius: [0, 4, 6, 8, 12, 16],
  durationMs: [0, 75],
  ...(SCALE_FILE ? JSON.parse(fs.readFileSync(path.resolve(SCALE_FILE), 'utf8')) : {}),
};
const TYPE_TOKENS = ['2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl'];
const RADIUS_TOKENS = ['xs', 'sm', 'md', 'lg', 'xl'];
const SEMANTIC_COLORS = [
  'bg',
  'surface',
  'surface-raised',
  'surface-sunken',
  'overlay',
  'overlay-scrim',
  'fg',
  'fg-muted',
  'fg-subtle',
  'fg-on-accent',
  'border',
  'border-strong',
  'border-hover',
  'border-input',
  'accent',
  'accent-hover',
  'accent-fg',
  'accent-subtle',
  'surface-selected',
  'code-keyword',
  'success',
  'success-fg',
  'success-subtle',
  'warn',
  'warn-fg',
  'warn-subtle',
  'danger',
  'danger-fg',
  'danger-subtle',
  'danger-solid',
  'focus',
];
const RAMP_COLORS = [
  ...[
    0, 50, 100, 150, 200, 300, 400, 500, 525, 575, 600, 700, 750, 800, 850, 875, 900, 950, 1000,
  ].map((n) => `neutral-${n}`),
  ...[100, 200, 300, 400, 500, 550, 600, 700, 800, 900, 950].map((n) => `accent-${n}`),
  ...[300, 700].map((n) => `keyword-${n}`),
  ...[100, 300, 500, 700, 900].flatMap((n) => [`success-${n}`, `warn-${n}`]),
  ...[100, 300, 500, 600, 700, 900].map((n) => `danger-${n}`),
];

/**
 * Every screen and state worth looking at. `setup` runs after the theme is set
 * and must leave the page settled; `once` shots are taken at the first width only.
 */
const SHOTS = [
  {
    name: 'list',
    async setup(page) {
      await page.goto(`${base}/`);
      await page.getByRole('heading', { name: 'Problems' }).waitFor();
      await page.getByRole('row').nth(3).waitFor();
    },
  },
  {
    name: 'list-empty-filter',
    async setup(page) {
      await page.goto(`${base}/`);
      await page.getByPlaceholder('Search titles, patterns and notes').fill('zzzz no such problem');
      await page.getByRole('button', { name: 'Clear all filters' }).waitFor();
    },
  },
  {
    name: 'list-welcome',
    async setup(page) {
      await putSettings({ welcomeDismissed: false });
      await page.goto(`${base}/`);
      await page.getByRole('complementary', { name: 'Welcome' }).waitFor();
    },
    // After the screenshot, not in setup, or the panel would be gone before it.
    async teardown() {
      await putSettings({ welcomeDismissed: true });
    },
  },
  {
    name: 'command-palette',
    async setup(page) {
      await page.goto(`${base}/`);
      await page.getByRole('heading', { name: 'Problems' }).waitFor();
      await page.keyboard.press('Control+K');
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'workspace',
    async setup(page) {
      await page.goto(`${base}/problems/${SOLVED}`);
      await page.locator('[data-testid="editor"] .monaco-editor').waitFor();
    },
  },
  {
    name: 'workspace-accepted',
    async setup(page) {
      await page.goto(`${base}/problems/${SOLVED}`);
      await page.locator('[data-testid="editor"] .monaco-editor').waitFor();
      await page.getByRole('button', { name: 'Run' }).click();
      await page
        .getByTestId('verdict')
        .filter({ hasText: 'Accepted' })
        .waitFor({ timeout: 120_000 });
    },
  },
  {
    name: 'workspace-failed',
    async setup(page) {
      await page.goto(`${base}/problems/${UNSOLVED}`);
      await page.locator('[data-testid="editor"] .monaco-editor').waitFor();
      await page.getByRole('button', { name: 'Run' }).click();
      await page
        .getByTestId('verdict')
        .filter({ hasText: /wrong|error|limit|failed/i })
        .waitFor({ timeout: 120_000 });
    },
  },
  {
    // The focus ring on the primary action, the one place it sits next to an accent fill.
    name: 'workspace-focus',
    async setup(page) {
      await page.goto(`${base}/problems/${SOLVED}`);
      await page.locator('[data-testid="editor"] .monaco-editor').waitFor();
      // A key press first, so the browser treats the next focus as keyboard focus (:focus-visible).
      await page.keyboard.press('Shift');
      await page.getByRole('button', { name: 'Submit' }).focus();
    },
  },
  {
    name: 'workspace-hints',
    async setup(page) {
      await page.goto(`${base}/problems/${SOLVED}`);
      await page.locator('[data-testid="editor"] .monaco-editor').waitFor();
      await page.getByRole('tab', { name: 'Hints' }).click();
      await page.getByRole('button', { name: /Show the (first|next) hint/ }).click();
    },
  },
  {
    name: 'workspace-coach',
    async setup(page) {
      await page.goto(`${base}/problems/${SOLVED}`);
      await page.locator('[data-testid="editor"] .monaco-editor').waitFor();
      await page.getByRole('tab', { name: 'Coach' }).click();
      await page.getByRole('button', { name: /Ask for help/i }).waitFor();
    },
  },
  {
    // A coached answer: summary and body in the coach's serif, the next step, the rubric.
    name: 'workspace-coach-reply',
    async setup(page) {
      await page.route('**/api/coach/feedback', (route) => route.fulfill(sse(COACH_TURN)));
      await page.goto(`${base}/problems/${SOLVED}`);
      await page.locator('[data-testid="editor"] .monaco-editor').waitFor();
      await page.getByRole('tab', { name: 'Coach' }).click();
      await page.getByRole('button', { name: /Ask for help/i }).click();
      await page.getByText(COACH_TURN.at(-1).feedback.summary).waitFor();
    },
  },
  {
    // The row holding keyboard focus: its 2px accent bar and the link's ring.
    name: 'list-keyboard',
    async setup(page) {
      await page.goto(`${base}/`);
      await page.getByRole('row').nth(3).waitFor();
      await page.keyboard.press('Shift');
      await page.getByRole('link', { name: 'Highest So Far' }).focus();
    },
  },
  {
    // Held in flight, so the skeleton (shown after 150ms) is what is on screen.
    name: 'list-loading',
    async setup(page) {
      await page.route('**/api/problems?*', () => new Promise(() => undefined));
      await page.route('**/api/problems', () => new Promise(() => undefined));
      await page.goto(`${base}/`);
      await page.getByText('Loading problems').waitFor({ state: 'attached' });
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'list-error',
    async setup(page) {
      await page.route('**/api/problems?*', (route) => route.fulfill(SERVER_ERROR));
      await page.route('**/api/problems', (route) => route.fulfill(SERVER_ERROR));
      await page.goto(`${base}/`);
      await page.getByRole('button', { name: 'Try again' }).waitFor();
    },
  },
  {
    name: 'progress',
    async setup(page) {
      await page.goto(`${base}/progress`);
      await page.getByRole('heading', { name: 'Progress' }).waitFor();
    },
  },
  {
    name: 'progress-loading',
    async setup(page) {
      await page.route('**/api/dashboard*', () => new Promise(() => undefined));
      await page.goto(`${base}/progress`);
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'progress-error',
    async setup(page) {
      await page.route('**/api/dashboard*', (route) => route.fulfill(SERVER_ERROR));
      await page.goto(`${base}/progress`);
      await page.getByRole('button', { name: 'Try again' }).waitFor();
    },
  },
  {
    name: 'interview',
    async setup(page) {
      await page.goto(`${base}/interview`);
      await page.getByRole('heading', { name: 'Mock interview' }).waitFor();
    },
  },
  {
    /*
     * A sitting under way, with one exchange in the transcript. Both the sitting
     * and the interviewer's turn are answered in the browser, so the audit
     * database never holds a running interview for the idle shot above to find.
     */
    name: 'interview-running',
    async setup(page) {
      const sitting = await runningSitting();
      await page.route('**/api/interview', (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ json: { interview: sitting } })
          : route.fallback(),
      );
      await page.route('**/api/interview/*/say', (route) =>
        route.fulfill(
          sse([
            { type: 'start', sessionId: sitting.sessionId },
            { type: 'markdown', delta: INTERVIEWER_TURN },
          ]),
        ),
      );
      await page.goto(`${base}/interview`);
      await page.getByRole('timer', { name: 'Time remaining' }).waitFor();
      await page.getByLabel('What you would say').fill(CANDIDATE_TURN);
      await page.getByRole('button', { name: 'Say it' }).click();
      await page.getByText(INTERVIEWER_TURN.slice(0, 40)).waitFor();
    },
  },
  {
    name: 'settings',
    async setup(page) {
      await page.goto(`${base}/settings`);
      await page.getByRole('heading', { name: 'Settings' }).waitFor();
    },
  },
  {
    name: 'not-found',
    async setup(page) {
      await page.goto(`${base}/no-such-page`);
      await page.getByText('No such page.').waitFor();
    },
  },
  {
    name: 'too-narrow',
    width: 800,
    once: true,
    async setup(page) {
      await page.goto(`${base}/`);
      await page.getByRole('heading', { name: 'This window is too narrow.' }).waitFor();
    },
  },
  {
    // Only on a dev server; the production build has no such route.
    name: 'kitchen-sink',
    devOnly: true,
    async setup(page) {
      await page.goto(`${base}/dev/kitchen-sink`);
      await page.waitForLoadState('networkidle');
    },
  },
];

async function putSettings(body) {
  const response = await fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`settings write failed: ${String(response.status)}`);
}

async function post(url, body, method = 'POST') {
  await fetch(`${base}${url}`, {
    method,
    headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function waitForHealth(deadlineMs = 30_000) {
  const until = Date.now() + deadlineMs;
  for (;;) {
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {
      // Not up yet.
    }
    if (Date.now() > until) throw new Error(`no /health from ${base}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function seed() {
  const read = (topic, slug) => {
    const file = path.join(REPO_ROOT, 'problems', topic, slug, 'reference.py');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
  };
  const reference = read('arrays', SOLVED);
  if (reference) {
    await post('/api/submit', { slug: SOLVED, language: 'python', code: reference });
    await post(`/api/drafts/${SOLVED}/python`, { code: reference }, 'PUT');
  }
  for (const [topic, slug] of ALSO_SOLVED) {
    const code = read(topic, slug);
    if (code) await post('/api/submit', { slug, language: 'python', code });
  }
  await post(`/api/notes/${SOLVED}`, { body: 'The prefix sum is the whole trick.' }, 'PUT');
  /*
   * The failed-run shot clicks Run on UNSOLVED, which marks it In progress. Run
   * it here too, so every shot sees the same data whatever order it is taken
   * in. Otherwise the list before that shot says Not started and after it In
   * progress, and a before/after pair shows a data change as if it were a
   * design change.
   */
  const starter = path.join(REPO_ROOT, 'problems', 'arrays', UNSOLVED, 'starter.py');
  if (fs.existsSync(starter)) {
    await post('/api/run', {
      slug: UNSOLVED,
      language: 'python',
      code: fs.readFileSync(starter, 'utf8'),
    });
  }
  await putSettings({ welcomeDismissed: true });
}

/**
 * Runs in the page. Walks every visible element outside Monaco and tallies the
 * values it paints, then says which of them no token accounts for, with a few
 * selectors per value so the finding can be traced to a component.
 */
function inventory({ semantic, ramps, scale: fixedScale, typeTokens, radiusTokens }) {
  const probe = document.createElement('div');
  document.body.appendChild(probe);
  /*
   * Type sizes and radii come from the page's own variables when it has them,
   * so a proposal that changes the scale is measured against its own scale.
   */
  const px = (v) => Number.parseFloat(v);
  const live = (prop, names, prefix) =>
    names
      .map((n) => {
        probe.style[prop] = '';
        probe.style[prop] = `var(--${prefix}-${n})`;
        return px(getComputedStyle(probe)[prop]);
      })
      .filter((v) => v > 0);
  const liveType = live('fontSize', typeTokens, 'text');
  const liveRadius = live('borderTopLeftRadius', radiusTokens, 'radius');
  const scale = {
    ...fixedScale,
    fontSize: liveType.length ? liveType : fixedScale.fontSize,
    radius: liveRadius.length ? [0, ...liveRadius] : fixedScale.radius,
  };
  probe.style.fontSize = '';
  probe.style.borderTopLeftRadius = '';
  // The grid is half of whatever --spacing is (4px today: odd steps are 2px half-steps).
  // Read from the variable, not a probe's width: layout rounds to 1/64px, and that error grows with the multiple.
  const rootPx = px(getComputedStyle(document.documentElement).fontSize) || 16;
  const spacingVar = getComputedStyle(document.documentElement)
    .getPropertyValue('--spacing')
    .trim();
  const step = spacingVar.endsWith('rem') ? px(spacingVar) * rootPx : px(spacingVar) || 4;
  const half = step / 2;
  const onGrid = (v) => Math.abs(v - Math.round(v / half) * half) < 0.1;
  /*
   * Semantic tokens are read from their theme variables (`--surface`), not from
   * `--color-surface`: that one is declared `@theme inline`, so Tailwind never
   * emits it. Each probe starts from a sentinel so an unresolved variable reads
   * as unresolved rather than as the previous token's colour.
   */
  const SENTINEL = 'rgb(1, 2, 3)';
  const resolve = (variable) => {
    probe.style.color = SENTINEL;
    probe.style.color = `var(${variable}, ${SENTINEL})`;
    const value = getComputedStyle(probe).color;
    return value === SENTINEL ? undefined : value;
  };
  const tokenOf = new Map();
  for (const name of semantic) {
    const value = resolve(`--${name}`);
    if (value && !tokenOf.has(value)) tokenOf.set(value, name);
  }
  const rampOf = new Map();
  for (const name of ramps) {
    const value = resolve(`--color-${name}`);
    if (value && !rampOf.has(value)) rampOf.set(value, name);
  }
  probe.remove();

  const describe = (el) => {
    const parts = [];
    for (
      let node = el, depth = 0;
      node && node !== document.body && depth < 3;
      node = node.parentElement, depth++
    ) {
      let part = node.tagName.toLowerCase();
      const id =
        node.getAttribute('data-testid') ??
        node.getAttribute('aria-label') ??
        node.getAttribute('role');
      if (id) part += `[${id.slice(0, 30)}]`;
      const cls =
        typeof node.className === 'string'
          ? node.className.trim().split(/\s+/).slice(0, 4).join('.')
          : '';
      if (cls && depth === 0) part += `.${cls}`;
      parts.unshift(part);
    }
    return parts.join(' > ');
  };

  const findings = new Map(); // key -> { kind, value, count, where[] }
  const note = (kind, value, el, extra) => {
    const key = `${kind}|${value}`;
    const entry = findings.get(key) ?? { kind, value, count: 0, where: [], ...extra };
    entry.count++;
    if (entry.where.length < 4) entry.where.push(describe(el));
    findings.set(key, entry);
  };
  const used = { colors: {}, fontSize: {}, fontWeight: {}, radius: {}, spacing: {} };
  const bump = (bucket, value) => (bucket[value] = (bucket[value] ?? 0) + 1);

  const isTransparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent' || /\/ 0\)$/.test(c);
  const checkColor = (prop, value, el) => {
    if (!value || isTransparent(value) || value === 'currentcolor') return;
    const token = tokenOf.get(value);
    bump(used.colors, token ?? value);
    if (token) return;
    const ramp = rampOf.get(value);
    note(ramp ? 'ramp-color' : 'untokened-color', value, el, { prop, ramp });
  };

  const editor = document.querySelector('[data-testid="editor"]');
  for (const el of document.body.querySelectorAll('*')) {
    if (editor?.contains(el)) continue;
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      checkColor('color', cs.color, el);
      const size = px(cs.fontSize);
      bump(used.fontSize, size);
      if (!scale.fontSize.includes(size)) note('off-scale-font-size', `${size}px`, el);
      const weight = Number(cs.fontWeight);
      bump(used.fontWeight, weight);
      if (!scale.fontWeight.includes(weight)) note('off-scale-font-weight', String(weight), el);
    }
    checkColor('background-color', cs.backgroundColor, el);
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if (px(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none') {
        checkColor(`border-${side.toLowerCase()}-color`, cs[`border${side}Color`], el);
      }
    }
    if (cs.fill && cs.fill !== 'none' && el.tagName.toLowerCase() === 'svg')
      checkColor('fill', cs.fill, el);

    const radius = px(cs.borderTopLeftRadius);
    if (radius > 0) {
      const full = radius >= Math.min(rect.width, rect.height) / 2 - 0.5;
      bump(used.radius, full ? 'full' : radius);
      if (!full && !scale.radius.includes(radius)) note('off-scale-radius', `${radius}px`, el);
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      // Tailwind stacks empty ring/shadow layers; only the visible ones matter.
      const layers = cs.boxShadow
        .split(/,(?![^(]*\))/)
        .map((s) => s.trim())
        .filter((s) => !/^rgba\(0, 0, 0, 0\)/.test(s));
      // A `ring-*` is a zero-blur spread: a border by another name, so check its colour instead.
      const shadows = [];
      for (const layer of layers) {
        const ring = /^(.*\)) 0px 0px 0px [\d.]+px$/.exec(layer);
        if (ring) checkColor('ring', ring[1], el);
        else shadows.push(layer);
      }
      if (shadows.length) note('shadow', shadows.join(', ').slice(0, 120), el);
    }
    if (cs.backgroundImage && /gradient/.test(cs.backgroundImage))
      note('gradient', cs.backgroundImage.slice(0, 60), el);

    for (const prop of [
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'rowGap',
      'columnGap',
    ]) {
      const v = px(cs[prop]);
      if (!v) continue;
      bump(used.spacing, v);
      if (!onGrid(v) && v !== 1) note('off-grid-spacing', `${prop} ${v}px`, el);
    }
    const durations = cs.transitionDuration
      .split(',')
      .map((d) => px(d) * (d.includes('ms') ? 1 : 1000));
    for (const d of durations)
      if (!scale.durationMs.includes(d)) note('off-scale-duration', `${d}ms`, el);
    if (/\ball\b/.test(cs.transitionProperty) && durations.some((d) => d > 0))
      note('transition-all', cs.transitionProperty, el);
  }

  return {
    theme: document.documentElement.getAttribute('data-theme') ?? 'system',
    findings: [...findings.values()].sort((a, b) => b.count - a.count),
    used,
  };
}

// ---------------------------------------------------------------------------

let server;
if (!external) {
  if (!fs.existsSync(SERVER_ENTRY) || !fs.existsSync(WEB_INDEX)) {
    console.error('No build found. Run `npm run build` first; the audit is of what ships.');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  server = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DEVPROMAX_PORT: String(PORT),
      DEVPROMAX_DB: path.join(OUT_DIR, 'audit.db'),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
const browser = await chromium.launch();
try {
  await waitForHealth();
  if (!external) await seed();
  const devServer = Boolean(external);

  for (const [wi, width] of WIDTHS.entries()) {
    for (const theme of THEMES) {
      for (const shot of SHOTS) {
        if (ONLY && !ONLY.some((o) => shot.name.includes(o))) continue;
        if (shot.devOnly && !devServer) continue;
        if (shot.once && wi > 0) continue;
        const w = shot.width ?? width;
        const context = await browser.newContext({
          viewport: { width: w, height: HEIGHT_FOR[width] ?? 900 },
          extraHTTPHeaders: CLIENT_HEADERS,
          // Colours measured mid-transition are colours nobody reads (a11y.spec.ts).
          reducedMotion: 'reduce',
        });
        if (injected) {
          // Appended after the app's stylesheet on every load, so it wins by order.
          await context.addInitScript((css) => {
            const add = () => {
              const style = document.createElement('style');
              style.dataset.designPreview = '';
              style.textContent = css;
              document.head.appendChild(style);
            };
            if (document.head) add();
            else document.addEventListener('DOMContentLoaded', add);
          }, injected);
          // Local assets for the preview (a font under node_modules), repo-confined.
          await context.route('**/__design-preview/**', async (route) => {
            const rel = decodeURIComponent(
              new URL(route.request().url()).pathname.replace(/^\/__design-preview\//, ''),
            );
            const target = path.resolve(REPO_ROOT, rel);
            if (!target.startsWith(REPO_ROOT + path.sep) || !fs.existsSync(target)) {
              await route.fulfill({ status: 404 });
              return;
            }
            const type =
              {
                '.woff2': 'font/woff2',
                '.woff': 'font/woff',
                '.css': 'text/css',
                '.png': 'image/png',
                '.svg': 'image/svg+xml',
              }[path.extname(target)] ?? 'application/octet-stream';
            await route.fulfill({ body: fs.readFileSync(target), contentType: type });
          });
        }
        const page = await context.newPage();
        const file = path.join(String(w), theme, `${shot.name}.png`);
        const entry = { shot: shot.name, width: w, theme, file };
        try {
          await putSettings({ theme });
          await shot.setup(page);
          await page.locator(`html[data-theme="${theme}"]`).waitFor({ timeout: 5_000 });
          // Monaco paints its own theme a frame after the page does.
          await page.waitForTimeout(400);
          fs.mkdirSync(path.join(OUT_DIR, String(w), theme), { recursive: true });
          await page.screenshot({ path: path.join(OUT_DIR, file) });
          // Scanned with reduced motion off, so real transition durations are measured.
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          const inv = await page.evaluate(inventory, {
            semantic: SEMANTIC_COLORS,
            ramps: RAMP_COLORS,
            scale: SCALE,
            typeTokens: TYPE_TOKENS,
            radiusTokens: RADIUS_TOKENS,
          });
          await page.emulateMedia({ reducedMotion: 'reduce' });
          entry.findings = inv.findings;
          entry.used = inv.used;
          if (AXE && w !== 800) {
            const { violations } = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
              .exclude('[data-testid="editor"]')
              .analyze();
            entry.axe = violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              help: v.help,
              nodes: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
            }));
          }
          const flagged = entry.findings.reduce((sum, f) => sum + (f.kind === 'shadow' ? 0 : 1), 0);
          console.log(
            `  ${file.padEnd(40)} ${String(flagged).padStart(3)} value findings${entry.axe ? `, ${String(entry.axe.length)} axe` : ''}`,
          );
        } catch (error) {
          entry.error = String(error instanceof Error ? error.message.split('\n')[0] : error);
          console.log(`  ${file.padEnd(40)} FAILED: ${entry.error}`);
        } finally {
          await shot.teardown?.().catch(() => undefined);
          await context.close();
        }
        results.push(entry);
      }
    }
  }
} finally {
  await putSettings({ theme: 'system' }).catch(() => undefined);
  await browser.close();
  server?.kill();
}

// ---------------------------------------------------------------------------
// The report: one JSON for the agent, one Markdown summary for a person.

fs.writeFileSync(
  path.join(OUT_DIR, 'report.json'),
  JSON.stringify(
    {
      base,
      when: new Date().toISOString(),
      injectedTokens: INJECT_TOKENS ?? null,
      injectedCss: INJECT_CSS ?? null,
      results,
    },
    null,
    2,
  ),
);

const lines = [
  `# Design capture - ${new Date().toISOString().slice(0, 16)}`,
  '',
  `Source: ${base}`,
  '',
];
lines.push(
  '| Shot | Width | Theme | Untokened colours | Ramp leaks | Off-scale type | Off-scale radius | Shadows | Motion | axe |',
);
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
const count = (e, kinds) => (e.findings ?? []).filter((f) => kinds.includes(f.kind)).length;
for (const e of results) {
  if (e.error) {
    lines.push(`| ${e.shot} | ${String(e.width)} | ${e.theme} | FAILED: ${e.error} | | | | | | |`);
    continue;
  }
  lines.push(
    `| [${e.shot}](${e.file.replaceAll('\\', '/')}) | ${String(e.width)} | ${e.theme} | ${String(count(e, ['untokened-color']))} | ${String(count(e, ['ramp-color']))} | ${String(count(e, ['off-scale-font-size', 'off-scale-font-weight']))} | ${String(count(e, ['off-scale-radius']))} | ${String(count(e, ['shadow']))} | ${String(count(e, ['off-scale-duration', 'transition-all']))} | ${e.axe ? String(e.axe.length) : '-'} |`,
  );
}

// Aggregate: each distinct off-token value once, with every shot that shows it.
const byValue = new Map();
for (const e of results) {
  for (const f of e.findings ?? []) {
    const key = `${f.kind}|${f.value}`;
    const agg = byValue.get(key) ?? { ...f, count: 0, shots: new Set() };
    agg.count += f.count;
    agg.shots.add(`${e.shot}/${e.theme}`);
    byValue.set(key, agg);
  }
}
lines.push(
  '',
  '## Distinct off-token values',
  '',
  'Shadows are listed for review: `shadow-overlay` on something that floats is correct.',
  '',
);
lines.push('| Kind | Value | Ramp | Elements | Seen on | Example |');
lines.push('| --- | --- | --- | --- | --- | --- |');
for (const f of [...byValue.values()].sort((a, b) => b.count - a.count)) {
  lines.push(
    `| ${f.kind} | \`${f.value}\`${f.prop ? ` (${f.prop})` : ''} | ${f.ramp ?? ''} | ${String(f.count)} | ${[...f.shots].slice(0, 4).join(', ')}${f.shots.size > 4 ? ` +${String(f.shots.size - 4)}` : ''} | \`${(f.where[0] ?? '').replaceAll('|', '\\|')}\` |`,
  );
}

const axeAll = new Map();
for (const e of results)
  for (const v of e.axe ?? []) {
    const agg = axeAll.get(v.id) ?? { ...v, shots: new Set() };
    agg.shots.add(`${e.shot}/${e.theme}`);
    axeAll.set(v.id, agg);
  }
if (axeAll.size) {
  lines.push(
    '',
    '## axe (all impacts, WCAG 2.2 AA)',
    '',
    '| Rule | Impact | Help | Seen on | Example |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const v of axeAll.values()) {
    lines.push(
      `| ${v.id} | ${v.impact ?? ''} | ${v.help} | ${[...v.shots].slice(0, 4).join(', ')} | \`${(v.nodes[0] ?? '').replaceAll('|', '\\|')}\` |`,
    );
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'report.md'), `${lines.join('\n')}\n`);
const failed = results.filter((e) => e.error).length;
console.log(
  `\n${String(results.length - failed)} captured, ${String(failed)} failed. Report: ${path.relative(REPO_ROOT, path.join(OUT_DIR, 'report.md'))}`,
);
process.exitCode = failed ? 1 : 0;
