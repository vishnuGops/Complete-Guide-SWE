---
name: design-update
description: Capture every DevProMax screen in both themes, measure what it paints against the tokens in tokens.css, audit the source for token leaks, and turn the result into a prioritised, token-first design update - then apply it and prove it with before/after captures. Also redesigns the UI to a new look (a reference site or screenshot, or a described direction) through a brief, measured references, a checked token proposal previewed on every screen, an independent screenshot review and the owner's approval. Use when asked to review, polish, audit, update, restyle, redesign or "fix the design of" the web UI, to make it look like another site, to pull up screenshots of the current UI, to check a UI change against docs/DESIGN.md, or before a UI-heavy release.
---

# Design update

A design pass for this app. `docs/DESIGN.md` is the constitution and
`apps/web/src/styles/tokens.css` is the vocabulary. Most modes hold the shipped
UI to them and fix drift at the lowest layer that will hold; `redesign`
deliberately rewrites the taste half of both and leaves the function half alone.

## Modes

Arguments are free text: a mode, and optionally a screen filter (`workspace`,
`settings`) or, for redesign, references.

| Mode              | Does                                                                                                                           | Edits source?                 | Sections                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------- |
| `audit` (default) | Capture, measure, look, and write a prioritised plan                                                                           | No                            | 0-3 below                                                |
| `apply`           | `audit`, then implement the plan top-down and verify                                                                           | Yes                           | 0-5 below                                                |
| `verify`          | Recapture and compare with an earlier run                                                                                      | No                            | 5 below, with `compare.mjs`                              |
| `redesign`        | Brief, measure references, propose tokens, preview on every screen, independent review, owner approval, then apply on a branch | Only after the owner approves | **Read `reference/redesign.md` in full, then follow it** |

For `redesign`, the rest of this file still applies where that file points back
to it (the look-list in section 2, the audit in sections 1-3 after applying).

Scripts, all under `.claude/skills/design-update/scripts/`, run from the repo root:

| Script               | For                                                                                |
| -------------------- | ---------------------------------------------------------------------------------- |
| `capture.mjs`        | Screenshot and measure every screen; `--inject-tokens` previews a proposal         |
| `token-audit.mjs`    | Source scan for token leaks, `file:line`                                           |
| `compare.mjs`        | Before/after: side-by-side pairs, a flip-view `compare.html`, a measurement diff   |
| `reference.mjs`      | Measure a reference URL or image into palette, type, spacing and radius numbers    |
| `check-proposal.mjs` | Gate a candidate tokens.css on shape, contrast, verdict hues and self-hosted fonts |

## 0. Load the rules first

Read, in full, before looking at a single pixel:

- `docs/DESIGN.md` - sections 1-3 decide taste, 4-8 decide values and screens, 9-12 behaviour, 13 is the checklist.
- `apps/web/src/styles/tokens.css`, `base.css`, and `apps/web/src/markdown/markdown.css` if the statement is in scope.
- `apps/web/src/ui/` primitives, so a fix reuses them instead of re-styling a screen.

Outside `redesign`, settled decisions are not findings: 14px base, one accent,
1024px minimum width, the card and elevation rules of section 6, 75ms
colour-and-opacity motion, the serif reserved for the coach. If you believe one of them is wrong, say so separately
at the end - never fold it into the plan. Changing them is what `redesign` is for.

## 1. Capture

The audit is of what ships, so build first if `apps/web/dist` is older than the
last change under `apps/web/src` or `apps/server/src`:

```
npm run build
node .claude/skills/design-update/scripts/capture.mjs --out data/design-audit/<run>-before
node .claude/skills/design-update/scripts/token-audit.mjs
```

`capture.mjs` starts the production server on its own database (inside the run
folder), seeds a few solves, a draft and a note, and captures 20 states (list,
filtered-empty, first-run welcome, keyboard-focused row, loading, error; command
palette; workspace idle / accepted / failed / focus / hints / coach / coach reply;
progress, its loading and error; interview idle and running; settings; 404) plus
the too-narrow notice, in light and dark, at 1440x900 and 1024x768. The coach
reply, the running interview and the loading and error states are answered in
the browser (`page.route`), so the audit database never holds them. For each it
writes:

- `<width>/<theme>/<shot>.png`
- `report.json` - per shot: every colour, font size, weight, radius, spacing,
  shadow and transition on screen (Monaco excluded), whether a semantic token
  accounts for it, up to four selectors per off-token value, and axe results at
  WCAG 2.2 AA, all impacts.
- `report.md` - the same, aggregated to one row per distinct off-token value.

Useful flags: `--only <substring>[,<substring>]`, `--widths 1440`, `--themes dark`, `--no-axe`,
`--url http://127.0.0.1:5173` to point at `npm run dev` instead (that also adds
`/dev/kitchen-sink`). About 3 minutes for the full matrix on the home server.

`token-audit.mjs` scans `apps/web/src` for ramp classes, Tailwind palette
classes, raw colours, gradients, stray shadows and radii, 700 weights, arbitrary
type and spacing, `var(--spacing-N)`, off-budget motion, removed focus rings,
`dark:` overuse and emoji - each with `file:line` and the DESIGN.md section it
breaks. `--changed <ref>` limits it to files changed since a ref. Exit 1 means
an `error`-severity finding.

If a shot fails, the run still finishes; the failure is in the report. Fix the
shot's selector in `capture.mjs` when the UI legitimately changed, rather than
dropping the shot.

## 2. Look

The numbers find values; only looking finds composition. Read every 1440 PNG in
both themes with the Read tool (it renders images), and the 1024 ones for any
screen that is dense or has a toolbar. Put light and dark of the same shot next
to each other.

For each screen, answer these, which no script checks:

