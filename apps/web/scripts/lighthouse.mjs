#!/usr/bin/env node
/**
 * Lighthouse, on the built app, in both themes (ROADMAP P8-2).
 *
 * Not a Playwright spec, for two reasons: Lighthouse drives Chrome itself
 * through the DevTools protocol and throttles the CPU and network to do it,
 * which is the opposite of what a test runner wants; and its numbers are only
 * comparable when nothing else is running, which a parallel suite cannot
 * promise. So it is a script you run, and CI runs it as its own step.
 *
 * It measures the **built** output on the production server, because that is
 * what a user gets. Measuring a Vite dev server would score the unbundled
 * module graph and the HMR client, which nobody ships.
 *
 * The theme is a server setting, so both themes mean two runs with a `PUT`
 * between them - and the dark one matters: a palette can pass contrast in one
 * theme and fail in the other, which is the same reason the axe audit runs
 * twice (P4-13).
 *
 *   node scripts/lighthouse.mjs            # start a server, measure, stop it
 *   node scripts/lighthouse.mjs --url http://127.0.0.1:5174   # measure that one
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const SERVER_ENTRY = path.join(REPO_ROOT, 'apps', 'server', 'dist', 'start.js');
const WEB_INDEX = path.join(REPO_ROOT, 'apps', 'web', 'dist', 'index.html');

/**
 * The floor, and why it is 90 rather than 100.
 *
 * 90 is the roadmap's number and it is the right one: the last ten points of a
 * Lighthouse performance score are bought with things this app should not do -
 * inlining critical CSS, deferring the editor past first interaction, shaving
 * the 2.6 MB Monaco chunk that is the entire point of the workspace screen.
 */
const FLOOR = 90;

/** Screens worth scoring: one per shape of page the app has. */
const PAGES = [
  { name: 'problem list', path: '/' },
  { name: 'workspace', path: '/problems/insert-position' },
  { name: 'progress', path: '/progress' },
];

const THEMES = ['light', 'dark'];

const CLIENT_HEADERS = { 'X-DevProMax-Client': 'devpromax-web' };

function arg(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

const PORT = Number(arg('--port') ?? 5198);
const external = arg('--url');
const base = external ?? `http://127.0.0.1:${String(PORT)}`;

async function waitForHealth(deadlineMs = 30_000) {
  const until = Date.now() + deadlineMs;
  for (;;) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    if (Date.now() > until)
      throw new Error(`no /health from ${base} within ${String(deadlineMs)}ms`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function setTheme(theme) {
  const response = await fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  });
  if (!response.ok) throw new Error(`could not set the ${theme} theme: ${String(response.status)}`);
}

/**
 * Which Chrome to drive.
 *
 * Playwright's, unless `CHROME_PATH` says otherwise. The suite already
 * downloads a Chromium and pins its version; asking the developer to install a
 * second browser - and then scoring against whichever one they happen to have -
 * would make these numbers incomparable between machines.
 */
async function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const { chromium } = await import('playwright');
  return chromium.executablePath();
}

/**
 * One Lighthouse run.
 *
 * Its own Chrome each time, because Lighthouse resets the protocol connection
 * between runs and a shared browser leaks throttling state into the next
 * measurement.
 */
async function measure(url, categories) {
  const { default: lighthouse } = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    chromePath: await chromePath(),
  });
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: categories,
      // Desktop: this is a local tool used on a laptop, and scoring it against
      // a throttled mid-range phone would be measuring a machine nobody uses.
      formFactor: 'desktop',
      screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1 },
      throttling: { rttMs: 0, throughputKbps: 0, cpuSlowdownMultiplier: 1 },
      throttlingMethod: 'provided',
    });
    if (!result) throw new Error(`lighthouse returned nothing for ${url}`);
    return result.lhr;
  } finally {
    await chrome.kill();
  }
}

let server;
if (!external) {
  if (!fs.existsSync(SERVER_ENTRY) || !fs.existsSync(WEB_INDEX)) {
    console.error('No build found. Run `npm run build` first; Lighthouse scores what ships.');
    process.exit(1);
  }
  server = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DEVPROMAX_PORT: String(PORT),
      DEVPROMAX_DB: path.join(REPO_ROOT, 'data', 'lighthouse.db'),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

const failures = [];
try {
  await waitForHealth();

  for (const theme of THEMES) {
    await setTheme(theme);
    for (const page of PAGES) {
      const lhr = await measure(`${base}${page.path}`, ['performance', 'accessibility']);
      for (const key of ['performance', 'accessibility']) {
        const score = Math.round((lhr.categories[key]?.score ?? 0) * 100);
        const line = `${theme.padEnd(5)} ${page.name.padEnd(13)} ${key.padEnd(13)} ${String(score)}`;
        console.log(score >= FLOOR ? `  ok   ${line}` : `  FAIL ${line}`);
        if (score < FLOOR) {
          failures.push(`${page.name} (${theme}) ${key} ${String(score)} < ${String(FLOOR)}`);
        }
      }
    }
  }
} finally {
  // Back to following the OS, which is the default a fresh install has.
  await setTheme('system').catch(() => undefined);
  server?.kill();
}

if (failures.length > 0) {
  console.error(`\nLighthouse below ${String(FLOOR)}:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`\nEvery score is ${String(FLOOR)} or better.`);
