import { expect, test } from '@playwright/test';
import { problemFile, setEditorContents } from './helpers.js';

/**
 * The M0 exit criterion, as a test (ROADMAP P4-1).
 *
 * "Solve all three pilot problems in both languages from the browser" is the
 * milestone, and a milestone nobody can re-check is a claim rather than a fact.
 * This drives the real UI against the real server and the real judge: the only
 * thing it takes a shortcut on is typing, because pasting a reference solution
 * keystroke by keystroke tests Monaco's auto-indent rather than DevProMax.
 */

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
  return problemFile(topic, slug, file);
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
        // The header's status is refetched from the server, so this also proves
        // the submit was recorded and not merely answered (P4-8).
        await expect(page.getByTestId('problem-status')).toHaveText(`Solved in ${language.label}`);
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
