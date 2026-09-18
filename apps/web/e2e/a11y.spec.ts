import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { CLIENT_HEADERS } from './helpers.js';

/**
 * The accessibility audit (ROADMAP P4-10).
 *
 * Run in a real browser rather than in jsdom, and that is the point: half of
 * what axe checks - computed contrast, what is actually visible, what the
 * layout puts where - does not exist in a DOM with no CSS. This is also the only
 * automated check of the contrast rule as the user meets it, rather than as
 * `styles/contrast.test.ts` measures it in the token file.
 *
 * Both themes, because docs/DESIGN.md section 9 says both are first-class and a
 * palette that passes in light has proved nothing about dark.
 *
 * The bar is the roadmap's: zero violations at `serious` or `critical`. Lesser
 * ones are reported in the failure message when something does break, so a
 * `moderate` finding is visible without being a gate - the alternative is a
 * suite that fails on a debatable landmark rule and gets switched off.
 *
 * Automated coverage catches a minority of real barriers. The rest of the
 * section 10 checklist - focus order, keyboard reachability, whether a label
 * says anything useful - is read by a person, and the keyboard-only flow is
 * exercised by the golden path in `flows.spec.ts`.
 */

/*
 * Motion off for the whole audit.
 *
 * Not a preference - a correctness fix. Tab triggers and buttons carry a 75ms
 * colour transition, and axe reads the computed colour at whatever instant it
 * runs: catch a tab mid-transition after the theme switch and the contrast it
 * measures is a colour that existed for one frame and never as a thing anyone
 * read. `base.css` collapses transitions under `prefers-reduced-motion`, so
 * emulating it is exactly "measure the colours the app settles on".
 */
test.use({ reducedMotion: 'reduce' });

/*
 * One worker, one page at a time, for this file.
 *
 * The theme is a *server* setting (`useAppTheme`), shared by every window on the
 * machine - which is the behaviour we want from the app and is fatal to an audit
 * run in parallel: one worker clicking Dark repaints another worker's page while
 * axe is walking it, and the finding that comes back is one theme's text colour
 * measured against the other theme's background. It was an hour's worth of
 * chasing a contrast bug that did not exist.
 *
 * `default` rather than `serial`: sequential in one worker, but a failure on the
 * problem list still lets the workspace be audited. An audit that stops at the
 * first finding reports one thing to fix at a time.
 */
test.describe.configure({ mode: 'default' });

const THEMES = ['light', 'dark'] as const;

const PAGES = [
  { name: 'problem list', url: '/', ready: 'Problems' },
  { name: 'progress', url: '/progress', ready: 'Progress' },
  { name: 'settings', url: '/settings', ready: 'Settings' },
  { name: 'interview', url: '/interview', ready: 'Mock interview' },
  { name: 'workspace', url: '/problems/pair-sum-index', ready: 'Pair Sum Index' },
] as const;

/**
 * Puts the app in one theme, through the API and before the page loads.
 *
 * Clicking the toggle would be the user's path, and it is the wrong one here:
 * the click fires a settings write while the page's own settings query may
 * still be in flight, and whichever answers last wins. Writing first and then
 * loading leaves nothing to race - the page arrives already in the theme under
 * audit, and `data-theme` proves it before a single rule is evaluated.
 */
