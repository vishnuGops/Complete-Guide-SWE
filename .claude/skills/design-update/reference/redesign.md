# Redesign mode

Change how DevProMax looks - to match a reference the owner likes, or a
direction they describe - without breaking what the design system is for, and
without touching source until the owner has seen every screen in both themes
and said yes.

The other modes hold the app to `docs/DESIGN.md`. This one rewrites the parts of
DESIGN.md that are taste, keeps the parts that are function, and then hands the
new DESIGN.md back to the other modes to enforce.

Read this whole file before starting. Do the steps in order; each one has an
output file, and a step whose output does not exist has not been done.

## Unattended runs

The owner may start a redesign and ask for it to run to completion without
stopping. That changes who answers the two questions, not whether they are
answered:

- **Brief (step 1).** If the request, or a `docs/DESIGN.md` already rewritten for
  this redesign, answers the brief's questions, write `brief.md` from it without
  asking. Quote the source of each answer in the brief. Its "Settled rules to
  lift" are the ones that DESIGN.md already changed.
- **Approval (step 8).** If the request pre-approves the result, a passing round
  (score and every hard gate) is approved: write `decision.md` saying so, quoting
  the request, and continue to step 9. If four rounds pass without a pass, take
  the best round **only if every hard gate is green**, record its open issues in
  `decision.md`, and continue; if a hard gate is still red, stop and report -
  that is the one stop the owner cannot pre-approve.
- **Dependencies** the request names (fonts, icon set) may be installed without
  asking; anything else still needs asking.
- **Branch.** If already on a branch other than `main`, stay on it instead of
  creating `design/<slug>`. Commit only if the request says to, one commit per
  concern, messages prefixed with the task ID.
- **Done means verified.** The run ends only after step 9 in full: unit, lint,
  typecheck, the whole `npm run test:e2e` suite (axe included, both themes), the
  final capture compared both ways, and an audit against DESIGN.md with no P0 or
  P1 left. A failing test is fixed, not skipped; a test whose assertion encodes the
  old design (a colour, a label that moved) is updated in the same change and
  named in the report.
- Everything else in this file still applies, the independent reviewer included.

## What may change, and what may not

A redesign changes values. It does not change contracts.

| May change (taste)                                                                                   | May not change (function)                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every ramp colour, the neutrals' temperature, the accent's hue and chroma                            | The semantic token names components use (`bg`, `surface`, `fg-muted`, `accent`, `success-fg` ...). New ones may be added; none removed or repurposed            |
| Which ramp step each semantic token points at, per theme                                             | Contrast: text 4.5:1, meaningful non-text 3:1, both themes (`contrast.test.ts` pairs)                                                                           |
| Font families (open-licence, self-hosted via `@fontsource`), the type scale, weights, letter-spacing | One hue per verdict meaning (success / warn / danger), each far from the accent, and colour never the only signal                                               |
| Density (`--spacing`), radii, borders vs. tonal surfaces                                             | Both themes first-class, dark defined twice identically; the focus ring visible on every surface                                                                |
| Shadows and elevation, including on panels, if the brief asks                                        | Keyboard operation, `prefers-reduced-motion`, 1024px minimum width                                                                                              |
| Motion duration and properties, within reduced-motion                                                | Offline: no font or asset from a CDN. No component library (CLAUDE.md). Radix for behaviour                                                                     |
| The DESIGN.md section 3 "not this" list - with the owner's explicit yes per item                     | The tool's job: a dense list, an editor, a verdict, readable for hours. A layout that makes code or verdicts harder to read fails review whatever it looks like |

Anything in the left column that contradicts DESIGN.md today (panel shadows, a
second accent, rounder corners) needs the owner to choose it in the brief, and
then becomes a documented DESIGN.md change in step 9, with the reason.

Borrow a look, not an identity: no logos, product names, illustrations or
proprietary fonts from a reference. If a reference uses a commercial typeface,
find the closest open one on Fontsource and say so in the rationale.

## Run folder

Everything lives under `data/design-audit/<slug>/` (gitignored), `<slug>` being
a short name for the direction, e.g. `redesign-graphite`:

```
brief.md                 step 1
reference/               step 2: measure.md, measure.json, screenshots
baseline/                step 3: capture of the app as it is
r1/ r2/ ...              one folder per proposal round:
  tokens.css               the full candidate tokens.css
  rationale.md             every changed token, old -> new, and why
  scale.json               only if weights or motion change
  extra.css                only for @font-face of a new font
  check.md                 check-proposal output
  capture/                 capture with the proposal injected
  compare/                 compare.html, pairs/, summary.md
  self-review.md           your screen-by-screen notes
  review.md                the independent reviewer's scores and issues
decision.md              step 8: what the owner approved
final/                   step 9: capture of the built, applied redesign
```

## 1. Brief

From ECC's `frontend-design-direction` (purpose, audience, tone, one memorable
detail, constraints) and `brand-discovery` (never accept a thin answer).

Ask with AskUserQuestion, one round of up to four questions, then follow up only
where an answer is thin:

1. **Reference** - a URL, a screenshot path, or "none, I'll describe it". Up to three.
2. **What to take from it** - multi-select: colour, type, density, corners and
   surfaces, elevation, overall mood. What is taken is what gets measured and matched;
   the rest stays as it is.
3. **Density** - keep dense (a list of two hundred rows), balanced, or airy - with
   the cost stated: airy loses rows and editor lines.
4. **Theme priority** - both equal, dark-first, or light-first. Both are still
   shipped and reviewed; this decides which one the reference is matched in.

A thin answer is one a designer could not act on. "Sleek", "modern", "clean" are
thin: ask for one site or app that is sleek to them, or show two directions
(step 4). Do not guess a meaning for an adjective.

Write `brief.md`:

- **Purpose and audience** - unchanged from DESIGN.md section 1 unless the owner changes it.
- **Direction** - three to five concrete statements ("near-black canvas with
  tonal, borderless panels", "one cool accent, higher chroma than today").
- **Take / leave** - from each reference, what is borrowed and what is not.
- **Memorable detail** - exactly one, and it must serve the work (a verdict
  treatment, the editor frame), not decorate it.
- **Settled rules to lift** - each DESIGN.md rule the direction breaks, named, for the owner to confirm.
- **Out of scope** - layout and information architecture stay unless the owner asks.

Show the brief and get a yes before measuring anything.

## 2. Measure the references

From ECC's `taste-distillation`: words do not reproduce a look, measurements do.

```
node .claude/skills/design-update/scripts/reference.mjs --out data/design-audit/<slug>/reference <url-or-image> [...]
```

For a URL you get light and dark screenshots and area-weighted computed styles:
backgrounds, text colours, accent candidates, contrast, font families and sizes,
weights, line height, letter-spacing, radii, shadows, padding, gaps, control
heights, transitions - as medians and MADs. For an image you get an OKLab
palette by pixel share, dark/light share, and lightness/chroma medians; type and
spacing must be read off the picture by eye and marked as estimates.

Then read every reference screenshot yourself. Add to `brief.md` a
**Measured** section: the values you will match, each with its source line in
`measure.md`. A token decision later that cites neither the brief nor a
measurement is a guess, and gets removed.

Watch for traps: a marketing page's hero is not the product's UI (measure the
app screens if the site has them); a site that ignores `prefers-color-scheme`
gives two identical shots, so its other theme must be designed, not measured.

## 3. Baseline

Build if `apps/web/dist` is older than the last change under `apps/web/src`,
then capture the app as it is:

```
npm run build
node .claude/skills/design-update/scripts/capture.mjs --out data/design-audit/<slug>/baseline
```

## 4. Directions (only when the brief is open)

If there is a concrete reference, skip to step 5 with one direction. If the
brief is adjectives without a reference, make two contrasting directions (`r1a`,
`r1b`), take them through steps 5-6 with `--only list` and `--only workspace` at
1440 only, show the owner both compare pages, and continue with the one they pick.
Two is the number: one is a guess and three is a menu.

## 5. Proposal

```
cp apps/web/src/styles/tokens.css data/design-audit/<slug>/r1/tokens.css
```

Edit values in the copy, never the structure. The rules that keep it valid:

- **Ramps are OKLCH, evenly stepped in L.** Neutrals: 14 steps as today, chroma
  <= 0.02, hue leaning toward the accent (or warm, if the brief says so). Accent
  and statuses: chroma peaks mid-ramp and falls toward both ends, or the light
  steps turn neon and the dark ones muddy.
- **Dark is designed, not inverted.** Surfaces get lighter as they rise
  (`bg` < `surface` < `surface-raised` < `overlay`); text is off-white, not
  white; `accent-fg` and every `*-fg` step lighter than in light.
- **Semantic tokens alias ramps** (`--fg: var(--color-neutral-900)`), because
  contrast.test.ts reads them that way. A raw value is allowed only where it is
  today (`--overlay-scrim`).
- **Both dark blocks identical.** Edit one, copy it to the other.
- **Statuses keep their hue family.** Adjust lightness and chroma to sit with the
  new palette; move hue only within +/- 15 deg.
- **Type**: sizes stay tokens (`--text-*` with their `--line-height`); a new
  family goes in `--font-sans` / `--font-mono` with the old one kept as fallback.
  Preview a new font with `extra.css`:
  ```css
  @font-face {
    font-family: 'Geist Variable';
    font-weight: 100 900;
    src: url('/__design-preview/node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2')
      format('woff2');
  }
  ```
  That needs the package installed; installing is a dependency change, so ask first.
- **Density** is `--spacing`. 0.25rem is today; 0.275-0.3rem is noticeably airier.
- Anything tokens cannot express (panel elevation, a heading's letter-spacing,
  the Monaco theme, a component's padding) is a **component change**: list it in
  `rationale.md` with the file it touches. It is applied in step 9 and first seen
  in the `final/` capture, so keep that list short and say which screens it moves.

The Monaco editor uses its built-in `vs` / `vs-dark` themes today
(`apps/web/src/editor/CodeEditor.tsx`). If the new palette moves `surface` far
from `#ffffff` / `#1e1e1e`, the editor will look pasted in; plan a
`monaco.editor.defineTheme` derived from the tokens as a component change.

`rationale.md` is a table - token, old, new, why (brief line or `measure.md`
value) - then the component changes, then open questions.

Then the gate, which must pass before any capture:

```
node .claude/skills/design-update/scripts/check-proposal.mjs data/design-audit/<slug>/r1/tokens.css --brief data/design-audit/<slug>/brief.md > data/design-audit/<slug>/r1/check.md
```

It checks shape (all semantic tokens in all four places, identical dark blocks,
aliases to OKLCH ramps, the utilities and variants still there), every
contrast.test.ts pair in both themes, hue separation between accent and
verdicts, and that the lead font is self-hosted. Fix and re-run until it passes.
Its "tightest pairs" list is where the next edit will break things.

## 6. Preview

```
node .claude/skills/design-update/scripts/capture.mjs --out data/design-audit/<slug>/r1/capture --inject-tokens data/design-audit/<slug>/r1/tokens.css [--inject-css .../extra.css] [--scale .../scale.json]
node .claude/skills/design-update/scripts/compare.mjs --before data/design-audit/<slug>/baseline --after data/design-audit/<slug>/r1/capture --out data/design-audit/<slug>/r1/compare
```

The built app, every state, both themes, both widths, with the proposal laid
over it - colour, type, density, radius and fonts show exactly; shadows and
component changes do not (they arrive in step 9). `summary.md` must show no
introduced untokened or ramp colours and no new axe rules; each is a hard fail.

## 7. Review - twice, by two different readers

### 7a. Your pass

Read every `compare/pairs/1440-*.png` (26 images) and the 1024 pairs of the
workspace, list and settings. Where a pair is too small to judge, open the
original `capture/<width>/<theme>/<shot>.png` at full size. For each screen, in
`self-review.md`:

- The section 2 look-list from SKILL.md (eye path, one primary action,
  hierarchy, alignment, empty labels, truncation, theme parity, editor fit,
  state coverage).
- **Brief fidelity**: put the reference screenshot next to the after shot. Name
  each Direction line from the brief as met, partly met or missed, with the
  shot that shows it.
- **Tool fitness**: rows visible in the list vs. baseline, editor lines visible
  vs. baseline, how fast a Wrong Answer reads in `workspace-failed`. A redesign
  that costs more than ~15% of visible rows needs the owner's density answer to
  have asked for it.
- **Coherence**: the same element (a tab, a primary button, a status dot) looks
  the same on every screen.
- **Both themes**: dark is judged on its own, not as "light but dark".

### 7b. Independent review

Self-review is optimistic (ECC's `gan-style-harness`: an agent grading its own
work praises it). Spawn a separate reviewer with the Agent tool
(`subagent_type: general-purpose`), using the prompt in `reviewer-prompt.md`
with the paths filled in. Do not give it `rationale.md` or `self-review.md`: it
judges the screens against the brief, not your argument for them. Save its
answer as `review.md`.

**Pass** = weighted score >= 7.5, no criterion below 6, and every hard gate
green (check-proposal, no new axe rules, no introduced untokened colours).

## 8. Iterate, then ask

Fail: copy `r1/` to `r2/`, fix the reviewer's issues in severity order plus
your own, add a "Round 2 changes" section to `rationale.md` mapping each change
to the issue it answers, and repeat steps 5-7. Stop after four rounds; if it has
still not passed, present the best round with its open issues rather than
looping.

Pass: show the owner -

- the `compare.html` path, opened for them (`start "" "<path>"` on Windows),
- the brief's Direction lines with met / partly / missed,
- the reviewer's scores and anything it still flagged,
- the list of DESIGN.md rules this lifts and the component changes to come,

and ask with AskUserQuestion: approve, request changes (then iterate), or stop.
Write the answer and any conditions into `decision.md`. Nothing in the source
changes before this.

## 9. Apply

On a branch, so the whole redesign is one revertible unit:
`git switch -c design/<slug>` (the owner decides later whether to commit).

1. Copy the approved `tokens.css` over `apps/web/src/styles/tokens.css`. Rewrite
   its comments where the reasoning changed - they explain the values, and a
   comment defending the old accent next to the new one is a lie.
2. New font: `npm install @fontsource-variable/<family> -w @devpromax/web`, import it
   in `apps/web/src/styles/index.css` next to Inter, and keep Inter / JetBrains Mono
   only if still used.
3. Component changes from `rationale.md`, including the Monaco theme.
4. Update every place the old design is written down, in the same change:
   - `docs/DESIGN.md` - each section whose rule or value changed, in its own
     voice, with the reason; section 3 and section 13 if a "not this" item or a
     checklist line changed.
   - `ROADMAP.md` - the D16 decision row with the new reasoning, a line in the
     revision history, and a task row for the redesign at the right priority
     (CLAUDE.md, "Working with ROADMAP.md").
   - `apps/web/src/styles/contrast.test.ts` - any new pair.
   - `.claude/skills/design-update/scripts/` - `capture.mjs` `SCALE`
     (weights, durations), `token-audit.mjs` `RULES` (shadow, radius, motion,
     weight rules) and `check-proposal.mjs` `PAIRS`, so the audit enforces the
     new design and not the old one.
   - `apps/web/src/dev/KitchenSink.tsx` if ramp names changed.
5. Build and capture the real thing, then compare it both ways:
   ```
   npm run build
   node .claude/skills/design-update/scripts/capture.mjs --out data/design-audit/<slug>/final
   node .claude/skills/design-update/scripts/compare.mjs --before data/design-audit/<slug>/baseline --after data/design-audit/<slug>/final --out data/design-audit/<slug>/final-vs-baseline
   node .claude/skills/design-update/scripts/compare.mjs --before data/design-audit/<slug>/rN/capture --after data/design-audit/<slug>/final --out data/design-audit/<slug>/final-vs-preview
   ```
   `final-vs-preview` should differ only where component changes and shadows
   were expected to. Review every difference it shows: that is the part of the
   redesign nobody has seen yet.
6. Run audit mode (SKILL.md sections 1-3) against the new DESIGN.md and fix every P0 and P1.
7. Verify: `npm run test:unit`, `npm run lint && npm run typecheck`,
   `npm run test:e2e` (axe in both themes), and `npm run screenshots` for the README.
8. Report back: the three compare pages, test results as they came out, the
   files changed, and what the owner still needs to decide (commit, merge).

Rolling back before a commit is `git switch -` and deleting the branch; the run
folder keeps every capture either way.
