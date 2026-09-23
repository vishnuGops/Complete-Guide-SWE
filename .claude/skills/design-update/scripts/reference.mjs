#!/usr/bin/env node
/**
 * Measure a design reference - a live site or a screenshot - into numbers the
 * redesign mode can build tokens from.
 *
 * The lesson borrowed from ECC's taste-distillation skill: describing a look in
 * words does not reproduce it, measuring it does. "Sleek, dark, lots of space"
 * becomes a background that is oklch(0.16 0.01 270) on 61% of the page, body
 * text at 14px, radii that cluster at 6px and 12px, and one saturated hue.
 *
 *   node .claude/skills/design-update/scripts/reference.mjs --out data/design-audit/<run>/reference https://example.com
 *   node .claude/skills/design-update/scripts/reference.mjs --out <dir> path/to/screenshot.png
 *   node .claude/skills/design-update/scripts/reference.mjs --out <dir> https://a.dev https://b.dev ./c.png
 *
 * For a URL: a 1440x900 screenshot in light and dark (`prefers-color-scheme`),
 * and the computed styles of every visible element, weighted by the area or
 * text they cover. For an image: its palette, clustered in OKLab and weighted by
 * pixel share. Either way, statistics are medians and MADs, never means: design
 * values are skewed (one hero headline outweighs a hundred labels in a mean).
 *
 * Reads public pages only; it does not log in, submit forms or accept cookies.
 */

/* `measurePage` and `pixels` below run inside the page, where these exist. */
/* global document, getComputedStyle, Image, window */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
if (outAt === -1 || args.length < 3) {
  console.error('usage: reference.mjs --out <dir> <url | image> [...]');
  process.exit(2);
}
const OUT_DIR = path.resolve(REPO_ROOT, args[outAt + 1]);
const inputs = args.filter((_, i) => i !== outAt && i !== outAt + 1);

