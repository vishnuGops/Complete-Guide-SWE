#!/usr/bin/env node
/**
 * The README's screenshots (ROADMAP P8-4).
 *
 * Taken from the built app on the production server, the same way Lighthouse
 * measures it, because a screenshot of a dev server is a screenshot of
 * something nobody runs. Checked in, because a README whose images are
 * generated on demand has no images.
 *
 * Four of them, deliberately: the list, the workspace mid-loop, the dashboard,
 * and one dark shot to show the app has two themes rather than a dark mode that
 * was bolted on. More than that and the README becomes a gallery.
 *
 *   npm run screenshots          # start a server, capture, stop it
 *   npm run screenshots -- --url http://127.0.0.1:5174
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const SERVER_ENTRY = path.join(REPO_ROOT, 'apps', 'server', 'dist', 'start.js');
const WEB_INDEX = path.join(REPO_ROOT, 'apps', 'web', 'dist', 'index.html');
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'screenshots');

/** Wide enough for the three-panel workspace the app insists on (DESIGN 9). */
const VIEWPORT = { width: 1440, height: 900 };

const CLIENT_HEADERS = { 'X-DevProMax-Client': 'devpromax-web' };

function arg(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

const PORT = Number(arg('--port') ?? 5195);
const external = arg('--url');
const base = external ?? `http://127.0.0.1:${String(PORT)}`;

/** The problem the workspace shots are of: solved, and not one of the pilots. */
const PROBLEM = 'balance-point';

/**
 * A handful more, submitted so the dashboard has a shape.
 *
 * A dashboard with one solve is honest but says nothing about what the screen
 * is for - "1 of 169" and a single green square could be any progress bar.
 * Five across four topics shows the per-topic breakdown doing its job.
 */
const ALSO_SOLVED = [
  ['arrays', 'running-maximum'],
  ['hashmap', 'first-unique-symbol'],
  ['binary-search', 'insert-position'],
  ['stack', 'bracket-balance'],
];

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

async function setTheme(theme) {
  await fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  });
}

let server;
if (!external) {
  if (!fs.existsSync(SERVER_ENTRY) || !fs.existsSync(WEB_INDEX)) {
    console.error(
      'No build found. Run `npm run build` first; these are screenshots of what ships.',
    );
    process.exit(1);
  }
  server = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DEVPROMAX_PORT: String(PORT),
      // Its own database, so the shots do not depend on - or disturb - whatever
      // practice history the developer has.
      DEVPROMAX_DB: path.join(REPO_ROOT, 'data', 'screenshots.db'),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
try {
  await waitForHealth();

  const page = await browser.newPage({ viewport: VIEWPORT, extraHTTPHeaders: CLIENT_HEADERS });

  /*
   * A solved problem and a note, so the list and the dashboard have something
   * to show. Written through the API rather than faked in the page: a
   * screenshot of a mocked screen is a screenshot of a mock.
   */
  const reference = fs.readFileSync(
    path.join(REPO_ROOT, 'problems', 'arrays', PROBLEM, 'reference.py'),
    'utf8',
  );
  await fetch(`${base}/api/submit`, {
    method: 'POST',
    headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: PROBLEM, language: 'python', code: reference }),
  });
  /*
   * And left in the editor as a draft.
   *
   * The editor seeds from the saved draft, so without this the workspace shot
   * showed the untouched starter - and the Run below then failed, which is a
   * screenshot of the app not working rather than of the app working. Written
   * as a draft rather than pasted, because pasting needs clipboard permission
   * and this is not a test.
   */
  await fetch(`${base}/api/drafts/${PROBLEM}/python`, {
    method: 'PUT',
    headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: reference }),
  });
  for (const [topic, slug] of ALSO_SOLVED) {
    const file = path.join(REPO_ROOT, 'problems', topic, slug, 'reference.py');
    if (!fs.existsSync(file)) continue;
    await fetch(`${base}/api/submit`, {
      method: 'POST',
      headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, language: 'python', code: fs.readFileSync(file, 'utf8') }),
    });
  }

  await fetch(`${base}/api/notes/${PROBLEM}`, {
    method: 'PUT',
    headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: 'The prefix sum is the whole trick.' }),
  });
  await fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
    // The welcome is a first-run panel and would cover the list.
    body: JSON.stringify({ welcomeDismissed: true }),
  });

  const shots = [
    {
      file: 'problem-list.png',
      theme: 'light',
      async take() {
        await page.goto(`${base}/`);
        await page.getByRole('heading', { name: 'Problems' }).waitFor();
        await page.getByRole('row').nth(3).waitFor();
      },
    },
    {
      file: 'workspace.png',
      theme: 'light',
      async take() {
        await page.goto(`${base}/problems/${PROBLEM}`);
        await page.locator('[data-testid="editor"] .monaco-editor').waitFor();
        await page.getByRole('button', { name: 'Run' }).click();
        // Waited on by its text, not merely by existing: a shot taken the
        // instant the panel appears catches it mid-verdict.
        await page.getByTestId('verdict').filter({ hasText: 'Accepted' }).waitFor({
          timeout: 120_000,
        });
      },
    },
    {
      file: 'progress.png',
      theme: 'light',
      async take() {
        await page.goto(`${base}/progress`);
        await page.getByRole('heading', { name: 'Progress' }).waitFor();
      },
    },
    {
      file: 'workspace-dark.png',
      theme: 'dark',
      async take() {
        await page.goto(`${base}/problems/${PROBLEM}`);
        await page.locator('[data-testid="editor"] .monaco-editor').waitFor();
        await page.getByRole('tab', { name: 'Hints' }).click();
        await page.getByRole('button', { name: /Show the (first|next) hint/ }).click();
      },
    },
  ];

  for (const shot of shots) {
    await setTheme(shot.theme);
    await shot.take();
    // The editor paints its own theme a frame after the page does.
    await page.waitForTimeout(400);
    const file = path.join(OUT_DIR, shot.file);
    await page.screenshot({ path: file });
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`  ${shot.file.padEnd(22)} ${shot.theme.padEnd(6)} ${String(kb)} KB`);
  }
} finally {
  await setTheme('system').catch(() => undefined);
  await browser.close();
  server?.kill();
}

console.log(`\nWritten to ${path.relative(REPO_ROOT, OUT_DIR)}.`);
