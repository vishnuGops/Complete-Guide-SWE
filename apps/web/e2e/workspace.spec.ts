import { expect, test } from '@playwright/test';
import { CLIENT_HEADERS, clearDrafts, openOnPython, setEditorContents } from './helpers.js';

/**
 * The workspace, apart from the judge (ROADMAP P8-1).
 *
 * `flows.spec.ts` walks the loop and `verdicts.spec.ts` covers what the judge
 * says. What is left is everything the screen does on its own: custom test
 * cases, the panel toggle, reset to starter, the notes tab, the star, interview
 * mode and review mode. None of it runs a subprocess, so this file is quick.
 */

/** Its own problem, so a status this file changes cannot surprise another spec. */
const PROBLEM = { topic: 'arrays', slug: 'insert-position', title: 'Where It Would Go' };

test.describe('the workspace', () => {
  test.afterEach(async ({ page }) => {
    await clearDrafts(page, PROBLEM.slug);
  });

  test('takes a case the user typed, and says when it does not fit', async ({ page }) => {
    await openOnPython(page, PROBLEM);

    await page.getByRole('button', { name: 'Add a case' }).click();
    const first = page.getByRole('textbox', { name: 'Argument 1' });
    // Prefilled from the first sample, so the box shows the shape of a legal
    // input rather than an empty field.
    await expect(first).not.toHaveValue('');

    await first.fill('not json at all');
    // Said beside the box rather than discovered by a round trip: the server
    // would reject it too, but the user should not have to ask to find out.
    await expect(page.getByText(/Argument 1/).last()).toBeVisible();
    await expect(page.getByText(/is not valid JSON|could not be read/i).first()).toBeVisible();

    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(first).toBeHidden();
  });

  test('collapses the bottom panel, and its shortcut agrees with the button', async ({ page }) => {
    await openOnPython(page, PROBLEM);

    const panel = page.getByRole('button', { name: /^(Hide|Show)$/ });
    const expanded = await panel.getAttribute('aria-expanded');

    await page.keyboard.press('ControlOrMeta+j');
    await expect(panel).not.toHaveAttribute('aria-expanded', expanded ?? '');

    await panel.click();
    await expect(panel).toHaveAttribute('aria-expanded', expanded ?? '');
  });

  test('puts the starter back, once the user has said so twice', async ({ page }) => {
    await openOnPython(page, PROBLEM);
    await setEditorContents(page, '# something of my own\n');

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    // Dismissed: the code is still there, because a confirmation that does the
    // thing anyway is not a confirmation.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="editor"]')).toContainText('something of my own');

    await page.getByRole('button', { name: 'Reset' }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).last().click();
    await expect(page.locator('[data-testid="editor"]')).toContainText('insertPosition');
  });

  test('keeps a note, and the list says the problem has one (P7-4)', async ({ page }) => {
    await page.request.put(`/api/notes/${PROBLEM.slug}`, {
      headers: CLIENT_HEADERS,
      data: { body: '' },
    });
    await openOnPython(page, PROBLEM);

    await page.getByRole('tab', { name: 'Notes' }).click();
    await page
      .getByRole('textbox', { name: 'Your notes on this problem' })
      .fill('## Remember\n\nthe midpoint');

    // Autosaved, so a reload is the whole assertion.
    await expect
      .poll(async () => {
        const response = await page.request.get(`/api/problems/${PROBLEM.slug}`, {
          headers: CLIENT_HEADERS,
        });
        return ((await response.json()) as { note: string | null }).note;
      })
      .toContain('the midpoint');

    await page.reload();
    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(page.getByRole('textbox', { name: 'Your notes on this problem' })).toHaveValue(
      /the midpoint/,
    );

    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByRole('heading', { name: 'Remember' })).toBeVisible();

    await page.request.put(`/api/notes/${PROBLEM.slug}`, {
      headers: CLIENT_HEADERS,
      data: { body: '' },
    });
  });

  test('stars a problem and unstars it again (P7-7)', async ({ page }) => {
    await page.request.delete(`/api/bookmarks/${PROBLEM.slug}`, { headers: CLIENT_HEADERS });
    await openOnPython(page, PROBLEM);

    await page.getByRole('button', { name: 'Bookmark' }).click();
    await expect(page.getByRole('button', { name: 'Bookmarked' })).toBeVisible();

    // Survives a reload, which is the difference between a star and a highlight.
    await page.reload();
    await page.getByRole('button', { name: 'Bookmarked' }).click();
    await expect(page.getByRole('button', { name: 'Bookmark' })).toBeVisible();
  });

  test('shuts the hints while the interview clock runs (P7-6)', async ({ page }) => {
    await openOnPython(page, PROBLEM);
    await expect(page.getByRole('tab', { name: 'Hints' })).toBeVisible();

    await page.getByRole('button', { name: 'Interview mode' }).click();
    await page.getByRole('button', { name: 'Stopwatch' }).click();

    await expect(page.getByRole('timer')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Hints' })).toBeHidden();
    await expect(page.getByRole('tab', { name: 'Editorial' })).toBeHidden();

    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByRole('tab', { name: 'Hints' })).toBeVisible();
  });

  test('shuts them for a review too, and says so (P7-8)', async ({ page }) => {
    await clearDrafts(page, PROBLEM.slug);
    await page.goto(`/problems/${PROBLEM.slug}?review=1`);

    await expect(page.getByText(/Reviewing from memory/)).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Hints' })).toBeHidden();

    await page.getByRole('button', { name: 'Leave review mode' }).click();
    await expect(page.getByRole('tab', { name: 'Hints' })).toBeVisible();
  });

  test('opens a problem from the command palette (P7-7)', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('ControlOrMeta+k');
    const field = page.getByRole('combobox', { name: 'Search problems and commands' });
    await expect(field).toBeFocused();

    await field.fill('would go');
    await field.press('ArrowDown');
    await field.press('Enter');

    await expect(page.getByRole('heading', { name: PROBLEM.title })).toBeVisible();
  });
});
