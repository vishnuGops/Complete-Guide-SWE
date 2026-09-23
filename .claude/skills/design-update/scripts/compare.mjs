#!/usr/bin/env node
/**
 * Compare two capture runs: before and after a redesign proposal (or a fix).
 *
 *   node .claude/skills/design-update/scripts/compare.mjs --before <run>/baseline --after <run>/r1/capture --out <run>/r1/compare
 *
 * Writes three things, each for a different reader:
 *
 *   pairs/<width>-<theme>-<shot>.png   before | after, one image per state,
 *                                      for the reviewer to see the whole change
 *                                      at once (open the originals for detail)
 *   compare.html                       for the owner: every state, both themes,
 *                                      with a flip toggle - flipping in place
 *                                      shows a change that side-by-side hides
 *   summary.md                         what the measurements say changed: off-
 *                                      token values and axe findings, per shot
 *
 * compare.html links the run folders by relative path; keep it where it is.
 */

/* global document */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');

function arg(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}
const beforeDir = arg('--before');
const afterDir = arg('--after');
const outArg = arg('--out');
if (!beforeDir || !afterDir || !outArg) {
  console.error('usage: compare.mjs --before <run> --after <run> --out <dir> [--title "..."]');
  process.exit(2);
}
const BEFORE = path.resolve(REPO_ROOT, beforeDir);
const AFTER = path.resolve(REPO_ROOT, afterDir);
const OUT = path.resolve(REPO_ROOT, outArg);
const TITLE = arg('--title') ?? `${path.basename(path.dirname(AFTER))} / ${path.basename(AFTER)}`;

const load = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
const before = load(BEFORE);
const after = load(AFTER);
const key = (e) => `${String(e.width)}|${e.theme}|${e.shot}`;
const beforeBy = new Map(before.results.map((e) => [key(e), e]));

const pairs = after.results
  .filter((e) => !e.error && beforeBy.has(key(e)) && !beforeBy.get(key(e)).error)
  .map((e) => ({ key: key(e), before: beforeBy.get(key(e)), after: e }));
const unmatched = after.results.filter((e) => !beforeBy.has(key(e))).map(key);

fs.mkdirSync(path.join(OUT, 'pairs'), { recursive: true });

// ---------------------------------------------------------------------------
// Composites, rendered by the browser so there is no image library to add.

const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 600 } });
  for (const p of pairs) {
    const name = `${String(p.after.width)}-${p.after.theme}-${p.after.shot}.png`;
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#777;font:600 14px system-ui">
      <div style="display:flex;gap:8px;padding:8px">
        ${[
          ['Before', path.join(BEFORE, p.before.file)],
          ['After', path.join(AFTER, p.after.file)],
        ]
          .map(
            ([label, file]) =>
              `<figure style="margin:0;flex:1"><figcaption style="color:#fff;padding:0 0 6px">${label} - ${p.after.shot}, ${p.after.theme}, ${String(p.after.width)}px</figcaption><img style="width:100%;display:block" src="${dataUrl(file)}"></figure>`,
          )
          .join('')}
      </div></body></html>`);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    await page.screenshot({ path: path.join(OUT, 'pairs', name), fullPage: true });
    p.composite = `pairs/${name}`;
  }
} finally {
  await browser.close();
}

// ---------------------------------------------------------------------------
// Measurement deltas.

const kinds = [
  ['untokened-color', 'Untokened colour'],
  ['ramp-color', 'Ramp leak'],
  ['off-scale-font-size', 'Off-scale size'],
  ['off-scale-font-weight', 'Off-scale weight'],
  ['off-scale-radius', 'Off-scale radius'],
  ['off-grid-spacing', 'Off-grid spacing'],
  ['shadow', 'Shadow'],
  ['off-scale-duration', 'Motion'],
  ['transition-all', 'transition: all'],
];
const count = (e, kind) => (e.findings ?? []).filter((f) => f.kind === kind).length;
const md = [
  `# Compare - ${TITLE}`,
  '',
  `Before: \`${path.relative(REPO_ROOT, BEFORE)}\``,
  `After: \`${path.relative(REPO_ROOT, AFTER)}\``,
];
if (after.injectedTokens) md.push(`Injected tokens: \`${after.injectedTokens}\``);
md.push('', '| Shot | Width | Theme | ' + kinds.map(([, l]) => l).join(' | ') + ' | axe | Pair |');
md.push(
  '| ' +
    Array(kinds.length + 5)
      .fill('---')
      .join(' | ') +
    ' |',
);
for (const p of pairs) {
  const cells = kinds.map(([k]) => {
    const [b, a] = [count(p.before, k), count(p.after, k)];
    return b === a ? String(a) : `${String(b)} -> **${String(a)}**`;
  });
  const [ab, aa] = [p.before.axe?.length ?? 0, p.after.axe?.length ?? 0];
  md.push(
    `| ${p.after.shot} | ${String(p.after.width)} | ${p.after.theme} | ${cells.join(' | ')} | ${ab === aa ? String(aa) : `${String(ab)} -> **${String(aa)}**`} | [pair](${p.composite}) |`,
  );
}

