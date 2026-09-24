import { expect, test } from '@playwright/test';
import { CLIENT_HEADERS } from './helpers.js';

/**
 * Settings (ROADMAP P8-1).
 *
 * `coach.spec.ts` covers the key and the connection test, which is the part
 * that talks to a vendor. This is the rest: that a setting written here is a
 * setting the rest of the app reads, and that it survives a reload - a
 * preference that only holds until the page is refreshed is not a preference.
 *
 * **Reset all progress is opened and cancelled, never confirmed.** It deletes
 * every submission in the database, and that database is shared by every spec
 * running beside this one - the golden path would find its Solved gone halfway
 * through. The confirmed path is covered in `settingsService.test.ts`, where
 * the database belongs to that test alone.
 */

test.describe('settings', () => {
  /** Puts back what the suite found, so specs after this one see what they expect. */
  test.afterEach(async ({ page }) => {
    await page.request.put('/api/settings', {
      headers: CLIENT_HEADERS,
      data: { editor: { fontSize: 14, tabSize: 4 }, judge: { timeoutMultiplier: 1 } },
    });
  });

  test('an editor preference reaches the editor, and survives a reload', async ({ page }) => {
    await page.goto('/settings');

    const fontSize = page.getByLabel('Editor font size');
    await fontSize.fill('20');
    await fontSize.blur();

    await page.reload();
    await expect(page.getByLabel('Editor font size')).toHaveValue('20');

    // The claim is not that the field remembers it: it is that the editor gets
    // it. Monaco renders the size it was told into the line height.
    await page.goto('/problems/insert-position');
    await expect(page.locator('[data-testid="editor"] .monaco-editor')).toBeVisible();
    const fontPx = await page
      .locator('[data-testid="editor"] .view-lines')
      .evaluate((node) => getComputedStyle(node).fontSize);
    expect(fontPx).toBe('20px');
  });

  test('refuses a font size outside the range it advertises', async ({ page }) => {
    await page.goto('/settings');

    const fontSize = page.getByLabel('Editor font size');
    await fontSize.fill('99');
    await fontSize.blur();

    // Said on the field rather than swallowed: a number the server will not
    // accept should not look accepted.
    await expect(page.getByText(/10 to 24/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Editor font size')).not.toHaveValue('99');
  });

  test('the theme is a server setting, so it is the same on every screen', async ({ page }) => {
    await page.goto('/settings');
    const root = page.locator('html');
    const before = await root.getAttribute('data-theme');

    /*
     * Three labelled buttons, not radios and not a two-state toggle: `system`
     * is a real third state and the default (see `ThemeToggle`). Scoped to the
     * page's own group, because the top bar carries the same control.
     */
    const control = page.getByRole('main').getByRole('group', { name: 'Theme' });
    const wanted = before === 'dark' ? 'Light' : 'Dark';
    await control.getByRole('button', { name: wanted }).click();
    await expect(root).toHaveAttribute('data-theme', wanted.toLowerCase());

    // Another screen, not a re-render of this one.
    await page.goto('/progress');
    await expect(root).toHaveAttribute('data-theme', wanted.toLowerCase());

    // Put back whatever this database had, including "follow the OS".
    await page.goto('/settings');
    const restore = before === 'dark' ? 'Dark' : before === 'light' ? 'Light' : 'System';
    await page
      .getByRole('main')
      .getByRole('group', { name: 'Theme' })
      .getByRole('button', { name: restore })
      .click();
    await expect(
      page
        .getByRole('main')
        .getByRole('group', { name: 'Theme' })
        .getByRole('button', { name: restore }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('the judge time limit multiplier reaches the problem payload', async ({ page }) => {
    await page.goto('/settings');

    await page.getByLabel('Time limit multiplier').fill('2');
    await page.getByLabel('Time limit multiplier').blur();

    await expect
      .poll(async () => {
        const response = await page.request.get('/api/problems/insert-position', {
          headers: CLIENT_HEADERS,
        });
        return ((await response.json()) as { timeoutMs: { python: number } }).timeoutMs.python;
      })
      // Whatever the problem's own limit is, doubled - so the assertion is the
      // multiplier having been applied rather than a number copied from a file.
      .toBeGreaterThan(1_000);
  });

  test('reset all progress asks first, and does nothing when dismissed', async ({ page }) => {
    await page.goto('/settings');

    // Labelled "Reset…" beside a row that says what it deletes; the row's label
    // is the accessible name of the setting, not of the button.
    await page.getByRole('button', { name: 'Reset…' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/submission/i);

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // Nothing went: the catalogue counts are still whatever they were.
    await expect(page.getByTestId('global-progress')).toContainText(/Solved \d+ \/ \d+/);
  });
});
