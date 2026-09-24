import { expect, test, type Page } from '@playwright/test';
import { chooseLanguage, problemFile, setEditorContents } from './helpers.js';

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
 * **The assertions hold whatever came before.** The suite starts on an empty
 * `data/e2e.db` (see `playwright.config.ts`), but other specs share it, retries
 * re-run a test on whatever its first attempt left, and a spec run twice in one
 * session meets itself. So the assertions are written to hold whether this
 * problem was solved a minute ago or never: "Solved" after a submit is true
 * either way, where "In progress after the first Run" would be a test that
 * passes once and then never again.
 */

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
  return problemFile(problem.topic, problem.slug, file);
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
    /*
     * Everything on screen matches both filters, which is the only assertion
     * that would catch a filter the server ignored.
     *
     * Asserted as "no row fails to match" rather than by walking the rows:
     * `all()` snapshots a list of locators, and the list re-renders when the
     * query settles, so by the time the sixth was checked it could be gone.
     * This form is one retrying assertion over whatever is on screen now.
     */
    await expect(rows.filter({ hasNotText: 'Arrays' })).toHaveCount(0);

    // --- open it ------------------------------------------------------------
    await page.getByRole('link', { name: problem.title }).click();
    await expect(page.getByRole('heading', { name: problem.title })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Description' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The statement is rendered markdown, not a wall of asterisks (P4-3).
    await expect(page.getByRole('heading', { name: 'Input' })).toBeVisible();

    /*
     * A hint at a time, and only when asked for (P4-6).
     *
     * Written as "one more than there was" rather than "the first one", because
     * P7-1 made reveals persist: against a database that has seen this test
     * before, the first rung is already open and a button named "Show the first
     * hint" does not exist. Same reasoning as the editorial's lock, which this
     * test deliberately does not assert - an assertion that can never be true
     * twice is worse than no assertion. `Workspace.test.tsx` covers both
     * transitions, where the state is made rather than inherited.
     */
    await page.getByRole('tab', { name: 'Hints' }).click();
    const revealed = page.getByText(/^Hint \d+$/);
    const reveal = page.getByRole('button', { name: /Show the (first|next) hint/ });

    if (await reveal.isVisible()) {
      const before = await revealed.count();
      await reveal.click();
      await expect(revealed).toHaveCount(before + 1);
    } else {
      // The whole ladder is already open on this database, which is still the
      // feature working - just not a transition this run can watch.
      await expect(page.getByText('That is every hint for this problem.')).toBeVisible();
    }
    await expect(revealed.first()).toBeVisible();
    await page.getByRole('tab', { name: 'Description' }).click();

    // --- run the samples ----------------------------------------------------
    await chooseLanguage(page, 'python');
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
    // A list rather than a table since P7-3: every row is one button that opens
    // the attempt under it, and there are no column headers left to justify one.
    const history = page.getByRole('list', { name: /Submissions for this problem/ });
    await expect(history.getByText('Accepted').first()).toBeVisible();

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

    await chooseLanguage(page, 'python');
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

/**
 * Drafts, through two language switches and a reload (ROADMAP P4-11).
 *
 * The defect this covers was invisible to every other test: the PUT was always
 * sent, so "the draft was saved" was true - what was wrong was what the app
 * believed afterwards. Java → Python → Java restored the starter over ten
 * minutes of typing, and the next autosave wrote that starter over the real
 * draft. Only a round trip through two switches and a reload can tell.
 *
 * Two things about the setup, both learned the hard way:
 *
 *   - **The language is not Python by default.** `lastLanguage` is a *setting*,
 *     shared by every test and every earlier run, so this starts by choosing
 *     Python explicitly. Without that, an earlier test's choice decided which
 *     language these drafts were written to, and the assertions then held or
 *     failed depending on the order the suite happened to run in.
 *   - **Every step waits for the save it expects**, not for the editor to look
 *     right. Monaco shows pasted text before React has it, so waiting on the
 *     PUT that carries the text is the only proof that the app, and not just
 *     the DOM, is holding it.
 *
 * Its own problem, so it cannot disturb the golden path, and it never submits.
 */
test.describe('drafts', () => {
  /*
   * Serial, and a problem each.
   *
   * These two both write drafts and both choose a language, and `lastLanguage`
   * is a *setting* - global to the database the suite shares. Run in parallel
   * they typed into each other's editors, which showed up as a draft with both
   * tests' text in it.
   */
  test.describe.configure({ mode: 'serial' });

  const PROBLEM = { slug: 'sequence-run-length', title: 'Longest Consecutive Run' };
  /** A second problem, so the flush test cannot disturb the round-trip one. */
  const FLUSH_PROBLEM = { slug: 'first-unique-symbol', title: 'First Symbol That Stands Alone' };

  const PYTHON_MARK = '# python draft P4-11';
  const JAVA_MARK = '// java draft P4-11';

  const CLIENT = { 'X-DevProMax-Client': 'devpromax-web' };

  /** Resolves when a draft PUT for this problem and language carries `text`. */
  function draftSaved(page: Page, slug: string, language: 'python' | 'java', text: string) {
    return page.waitForResponse((response) => {
      const request = response.request();
      if (request.method() !== 'PUT') return false;
      if (!response.url().endsWith(`/api/drafts/${slug}/${language}`)) return false;
      return (request.postData() ?? '').includes(text);
    });
  }

  async function clearDrafts(page: Page, slug: string): Promise<void> {
    for (const language of ['python', 'java'] as const) {
      const response = await page.request.delete(`/api/drafts/${slug}/${language}`, {
        headers: CLIENT,
      });
      expect(response.ok(), 'the draft delete that resets this problem').toBe(true);
    }
  }

  /** Opens a problem on a known language with no drafts behind it. */
  async function openOnPython(
    page: Page,
    problem: { slug: string; title: string },
    starterMarker: string,
  ): Promise<void> {
    await clearDrafts(page, problem.slug);
    await page.goto(`/problems/${problem.slug}`);
    await expect(page.getByRole('heading', { name: problem.title })).toBeVisible();
    await chooseLanguage(page, 'python');
    await expect(page.locator('[data-testid="editor"]')).toContainText(starterMarker);
  }

  test('survive switching language twice and reloading', async ({ page }) => {
    await openOnPython(page, PROBLEM, 'def longestRun');
    const editor = page.locator('[data-testid="editor"]');

    // Python first, and not a step further until the server has it.
    const pythonSaved = draftSaved(page, PROBLEM.slug, 'python', PYTHON_MARK);
    await setEditorContents(
      page,
      `${PYTHON_MARK}
class Solution:
    pass
`,
    );
    await expect(editor).toContainText(PYTHON_MARK);
    await pythonSaved;

    await page.getByRole('button', { name: 'Java' }).click();
    const javaSaved = draftSaved(page, PROBLEM.slug, 'java', JAVA_MARK);
    await setEditorContents(
      page,
      `${JAVA_MARK}
class Solution {}
`,
    );
    await expect(editor).toContainText(JAVA_MARK);
    await javaSaved;

    // Back to Python. This is the assertion the write-through exists for: the
    // editor is re-seeded from the cached problem, and the cache had never been
    // told about either save.
    await page.getByRole('button', { name: 'Python', exact: true }).click();
    await expect(editor).toContainText(PYTHON_MARK);

    // And after a reload, which is the only way to prove the server has them
    // rather than the page. Python chosen again rather than assumed: a reload
    // opens on `lastLanguage`, which a worker in another spec may have set to
    // Java since this test last chose (ROADMAP P8-7).
    await page.reload();
    await expect(page.getByRole('heading', { name: PROBLEM.title })).toBeVisible();
    await chooseLanguage(page, 'python');
    await expect(editor).toContainText(PYTHON_MARK);

    await page.getByRole('button', { name: 'Java' }).click();
    await expect(editor).toContainText(JAVA_MARK);

    await clearDrafts(page, PROBLEM.slug);
  });

  test('a draft typed a moment before leaving is still written', async ({ page }) => {
    // The debounce used to be cleared without being flushed, so the last
    // 800 ms of typing died with the language click. Typed rather than pasted:
    // a keystroke reaches React on its own, where a paste goes through Monaco's
    // clipboard path and lands when it lands.
    await openOnPython(page, FLUSH_PROBLEM, 'class Solution');

    const flushed = '# flushed';
    const saved = draftSaved(page, FLUSH_PROBLEM.slug, 'python', flushed);

    await page.locator('[data-testid="editor"] .view-lines').click();
    await page.keyboard.type(
      `${flushed}
`,
      { delay: 30 },
    );
    // Immediately - well inside the 800 ms debounce.
    await page.getByRole('button', { name: 'Java' }).click();

    await saved;
    await clearDrafts(page, FLUSH_PROBLEM.slug);
  });
});
