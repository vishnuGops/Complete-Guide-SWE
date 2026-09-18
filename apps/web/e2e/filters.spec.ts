import { expect, test, type Page } from '@playwright/test';
import { CLIENT_HEADERS } from './helpers.js';

/**
 * The problem list's filters (ROADMAP P8-1).
 *
 * `flows.spec.ts` narrows the list once on its way to a problem. This is the
 * filter bar itself: that the URL is the state rather than a copy of it, that
 * Back walks back through the narrowing, that a hand-edited query survives one
 * bad word, and that the catalogue-wide counts do not move when the rows do.
 *
 * Nothing here runs the judge, so it is fast and can afford to be thorough.
 */

test.describe('the filters', () => {
  /** Rows currently on screen, by the count the header prints. */
  async function shown(page: Page): Promise<number> {
    // Two forms: "N of M problems" while something is narrowing the list, and
    // "M problems" when nothing is. Reading only the first would make the
    // unfiltered case look like zero rows.
    const text = (await page.getByTestId('list-counts').textContent()) ?? '';
    const narrowed = /(\d+) of \d+/.exec(text);
    if (narrowed) return Number(narrowed[1]);
    return Number(/(\d+) problems/.exec(text)?.[1] ?? 0);
  }

  test('puts every filter in the URL, and takes it back out again', async ({ page }) => {
    await page.goto('/');
    const all = await shown(page);

    await page.getByRole('checkbox', { name: /^Easy/ }).click();
    await expect(page).toHaveURL(/tier=Easy/);
    /*
     * Polled, not read once. The URL changes on the click and the rows arrive a
     * request later; until then the previous page's rows are deliberately still
     * on screen (`placeholderData`, P4-5), so a single read here sees the
     * unfiltered count and the assertion fails for the wrong reason.
     */
    await expect.poll(() => shown(page)).toBeLessThan(all);
    const easy = await shown(page);

    await page.getByRole('checkbox', { name: /^Graph/ }).click();
    await expect(page).toHaveURL(/topic=graph/);
    await expect.poll(() => shown(page)).toBeLessThan(easy);

    // The back button walks back through the narrowing, one filter at a time,
    // because each change is a navigation (P4-5).
    await page.goBack();
    await expect(page).not.toHaveURL(/topic=graph/);
    await expect.poll(() => shown(page)).toBe(easy);
  });

  test('is a link you can send yourself', async ({ page }) => {
    await page.goto('/?tier=Hard&topic=graph');

    // Seeded from the URL rather than from a click, which is the whole claim.
    await expect(page.getByRole('checkbox', { name: /^Hard/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /^Graph/ })).toBeChecked();

    const rows = page.getByRole('row').filter({ hasText: 'Hard' });
    await expect(rows.first()).toBeVisible();
    await expect(rows.filter({ hasNotText: 'Graph' })).toHaveCount(0);
  });

  test('drops one bad word from a hand-edited query and keeps the rest', async ({ page }) => {
    await page.goto('/?topic=arrays,not-a-topic&tier=Easy');

    // Rejecting the whole query would silently reset filters the user can still
    // see in the address bar (P4-5).
    await expect(page.getByRole('checkbox', { name: /^Arrays/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /^Easy/ })).toBeChecked();
    await expect(page.getByTestId('list-counts')).toContainText(/\d+ of \d+/);
  });

  test('searches titles, and says so when nothing matches', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('searchbox', { name: 'Search problems' });

    await search.fill('rotated');
    await expect(page).toHaveURL(/q=rotated/);
    await expect(page.getByRole('row').filter({ hasText: 'Rotated' }).first()).toBeVisible();

    await search.fill('zzzz-nothing-matches-this');
    await expect.poll(() => shown(page)).toBe(0);
    await expect(page.getByText('No problem matches these filters.')).toBeVisible();
  });

  test('keeps the catalogue-wide counts still while the rows move', async ({ page }) => {
    await page.goto('/');
    const banner = await page.getByTestId('global-progress').textContent();

    await page.getByRole('checkbox', { name: /^Hard/ }).click();
    await expect(page).toHaveURL(/tier=Hard/);

    // "Solved 42 / 200" that changed when you ticked a box would have stopped
    // meaning anything.
    await expect(page.getByTestId('global-progress')).toHaveText(banner ?? '');
  });

  test('clears every filter but keeps the sort', async ({ page }) => {
    await page.goto('/?tier=Easy&topic=arrays&sort=rating&dir=desc');

    await page.getByRole('button', { name: /Clear/ }).click();

    await expect(page).not.toHaveURL(/tier=Easy/);
    await expect(page).not.toHaveURL(/topic=arrays/);
    // Re-ordering a list is not filtering it: Clear must not throw away the
    // column the user is sorting by.
    await expect(page).toHaveURL(/sort=rating/);
  });

  test('sorts by a column, then reverses it', async ({ page }) => {
    await page.goto('/');

    const rating = page.getByRole('button', { name: /^Rating/ });
    await rating.click();
    await expect(page).toHaveURL(/sort=rating/);
    await expect(page).not.toHaveURL(/dir=desc/);

    await rating.click();
    await expect(page).toHaveURL(/dir=desc/);
  });

  test('shows only starred problems when asked (P7-7)', async ({ page }) => {
    const slug = 'insert-position';
    await page.request.put(`/api/bookmarks/${slug}`, { headers: CLIENT_HEADERS });

    await page.goto('/?bookmarked=true');
    await expect(page.getByRole('checkbox', { name: 'Starred only' })).toBeChecked();
    await expect(page.getByRole('link', { name: 'Where It Would Go' })).toBeVisible();

    // Unstarring it takes the row away, which is the only assertion that shows
    // the filter is reading the server rather than a cached list.
    await page.request.delete(`/api/bookmarks/${slug}`, { headers: CLIENT_HEADERS });
    await page.reload();
    await expect(page.getByRole('link', { name: 'Where It Would Go' })).toBeHidden();
  });
});
