import { test, expect } from '@playwright/test';

test('the app shell renders the problem list', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Problems' })).toBeVisible();
  // The shell's progress bar counts the catalogue, which is how you can tell the
  // API answered rather than the page merely rendering.
  await expect(page.getByTestId('global-progress')).toContainText(/Solved \d+ \/ \d+/);
  await expect(page.getByTestId('list-counts')).toContainText(/\d+ problems/);
});
