import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    // The editor is filled by pasting rather than typing (see e2e/m0.spec.ts).
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /(a11y|settings)\.spec\.ts/,
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
       * measured against the other project's background.
       */
      dependencies: ['settings'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: '../..',
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    /*
     * A database of its own.
     *
     * These tests submit real solutions through the real judge, and every one
     * of those is a row someone else has to live with: without this the suite
     * writes its practice history into `data/devpromax.db`, which is the
     * developer's. `data/` is gitignored, so this file is created on first run
     * and can be deleted at any time.
     *
     * Note `reuseExistingServer`: a dev server already running on this port is
     * reused as-is and will be using the normal database. The specs are written
     * to work either way - none of them deletes anything.
     */
    env: {
      DEVPROMAX_DB: path.join(REPO_ROOT, 'data', 'e2e.db'),
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
      DEVPROMAX_COACH_BASE_URL: 'http://127.0.0.1:5174/api/__no_vendor__',
    },
  },
});
