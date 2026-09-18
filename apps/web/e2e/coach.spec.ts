import { expect, test, type Page } from '@playwright/test';

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

test.describe('AI Help', () => {
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
