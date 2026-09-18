import {
  RUBRIC_DIMENSIONS,
  RUBRIC_LABEL,
  TIERS,
  TOPIC_LABEL,
  type DashboardResponse,
  type ReportFormat,
} from '@devpromax/shared';

/**
 * The shareable skills report (ROADMAP P7-5).
 *
 * Three formats of one thing: JSON for whatever someone wants to do with it,
 * markdown for pasting into a message, and a single HTML file for sending to
 * someone who will open it in a browser. The HTML has no script, no stylesheet
 * link and no image - it is a file that is going to leave this machine and be
 * opened somewhere else, and anything it tried to fetch would either fail or
 * tell a third party that it had been opened.
 *
 * What it does not contain: code, notes, or anything else the user wrote. A
 * skills report is what someone can do, not what they typed.
 */

function pad(value: number): string {
  return value.toFixed(1);
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function reportDate(iso: string): string {
  return iso.slice(0, 10);
}

export function reportMarkdown(data: DashboardResponse): string {
  const solved = data.byStatus.solved + data.byStatus.mastered;
  const lines: string[] = [
    '# DSA practice report',
    '',
    `Generated ${reportDate(data.generatedAt)} from DevProMax.`,
    '',
    '## Overall',
    '',
    `- Solved: **${String(solved)} of ${String(data.total)}** (${String(percent(solved, data.total))}%)`,
    `- Mastered: **${String(data.byStatus.mastered)}**`,
    `- In progress: ${String(data.byStatus.in_progress)}`,
    `- Current streak: ${String(data.streak.current)} day(s); longest ${String(data.streak.longest)}`,
  ];

  if (data.editorialsRevealed > 0) {
    // Stated rather than left out: a report that counts an opened editorial the
    // same as a solve is worth nothing to whoever reads it.
    lines.push(`- Editorials opened before solving: ${String(data.editorialsRevealed)}`);
  }

  lines.push(
    '',
    '## By tier',
    '',
    '| Tier | Solved | Mastered | Total |',
    '| --- | --- | --- | --- |',
  );
  for (const tier of TIERS) {
    const row = data.byTier.find((entry) => entry.tier === tier);
    if (!row) continue;
    lines.push(
      `| ${tier} | ${String(row.solved + row.mastered)} | ${String(row.mastered)} | ${String(row.total)} |`,
    );
  }

  lines.push('', '## By topic', '', '| Topic | Solved | Total |', '| --- | --- | --- |');
  for (const row of data.byTopic) {
    lines.push(
      `| ${TOPIC_LABEL[row.topic]} | ${String(row.solved + row.mastered)} | ${String(row.total)} |`,
    );
  }

  if (data.skills.length > 0) {
    lines.push(
      '',
      '## Rubric scores by topic',
      '',
      'Averaged over every coach review, out of 4. Weakest first.',
      '',
      `| Topic | Reviews | ${RUBRIC_DIMENSIONS.map((d) => RUBRIC_LABEL[d]).join(' | ')} | Average |`,
      `| --- | --- | ${RUBRIC_DIMENSIONS.map(() => '---').join(' | ')} | --- |`,
    );
    for (const skill of data.skills) {
      const cells = RUBRIC_DIMENSIONS.map((d) => pad(skill.scores[d] ?? 0)).join(' | ');
      lines.push(
        `| ${TOPIC_LABEL[skill.topic]} | ${String(skill.samples)} | ${cells} | ${pad(skill.average)} |`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

/** Escapes text for HTML. The report is a file that someone else opens. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const REPORT_STYLE = `
  :root { color-scheme: light dark; --line: color-mix(in oklch, currentColor 20%, transparent); }
  body { margin: 0 auto; max-width: 48rem; padding: 2rem 1rem;
         font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1rem; margin: 2rem 0 0.5rem; }
  .muted { opacity: 0.7; }
  ul { padding-left: 1.1rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
  caption { text-align: left; padding-bottom: 0.4rem; opacity: 0.7; font-size: 0.85rem; }
  th, td { border-bottom: 1px solid var(--line); padding: 0.3rem 0.5rem; text-align: right; }
  th[scope="row"], thead th:first-child { text-align: left; }
  td.bar { width: 8rem; }
  td.bar span { display: block; height: 0.4rem; background: currentColor; opacity: 0.45; }
`;

export function reportHtml(data: DashboardResponse): string {
  const solved = data.byStatus.solved + data.byStatus.mastered;

  const tiers = TIERS.map((tier) => data.byTier.find((entry) => entry.tier === tier))
    .filter((row) => row !== undefined)
    .map(
      (row) =>
        `<tr><th scope="row">${escapeHtml(row.tier)}</th><td>${String(row.solved + row.mastered)}</td><td>${String(row.mastered)}</td><td>${String(row.total)}</td></tr>`,
    )
    .join('\n');

  const topics = data.byTopic
    .map((row) => {
      const done = row.solved + row.mastered;
      return `<tr><th scope="row">${escapeHtml(TOPIC_LABEL[row.topic])}</th><td>${String(done)}</td><td>${String(row.total)}</td><td class="bar"><span style="width:${String(percent(done, row.total))}%"></span></td></tr>`;
    })
    .join('\n');

  const skillRows = data.skills
    .map((skill) => {
      const cells = RUBRIC_DIMENSIONS.map((d) => `<td>${pad(skill.scores[d] ?? 0)}</td>`).join('');
      return `<tr><th scope="row">${escapeHtml(TOPIC_LABEL[skill.topic])}</th><td>${String(skill.samples)}</td>${cells}<td>${pad(skill.average)}</td></tr>`;
    })
    .join('\n');

  const skillHeads = RUBRIC_DIMENSIONS.map(
    (d) => `<th scope="col">${escapeHtml(RUBRIC_LABEL[d])}</th>`,
  ).join('');

  const skills =
    data.skills.length === 0
      ? '<p class="muted">No coach reviews yet, so there is nothing to score.</p>'
      : [
          '<table>',
          '  <caption>Averaged over every coach review, out of 4. Weakest first.</caption>',
          `  <thead><tr><th scope="col">Topic</th><th scope="col">Reviews</th>${skillHeads}<th scope="col">Average</th></tr></thead>`,
          '  <tbody>',
          skillRows,
          '  </tbody>',
          '</table>',
        ].join('\n');

  const revealed =
    data.editorialsRevealed > 0
      ? `  <li>Editorials opened before solving: ${String(data.editorialsRevealed)}</li>\n`
      : '';

  // One file, no requests. `color-scheme` rather than a media query, so the page
  // follows whatever the reader's browser is set to without carrying two
  // palettes for a document that is four tables long.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DSA practice report</title>
<style>${REPORT_STYLE}</style>
</head>
<body>
<h1>DSA practice report</h1>
<p class="muted">Generated ${escapeHtml(reportDate(data.generatedAt))} from DevProMax.</p>

<h2>Overall</h2>
<ul>
  <li>Solved: <strong>${String(solved)} of ${String(data.total)}</strong> (${String(percent(solved, data.total))}%)</li>
  <li>Mastered: <strong>${String(data.byStatus.mastered)}</strong></li>
  <li>In progress: ${String(data.byStatus.in_progress)}</li>
  <li>Current streak: ${String(data.streak.current)} day(s); longest ${String(data.streak.longest)}</li>
${revealed}</ul>

<h2>By tier</h2>
<table>
  <thead><tr><th scope="col">Tier</th><th scope="col">Solved</th><th scope="col">Mastered</th><th scope="col">Total</th></tr></thead>
  <tbody>
${tiers}
  </tbody>
</table>

<h2>By topic</h2>
<table>
  <thead><tr><th scope="col">Topic</th><th scope="col">Solved</th><th scope="col">Total</th><th scope="col"><span class="muted">Progress</span></th></tr></thead>
  <tbody>
${topics}
  </tbody>
</table>

<h2>Rubric scores by topic</h2>
${skills}
</body>
</html>
`;
}

export function buildReport(
  data: DashboardResponse,
  format: ReportFormat,
): { body: string; contentType: string; filename: string } {
  const date = reportDate(data.generatedAt);
  if (format === 'json') {
    return {
      body: `${JSON.stringify(data, null, 2)}\n`,
      contentType: 'application/json; charset=utf-8',
      filename: `devpromax-report-${date}.json`,
    };
  }
  if (format === 'html') {
    return {
      body: reportHtml(data),
      contentType: 'text/html; charset=utf-8',
      filename: `devpromax-report-${date}.html`,
    };
  }
  return {
    body: reportMarkdown(data),
    contentType: 'text/markdown; charset=utf-8',
    filename: `devpromax-report-${date}.md`,
  };
}
