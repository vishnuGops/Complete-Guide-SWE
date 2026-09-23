# What was taken from ECC, and what was not

Source: <https://github.com/affaan-m/ecc> (MIT, (c) 2026 Affaan Mustafa), reviewed
2026-09-22. Nothing is copied verbatim; the ideas below were adapted to this
repo's rules. ECC's skills are written for any web app; DESIGN.md is written
for this one, and wins every conflict.

## Adopted, adapted

| ECC skill                                | Idea                                                                                               | Where it went                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `design-system` (Mode 2, visual audit)   | Score dimensions with exact file:line fixes                                                        | The P0-P3 plan with evidence and layer per item                                                                     |
| `design-system` (Mode 3, slop detection) | Named generic-AI patterns                                                                          | Already DESIGN.md section 2; the audit's `gradient`, `shadow`, `radius`, `emoji`, `tailwind-palette` rules check it |
| `browser-qa`                             | No baseline means inconclusive, never a silent pass                                                | Verify step compares against a `-before` run; no before run, no "fixed" claim                                       |
| `browser-qa`, `accessibility`            | axe covers a minority of WCAG; a clean run is necessary, not sufficient                            | Section 2's look-list is the manual half; capture runs axe at WCAG 2.2 AA, all impacts                              |
| `make-interfaces-feel-better`            | `text-wrap: balance` on headings, `pretty` on short text; never `transition: all`; tabular numbers | P3 examples; `motion` audit rule; `tnum` already in DESIGN 4                                                        |
| `make-interfaces-feel-better`            | Before/after rows per change                                                                       | The report-back format                                                                                              |
| `frontend-design-direction`              | Purpose / audience / tone before pixels; dense and quiet for a repeated-use tool                   | Already DESIGN.md section 1, which the skill reads first                                                            |

## Adopted for redesign mode

`reference/redesign.md` is built from these. Where an idea was rejected for the
audit modes above, it is still rejected there; redesign may use it only when the
owner chooses it in the brief.

| ECC skill                     | Idea                                                                                                   | Where it went                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend-design-direction`   | Purpose, audience, tone, one memorable detail, constraints - before any pixel; match the domain        | Step 1, `brief.md`, with Direction lines the reviewer scores against                                                                           |
| `brand-discovery`             | Never accept a thin answer; ask for one concrete example; confirm before moving on                     | Step 1: "sleek" gets a follow-up for a reference, or two directions (step 4); the brief is confirmed before measuring                          |
| `taste-distillation`          | Measure the reference, do not describe it; medians and MADs, not means; background share; mask chrome  | `reference.mjs`: area-weighted computed styles for URLs, OKLab clusters for images, accents clustered separately, colours composited on screen |
| `design-system` Mode 1        | Scan what exists, propose a token set as CSS custom properties, rationale per decision, a preview page | Step 5 `tokens.css` + `rationale.md` (token, old, new, why), step 6 `compare.html`                                                             |
| `gan-style-harness`           | Separate generator from a strict evaluator; weighted rubric; pass threshold; iterate with a cap        | Step 7b reviewer (`reviewer-prompt.md`), weights 0.25/0.2/0.2/0.2/0.15, pass at 7.5 with no criterion below 6, four rounds at most             |
| `plan-canvas`                 | The human approves or requests changes on a rendered artifact before implementation                    | Step 8: `compare.html` (flip view, brief, rationale) and an explicit approve / change / stop; nothing in the source changes before it          |
| `browser-qa`                  | No baseline means inconclusive                                                                         | `compare.mjs` lists unmatched shots as INCONCLUSIVE and compares only states captured in both runs                                             |
| `make-interfaces-feel-better` | Concentric radii, tabular numbers, text-wrap, scoped transitions                                       | Available to a redesign whose brief asks for softer surfaces or more motion; still bounded by reduced-motion and the 75ms default otherwise    |

Not taken for redesign: `gan-style-harness`'s planner agent (the brief is
the plan, and the product already exists), its 15-iteration budget (four rounds;
a token proposal converges fast or not at all), and `plan-canvas`'s CLI and
browser server (`ecc-plan-canvas` is not installed; `compare.html` plus
AskUserQuestion does the same job with nothing to install).

## Not adopted

| ECC skill                                                                                  | Idea                                                                    | Why not                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design-system` Mode 1                                                                     | Generate a new token set, research competitor sites                     | Not in `audit` / `apply`: the token system is decided (D16). It is what `redesign` does, from the owner's references rather than competitors chosen by the agent                    |
| `make-interfaces-feel-better`                                                              | Layered shadows for depth on cards and buttons                          | DESIGN 5: one shadow, only on what floats                                                                                                                                           |
| `make-interfaces-feel-better`                                                              | Press `scale(0.96)`, `translateY` enters, blur cross-fades, 150ms exits | DESIGN 1 and 9: 75ms, colour and opacity only, nothing moves in on load                                                                                                             |
| `make-interfaces-feel-better`                                                              | 40-44px hit areas                                                       | Dense table rows and toolbars; WCAG 2.2 AA target size is 24px                                                                                                                      |
| `make-interfaces-feel-better`                                                              | macOS font smoothing, image outlines                                    | Both PCs are Windows; the app has no content images                                                                                                                                 |
| `browser-qa`                                                                               | 375/768px breakpoints                                                   | DESIGN 9: minimum width is 1024px, and below it the app says so                                                                                                                     |
| `frontend-design-direction`                                                                | "Memorable detail", multi-hue palettes                                  | One accent; colour carries meaning (DESIGN 3, 6)                                                                                                                                    |
| `frontend-a11y`, `react-patterns`, `react-performance`, `frontend-patterns`, `e2e-testing` | General React / Next.js / Playwright guidance                           | Useful reading, but not a design pass; this repo's CLAUDE.md, e2e helpers and perf budgets already cover what applies. Next.js server-component advice does not apply to a Vite SPA |
| `ui-demo`, `click-path-audit`, `liquid-glass-design`, `taste*`                             | Demo videos, state-flow debugging, Apple glass, video style packs       | Out of scope, or contrary to DESIGN 2                                                                                                                                               |

Of the remaining ECC skills, `click-path-audit` (tracing a button through every
state change it causes) is the one worth a separate skill here if the workspace's
Run / Submit / coach / draft interplay ever produces a bug unit tests miss.