- **Where does the eye land first**, and is that the thing the user came for
  (the code, the verdict, the next unsolved row)? Chrome that competes is a bug (DESIGN 1).
- **One primary action per region.** Two filled accent buttons side by side means neither is primary.
- **Hierarchy by weight and colour, not size creep**: page title `text-xl`, panel titles `text-lg`, dense UI `text-sm`.
- **Alignment**: shared left edges across panels, baselines of mixed-size text in one row, numbers right-aligned with `tnum`.
- **Labels that say nothing, or labels with nothing under them** (an empty section heading, a caption for a value that is not shown).
- **Truncation**: ellipsised text with no way to read the rest (title attribute, tooltip, wider column).
- **Theme parity**: something visible in light and invisible in dark (a `surface-sunken` on `bg` is the classic), or a border that disappears.
- **Editor fit**: does Monaco's theme sit in the page, or does it look pasted in?
- **State coverage**: loading, empty and error each exist and each is a sentence (DESIGN 12).
- **Slop check (DESIGN 3)**: KPI-tile grids, cards inside cards, heavy shadows, hero copy, gradients (bar a chart fill), emoji, a second accent, celebratory UI.

Write down each observation with the shot path that shows it.

## 3. Plan - prioritised and token-first

Merge the three sources (report.md, token-audit output, your notes) into one
plan, written to `data/design-audit/<run>-before/plan.md` and summarised in chat.
Deduplicate: one finding per root cause, listing every screen it shows up on.

**Priority** - by harm to someone practising, not by effort:

| P   | Meaning                                                                                                                    | Examples                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| P0  | Wrong or unusable: fails WCAG AA, state conveyed by colour alone, focus lost or invisible, content unreadable in one theme | axe serious/critical, contrast < 4.5:1, `outline-none` without a replacement                 |
| P1  | Breaks a written DESIGN.md rule                                                                                            | ramp or raw colour, 700 weight, off-scale type, shadow on a panel, removed state             |
| P2  | Inconsistent: the same thing looks different in two places, or hierarchy misleads                                          | two button heights in one toolbar, mismatched section headings, an orphan label              |
| P3  | Polish                                                                                                                     | alignment by a pixel or two, `text-wrap: balance` on a heading, truncation without a tooltip |

**Layer** - fix at the lowest layer that makes the problem impossible to repeat:

1. **Token** (`tokens.css`): the value is wrong everywhere it is used, or a
   semantic role has no token. Adding a semantic token means editing all four
   places - the `@theme inline` mapping, `:root`, the `prefers-color-scheme: dark`
   block, and `:root[data-theme='dark']` (the two dark blocks are duplicates and
   must stay identical) - plus a pair in `styles/contrast.test.ts` and a line in
   DESIGN.md section 4.
2. **Utility / base** (`tokens.css` `@utility`, `base.css`, `markdown.css`): the
   rule is about an element type, not a component (`strong` weight, inline `code` size).
3. **Primitive** (`apps/web/src/ui/`): every use of a control needs it.
4. **Screen**: only this screen is wrong. If a second screen needs the same fix,
   promote it to a primitive then (DESIGN 10), not ahead of time.

Each plan item: `P? | title | screens + shot paths | evidence (value + selector, or file:line) | DESIGN.md section | fix and layer | how it will be verified`.

In `audit` mode, stop here and present the plan. Ask which priorities to apply
if it is long; P0 and P1 are the default.

## 4. Apply

Top-down by priority, and within a priority, tokens before utilities before
primitives before screens - a token change can make later items disappear.

- Semantic tokens only in components; a `dark:` variant is the escape hatch, not a fix.
- Keep behaviour: Radix handles focus and keyboard; do not replace it to get a look.
- A changed visual behaviour worth keeping gets an RTL test; anything in a
  golden path keeps its Playwright coverage green.
- Do not commit unless asked. When asked, one commit per concern, message
  prefixed with the ROADMAP task it belongs to (add a row at the right priority
  if there is none - see "Working with ROADMAP.md" in CLAUDE.md).

## 5. Verify

```
npm run test:unit                            # includes styles/contrast.test.ts
npm run lint && npm run typecheck
npm run build
node .claude/skills/design-update/scripts/token-audit.mjs
node .claude/skills/design-update/scripts/capture.mjs --out data/design-audit/<run>-after
npm run test:e2e                             # axe in both themes, golden paths
```

Then compare:

```
node .claude/skills/design-update/scripts/compare.mjs --before data/design-audit/<run>-before --after data/design-audit/<run>-after --out data/design-audit/<run>-compare
```

Read every pair in `pairs/` for a shot the change touched, and `summary.md`:
every targeted value should be under "Resolved" and "Introduced" should be
empty. A shot with no before is inconclusive, not passing. A fix that only one
theme was looked at in is not verified.

If the README's screens changed visibly, run `npm run screenshots` so
`docs/screenshots/` shows what ships.

Finish with DESIGN.md section 13 read against the diff, item by item, and update
DESIGN.md itself if a token, a rule or a decision changed (with the reason, in
its own voice).

## Report back

- The plan table (or what was applied from it), P0 first.
- Before/after shot paths for each applied item.
- Test results as they came out, including anything that failed.
- Anything deliberately left: settled decisions you disagree with, P3s skipped,
  shots that could not be captured.

## Not in this skill

Ideas from outside this repo that DESIGN.md rejects, so `audit` and `apply` do
not "improve" toward them: layered card shadows, press-scale or translate
animations, entrance animations, 44px minimum hit areas on dense rows (WCAG
2.2's 24px target size is the bar), a second accent for "personality", 16px body
text, mobile breakpoints. Only `redesign` may lift one of these, and only when
the owner chose it in the brief. See `reference/ecc-notes.md` for what was taken
from the ECC skills and why the rest was not.
