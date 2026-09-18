import { expect, test } from '@playwright/test';
import type { InterviewResponse } from '@devpromax/shared';
import { CLIENT_HEADERS } from './helpers.js';

/**
 * The mock interview through the real stack (ROADMAP P9-1).
 *
 * The screen over a fake `fetch` is `Interview.test.tsx` and the state machine
 * over `app.inject` is `routes.test.ts`; what neither covers is the one thing a
 * browser adds - a clock that ticks, and a debrief that arrives down a real
 * `text/event-stream`. **No vendor is involved and none is stubbed**: with no
 * key configured the server answers the stream itself with `skipped`, which is
 * the path that matters most anyway, because it is what stands between pressing
 * "End it" and a bill.
 *
 * Starting a sitting writes a row, so this file ends every interview it starts
 * and leaves the newest one closed - a closed sitting is what the screen shows
 * to someone who has never had one, so nothing later in the suite sees state it
 * did not create. It runs the judge for nothing and submits nothing, so no
 * status moves.
 */

test.describe.configure({ mode: 'serial' });

test.describe('a mock interview', () => {
  test.afterEach(async ({ request }) => {
    const response = await request.get('/api/interview', { headers: CLIENT_HEADERS });
    const current = (await response.json()) as InterviewResponse;
    if (current.interview !== null && current.interview.endedAt === null) {
      await request.post(`/api/interview/${current.interview.id}/finish`, {
        headers: CLIENT_HEADERS,
      });
    }
  });

  test('explains itself before it starts anything', async ({ page }) => {
    await page.goto('/interview');

    await expect(page.getByRole('heading', { name: 'Mock interview' })).toBeVisible();
    // The one thing to know before agreeing to forty-five minutes of it.
    await expect(page.getByText(/will not give you the answer/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start an interview' })).toBeVisible();
  });

  test('opens on the approach, with a clock that is running', async ({ page }) => {
    await page.goto('/interview');
    await page.getByRole('button', { name: 'Start an interview' }).click();

    const clock = page.getByRole('timer');
    await expect(clock).toBeVisible();
    const started = (await clock.textContent()) ?? '';
    expect(started).toMatch(/^4[45]:\d\d$/);

    // Two problems, and the approach before the code.
    const problems = page.getByRole('list', { name: 'The problems in this interview' });
    await expect(problems.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByText(/before any code/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'I am ready to write it' })).toBeVisible();

    // The clock counts down without the page asking the server for the number.
    await expect(clock).not.toHaveText(started, { timeout: 5_000 });
  });

  test('moves from the approach to the code when the candidate says so', async ({ page }) => {
    await page.goto('/interview');
    await page.getByRole('button', { name: 'Start an interview' }).click();
    await page.getByRole('button', { name: 'I am ready to write it' }).click();

    await expect(page.getByText(/^Write it\./)).toBeVisible();
    await expect(page.getByRole('button', { name: 'I have written it' })).toBeVisible();
  });

  test('ends when asked, and says why there is no debrief without a key', async ({ page }) => {
    await page.goto('/interview');
    await page.getByRole('button', { name: 'Start an interview' }).click();
    await page.getByRole('button', { name: 'End it and get the debrief' }).click();

    // Ended either way - and the reason survives the switch to the screen that
    // has no debrief on it.
    await expect(page.getByRole('alert')).toContainText('API key');
    await expect(page.getByRole('button', { name: 'Start an interview' })).toBeVisible();
    await expect(page.getByRole('timer')).toHaveCount(0);
  });

  test('is reachable from the command palette', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('ControlOrMeta+k');
    const field = page.getByRole('combobox', { name: 'Search problems and commands' });
    await field.fill('mock interview');
    await field.press('ArrowDown');
    await field.press('Enter');

    await expect(page).toHaveURL(/\/interview$/);
  });
});
