import { describe, expect, it } from 'vitest';
import type { DashboardResponse } from '@devpromax/shared';
import { buildReport, reportHtml, reportMarkdown } from './reportService.js';

/**
 * The exported skills report (ROADMAP P7-5).
 *
 * This is the one thing in the app that is meant to leave the machine, so the
 * assertions below are mostly about what it must *not* contain and must not
 * fetch, rather than about how it is laid out.
 */

function aDashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    total: 10,
    byStatus: { not_started: 5, in_progress: 2, solved: 2, mastered: 1 },
    byTopic: [{ topic: 'arrays', total: 4, solved: 2, mastered: 1, inProgress: 0 }],
    byTier: [{ tier: 'Easy', total: 4, solved: 2, mastered: 1, inProgress: 0 }],
    streak: { current: 3, longest: 9, days: [{ day: '2026-09-18', count: 4 }] },
    recent: [],
    skills: [
      {
        topic: 'graph',
        samples: 2,
        scores: {
          correctness: 1.5,
          timeComplexity: 2,
          spaceComplexity: 2,
          edgeCases: 1,
          readability: 3,
        },
        average: 1.9,
      },
    ],
    editorialsRevealed: 0,
    reviews: { due: [], upcoming: [] },
    generatedAt: '2026-09-18T09:30:00.000Z',
    ...overrides,
  };
}

describe('reportMarkdown', () => {
  it('leads with what was solved out of what', () => {
    const md = reportMarkdown(aDashboard());
    expect(md).toContain('# DSA practice report');
    // Solved counts Mastered too: mastering something does not un-solve it.
    expect(md).toContain('Solved: **3 of 10** (30%)');
    expect(md).toContain('Mastered: **1**');
    expect(md).toContain('Current streak: 3 day(s); longest 9');
  });

  it('names the weakest topic with how many reviews are behind it', () => {
    const md = reportMarkdown(aDashboard());
    expect(md).toContain('| Graph | 2 |');
    // An average of one review is an anecdote, so the count is not optional.
    expect(md).toContain('Reviews');
  });

  it('says when an editorial was opened rather than earned', () => {
    expect(reportMarkdown(aDashboard({ editorialsRevealed: 3 }))).toContain(
      'Editorials opened before solving: 3',
    );
    expect(reportMarkdown(aDashboard())).not.toContain('Editorials opened');
  });

  it('leaves out the rubric section when nothing has been scored', () => {
    expect(reportMarkdown(aDashboard({ skills: [] }))).not.toContain('Rubric scores');
  });
});

describe('reportHtml', () => {
  const html = reportHtml(aDashboard());

  it('is one self-contained file that fetches nothing', () => {
    // It is going to be opened somewhere else. Anything it requested would
    // either fail or tell a third party that it had been opened.
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('<style>');
  });

  it('is a real document, with a title and a language', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>DSA practice report</title>');
    expect(html).toContain('<meta charset="utf-8">');
  });

  it('escapes what it puts into the page', () => {
    // Nothing user-written goes in today, but a topic label is still text
    // being interpolated into markup, and the next field added here will be.
    const injected = reportHtml(
      aDashboard({ generatedAt: '<script>alert(1)</script>2026-09-18T00:00:00.000Z' }),
    );
    expect(injected).not.toContain('<script>alert(1)</script>');
    expect(injected).toContain('&lt;script&gt;');
  });

  it('says so plainly when there is nothing to score', () => {
    expect(reportHtml(aDashboard({ skills: [] }))).toContain('No coach reviews yet');
  });

  it('carries no code, notes or anything else the user typed', () => {
    // The dashboard payload has no such field, and this is the test that fails
    // if one is ever added to it without thinking about this file.
    expect(html).not.toContain('class Solution');
    expect(Object.keys(aDashboard())).not.toContain('notes');
  });
});

describe('buildReport', () => {
  it('names the file after the day it was produced', () => {
    for (const [format, extension] of [
      ['json', 'json'],
      ['markdown', 'md'],
      ['html', 'html'],
    ] as const) {
      const report = buildReport(aDashboard(), format);
      expect(report.filename).toBe(`devpromax-report-2026-09-18.${extension}`);
    }
  });

  it('gives each format its own content type', () => {
    expect(buildReport(aDashboard(), 'json').contentType).toContain('application/json');
    expect(buildReport(aDashboard(), 'markdown').contentType).toContain('text/markdown');
    expect(buildReport(aDashboard(), 'html').contentType).toContain('text/html');
  });

  it('round-trips the JSON form', () => {
    const report = buildReport(aDashboard(), 'json');
    expect(JSON.parse(report.body)).toEqual(aDashboard());
  });
});
