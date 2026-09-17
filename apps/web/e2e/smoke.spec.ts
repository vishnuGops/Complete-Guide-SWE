import { test, expect } from '@playwright/test';

test('the app shell renders the problem list', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Problems' })).toBeVisible();
  // The header counts the catalogue, which is how you can tell the API answered
  // rather than the page merely rendering.
  await expect(page.getByText(/Solved \d+ \/ \d+/)).toBeVisible();
});
