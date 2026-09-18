import { expect, test, type Page } from '@playwright/test';

/**
 * The performance budgets (ROADMAP P8-2).
 *
 * Three numbers the roadmap asks for, measured rather than assumed, with a
 * budget each so a regression fails a build instead of being noticed months
 * later. The numbers are deliberately loose - two and a half times what this
 * machine does today - because a budget that trips on a busy CI runner gets
 * deleted, and a budget nobody trusts is worse than none.
 *
 * Each test prints what it measured, so the report says how much headroom
 * there is rather than only "under budget".
 */

/** The catalogue the roadmap sizes the list against: 500 problems. */
const CATALOGUE_SIZE = 500;

const TOPICS = [
  'arrays',
  'hashmap',
  'sorting',
  'binary-search',
  'linked-list',
  'stack',
  'matrix',
  'binary-tree',
  'heap',
  'graph',
  'backtracking',
  'dynamic-programming',
  'bit-manipulation',
  'data-structures',
] as const;

const TIERS = ['Easy', 'Medium', 'Hard'] as const;

function aCatalogue(size: number) {
  const items = Array.from({ length: size }, (_, i) => ({
    id: `problem-${String(i)}`,
    slug: `problem-${String(i)}`,
    title: `Synthetic Problem ${String(i)}`,
    topic: TOPICS[i % TOPICS.length],
    tier: TIERS[i % TIERS.length],
    rating: (i % 10) + 1,
    order: i,
    patterns: ['two pointers', 'hash map'],
    mode: 'function',
    status: i % 4 === 0 ? 'solved' : 'not_started',
    statusByLanguage: i % 4 === 0 ? { python: 'solved' } : {},
    attempts: i % 3,
    lastAttemptedAt: null,
    solvedAt: null,
    hasNote: i % 17 === 0,
    bookmarked: i % 23 === 0,
    version: 1,
    solvedVersion: i % 4 === 0 ? 1 : null,
  }));

  return {
    items,
    matched: size,
    total: size,
    byStatus: {
      not_started: size - Math.ceil(size / 4),
      in_progress: 0,
      solved: Math.ceil(size / 4),
      mastered: 0,
    },
    byTopic: TOPICS.map((topic) => ({
      topic,
      total: Math.floor(size / TOPICS.length),
      solved: 0,
      mastered: 0,
      inProgress: 0,
    })),
  };
}

/** Answers the list route with a synthetic catalogue, leaving everything else real. */
async function serveCatalogue(page: Page, size: number): Promise<void> {
  await page.route(/\/api\/problems(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(aCatalogue(size)),
    });
  });
}

test.describe('the performance budgets', () => {
  /**
   * 500 rows, unvirtualised.
   *
   * The roadmap's instruction is "virtualise only if needed", and this is what
   * decides it. The assertion that all 500 rows are in the DOM is as important
   * as the timing: if a later change adds windowing, this test fails and the
   * decision gets made on purpose rather than by accident.
   */
  test('renders a 500-problem list well inside its budget', async ({ page }) => {
    await serveCatalogue(page, CATALOGUE_SIZE);

    const started = Date.now();
    await page.goto('/');
    const last = page.getByRole('link', {
      name: `Synthetic Problem ${String(CATALOGUE_SIZE - 1)}`,
    });
    await expect(last).toBeAttached();
    const elapsed = Date.now() - started;

    const rows = await page.getByRole('row').count();
    console.log(
      `list of ${String(CATALOGUE_SIZE)}: ${String(elapsed)} ms, ${String(rows)} rows in the DOM`,
    );

    // Every row is really there, so nothing is being windowed and the numbers
    // above are the whole list rather than a screenful of it.
    expect(rows).toBeGreaterThanOrEqual(CATALOGUE_SIZE);
    expect(elapsed).toBeLessThan(4_000);
  });

  test('filters a 500-problem list without a visible pause', async ({ page }) => {
    await serveCatalogue(page, CATALOGUE_SIZE);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Synthetic Problem 0' })).toBeAttached();

    // The server answers the same 500 rows whatever is asked for, so what this
    // measures is the click, the navigation and the re-render - not the query.
    const started = Date.now();
    await page.getByRole('checkbox', { name: /^Hard/ }).click();
    await expect(page).toHaveURL(/tier=Hard/);
    const elapsed = Date.now() - started;

    console.log(`filter click on ${String(CATALOGUE_SIZE)} rows: ${String(elapsed)} ms`);
    expect(elapsed).toBeLessThan(2_000);
  });

  test('opens the workspace, and the editor arrives as its own chunk', async ({ page }) => {
    const chunks: string[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (/\.js(\?|$)/.test(url)) chunks.push(url);
    });

    const started = Date.now();
    await page.goto('/problems/insert-position');
    await expect(page.locator('[data-testid="editor"] .monaco-editor')).toBeVisible();
    const elapsed = Date.now() - started;

    console.log(`workspace with the editor: ${String(elapsed)} ms`);
    expect(elapsed).toBeLessThan(10_000);

    /*
     * Monaco is code-split (P8-2), which is why the list and the dashboard do
     * not pay for it. In a dev server the chunk is a module graph rather than
     * one file, so this only asserts the editor is fetched separately at all -
     * the built output is where the split is visible as a `CodeEditor-*.js`.
     */
    expect(chunks.some((url) => /CodeEditor|monaco/i.test(url))).toBe(true);
  });
});
