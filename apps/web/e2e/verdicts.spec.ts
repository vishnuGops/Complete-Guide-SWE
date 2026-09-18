import { expect, test } from '@playwright/test';
import { clearDrafts, openOnPython, problemFile, setEditorContents } from './helpers.js';

/**
 * Every verdict the judge can reach, through the real UI (ROADMAP P8-1).
 *
 * `m0.spec.ts` proves an accepted solution is accepted. What this covers is the
 * other five: that a wrong answer, a crash, a syntax error and a runaway loop
 * each come back as themselves rather than as each other, and that the two test
 * *modes* the judge supports - operations and mutated arguments - work end to
 * end rather than only in the judge's own integration tests.
 *
 * The four failure cases go through **Run** rather than Submit. A Run is the
 * same judge, the same harness and the same verdict mapping, and it neither
 * writes a submission nor spends a minute running sixteen hidden tests to learn
 * something the first one already said.
 *
 * **MLE is deliberately not here.** Reaching it means allocating past a memory
 * limit, which on three platforms is either slow, flaky, or a machine that
 * starts swapping - and the mapping from a killed process to `MLE` is covered
 * where it belongs, in `apps/server/src/judge`. That is a gap in this file,
 * stated rather than papered over.
 */

/** One problem for the failures: a wrong answer does not move a status the way a solve does. */
const FAILING = { topic: 'arrays', slug: 'running-maximum', title: 'Highest So Far' };

/** The two test modes, each with its own problem so the specs can run in parallel. */
const OPERATIONS = {
  topic: 'heap',
  slug: 'kth-largest-stream',
  title: 'K-th Largest, As It Arrives',
};
const MUTATED = { topic: 'arrays', slug: 'zero-gravity', title: 'Sink The Zeroes' };

test.describe('the verdicts', () => {
  // Each of these compiles or interprets real code in a real subprocess.
  test.setTimeout(180_000);

  test.afterEach(async ({ page }) => {
    // The next test in this worker opens on the starter, and a leftover draft
    // of deliberately broken code is a confusing way to start.
    await clearDrafts(page, FAILING.slug);
  });

  test('a wrong answer is a wrong answer, with the failing case on screen', async ({ page }) => {
    await openOnPython(page, FAILING);
    await setEditorContents(
      page,
      [
        'from typing import List',
        '',
        '',
        'class Solution:',
        '    def runningMaximum(self, readings: List[int]) -> List[int]:',
        '        # Right shape, wrong answer.',
        '        return [0 for _ in readings]',
        '',
      ].join('\n'),
    );

    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Wrong Answer', { timeout: 120_000 });
    // The point of a wrong answer is being shown which case, not being told a word.
    await expect(page.getByTestId('results')).toContainText('Expected');
  });

  test('a crash is a runtime error, not a wrong answer', async ({ page }) => {
    await openOnPython(page, FAILING);
    await setEditorContents(
      page,
      [
        'from typing import List',
        '',
        '',
        'class Solution:',
        '    def runningMaximum(self, readings: List[int]) -> List[int]:',
        '        raise ValueError("deliberate")',
        '',
      ].join('\n'),
    );

    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Runtime Error', { timeout: 120_000 });
    // The exception the user has to act on, not a summary of it.
    await expect(page.getByTestId('results')).toContainText('ValueError');
  });

  test('a syntax error is a compile error, and says where', async ({ page }) => {
    await openOnPython(page, FAILING);
    await setEditorContents(page, 'class Solution:\n    def runningMaximum(self readings)\n');

    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Compile Error', { timeout: 120_000 });
    // A line number, because "there is a syntax error somewhere" is not help.
    await expect(page.getByTestId('results')).toContainText(/line \d+/i);
  });

  test('a runaway loop is a timeout rather than a hung page', async ({ page }) => {
    await openOnPython(page, FAILING);
    await setEditorContents(
      page,
      [
        'from typing import List',
        '',
        '',
        'class Solution:',
        '    def runningMaximum(self, readings: List[int]) -> List[int]:',
        '        while True:',
        '            pass',
        '',
      ].join('\n'),
    );

    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Time Limit Exceeded', {
      timeout: 120_000,
    });
  });

  test('an operations problem is driven through its method calls', async ({ page }) => {
    await openOnPython(page, OPERATIONS);
    await setEditorContents(page, problemFile(OPERATIONS.topic, OPERATIONS.slug, 'reference.py'));

    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Accepted', { timeout: 120_000 });
    await expect(page.getByTestId('problem-status')).toHaveText('Solved in Python');
  });

  test('a problem that changes its argument in place is checked on the argument', async ({
    page,
  }) => {
    await openOnPython(page, MUTATED);
    await setEditorContents(page, problemFile(MUTATED.topic, MUTATED.slug, 'reference.py'));

    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Accepted', { timeout: 120_000 });
    // `expect: mutatedArgs` - the method returns nothing, so an accepted verdict
    // here is only reachable if the harness compared the arguments afterwards.
    await expect(page.getByTestId('problem-status')).toHaveText('Solved in Python');
  });
});