async function applyTheme(page: Page, theme: (typeof THEMES)[number], url: string): Promise<void> {
  const response = await page.request.put('/api/settings', {
    headers: { 'X-DevProMax-Client': 'devpromax-web' },
    data: { theme },
  });
  expect(response.ok(), 'the settings write that sets the theme').toBe(true);

  await page.goto(url);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

function audit(page: Page): AxeBuilder {
  return (
    new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      /*
       * Monaco is excluded, and only Monaco.
       *
       * The editor's internals are not ours to fix - it renders its own
       * overlays, its own hidden input and its own colour theme - and an
       * exclusion that covers a third-party widget is honest, where one that
       * quietly covered our own toolbar would not be. Everything around it in
       * the workspace, the panel it sits in included, is still audited.
       */
      .exclude('[data-testid="editor"]')
  );
}

for (const theme of THEMES) {
  for (const target of PAGES) {
    test(`${target.name} has no serious a11y violations in ${theme}`, async ({ page }) => {
      await applyTheme(page, theme, target.url);
      await expect(page.getByRole('heading', { name: target.ready })).toBeVisible();

      const { violations } = await audit(page).analyze();
      const serious = violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );

      // Compared as `<impact> <rule>` strings: the diff of a failure is then
      // the list of rules broken, and the detail is in the message beside it.
      // Comparing the raw objects prints a screen of axe internals per finding.
      expect(
        serious.map((violation) => `${violation.impact ?? 'unknown'} ${violation.id}`),
        describe(violations, `${target.name} in ${theme}`),
      ).toEqual([]);
    });
  }

  /**
   * The Coach tab, audited separately because it has to be opened (P5-3).
   *
   * Worth its own case rather than a fifth entry in `PAGES`: the panel under it
   * is a different surface from the statement - a rubric drawn as pips, a live
   * region that fills in as text arrives, and a text box named only by its
   * `aria-label` - and none of it is on screen until the tab is selected.
   *
   * The tab also proved worth auditing: it exposed a heading jump from `h1` to
   * `h3` in the testcase panel that Hints and Submissions had had since P4-6,
   * hidden because Description's markdown happened to supply the missing `h2`.
   */
  test(`the coach panel has no serious a11y violations in ${theme}`, async ({ page }) => {
    await applyTheme(page, theme, '/problems/pair-sum-index');
    await expect(page.getByRole('heading', { name: 'Pair Sum Index' })).toBeVisible();

    await page.getByRole('tab', { name: 'Coach' }).click();
    await expect(page.getByRole('button', { name: /Ask for help/i })).toBeVisible();

    const { violations } = await audit(page).analyze();
    const serious = violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(
      serious.map((violation) => `${violation.impact ?? 'unknown'} ${violation.id}`),
      describe(violations, `the coach panel in ${theme}`),
    ).toEqual([]);
  });
}

