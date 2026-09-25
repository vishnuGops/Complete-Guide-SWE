import { test, expect } from '@playwright/test';

test('the app shell renders the problem list', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Problems' })).toBeVisible();
  // The shell's progress bar counts the catalogue, which is how you can tell the
  // API answered rather than the page merely rendering.
  await expect(page.getByTestId('global-progress')).toContainText(/Solved \d+ \/ \d+/);
  await expect(page.getByTestId('list-counts')).toContainText(/\d+ problems/);
});

/*
 * The shell is exactly one window tall and its cards scroll themselves (see
 * AppShell), so the document must never scroll. It did, on every screen with a
 * long card: an `sr-only` label inside a scroller that was not `relative`
 * escaped it and made the page as tall as the card's contents.
 */
for (const path of ['/', '/progress', '/interview', '/settings', '/problems/balance-point']) {
  test(`the document does not scroll on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('main')).not.toBeEmpty();
    // Let the screen's data arrive: the overflow comes from the rows it renders.
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
