import { expect, test } from '@playwright/test';
import { CLIENT_HEADERS } from './helpers.js';

/**
 * The progress dashboard and its export (ROADMAP P8-1, covering P7-5).
 *
 * Reads only: this file runs the judge for nothing and deletes nothing, so it
 * holds against whatever practice history is already in the database. The one
 * thing it writes is a note, which it removes again.
 *
 * The download is the part worth an end-to-end test rather than a unit one.
 * `reportService.test.ts` asserts what the file contains; only a browser can
 * show that the click produces a file at all, since the report goes through
 * `fetch` and a blob rather than a link (the client header, D15).
 */

test.describe('the dashboard', () => {
  test('counts the catalogue, and each topic row filters the list', async ({ page }) => {
    await page.goto('/progress');

    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
    await expect(page.getByText(/of \d+ problems solved/)).toBeVisible();

    // "Graph 0/14" is a prompt, and a prompt you cannot act on is a number.
    await page.getByRole('link', { name: 'Graph' }).first().click();
    await expect(page).toHaveURL(/topic=graph/);
    await expect(page.getByRole('checkbox', { name: /^Graph/ })).toBeChecked();
  });

  test('says how long the streak is in words, not only in squares', async ({ page }) => {
    await page.goto('/progress');

    const streak = page.getByRole('heading', { name: 'Streak' });
    await expect(streak).toBeVisible();
    // The calendar itself is `aria-hidden` decoration for this sentence, so the
    // sentence is what has to be there.
    await expect(page.getByText(/in a row\. Longest \d+/)).toBeVisible();
  });

  test('explains an empty skills table rather than showing an empty table', async ({ page }) => {
    await page.goto('/progress');

    // The coach has scored nothing in this database unless a key was configured
    // and used, so either the explanation or the table is correct - but exactly
    // one of them must be on screen.
    const explained = page.getByText(/Nothing scored yet/);
    const table = page.getByRole('table', { name: /Average coach rubric score/ });
    await expect(page.getByRole('heading', { name: 'Weakest topics' })).toBeVisible();
    expect((await explained.count()) + (await table.count())).toBe(1);
  });

  test('downloads the skills report as a file', async ({ page }) => {
    await page.goto('/progress');

    for (const [label, extension] of [
      ['Markdown', 'md'],
      ['Web page', 'html'],
      ['JSON', 'json'],
    ] as const) {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: label, exact: true }).click();
      const file = await download;

      // Named after the day it was produced, so two of them do not overwrite
      // each other in a downloads folder.
      expect(file.suggestedFilename()).toMatch(
        new RegExp(`^devpromax-report-\\d{4}-\\d{2}-\\d{2}\\.${extension}$`),
      );
    }
  });

  test('the exported web page is self-contained', async ({ page }) => {
    await page.goto('/progress');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Web page', exact: true }).click();
    const stream = await (await download).createReadStream();
    const html = (await new Response(stream as unknown as ReadableStream).text()).toString();

    // It is going to be opened on someone else's machine. Anything it requested
    // would either fail there or tell a third party it had been opened.
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('DSA practice report');
  });

  test('a note is searchable from the list (P7-4)', async ({ page }) => {
    const slug = 'tree-depth';
    await page.request.put(`/api/notes/${slug}`, {
      headers: CLIENT_HEADERS,
      data: { body: 'the one where the recursion is the easy part' },
    });

    await page.goto('/?q=recursion%20is%20the%20easy');
    // Title and patterns say nothing of the sort; the note is the only reason
    // this row matched.
    await expect(page.getByRole('link', { name: 'How Deep It Goes' })).toBeVisible();
    await expect(page.getByText('Has a note')).toBeVisible();

    await page.request.put(`/api/notes/${slug}`, { headers: CLIENT_HEADERS, data: { body: '' } });
  });
});
