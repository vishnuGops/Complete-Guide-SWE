import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

/**
 * What every spec in here needs (ROADMAP P8-1).
 *
 * These four had been copied into four files by the time this block started,
 * and the copies had begun to differ - which for `setEditorContents` in
 * particular is how a spec silently stops testing what it says it does.
 */

export const REPO_ROOT = path.resolve(process.cwd(), '..', '..');

/** The client header every `/api` request needs (D15); a link cannot send one. */
export const CLIENT_HEADERS = { 'X-DevProMax-Client': 'devpromax-web' } as const;

/** A problem's checked-in file, e.g. its reference solution. */
export function problemFile(topic: string, slug: string, file: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, 'problems', topic, slug, file), 'utf8');
}

/**
 * Replaces the editor's contents, the way a person would: select all, paste.
 *
 * Two details are load-bearing. The click has to land on the editor's own text
 * surface - Monaco 0.56 takes input through an `EditContext` element, so
 * focusing the hidden textarea older guides target does nothing at all. And the
 * text arrives through the clipboard rather than as keystrokes, because typing
 * a Python reference line by line tests Monaco's auto-indent rather than
 * DevProMax.
 */
export async function setEditorContents(page: Page, code: string): Promise<void> {
  await expect(page.locator('[data-testid="editor"] .monaco-editor')).toBeVisible();
  await page.locator('[data-testid="editor"] .view-lines').click();
  await page.evaluate((text) => navigator.clipboard.writeText(text), code);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+v');
}

const LANGUAGE_LABEL = { python: 'Python', java: 'Java' } as const;

/**
 * Puts the workspace on `language` as this page's own choice (ROADMAP P8-7).
 *
 * The workspace shows the language the page chose, or else `lastLanguage` -
 * a *server* setting that every worker writes. Clicking the button that is
 * already pressed does nothing, so "click Python" on a page that opened on
 * Python left it following the setting, and a settings fetch landing a moment
 * later with another worker's Java switched the editor under the paste. The
 * other language first makes the second click a real choice, which nothing
 * another worker does can take back.
 */
export async function chooseLanguage(page: Page, language: 'python' | 'java'): Promise<void> {
  const other = language === 'python' ? 'java' : 'python';
  await page.getByRole('button', { name: LANGUAGE_LABEL[other], exact: true }).click();
  const wanted = page.getByRole('button', { name: LANGUAGE_LABEL[language], exact: true });
  await wanted.click();
  await expect(wanted).toHaveAttribute('aria-pressed', 'true');
}

/** Removes both drafts, so the editor opens on the starter. */
export async function clearDrafts(page: Page, slug: string): Promise<void> {
  for (const language of ['python', 'java'] as const) {
    const response = await page.request.delete(`/api/drafts/${slug}/${language}`, {
      headers: CLIENT_HEADERS,
    });
    expect(response.ok()).toBe(true);
  }
}

/**
 * Opens a problem on Python, with no draft behind it.
 *
 * The language is a *setting*, shared by every test and every earlier run, so
 * "open a problem and paste Python" compiled as Java the moment another spec
 * had chosen Java - and a wrong answer came back as a compile error full of
 * `class, interface, enum, or record expected`. Choosing the language here is
 * what stops that, and it is why every spec that pastes code uses this - or
 * `chooseLanguage`, which is how this chooses.
 */
export async function openOnPython(
  page: Page,
  problem: { slug: string; title: string },
): Promise<void> {
  await clearDrafts(page, problem.slug);
  await page.goto(`/problems/${problem.slug}`);
  await expect(page.getByRole('heading', { name: problem.title })).toBeVisible();
  await chooseLanguage(page, 'python');
}
