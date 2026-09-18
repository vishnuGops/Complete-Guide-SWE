import { expect, test, type Page } from '@playwright/test';
import { setEditorContents } from './helpers.js';

/**
 * AI Help through the real stack (ROADMAP P5-7, P5-3).
 *
 * Everything between the button and the server is tested elsewhere - the UI
 * over a fake `fetch` in `coach.test.tsx`, the routes over `app.inject` in
 * `coachRoutes.test.ts`. What neither of those exercises is a browser reading a
 * real `text/event-stream` off a real socket: `inject` never opens one, and the
 * component tests hand the client a stream they built themselves.
 *
 * **No vendor is involved, and none is stubbed.** The two paths below are the
 * ones the server answers entirely on its own - the local pre-check and the
 * missing key - and they are the two that matter most anyway, because they are
 * what stands between a curious click and a bill. A test that needed a fake
 * provider wired into the production server would be testing the wiring.
 *
 * Nothing here runs or submits, so no status moves. Typing *does* write - the
 * workspace autosaves a draft - and that is the one piece of shared state these
 * tests have to manage: a draft left by one run is the code the next run's
 * editor opens with, which is exactly how the "untouched starter" case stopped
 * being untouched the first time this suite ran twice. Hence `resetDraft`, and
 * hence a problem of its own for the test that types.
 */

const PROBLEM = { slug: 'longest-distinct-stretch', title: 'Longest Limited Stretch' };
/** A second problem, so the test that types cannot disturb the one that must not. */
const TYPING_PROBLEM = { slug: 'pair-sum-under-limit', title: 'Pairs Under The Limit' };

/** The API's own headers, for the setup and teardown calls that go around the UI. */
const API_HEADERS = { 'X-DevProMax-Client': 'devpromax-web' };

/**
 * Removes any stored coach key.
 *
 * The settings row is global to the database these tests share, so the test
 * that pastes a key has to put it back - otherwise "someone with no key" is a
 * lie the moment that test has run once, which is the same class of bug the
 * `resetDraft` note above describes.
 */
async function clearStoredKey(page: Page): Promise<void> {
  const response = await page.request.put('/api/settings', {
    headers: API_HEADERS,
    data: { coach: { apiKey: '' } },
  });
  expect(response.ok(), 'the settings write that clears the key').toBe(true);
}

/** Reset-to-starter through the API, so the editor really does open on the starter. */
async function resetDraft(page: Page, slug: string): Promise<void> {
  const response = await page.request.delete(`/api/drafts/${slug}/python`, {
    headers: { 'X-DevProMax-Client': 'devpromax-web' },
  });
  expect(response.ok(), 'the draft delete that resets the editor').toBe(true);
}

/** The Coach panel, so an assertion cannot match an alert elsewhere on the page. */
function coachPanel(page: Page) {
  return page.getByRole('tabpanel', { name: 'Coach' });
}