test('says so instead of reflowing below 1024px', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'This window is too narrow.' })).toBeVisible();
  // The app is not merely covered up: the list it would have shown is gone from
  // the page, so nothing is reachable by keyboard behind the notice.
  await expect(page.getByRole('heading', { name: 'Problems' })).toBeHidden();
  // And the page does not scroll sideways at the width it does support.
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.getByRole('heading', { name: 'Problems' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

/** Every finding, worst first, so a failure says what to go and look at. */
function describe(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
  where: string,
): string {
  if (violations.length === 0) return `${where}: nothing found.`;
  const order = ['critical', 'serious', 'moderate', 'minor'];
  const lines = [...violations]
    .sort((a, b) => order.indexOf(a.impact ?? 'minor') - order.indexOf(b.impact ?? 'minor'))
    .map(
      (violation) =>
        `  [${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help}\n` +
        violation.nodes
          .slice(0, 3)
          .map((node) => `      ${node.target.join(' ')}${detail(node)}`)
          .join('\n'),
    );
  return `${where} — axe findings (the gate is serious and critical only):\n${lines.join('\n')}`;
}

/**
 * The numbers behind a contrast finding.
 *
 * Without them a colour-contrast failure is a CSS selector and a guess: the
 * ratio and the two colours say immediately whether a token is genuinely too
 * close, or whether the element was measured against a background it does not
 * actually sit on.
 */
function detail(node: { any?: { id: string; data?: unknown }[] }): string {
  const check = node.any?.find((candidate) => candidate.id === 'color-contrast');
  const data = check?.data as
    { contrastRatio?: number; fgColor?: string; bgColor?: string; fontSize?: string } | undefined;
  if (data?.contrastRatio === undefined) return '';
  return ` - ${String(data.contrastRatio)}:1, ${String(data.fgColor)} on ${String(data.bgColor)}, ${String(data.fontSize)}`;
}

/**
 * The interview while it is running (ROADMAP P9-1).
 *
 * The page in `PAGES` is the one with no sitting behind it - a heading, a
 * paragraph and a button. The screen that matters is the other one: a clock
 * that updates itself, a list of problems, a stage instruction and a transcript
 * with a text box under it, none of which exist until an interview is started.
 *
 * One theme, like `after a run` above and for the same reason: what this adds
 * is markup, and the colours in it are audited on every other screen.
 */
test.describe('an interview in progress', () => {
  test('has no serious violations while the clock is running', async ({ page, request }) => {
    const started = await request.post('/api/interview', { headers: CLIENT_HEADERS });
    test.skip(
      !started.ok(),
      'needs two unsolved problems, and this database has fewer than two left',
    );
    const { id } = (await started.json()) as { id: string };

    try {
      await applyTheme(page, 'light', '/interview');
      await expect(page.getByRole('timer')).toBeVisible();

      const { violations } = await audit(page).analyze();
      const serious = violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(
        serious.map((violation) => `${violation.impact ?? 'unknown'} ${violation.id}`),
        describe(violations, 'the interview screen mid-sitting'),
      ).toEqual([]);
    } finally {
      // Ended whatever happened above: the audit of the idle `/interview` page
      // runs in this same worker and expects the screen with the button on it.
      await request.post(`/api/interview/${id}/finish`, { headers: CLIENT_HEADERS });
    }
  });
});

/**
 * The screens that only exist after something happened (ROADMAP P4-13).
 *
 * Everything above audits an idle screen. The surfaces most likely to be wrong
 * are the ones drawn in response to a run: a verdict banner, a test list beside
 * a two-column diff, a compile-error list with line numbers - and a modal,
 * which is the one thing on the page that takes the keyboard away from
 * everything behind it.
 *
 * One theme each rather than both: what these add is *new markup*, and markup
 * does not change with the palette. The colours of everything they contain are
 * already covered by the idle passes above.
 */
test.describe('after a run', () => {
  // These three actually run code, through a real interpreter, while the rest
  // of the suite is doing the same on other workers. The default 30s is a
  // budget for an idle page, not for a judge queue.
  test.setTimeout(180_000);

  /*
   * A problem each, and no leftovers.
   *
   * Drafts are per problem and outlive a run, so two tests that paste into the
   * same editor - or one that ran an hour ago - decide what the next one
   * compiles. The Wrong Answer case was reported as a Compile Error exactly
   * once for that reason, which is the sort of failure that wastes an evening.
   */
  const WRONG = { slug: 'first-not-below', title: 'First Reading Not Below' };
  const BROKEN = { slug: 'rotated-lookup', title: 'Lookup In A Rotated Series' };

  /**
   * Opens a problem on Python, with no draft behind it.
   *
   * The language is a *setting*, shared by every test and every earlier run, so
   * "open a problem and paste Python" compiled as Java the moment another spec
   * had chosen Java - and the wrong-answer case came back as a compile error
   * full of `class, interface, enum, or record expected`.
   */
  async function openOnPython(page: Page, problem: { slug: string; title: string }): Promise<void> {
    await clearDrafts(page, problem.slug);
    await applyTheme(page, 'light', `/problems/${problem.slug}`);
    await expect(page.getByRole('heading', { name: problem.title })).toBeVisible();
    await page.getByRole('button', { name: 'Python', exact: true }).click();
  }

  /** Removes both drafts, so the editor opens on the starter. */
  async function clearDrafts(page: Page, slug: string): Promise<void> {
    for (const language of ['python', 'java'] as const) {
      const response = await page.request.delete(`/api/drafts/${slug}/${language}`, {
        headers: { 'X-DevProMax-Client': 'devpromax-web' },
      });
      expect(response.ok()).toBe(true);
    }
  }

  /** Replaces the editor's contents, as `m0.spec.ts` does. */
  async function setEditorContents(page: Page, code: string): Promise<void> {
    await expect(page.locator('[data-testid="editor"] .monaco-editor')).toBeVisible();
    await page.locator('[data-testid="editor"] .view-lines').click();
    await page.evaluate((text) => navigator.clipboard.writeText(text), code);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+v');
  }

  async function auditNow(page: Page, what: string): Promise<void> {
    const { violations } = await audit(page).analyze();
    const serious = violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(
      serious.map((violation) => `${violation.impact ?? 'unknown'} ${violation.id}`),
      describe(violations, what),
    ).toEqual([]);
  }

  test('the results panel, with a failing test and its diff', async ({ page }) => {
    await openOnPython(page, WRONG);

    // Deliberately wrong, so the diff, the "first difference" line and the
    // failing-test markers are all on screen.
    await setEditorContents(
      page,
      [
        'from typing import List',
        '',
        '',
        'class Solution:',
        '    def firstNotBelow(self, values: List[int], threshold: int) -> int:',
        '        return -1',
        '',
      ].join('\n'),
    );

    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Wrong Answer', { timeout: 120_000 });

    await auditNow(page, 'the results panel after a failing run');
    await clearDrafts(page, WRONG.slug);
  });

  test('the compile-error list', async ({ page }) => {
    await openOnPython(page, BROKEN);

    await setEditorContents(page, 'class Solution:\n    def findRotated(self values, target)\n');

    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByTestId('verdict')).toHaveText('Compile Error', { timeout: 120_000 });

    await auditNow(page, 'the compile-error list');
  });

  test('the reset confirmation, which owns the keyboard while it is open', async ({ page }) => {
    await openOnPython(page, WRONG);

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    await auditNow(page, 'the reset confirmation');

    // Left closed, because the next test in this worker inherits the page's
    // server-side state but not its DOM - and a dialog left open is a trap for
    // whoever debugs this file next.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeHidden();
  });
});
