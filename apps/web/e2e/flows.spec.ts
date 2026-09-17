import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * The golden path (ROADMAP P4-9).
 *
 * One journey, end to end, through the real UI, the real API, the real judge
 * and the real catalogue: find a problem by narrowing the list, read it, run it
 * against the samples, submit it, and watch the status follow you back to the
 * list and survive a reload.
 *
 * It is deliberately the *boring* path. `m0.spec.ts` proves the judge accepts
 * every pilot in both languages and that a wrong answer is reported as one;
 * what is untested until here is everything between those: that the filters
 * send what they claim, that a row opens the problem it names, that Run and
 * Submit are different operations, and that the status a submit produces is
 * written down rather than merely displayed.
 *
 * **Nothing here deletes anything.** The suite runs against `data/e2e.db` (see
 * `playwright.config.ts`), but a dev server already running on the port is
 * reused as-is and will be using the real one. So the assertions are written to
 * hold whether this problem was solved a minute ago or never: "Solved" after a
 * submit is true either way, where "In progress after the first Run" would be a
 * test that passes once and then never again.
 */

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');

/**
 * A problem each, and neither of them a pilot.
 *
 * `m0.spec.ts` submits all three pilots, the two tests below run in parallel,
 * and all of it shares one server and one database. Two tests solving the same
 * problem at once is two tests writing its status at once - and the second one
 * then finds a problem that is already Solved, which is a different problem
 * from the one it meant to open. Both of these are Easy and Arrays, which is
 * what the filter step needs.
 */
const PROBLEMS = {
  path: { topic: 'arrays', slug: 'balance-point', title: 'Balance Point' },
  keyboard: { topic: 'arrays', slug: 'window-average-peak', title: 'Peak Window Start' },
} as const;

function reference(problem: { topic: string; slug: string }, file: string): string {
  return fs.readFileSync(
    path.join(REPO_ROOT, 'problems', problem.topic, problem.slug, file),
    'utf8',
  );
}

/**
 * How many submissions this problem has, from the count beside the tab.
 *
 * The one number in the UI that cannot be true by accident. These tests run
 * against whatever practice history is already in the database, so "it says
 * Solved" proves nothing on a problem that was solved an hour ago - but "it has
 * one more submission than it had a moment ago" is only true if this submit
 * reached the database and came back. It is also what proves the opposite about
 * Run, which must record nothing at all.
 */
async function submissionCount(page: Page): Promise<number> {
  const label = await page.getByRole('tab', { name: /Submissions/ }).textContent();
  return Number(/\d+/.exec(label ?? '')?.[0] ?? 0);
}

/** Replaces the editor's contents by pasting, for the reasons m0.spec.ts gives. */
async function setEditorContents(page: Page, code: string): Promise<void> {
  await expect(page.locator('[data-testid="editor"] .monaco-editor')).toBeVisible();
  await page.locator('[data-testid="editor"] .view-lines').click();
  await page.evaluate((text) => navigator.clipboard.writeText(text), code);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+v');
}

