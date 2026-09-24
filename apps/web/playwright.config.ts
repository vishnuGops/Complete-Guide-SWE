import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/*
 * The suite's own ports, never the development ones (ROADMAP P8-6).
 *
 * `npm run dev` holds 5173 and 5174 on the owner's practice database. The suite
 * used to share them - `reuseExistingServer` handed it whatever dev server was
 * already running, and with it `data/devpromax.db`: `coach.spec.ts` saves an
 * empty API key, which deletes the real one, and the draft specs delete real
 * drafts. On ports of its own the two cannot meet, and with reuse off a
 * leftover server on these ports is an error rather than a stranger's database.
 *
 * Read from the suite's own variables, not DEVPROMAX_PORT and
 * DEVPROMAX_WEB_PORT: a shell set up for development must not be able to point
 * the suite back at development. They are passed to the children under the
 * names the server and Vite read.
 */
const WEB_PORT = process.env['DEVPROMAX_E2E_WEB_PORT'] ?? '5183';
const API_PORT = process.env['DEVPROMAX_E2E_API_PORT'] ?? '5184';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Emptied before every run by `e2e/reset-db.mjs`. */
const E2E_DB = path.join(REPO_ROOT, 'data', 'e2e.db');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  /*
   * The flake budget (ROADMAP P8-1).
   *
   * Retries are a CI-only affordance: locally a flake has to be seen to be
   * fixed, so `retries` above is 0 outside CI. In CI the JSON report is what
   * makes the flakes countable - `scripts/flake-budget.mjs` reads it and fails
   * the job when more than the budget passed only on a retry. A suite that
   * quietly retries its way to green is a suite nobody trusts.
   */
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'playwright-report/results.json' }],
      ]
    : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'on-first-retry',
    // The editor is filled by pasting rather than typing (see e2e/m0.spec.ts).
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    /*
     * The production server first, alone (P9-6).
     *
     * `production.spec.ts` times cold start - spawn to the first `/health` -
     * against P8-2's two-second budget. Run beside three browser workers on the
     * slower machine it was timing the machine instead: 1.1 s alone, 1.8 s
     * under the suite before P9-6 and 2.1 s after, with no change to what the
     * server does at start. Every other project waits for these few seconds, so
     * the number is the server's again.
     */
    {
      name: 'production',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /production\.spec\.ts/,
      workers: 1,
      fullyParallel: false,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /(a11y|settings|interview|production)\.spec\.ts/,
      dependencies: ['production'],
    },
    /*
     * Settings get a project of their own, one worker wide (ROADMAP P8-1).
     *
     * Everything in `settings.spec.ts` writes a *server* setting, which every
     * other window shares. Two of its tests running at once would each see the
     * other's theme, font size and time limit.
     */
    {
      name: 'settings',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /settings\.spec\.ts/,
      workers: 1,
      fullyParallel: false,
      dependencies: ['production'],
    },
    /*
     * And so does the interview, for the same reason (ROADMAP P9-1).
     *
     * There is one current sitting per database, so two tests starting one at
     * once are each other's - and the audit below walks `/interview`, which
     * draws a completely different screen while one is running. Serialised
     * here, and before the audit, so what the audit meets is whatever this
     * project left behind rather than a screen mid-interview.
     */
    {
      name: 'interview',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /interview\.spec\.ts/,
      workers: 1,
      fullyParallel: false,
      dependencies: ['production'],
    },
    /*
     * The audit gets its own project, one worker wide (ROADMAP P4-13).
     *
     * The theme is a *server* setting, shared by every window: one worker
     * clicking Dark repaints another worker's page while axe is walking it, and
     * the finding that comes back is one theme's text measured against the
     * other theme's background. `test.describe.configure({ mode: 'default' })`
     * inside the file does not prevent that - it orders the tests within a
     * worker and says nothing about how many workers there are - so the
     * serialisation has to live here.
     */
    {
      name: 'a11y',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /a11y\.spec\.ts/,
      workers: 1,
      fullyParallel: false,
      /*
       * After the settings project, never beside it. The audit reads the theme
       * out of the page it is measuring, and `settings.spec.ts` changes the
       * theme for every window there is - which would be one project's text
       * measured against the other project's background. The interview project
       * is a dependency for the same class of reason: it starts and ends the
       * sitting that decides which of two screens `/interview` draws.
       */
      dependencies: ['settings', 'interview'],
    },
  ],
  webServer: [
    {
      /*
       * The API first, on a database of its own, emptied a moment before it is
       * opened.
       *
       * These tests submit real solutions through the real judge, and every one
       * of those is a row someone else has to live with: without this the suite
       * writes its practice history into `data/devpromax.db`, which is the
       * developer's. The reset is part of the command rather than a
       * `globalSetup` because Playwright starts web servers before global setup
       * (see `e2e/reset-db.mjs`). `data/` is gitignored.
       *
       * Waited on at `/health`, not through Vite: were something else answering
       * on this port, Vite's proxy would reach it and the suite would never
       * know whose API it was talking to.
       */
      command: 'node apps/web/e2e/reset-db.mjs && npm run dev:server',
      cwd: '../..',
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DEVPROMAX_PORT: API_PORT,
        DEVPROMAX_DB: E2E_DB,
        /*
         * A vendor that is not a vendor.
         *
         * `coach.spec.ts` types a fake key into Settings and presses "Test
         * connection", and that must fail without a packet leaving this machine -
         * least of all one carrying something key-shaped. Pointed at the API's own
         * origin, every provider request lands on a path that does not exist and
         * is answered 403 by the client-header rule (D15), which the provider maps
         * to "the key was rejected" - the honest answer for a fake key, reached
         * offline and in the same number of milliseconds every time.
         *
         * The `/api` prefix is load-bearing (ROADMAP P8-1). It used to be
         * `/__no_vendor__`, which worked only while nothing was serving a UI
         * behind the API: once `apps/web/dist` exists, the server answers any
         * other path with the single-page app's `index.html`, and a 200 full of
         * HTML is not a refusal - the provider reported "answered, but not with a
         * model list" and the spec failed for a reason that had nothing to do with
         * the coach. Under `/api` the client-header rule runs before any route
         * and refuses, built UI or not.
         */
        DEVPROMAX_COACH_BASE_URL: `http://127.0.0.1:${API_PORT}/api/__no_vendor__`,
      },
    },
    {
      // Vite, proxying `/api` to the API above rather than to 5174.
      command: 'npm run dev:web',
      cwd: '../..',
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { DEVPROMAX_WEB_PORT: WEB_PORT, DEVPROMAX_PORT: API_PORT },
    },
  ],
});
