import { expect, test, type Page } from '@playwright/test';
import { CLIENT_HEADERS, clearDrafts, openOnPython, setEditorContents } from './helpers.js';

/**
 * Formatting in a real editor (ROADMAP P9-5).
 *
 * The RTL tests cover the loop around the editor - what is sent, what is
 * saved, what the note says - over a textarea. What only a browser can show
 * is Monaco's side: that the formatted code lands as one undoable edit rather
 * than a replaced value, and that Shift+Alt+F reaches our action.
 *
 * The formatting tests need `black`, which nothing here installs, and skip
 * when the server did not find it. CI's E2E lane installs it and sets
 * `DEVPROMAX_FORMATTER_TESTS=1`, which turns that skip into a failure - a
 * lane that quietly tests nothing is worse than no lane.
 */

const PROBLEM = { topic: 'arrays', slug: 'best-single-trade', title: 'Best Single Trade' };
/** A second one, so the two describes' draft clean-ups cannot race each other. */
const SAVING = { topic: 'arrays', slug: 'largest-run-sum', title: 'Largest Run Sum' };
const MESSY = 'x=[1,2 ,3]\ny  =  { "a":1 }\n';
const TIDY = ['x = [1, 2, 3]', 'y = {"a": 1}'];

async function lines(page: Page): Promise<string[]> {
  const text = await page.locator('[data-testid="editor"] .view-lines').innerText();
  return text
    .split('\n')
    .map((line) => line.replace(/\u00A0/g, ' ').trimEnd())
    .filter((line) => line !== '');
}

test.describe('formatting', () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.request.get('/api/format', { headers: CLIENT_HEADERS });
    const { formatters } = (await response.json()) as {
      formatters: { language: string; available: boolean }[];
    };
    const black = formatters.find((entry) => entry.language === 'python')?.available === true;
    if (process.env['DEVPROMAX_FORMATTER_TESTS'] === '1') {
      expect(black, 'black must be installed for this lane').toBe(true);
    }
    test.skip(!black, 'black is not installed here; see Settings › Formatting');
  });

  test.afterEach(async ({ page }) => {
    await clearDrafts(page, PROBLEM.slug);
  });

  test('formats as one edit that Ctrl+Z takes back', async ({ page }) => {
    await openOnPython(page, PROBLEM);
    await setEditorContents(page, MESSY);

    await page.getByRole('button', { name: 'Format', exact: true }).click();
    await expect(page.getByTestId('format-note')).toHaveText('Formatted');
    expect(await lines(page)).toEqual(TIDY);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => lines(page)).toEqual(['x=[1,2 ,3]', 'y  =  { "a":1 }']);
  });

  test('answers Shift+Alt+F from inside the editor', async ({ page }) => {
    await openOnPython(page, PROBLEM);
    await setEditorContents(page, MESSY);

    await page.keyboard.press('Shift+Alt+F');
    await expect(page.getByTestId('format-note')).toHaveText('Formatted');
    expect(await lines(page)).toEqual(TIDY);
  });
});

/** Needs no formatter: with format on save off, which is the default, Ctrl+S only saves. */
test.describe('Ctrl+S', () => {
  test.afterEach(async ({ page }) => {
    await clearDrafts(page, SAVING.slug);
  });

  test('saves on Ctrl+S, instead of opening the browser’s save dialog', async ({ page }) => {
    await openOnPython(page, SAVING);
    await setEditorContents(page, MESSY);

    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByTestId('format-note')).toHaveText('Saved');

    const detail = await page.request.get(`/api/problems/${SAVING.slug}`, {
      headers: CLIENT_HEADERS,
    });
    const { drafts } = (await detail.json()) as { drafts: { python?: { code: string } } };
    // Format on save is off by default, so what was pasted is what was kept.
    expect(drafts.python?.code).toBe(MESSY);
  });
});