test.describe('the golden path', () => {
  // A submit runs every hidden test through a real interpreter.
  test.setTimeout(180_000);

  test('filter, read, run, submit, and the status follows you back', async ({ page }) => {
    const problem = PROBLEMS.path;
    await page.goto('/');

    // --- narrow the catalogue down to one topic and one tier ----------------
    const easy = page.getByRole('checkbox', { name: /^Easy/ });
    const arrays = page.getByRole('checkbox', { name: /^Arrays/ });

    // `click` and then wait, rather than `check`: the box is not the state. The
    // URL is (P4-5), so a click goes out to the router and comes back as a
    // re-render, and `check`'s "did it change yet" happens in between.
    await easy.click();
    await expect(easy).toBeChecked();
    await arrays.click();
    await expect(arrays).toBeChecked();

    // The URL is the state (P4-5): a filtered list has to be a link you can
    // send yourself, and the back button has to walk back through the
    // narrowing.
    await expect(page).toHaveURL(/tier=Easy/);
    await expect(page).toHaveURL(/topic=arrays/);

    const rows = page.getByRole('row').filter({ hasText: 'Easy' });
    await expect(rows.first()).toBeVisible();
    // Everything on screen matches both filters, which is the only assertion
    // that would catch a filter the server ignored.
    for (const row of await rows.all()) {
      await expect(row).toContainText('Arrays');
      await expect(row).toContainText('Easy');
    }

    // --- open it ------------------------------------------------------------
    await page.getByRole('link', { name: problem.title }).click();
    await expect(page.getByRole('heading', { name: problem.title })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Description' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The statement is rendered markdown, not a wall of asterisks (P4-3).
    await expect(page.getByRole('heading', { name: 'Input' })).toBeVisible();

    // A hint at a time, and only when asked for (P4-6). Deliberately not the
    // editorial's locked state, which is only locked until the first time this
    // test passes - an assertion that can never be true twice is worse than no
    // assertion. `Workspace.test.tsx` covers the lock, where the state is made
    // rather than inherited.
    await page.getByRole('tab', { name: 'Hints' }).click();
    await page.getByRole('button', { name: 'Show the first hint' }).click();
    await expect(page.getByText('Hint 1')).toBeVisible();
    await expect(page.getByText('Hint 2')).toBeHidden();
    await page.getByRole('tab', { name: 'Description' }).click();

    // --- run the samples ----------------------------------------------------
    await page.getByRole('button', { name: 'Python', exact: true }).click();
    await setEditorContents(page, reference(problem, 'reference.py'));

    const before = await submissionCount(page);

    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Accepted', { timeout: 120_000 });

    // Run is the samples and nothing else: it must not have quietly run the
    // hidden tests, and it must not have recorded a submission (P2-6).
    const results = page.getByTestId('results');
    await expect(results).toContainText('Sample');
    await expect(results).not.toContainText('Hidden');
    expect(await submissionCount(page)).toBe(before);

    // --- submit -------------------------------------------------------------
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Accepted', { timeout: 120_000 });
    await expect(results).toContainText('Hidden');

    // The header flips from the refetched problem, not from the run result
    // (P4-8), so this is also the proof that the submit was recorded.
    await expect(page.getByTestId('problem-status')).toHaveText('Solved in Python');

    // One more submission than there was, and it is in the history with the
    // verdict it earned.
    await expect.poll(() => submissionCount(page)).toBe(before + 1);
    await page.getByRole('tab', { name: /Submissions/ }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Accepted' }).first()).toBeVisible();

    // --- back to the list, and then back to the app -------------------------
    await page.getByRole('link', { name: 'Problems' }).click();
    await expect(page.getByRole('row').filter({ hasText: problem.title })).toContainText('Solved');

    // Persisted, not merely cached: a reload asks the server everything again.
    await page.reload();
    await expect(page.getByRole('row').filter({ hasText: problem.title })).toContainText('Solved');
  });

  test('is walkable from the keyboard alone', async ({ page }) => {
    /*
     * Not a duplicate of the path above: the claim in docs/DESIGN.md section 8
     * is that the *whole loop* is reachable without a mouse, and a claim like
     * that decays silently. The one concession is pasting into Monaco, which is
     * how a keyboard user would fill an editor anyway.
     */
    const problem = PROBLEMS.keyboard;
    await page.goto(`/problems/${problem.slug}`);
    await expect(page.getByRole('heading', { name: problem.title })).toBeVisible();

    await page.getByRole('button', { name: 'Python', exact: true }).click();
    await setEditorContents(page, reference(problem, 'reference.py'));

    const before = await submissionCount(page);

    // Ctrl+Enter runs. The editor has focus, so this also proves the shortcut
    // survives Monaco having the keyboard (P4-2's registry).
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('verdict')).toHaveText('Accepted', { timeout: 120_000 });
    expect(await submissionCount(page)).toBe(before);

    // Ctrl+J collapses the panel and brings it back.
    await page.keyboard.press('Control+j');
    await expect(page.getByTestId('results')).toBeHidden();
    await page.keyboard.press('Control+j');
    await expect(page.getByTestId('results')).toBeVisible();

    // Ctrl+Shift+Enter submits. Counted rather than read off the header: this
    // problem may well have been Solved before the test started.
    await page.keyboard.press('Control+Shift+Enter');
    await expect.poll(() => submissionCount(page), { timeout: 120_000 }).toBe(before + 1);
    await expect(page.getByTestId('problem-status')).toHaveText('Solved in Python');
  });
});
