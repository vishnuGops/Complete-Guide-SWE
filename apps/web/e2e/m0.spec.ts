import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * The M0 exit criterion, as a test (ROADMAP P4-1).
 *
 * "Solve all three pilot problems in both languages from the browser" is the
 * milestone, and a milestone nobody can re-check is a claim rather than a fact.
 * This drives the real UI against the real server and the real judge: the only
 * thing it takes a shortcut on is typing, because pasting a reference solution
 * keystroke by keystroke tests Monaco's auto-indent rather than DevProMax.
 */

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');

const PILOTS = [
  { topic: 'arrays', slug: 'pair-sum-index', title: 'Pair Sum Index' },
  { topic: 'arrays', slug: 'shift-right-in-place', title: 'Shift Right In Place' },
  { topic: 'stack', slug: 'min-value-stack', title: 'Min Value Stack' },
] as const;

const LANGUAGES = [
  { label: 'Python', file: 'reference.py' },
  { label: 'Java', file: 'reference.java' },
] as const;

function reference(topic: string, slug: string, file: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, 'problems', topic, slug, file), 'utf8');
}

/**
 * Replaces the editor's contents, the way a person would: select all, paste.
 *
 * Two details are load-bearing. The click has to land on the editor's own text
 * surface - Monaco 0.56 takes input through an `EditContext` element, so
 * focusing the hidden textarea that older guides target does nothing at all.
 * And the text arrives through the clipboard rather than as keystrokes, because
 * typing a Python reference line by line tests Monaco's auto-indent rather than
 * DevProMax.
 */
async function setEditorContents(page: Page, code: string): Promise<void> {
  await expect(page.locator('[data-testid="editor"] .monaco-editor')).toBeVisible();
  await page.locator('[data-testid="editor"] .view-lines').click();
  await page.evaluate((text) => navigator.clipboard.writeText(text), code);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+v');
}

test.describe('M0: solve the pilot problems from the browser', () => {
  // A submit compiles and runs every hidden test in both languages.
  test.setTimeout(180_000);

  test('the problem list shows the catalogue', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Problems' })).toBeVisible();
    for (const pilot of PILOTS) {
      await expect(page.getByRole('link', { name: pilot.title })).toBeVisible();
    }
  });

  for (const pilot of PILOTS) {
    for (const language of LANGUAGES) {
      test(`${pilot.slug} is accepted in ${language.label}`, async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: pilot.title }).click();

        await expect(page.getByRole('heading', { name: pilot.title })).toBeVisible();
        await page.getByRole('button', { name: language.label, exact: true }).click();

        await setEditorContents(page, reference(pilot.topic, pilot.slug, language.file));
        await page.getByRole('button', { name: 'Submit' }).click();

        await expect(page.getByTestId('verdict')).toHaveText('Accepted', { timeout: 120_000 });
        await expect(page.getByTestId('solved')).toBeVisible();
      });
    }
  }

  test('an accepted submit flips the row in the list without a reload', async ({ page }) => {
    const pilot = PILOTS[0];
    await page.goto('/');
    await page.getByRole('link', { name: pilot.title }).click();

    // Named rather than assumed: the workspace opens in the language last used,
    // which is a setting shared by every test in this file (P3-4).
    await page.getByRole('button', { name: 'Python', exact: true }).click();
    await setEditorContents(page, reference(pilot.topic, pilot.slug, 'reference.py'));
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Accepted', { timeout: 120_000 });

    await page.getByRole('link', { name: 'Problems' }).click();
    const row = page.getByRole('row').filter({ hasText: pilot.title });
    await expect(row).toContainText('Solved');
  });

  test('a wrong answer is reported as one, with the failing test', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Pair Sum Index' }).click();

    await page.getByRole('button', { name: 'Python', exact: true }).click();
    await setEditorContents(
      page,
      [
        'class Solution:',
        '    def pairSumIndex(self, nums, target):',
        '        return [0, 0]',
      ].join('\n'),
    );
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByTestId('verdict')).toHaveText('Wrong Answer', { timeout: 120_000 });
    await expect(page.getByTestId('results')).toContainText('WA');
  });
});