// New problems are what matter: values and axe rules present after but not before.
// Only states captured in both runs: a shot the after run skipped has not been fixed.
const matched = new Set(pairs.map((p) => p.key));
const values = (run) => {
  const set = new Map();
  for (const e of run.results.filter((r) => matched.has(key(r)))) {
    for (const f of e.findings ?? [])
      set.set(`${f.kind}|${f.value}`, { ...f, shot: `${e.shot}/${e.theme}` });
  }
  return set;
};
const [vb, va] = [values(before), values(after)];
const introduced = [...va.entries()].filter(([k]) => !vb.has(k)).map(([, f]) => f);
const resolved = [...vb.entries()].filter(([k]) => !va.has(k)).map(([, f]) => f);
const axeIds = (run) =>
  new Set(
    run.results.filter((r) => matched.has(key(r))).flatMap((e) => (e.axe ?? []).map((v) => v.id)),
  );
const axeNew = [...axeIds(after)].filter((id) => !axeIds(before).has(id));

md.push('', `## Introduced (${String(introduced.length)})`, '');
for (const f of introduced)
  md.push(`- ${f.kind} \`${f.value}\` on ${f.shot} - \`${f.where[0] ?? ''}\``);
if (axeNew.length) md.push('', `**New axe rules failing:** ${axeNew.join(', ')}`);
md.push('', `## Resolved (${String(resolved.length)})`, '');
for (const f of resolved) md.push(`- ${f.kind} \`${f.value}\``);
if (unmatched.length)
  md.push(
    '',
    `Shots with no before to compare (INCONCLUSIVE, not passing): ${unmatched.join(', ')}`,
  );
fs.writeFileSync(path.join(OUT, 'summary.md'), `${md.join('\n')}\n`);

// ---------------------------------------------------------------------------
// The owner's page.