// ---------------------------------------------------------------------------
// Colour maths: sRGB <-> OKLab/OKLCH (Ottosson), shared by both kinds of input.

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function rgbToOklab([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToOklch([L, a, b]) {
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: C, h: C < 0.01 ? 0 : h };
}

const fmtOklch = ({ l, c, h }) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${Math.round(h)})`;

function relLuminance([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((v) => toLinear(v / 255));
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function median(values) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
const mad = (values) => {
  const m = median(values);
  return m === undefined ? undefined : median(values.map((v) => Math.abs(v - m)));
};

/** Weighted value histogram, largest weight first, as [value, share] pairs. */
function distribution(entries, top = 8) {
  const totals = new Map();
  let sum = 0;
  for (const [value, weight] of entries) {
    totals.set(value, (totals.get(value) ?? 0) + weight);
    sum += weight;
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([value, weight]) => [value, sum ? weight / sum : 0]);
}

// ---------------------------------------------------------------------------
// In-page measurement of a live site.

function measurePage() {
  // Resolve any CSS colour (lab(), color(), oklch() ...) to sRGB by painting it.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  /*
   * A colour as it lands on screen: painted over what is behind it, so a 5%
   * white border reads as the faint grey it is, not as white. Returns null for
   * fully transparent colours.
   */
  const rgbCache = new Map();
  const rgb = (css, under = null) => {
    const cacheKey = `${css}|${under ? under.join(',') : ''}`;
    if (rgbCache.has(cacheKey)) return rgbCache.get(cacheKey);
    ctx.clearRect(0, 0, 1, 1);
    if (under) {
      ctx.fillStyle = `rgb(${under.join(',')})`;
      ctx.fillRect(0, 0, 1, 1);
    }
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const value = a === 0 ? null : [r, g, b];
    rgbCache.set(cacheKey, value);
    return value;
  };
  const alphaOf = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data[3];
  };
  // The opaque colour behind an element: the nearest ancestor that paints one.
  const dark = getComputedStyle(document.documentElement).colorScheme.includes('dark');
  const behindCache = new WeakMap();
  const behind = (el) => {
    if (!el) return dark ? [0, 0, 0] : [255, 255, 255];
    if (behindCache.has(el)) return behindCache.get(el);
    const own = getComputedStyle(el).backgroundColor;
    const alpha = alphaOf(own);
    const parent = behind(el.parentElement);
    const value = alpha === 0 ? parent : rgb(own, parent);
    behindCache.set(el, value);
    return value;
  };

  const viewportArea = window.innerWidth * window.innerHeight;
  const out = {
    background: [],
    text: [],
    border: [],
    fontFamily: [],
    fontSize: [],
    fontWeight: [],
    lineHeight: [],
    letterSpacing: [],
    radius: [],
    shadow: [],
    padding: [],
    gap: [],
    duration: [],
    contentWidth: [],
    controlHeight: [],
  };

  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > window.innerHeight * 3) continue;
    // Area on screen, capped so one full-bleed wrapper does not drown the rest.
    const area = Math.min(r.width * r.height, viewportArea) / viewportArea;

    const under = behind(el.parentElement);
    const ownBg = alphaOf(cs.backgroundColor) > 0 ? rgb(cs.backgroundColor, under) : null;
    if (ownBg) out.background.push([ownBg, area]);
    const bg = behind(el);

    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ');
    if (text) {
      const chars = text.length;
      const fg = rgb(cs.color, bg);
      if (fg) out.text.push([fg, chars, bg]);
      out.fontFamily.push([cs.fontFamily.split(',')[0].replaceAll(/["']/g, '').trim(), chars]);
      out.fontSize.push([Number.parseFloat(cs.fontSize), chars]);
      out.fontWeight.push([Number(cs.fontWeight), chars]);
      const lh = Number.parseFloat(cs.lineHeight);
      if (lh) out.lineHeight.push([+(lh / Number.parseFloat(cs.fontSize)).toFixed(2), chars]);
      const ls = Number.parseFloat(cs.letterSpacing);
      out.letterSpacing.push([
        Number.isNaN(ls) ? 0 : +(ls / Number.parseFloat(cs.fontSize)).toFixed(3),
        chars,
      ]);
    }

    for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
      if (Number.parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none') {
        const c = rgb(cs[`border${side}Color`], bg);
        if (c) out.border.push([c, 1]);
      }
    }
    const radius = Number.parseFloat(cs.borderTopLeftRadius);
    if (radius > 0 && radius < Math.min(r.width, r.height) / 2) out.radius.push([radius, 1]);
    if (cs.boxShadow !== 'none') out.shadow.push([cs.boxShadow.slice(0, 140), 1]);
    for (const p of ['paddingTop', 'paddingLeft']) {
      const v = Number.parseFloat(cs[p]);
      if (v > 0) out.padding.push([v, 1]);
    }
    const gap = Number.parseFloat(cs.rowGap) || Number.parseFloat(cs.columnGap);
    if (gap > 0) out.gap.push([gap, 1]);
    for (const d of cs.transitionDuration.split(',')) {
      const ms = Number.parseFloat(d) * (d.includes('ms') ? 1 : 1000);
      if (ms > 0) out.duration.push([ms, 1]);
    }
    const tag = el.tagName.toLowerCase();
    if (['p', 'article', 'main'].includes(tag) && text.length > 80) {
      out.contentWidth.push([Math.round(r.width), 1]);
    }
    if (tag === 'button' || tag === 'input' || el.getAttribute('role') === 'button') {
      out.controlHeight.push([Math.round(r.height), 1]);
    }
  }
  return {
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    out,
  };
}

function summarisePage(measured) {
  const { out } = measured;
  const colour = (rgbValue) => fmtOklch(oklabToOklch(rgbToOklab(rgbValue)));
  const colourDist = (entries, top) =>
    distribution(
      entries.map(([c, w]) => [colour(c), w]),
      top,
    );
  // Contrast of body text against the background it sits on.
  const contrasts = out.text
    .filter(([, , bg]) => bg)
    .map(([fg, chars, bg]) => {
      const [hi, lo] = [relLuminance(fg), relLuminance(bg)].sort((a, b) => b - a);
      return [+((hi + 0.05) / (lo + 0.05)).toFixed(1), chars];
    });
  const numeric = (entries) => {
    const values = entries.flatMap(([v, w]) => Array(Math.max(1, Math.round(w))).fill(v));
    return { median: median(values), mad: mad(values), top: distribution(entries, 6) };
  };
  // Saturated colours are where a palette's identity lives; neutrals are the canvas.
  const accents = colourDist(
    [...out.background, ...out.text.map(([c, w]) => [c, w / 400]), ...out.border].filter(
      ([c]) => oklabToOklch(rgbToOklab(c)).c > 0.06,
    ),
    6,
  );
  return {
    colorScheme: measured.colorScheme,
    rootFontSize: measured.rootFontSize,
    backgrounds: colourDist(out.background, 6),
    text: colourDist(
      out.text.map(([c, w]) => [c, w]),
      6,
    ),
    borders: colourDist(out.border, 5),
    accents,
    textContrast: numeric(contrasts),
    fontFamily: distribution(out.fontFamily, 4),
    fontSize: numeric(out.fontSize),
    fontWeight: distribution(out.fontWeight, 5),
    lineHeight: numeric(out.lineHeight),
    letterSpacingEm: numeric(out.letterSpacing),
    radius: numeric(out.radius),
    shadows: { count: out.shadow.length, top: distribution(out.shadow, 3) },
    padding: numeric(out.padding),
    gap: numeric(out.gap),
    transitionMs: numeric(out.duration),
    contentWidth: numeric(out.contentWidth),
    controlHeight: numeric(out.controlHeight),
  };
}

// ---------------------------------------------------------------------------
// Image references: palette by k-means in OKLab, weighted by pixel share.

function kmeans(points, k, iterations = 12) {
  // Deterministic seeding: spread across lightness so dark and light both get a centre.
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  let centres = Array.from(
    { length: k },
    (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)],
  );
  let assignment = new Array(points.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    assignment = points.map((p) => {
      let best = 0;
      let bestD = Infinity;
      centres.forEach((c, i) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) [best, bestD] = [i, d];
      });
      return best;
    });
    centres = centres.map((c, i) => {
      const members = points.filter((_, j) => assignment[j] === i);
      if (!members.length) return c;
      return [0, 1, 2].map((d) => median(members.map((m) => m[d])));
    });
  }
  return centres
    .map((c, i) => ({ centre: c, share: assignment.filter((a) => a === i).length / points.length }))
    .filter((cluster) => cluster.share > 0.0005)
    .sort((a, b) => b.share - a.share);
}

async function measureImage(page, file) {
  const data = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  const samples = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, 360 / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const { data: px } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = [];
    for (let i = 0; i < px.length; i += 4)
      if (px[i + 3] > 200) out.push([px[i], px[i + 1], px[i + 2]]);
    return { width: img.width, height: img.height, pixels: out };
  }, data);
  const lab = samples.pixels.map(rgbToOklab);
  const clusters = kmeans(lab, 10).map(({ centre, share }) => ({
    oklch: fmtOklch(oklabToOklch(centre)),
    share: +share.toFixed(3),
  }));
  const L = lab.map((p) => p[0]);
  const C = lab.map((p) => Math.hypot(p[1], p[2]));
  /*
   * The accent usually covers under 1% of a UI screenshot - a button, a tab bar,
   * a status dot - so the all-pixel clusters absorb it into the neutrals. The
   * chromatic pixels are clustered on their own, with shares still of the whole.
   */
  const chromatic = lab.filter((p) => Math.hypot(p[1], p[2]) > 0.06);
  const saturated = chromatic.length
    ? kmeans(chromatic, Math.min(5, chromatic.length)).map(({ centre, share }) => ({
        oklch: fmtOklch(oklabToOklch(centre)),
        share: +((share * chromatic.length) / lab.length).toFixed(4),
      }))
    : [];
  return {
    size: `${String(samples.width)}x${String(samples.height)}`,
    palette: clusters,
    // The share of near-black and near-white pixels: whether the look is a dark
    // canvas, a light one, or neither. No average can see this.
    darkShare: +(L.filter((l) => l < 0.25).length / L.length).toFixed(3),
    lightShare: +(L.filter((l) => l > 0.93).length / L.length).toFixed(3),
    lightness: { median: +median(L).toFixed(3), mad: +mad(L).toFixed(3) },
    chroma: { median: +median(C).toFixed(3), mad: +mad(C).toFixed(3) },
    saturated,
  };
}

// ---------------------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [index, input] of inputs.entries()) {
    const isUrl = /^https?:\/\//.test(input);
    const name = isUrl
      ? new URL(input).hostname.replace(/^www\./, '').replaceAll('.', '-')
      : `${String(index + 1)}-${path.basename(input, path.extname(input))}`;
    const entry = { input, name, kind: isUrl ? 'url' : 'image' };
    try {
      if (isUrl) {
        entry.schemes = {};
        for (const scheme of ['light', 'dark']) {
          const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            colorScheme: scheme,
            reducedMotion: 'reduce',
          });
          const page = await context.newPage();
          await page.goto(input, { waitUntil: 'networkidle', timeout: 45_000 }).catch(async () => {
            await page.waitForLoadState('domcontentloaded');
          });
          await page.waitForTimeout(800);
          const shot = `${name}-${scheme}.png`;
          await page.screenshot({ path: path.join(OUT_DIR, shot) });
          entry.schemes[scheme] = {
            screenshot: shot,
            ...summarisePage(await page.evaluate(measurePage)),
          };
          await context.close();
        }
        // A site that ignores the preference paints the same page twice; say so.
        entry.respondsToColorScheme =
          entry.schemes.light.backgrounds[0]?.[0] !== entry.schemes.dark.backgrounds[0]?.[0];
      } else {
        const file = path.resolve(input);
        const page = await browser.newPage();
        Object.assign(entry, await measureImage(page, file));
        fs.copyFileSync(file, path.join(OUT_DIR, `${name}${path.extname(file)}`));
        entry.screenshot = `${name}${path.extname(file)}`;
        await page.close();
      }
      console.log(`  measured ${input}`);
    } catch (error) {
      entry.error = String(error instanceof Error ? error.message.split('\n')[0] : error);
      console.log(`  FAILED ${input}: ${entry.error}`);
    }
    results.push(entry);
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT_DIR, 'measure.json'), JSON.stringify(results, null, 2));

// Markdown for a person and for the brief.
const pct = (share) => `${(share * 100).toFixed(0)}%`;
const list = (dist, fmt = (v) => String(v)) =>
  dist.map(([v, s]) => `${fmt(v)} (${pct(s)})`).join(', ') || '-';
const stat = (s, unit = '') =>
  s.median === undefined
    ? '-'
    : `median ${String(+s.median.toFixed(2))}${unit}, MAD ${String(+s.mad.toFixed(2))}${unit}; common: ${list(s.top, (v) => `${String(v)}${unit}`)}`;

const md = [
  `# Reference measurements`,
  '',
  `Measured ${new Date().toISOString().slice(0, 16)}.`,
  '',
];
for (const r of results) {
  md.push(`## ${r.input}`, '');
  if (r.error) {
    md.push(`FAILED: ${r.error}`, '');
    continue;
  }
  if (r.kind === 'image') {
    md.push(
      `![${r.name}](${r.screenshot})`,
      '',
      `- Size: ${r.size}`,
      `- Palette (OKLab clusters, by pixel share): ${r.palette.map((c) => `\`${c.oklch}\` ${pct(c.share)}`).join(', ')}`,
      `- Saturated colours (clustered on their own; share of the whole image): ${r.saturated.map((c) => `\`${c.oklch}\` ${(c.share * 100).toFixed(2)}%`).join(', ') || 'none'}`,
      `- Dark share (L < 0.25): ${pct(r.darkShare)}; light share (L > 0.93): ${pct(r.lightShare)}`,
      `- Lightness median ${String(r.lightness.median)} (MAD ${String(r.lightness.mad)}); chroma median ${String(r.chroma.median)} (MAD ${String(r.chroma.mad)})`,
      '',
      'Type, spacing and radius cannot be measured from pixels: read them off the image and write them into the brief as estimates.',
      '',
    );
    continue;
  }
  md.push(
    `Responds to prefers-color-scheme: ${r.respondsToColorScheme ? 'yes' : 'no (both shots are the same theme)'}`,
    '',
  );
  for (const [scheme, s] of Object.entries(r.schemes)) {
    md.push(
      `### ${scheme}`,
      '',
      `![${r.name} ${scheme}](${s.screenshot})`,
      '',
      `- Backgrounds (by area): ${list(s.backgrounds, (v) => `\`${v}\``)}`,
      `- Text colours (by characters): ${list(s.text, (v) => `\`${v}\``)}`,
      `- Borders: ${list(s.borders, (v) => `\`${v}\``)}`,
      `- Saturated (accent candidates): ${list(s.accents, (v) => `\`${v}\``)}`,
      `- Text contrast: ${stat(s.textContrast, ':1')}`,
      `- Font families: ${list(s.fontFamily)}`,
      `- Font size: ${stat(s.fontSize, 'px')} (root ${String(s.rootFontSize)}px)`,
      `- Font weight: ${list(s.fontWeight)}`,
      `- Line height (x font size): ${stat(s.lineHeight)}`,
      `- Letter spacing (em): ${stat(s.letterSpacingEm)}`,
      `- Radius: ${stat(s.radius, 'px')}`,
      `- Shadows: ${String(s.shadows.count)} elements; ${list(s.shadows.top, (v) => `\`${v}\``)}`,
      `- Padding: ${stat(s.padding, 'px')}`,
      `- Gap: ${stat(s.gap, 'px')}`,
      `- Control height: ${stat(s.controlHeight, 'px')}`,
      `- Prose width: ${stat(s.contentWidth, 'px')}`,
      `- Transitions: ${stat(s.transitionMs, 'ms')}`,
      '',
    );
  }
}
fs.writeFileSync(path.join(OUT_DIR, 'measure.md'), `${md.join('\n')}\n`);
console.log(`\nWritten to ${path.relative(REPO_ROOT, path.join(OUT_DIR, 'measure.md'))}`);
process.exitCode = results.some((r) => r.error) ? 1 : 0;