async function openCoach(page: Page, slug = PROBLEM.slug, title = PROBLEM.title): Promise<void> {
  await page.goto(`/problems/${slug}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('tab', { name: 'Coach' }).click();
}

/*
 * Serial, because one of these writes settings.
 *
 * The key field is the only control in the app that changes state every other
 * test in the file reads: with a key stored, the pre-check stops sending anyone
 * to Settings. Running them in order, with the key cleared before and after the
 * one test that sets it, is cheaper than giving that test a database of its own.
 */
test.describe.configure({ mode: 'serial' });

test.describe('AI Help', () => {
  /*
   * A leftover key breaks every test below it (ROADMAP P5-8).
   *
   * The key lives in the settings row, which is global to the database these
   * tests share, and a run interrupted inside the test that pastes one leaves
   * it there - so the next run's "someone with no key" is looking at a
   * configured coach. Cleared before and after the whole file, in hooks that
   * run even when a test fails.
   */
  test.beforeAll(async ({ request }) => {
    const response = await request.put('/api/settings', {
      headers: API_HEADERS,
      data: { coach: { apiKey: '' } },
    });
    expect(response.ok(), 'clearing any key left by an earlier run').toBe(true);
  });

  test.afterAll(async ({ request }) => {
    await request.put('/api/settings', {
      headers: API_HEADERS,
      data: { coach: { apiKey: '' } },
    });
  });

  test('explains itself, and promises not to hand over the solution', async ({ page }) => {
    await openCoach(page);

    await expect(page.getByText(/Ask for feedback on the code in the editor/i)).toBeVisible();
    // The D13 promise, where the user can read it before spending anything.
    await expect(page.getByText(/will not hand over the solution/i)).toBeVisible();
  });

  test('refuses the untouched starter over a real event stream', async ({ page }) => {
    // The whole point of the pre-check: this answer costs nothing and arrives
    // without a key configured, because the server never leaves the machine.
    await resetDraft(page, PROBLEM.slug);
    await openCoach(page);

    await page.getByRole('button', { name: 'AI Help' }).click();

    await expect(page.getByText('Write some code first, then ask for help.')).toBeVisible();
    // Not an error: nothing went wrong, so nothing is announced as wrong.
    await expect(coachPanel(page).getByRole('alert')).toHaveCount(0);
  });

  test('sends someone with real code and no key to Settings', async ({ page }) => {
    await openCoach(page, TYPING_PROBLEM.slug, TYPING_PROBLEM.title);

    // Enough to get past the pre-check, which is all this needs.
    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('class Solution:\n    def f(self):\n        total = 0\n');

    await page.getByRole('button', { name: 'AI Help' }).click();

    const openSettings = page.getByRole('button', { name: /Open Settings/i });
    await expect(openSettings).toBeVisible();
    await expect(coachPanel(page).getByRole('alert')).toHaveCount(0);

    await openSettings.click();
    await expect(page).toHaveURL(/\/settings$/);

    // ...and that the page it lands on is one where the key can be set (P5-8).
    // Asserting only the URL is how the missing field went unnoticed.
    await expect(page.getByRole('heading', { name: 'AI coach' })).toBeVisible();
    await expect(page.getByTestId('api-key-status')).toHaveText('No key configured.');
  });

  test('takes a key from Settings, and says honestly that a fake one fails', async ({ page }) => {
    // Two round trips to the stand-in vendor on a machine that is also running
    // judges for other workers; the default 30s budget is for an idle page.
    test.setTimeout(120_000);
    await clearStoredKey(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'AI coach' })).toBeVisible();

    const fake = 'sk-ant-not-a-real-key-a1b2c3d4';
    await page.getByLabel('API key').fill(fake);
    await page.getByRole('button', { name: 'Save' }).click();

    // The mask is the whole point: what is on screen after a save is the
    // server's four characters, never the value that was typed.
    await expect(page.getByTestId('api-key-status')).toContainText('••••••••c3d4');
    await expect(page.getByTestId('api-key-status')).toContainText('stored on this machine');
    await expect(page.getByLabel('API key')).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(fake);

    // Test connection now has something to test, and fails without a packet
    // leaving the machine - see DEVPROMAX_COACH_BASE_URL in playwright.config.
    const testButton = page.getByRole('button', { name: 'Test connection' });
    await expect(testButton).toBeEnabled();
    await testButton.click();
    // The stand-in vendor (DEVPROMAX_COACH_BASE_URL in playwright.config) sits
    // under this app's own `/api` prefix, where the client-header rule answers
    // 403 - which the provider maps to "rejected that API key". Honest for a
    // fake key, and reached without a packet leaving the machine.
    //
    // Worth knowing if this ever fails again: a *reused* dev server started
    // without that variable sends the request to the real vendor instead, and
    // the failure looks like a different bug entirely.
    await expect(page.getByText(/rejected that API key/i)).toBeVisible();

    // And the coach no longer sends this user to Settings: with a key present
    // the pre-check passes and the request is attempted, so what comes back is
    // a provider error rather than the key prompt.
    //
    // Its own code, and its own language. Both are shared state - the language
    // is a *setting* every other spec can change, and a draft outlives the run
    // that wrote it - so relying on what an earlier test left behind meant this
    // one sometimes opened an untouched Java starter and was refused locally,
    // for want of a solution body, before any of that was tested.
    await page.goto(`/problems/${TYPING_PROBLEM.slug}`);
    await expect(page.getByRole('heading', { name: TYPING_PROBLEM.title })).toBeVisible();
    await page.getByRole('button', { name: 'Python', exact: true }).click();

    /*
     * Pasted rather than typed (ROADMAP P8-1's flake budget).
     *
     * This used to send the three lines as keystrokes, and under the full suite
     * - a machine also running judges for several other workers - Monaco
     * dropped characters: the run that prompted this had "class Soltion" and
     * "totl = 0" in the editor. What this test is about is the coach's answer
     * to a fake key; the fidelity of Monaco's keyboard handling is not its
     * subject, and every other spec pastes for exactly that reason.
     */
    await setEditorContents(
      page,
      [
        'class Solution:',
        '    def countPairs(self, weights, limit):',
        '        total = 0',
        '',
      ].join('\n'),
    );
    await expect(page.locator('[data-testid="editor"]')).toContainText('total = 0');

    await page.getByRole('tab', { name: 'Coach' }).click();
    await page.getByRole('button', { name: 'AI Help' }).click();

    await expect(page.getByRole('button', { name: /Open Settings/i })).toHaveCount(0);
    // The turn goes out to the stand-in vendor and comes back refused. Given a
    // longer leash than the default: under the full suite this shares a machine
    // with several judge runs.
    await expect
      .poll(async () => (await coachPanel(page).textContent()) ?? '', { timeout: 30_000 })
      .toMatch(/rejected|endpoint|could not|went wrong/i);

    await clearStoredKey(page);
  });

  test('opens the Coach tab when AI Help is pressed from the Description tab', async ({ page }) => {
    await page.goto(`/problems/${PROBLEM.slug}`);
    await expect(page.getByRole('heading', { name: PROBLEM.title })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Description' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByRole('button', { name: 'AI Help' }).click();

    await expect(page.getByRole('tab', { name: 'Coach' })).toHaveAttribute('aria-selected', 'true');
  });

  test('is reachable by its shortcut', async ({ page }) => {
    await resetDraft(page, PROBLEM.slug);
    await page.goto(`/problems/${PROBLEM.slug}`);
    await expect(page.getByRole('heading', { name: PROBLEM.title })).toBeVisible();

    await page.keyboard.press('Control+Shift+H');

    await expect(page.getByRole('tab', { name: 'Coach' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Write some code first, then ask for help.')).toBeVisible();
  });
});