const rel = (file) => path.relative(OUT, file).replaceAll('\\', '/');
const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const groups = new Map();
for (const p of pairs) {
  const g = `${p.after.shot}|${String(p.after.width)}`;
  groups.set(g, [...(groups.get(g) ?? []), p]);
}
const briefFile = [
  path.join(path.dirname(AFTER), 'brief.md'),
  path.join(path.dirname(path.dirname(AFTER)), 'brief.md'),
].find((f) => fs.existsSync(f));
const rationaleFile = path.join(path.dirname(AFTER), 'rationale.md');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design compare</title>
<style>
  :root { --bg:#f4f4f5; --fg:#18181b; --muted:#52525b; --line:#d4d4d8; --panel:#fff; --accent:#4f46e5; color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#111113; --fg:#ececef; --muted:#a1a1aa; --line:#2e2e33; --panel:#18181b; --accent:#8b8cf8; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg:#111113; --fg:#ececef; --muted:#a1a1aa; --line:#2e2e33; --panel:#18181b; --accent:#8b8cf8; color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.5 system-ui, sans-serif; }
  header { position:sticky; top:0; z-index:1; background:var(--panel); border-bottom:1px solid var(--line); padding:12px 16px; display:flex; flex-wrap:wrap; gap:12px; align-items:center; }
  h1 { font-size:16px; margin:0 12px 0 0; font-weight:600; }
  button, select { font:inherit; color:inherit; background:var(--panel); border:1px solid var(--line); border-radius:5px; padding:4px 10px; cursor:pointer; }
  button[aria-pressed="true"] { border-color:var(--accent); color:var(--accent); }
  button:focus-visible, select:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  main { padding:16px; max-width:2400px; margin:0 auto; }
  section { margin:0 0 32px; }
  h2 { font-size:14px; font-weight:600; margin:0 0 8px; }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .flip .row { grid-template-columns:1fr; }
  figure { margin:0; background:var(--panel); border:1px solid var(--line); border-radius:5px; overflow:hidden; }
  figcaption { font-size:12px; color:var(--muted); padding:4px 8px; border-bottom:1px solid var(--line); }
  img { display:block; width:100%; height:auto; }
  .flip figure.before { display:none; }
  .flip.showing-before figure.before { display:block; }
  .flip.showing-before figure.after { display:none; }
  .hint { color:var(--muted); font-size:12px; }
  details { background:var(--panel); border:1px solid var(--line); border-radius:5px; padding:8px 12px; margin:0 0 16px; }
  pre { white-space:pre-wrap; font:12px/1.5 ui-monospace, monospace; margin:8px 0 0; }
  @media (max-width: 800px) { .row { grid-template-columns:1fr; } }
</style>
</head>
<body>
<header>
  <h1>${esc(TITLE)}</h1>
  <label>Theme <select id="theme"><option value="all">Both</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
  <label>Width <select id="width">${[...new Set(pairs.map((p) => p.after.width))].map((w) => `<option>${String(w)}</option>`).join('')}</select></label>
  <button id="mode" aria-pressed="false">Flip mode</button>
  <span class="hint">In flip mode, press F (or click an image) to switch before/after in place.</span>
</header>
<main>
  ${briefFile ? `<details><summary>Brief</summary><pre>${esc(fs.readFileSync(briefFile, 'utf8'))}</pre></details>` : ''}
  ${fs.existsSync(rationaleFile) ? `<details open><summary>Rationale</summary><pre>${esc(fs.readFileSync(rationaleFile, 'utf8'))}</pre></details>` : ''}
  <details><summary>Measurement summary</summary><pre>${esc(md.join('\n'))}</pre></details>
  ${[...groups.values()]
    .flat()
    .map(
      (p) => `<section data-theme-of="${p.after.theme}" data-width="${String(p.after.width)}">
    <h2>${esc(p.after.shot)} - ${p.after.theme}</h2>
    <div class="row">
      <figure class="before"><figcaption>Before</figcaption><img loading="lazy" alt="${esc(p.after.shot)} before, ${p.after.theme}" src="${rel(path.join(BEFORE, p.before.file))}"></figure>
      <figure class="after"><figcaption>After</figcaption><img loading="lazy" alt="${esc(p.after.shot)} after, ${p.after.theme}" src="${rel(path.join(AFTER, p.after.file))}"></figure>
    </div>
  </section>`,
    )
    .join('\n  ')}
</main>
<script>
  const main = document.querySelector('main');
  const theme = document.getElementById('theme');
  const width = document.getElementById('width');
  const mode = document.getElementById('mode');
  function filter() {
    for (const s of document.querySelectorAll('section')) {
      s.hidden = (theme.value !== 'all' && s.dataset.themeOf !== theme.value) || s.dataset.width !== width.value;
    }
  }
  theme.addEventListener('change', filter);
  width.addEventListener('change', filter);
  mode.addEventListener('click', () => {
    const on = main.classList.toggle('flip');
    mode.setAttribute('aria-pressed', String(on));
  });
  const flip = () => main.classList.contains('flip') && main.classList.toggle('showing-before');
  main.addEventListener('click', (e) => { if (e.target.tagName === 'IMG') flip(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') flip(); });
  filter();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'compare.html'), html);

console.log(
  `${String(pairs.length)} pairs, ${String(introduced.length)} values introduced, ${String(resolved.length)} resolved, ${String(axeNew.length)} new axe rules.`,
);
console.log(
  `Open ${path.relative(REPO_ROOT, path.join(OUT, 'compare.html'))} in a browser; summary in summary.md.`,
);
