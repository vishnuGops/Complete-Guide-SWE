# Design

The rules this app's interface is built and reviewed against (ROADMAP D16).
`ROADMAP.md` section 2 says what was decided; this says what it means in front
of a screen.

It is a working document with teeth: section 13 is a checklist, and a screen
that fails it does not merge. Where it is silent, decide in the spirit of
section 1 and then write down what you decided.

> **Status (2026-09-22, P9-6).** This is the second version of this document,
> rewritten from a reference the owner chose (section 2). `tokens.css` and the
> screens still implement the first version until P9-6 lands, so an audit against
> this document today reports the whole gap - which is the work list. The first
> version is in git history: `git show 181e5c5:docs/DESIGN.md`. Values marked _target_ are read off the reference by eye; P9-6 sets
> the exact ones in `tokens.css`, where `contrast.test.ts` proves them.

---

## 1. What we are making

A tool for one developer practising algorithms at their desk, used for hours at
a time, mostly by keyboard, often beside a terminal and an editor.

That sentence has not changed, and it still settles most arguments:

- **Calm beats busy.** The page is a quiet grey canvas; the work sits on bright
  surfaces above it. The interesting thing on screen is always the user's code,
  the judge's answer, or the coach's advice - chrome that competes with them is a bug.
- **Scannable beats dense, and dense beats airy.** The first version packed the
  screen; this one gives each surface room to breathe, but a list of two hundred
  problems and an editor are still the product. Space is spent between surfaces,
  not inside rows.
- **Fast beats animated.** Transitions show that something changed state, not
  that the app is lively. 75ms, colour and opacity only.
- **Legible beats clever.** Someone reading a failing test at midnight needs
  contrast, tabular figures and a diff they can scan.

## 2. The reference, and what was taken from it

The look comes from a dashboard shot the owner supplied (a personal-finance app:
an icon rail, a greeting header, white rounded cards on a pale grey canvas, one
saturated blue, big tabular numbers, a serif voice for the assistant). **We
borrow its look, not its identity**: no names, logos, illustrations or its
fonts' licences come with it.

| Taken                                                                                                     | Becomes here                                                                            |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Pale cool-grey canvas, white rounded cards with a hairline edge and a faint lift                          | `bg`, `surface`, `border`, `shadow-card`, `rounded-xl` (sections 4, 6)                  |
| One saturated royal blue for the action, the active nav item, the chart line                              | The accent (section 4)                                                                  |
| A slim icon rail with a filled active item                                                                | The app shell (section 8)                                                               |
| Greeting-style header: title, one muted line of context, search pill with a key hint, primary pill button | Every page header (section 8)                                                           |
| Big bold tabular numerals with a small delta chip beside them                                             | The Stat pattern on Progress (section 8)                                                |
| A serif typeface for the assistant's sentences                                                            | **The coach speaks in serif** - the one memorable detail (section 5)                    |
| A tinted inset for "suggested next step"                                                                  | The Callout (`accent-subtle`), used for the coach's recommendation and the review queue |
| Segmented progress bars for goals                                                                         | Per-topic progress on the dashboard                                                     |
| Segmented range control (1M / 3M / YTD / 1Y / All) in a sunken tray                                       | The Segmented control: language switch, time ranges, list views                         |
| Recent-activity rows with a coloured icon tile, a title, a muted meta line, a right-aligned amount        | Recent submissions and the review queue, with verdict tiles                             |

| Not taken                                        | Because                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| The glossy gradient orb that marks the assistant | Decoration. The coach is marked by a flat accent dot and by its serif voice (section 5).                     |
| The lime delta chip                              | A second accent. Positive deltas use the success family, tinted toward lime within its hue band (section 7). |
| Brand-coloured icon tiles (merchant logos)       | Colour here means a verdict or the action. Icon tiles are neutral unless they carry a verdict.               |
| Its type size for body text in cards             | The problem statement is read, not glanced at; body stays 14px.                                              |
| The dashboard as the landing page                | The app still opens on the work: the problem list.                                                           |

## 3. What "not AI slop" means here

The phrase in the ROADMAP is a real constraint. With cards now allowed, the line
moves from "no cards" to "no card that does not earn its place":

| Not this                                                   | Because                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A card per number ("KPI tiles") in an even grid            | The generic dashboard. A card holds one question with its answer and its context, and sizes to its content.   |
| Cards inside cards                                         | Nesting borders is how depth stops meaning anything. Inside a card, group with space, a divider or a Callout. |
| Heavy or coloured shadows, glow, glassmorphism             | One faint lift for cards, one real shadow for what floats (section 6).                                        |
| Gradients                                                  | Decoration. The single exception is a chart's area fill (section 6).                                          |
| Hero sections, marketing copy, a greeting for its own sake | The header says something true and useful ("4 due for review"), or it says nothing.                           |
| Emoji as UI                                                | Renders differently everywhere and carries no semantics.                                                      |
| More than one accent                                       | Two accents mean neither signals anything.                                                                    |
| Confetti, celebratory toasts, streak flames                | The status flips to Solved; that is the reward.                                                               |
| Icon-only buttons with no tooltip or label                 | The rail is icons, so every icon has a tooltip and an accessible name (section 9).                            |

The positive version is unchanged: **this should look like it was made by
someone who uses it.**

## 4. Tokens

Defined in `apps/web/src/styles/tokens.css`, visible in both themes at
`/dev/kitchen-sink` (dev only). Two layers, and the split is the rule that
matters:

- **Ramps** (`neutral-*`, `accent-*`, `success-*`, `warn-*`, `danger-*`) are
  fixed. `neutral-700` is the same colour in both themes.
- **Semantic tokens** (`bg`, `surface`, `fg`, `border`, `accent`, `success`, …)
  are what components use, and the only thing the theme swaps.

> A component that writes `bg-neutral-100` has hard-coded the light theme. Use
> the semantic name. If none fits, add one - do not reach past them into a ramp.

Colours are OKLCH so that equal steps look equal. Neutrals lean slightly blue
(hue ~265) toward the accent, as the reference's greys do.

### Surfaces, light theme (_target_)

| Token            | Target                   | Used for                                                             |
| ---------------- | ------------------------ | -------------------------------------------------------------------- |
| `bg`             | `oklch(0.965 0.006 265)` | The canvas behind everything                                         |
| `surface`        | `oklch(1 0 0)`           | Cards and the rail                                                   |
| `surface-sunken` | `oklch(0.975 0.004 265)` | Inside a card: segmented trays, search fields, table headers         |
| `surface-raised` | `oklch(1 0 0)`           | Menus, the palette, dialogs (lifted by `shadow-overlay`, not colour) |
| `border`         | `oklch(0.925 0.006 265)` | The hairline around every card and between rows                      |
| `border-strong`  | `oklch(0.86 0.008 265)`  | Inputs, the edge of a control that can be clicked                    |

### Surfaces, dark theme (_target_)

Dark is designed, not inverted: surfaces get **lighter** as they rise, and
tonal steps do the lifting because a shadow on near-black is invisible.

| Token            | Target                   |
| ---------------- | ------------------------ |
| `bg`             | `oklch(0.155 0.01 265)`  |
| `surface`        | `oklch(0.2 0.012 265)`   |
| `surface-sunken` | `oklch(0.175 0.01 265)`  |
| `surface-raised` | `oklch(0.235 0.013 265)` |
| `border`         | `oklch(0.27 0.012 265)`  |
| `border-strong`  | `oklch(0.36 0.014 265)`  |

Text in dark is off-white (`fg` about L 0.95), never pure white.

### The accent

One accent, a saturated royal blue, _target_ `oklch(0.52 0.23 266)` for fills
in light and `oklch(0.56 0.21 266)` in dark, with white text on both (5.9:1 and
about 4.9:1; the dark fill cannot get lighter without losing that).
`accent-fg` (the accent as text) is darker in light and lighter in dark;
`accent-subtle` is the pale blue tint of the Callout.

It means **"this is the action"** or **"this is where you are"**: the primary
pill, the active rail item, the selected segment, the focus ring, a chart's
line, the current row. It is never decoration, and it is never a status -
"In progress" is drawn in `fg-muted` with its ring glyph, not in blue, so the
only blue things on screen are things you can act on or where you are.

The previous accent was indigo-violet, chosen to sit far from the verdict hues
and from the editor. Blue at 266 is still far from green, amber and red, but it
is Monaco's keyword blue - so the editor gets its own theme (section 8).

## 5. Type

Three families, all open-licence and self-hosted through `@fontsource` - the app
works offline apart from the coach, and a font from a CDN is a font that does not
arrive on a plane.

- **Inter** for the interface.
- **JetBrains Mono** for anything the user could paste into an editor.
- **Newsreader** (serif, variable) for **the coach's voice**, and only that: coach
  replies, the coach's one-line brief on Progress, the recommendation in the
  palette, the interview debrief. When the words are the coach's, they are in
  serif; when they are the app's, they are not. That is how a user tells advice
  from interface at a glance, and it is the one detail this design is remembered by.

| Token       | Size | Used for                                                          |
| ----------- | ---- | ----------------------------------------------------------------- |
| `text-2xs`  | 11px | Keyboard hints in chips, dense metadata. Never prose.             |
| `text-xs`   | 12px | Meta lines under a title, labels, captions                        |
| `text-sm`   | 13px | Dense UI: buttons, tabs, table cells, card titles                 |
| `text-base` | 14px | Body text, problem statements                                     |
| `text-md`   | 16px | Lead paragraphs, coach replies (serif)                            |
| `text-lg`   | 18px | Panel titles where a card title is not enough                     |
| `text-xl`   | 22px | Page titles; the coach's brief headline (serif)                   |
| `text-2xl`  | 28px | Secondary stat numerals                                           |
| `text-3xl`  | 36px | The primary stat numeral on a card. The largest thing in the app. |

`base` stays 14px: the statement is read, and the list is scanned. Nothing below
12px carries meaning a user must read to work.

Weights: 400 text, 500 controls and emphasis, 600 headings and card titles.
**700 only for stat numerals of 28px and up**, where the reference's weight
reads as confident rather than smeared; nowhere below that.

Numerals at 22px and up get `-0.02em` letter-spacing; page titles `-0.01em`.
Every number read by comparison - counts, timings, ratings, deltas - gets `tnum`.

## 6. Space, shape, elevation

**8-pt rhythm on a 4px step.** Tailwind's step stays 4px (`--spacing: 0.25rem`),
so even steps land on the grid and odd ones are deliberate half-steps. The
reference's airiness is spent in chosen places, not by stretching the step:

| Where                 | Space                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- |
| Canvas padding        | 24px (`p-6`)                                                                            |
| Gap between cards     | 16px (`gap-4`); 12px in the workspace, where width is scarce                            |
| Card padding          | 20px (`p-5`); 16px for dense cards (the list, the results panel)                        |
| Card title to content | 16px                                                                                    |
| Table rows            | 36px tall (was 33px): about one row fewer at 900px, accepted by the owner for this look |

In hand-written CSS a spacing step is `calc(var(--spacing) * 3)`, never
`var(--spacing-3)`. Tailwind v4 has one `--spacing` variable; the shorter
spelling resolves to nothing and the declaration is silently dropped.

**Radii** grow with the size of the thing:

| Token          | Value | For                                                         |
| -------------- | ----- | ----------------------------------------------------------- |
| `rounded-xs`   | 4px   | Keyboard chips, tiny tags                                   |
| `rounded-sm`   | 6px   | Icon tiles, selected segments                               |
| `rounded-md`   | 8px   | Inputs, secondary buttons, segmented trays                  |
| `rounded-lg`   | 12px  | Callouts, the active rail item, menus, the palette, dialogs |
| `rounded-xl`   | 16px  | Cards                                                       |
| `rounded-full` | -     | The primary pill button, delta chips, status dots, avatars  |

A thing inside a card is rounder than nothing and less round than the card
(concentric: inner radius = outer radius - padding, roughly).

**Elevation, three levels and no more:**

| Level   | Token            | What                                                                                                                                                                   |
| ------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas  | none             | The page                                                                                                                                                               |
| Card    | `shadow-card`    | Every card and the rail: a hairline `border` plus a barely-there lift, _target_ `0 1px 2px oklch(0.2 0.02 265 / 0.05)`. **None in dark**, where the tonal step does it |
| Overlay | `shadow-overlay` | Tooltips, menus, the palette, dialogs - things that float above cards                                                                                                  |

**Gradients: one exception.** A line chart may fill the area under its line with
the line's own colour fading to transparent - it shows the area the line
encloses. Nothing else has a gradient, including the coach mark and buttons.

## 7. Colour carries meaning, and never alone

Three semantic hues, each meaning exactly one thing:

| Hue       | Means                          | Verdicts   |
| --------- | ------------------------------ | ---------- |
| `success` | The judge accepted it          | AC         |
| `warn`    | It ran, but outside its budget | TLE, MLE   |
| `danger`  | It failed                      | WA, RE, CE |

The reference's green positives, orange "behind" and red map straight onto these.
Two uses are added:

- **Delta chips** (`+3 this week`, `+12%`) use `success-subtle` with
  `success-fg` text when the change is good and a neutral chip when it is not.
  `success-subtle` may lean toward lime to echo the reference, within 15 degrees of
  the success hue - never its own hue.
- **Positive numbers** in a list may be `success-fg`; negative ones stay `fg`.
  Red is for failure, not for "less".

Progress statuses: Not started is `fg-subtle`, In progress is `fg-muted` with
the half-ring glyph, Solved and Mastered are `success`, told apart by shape.

**Never colour alone.** Every state carries a second signal: a word, a shape, an
icon, an `aria-` attribute. Roughly one reader in twelve cannot separate red
from green, and every one of them still has to read a verdict.

Contrast: 4.5:1 for text, 3:1 for borders and icons that carry meaning, in
**both** themes. `fg-subtle` is the floor. A card's `border` is held to 1.2:1
against `surface`, so a card stays a card in both themes: the fill barely
differs from the canvas (about 1.1:1), and the hairline is what draws the edge.

## 8. Screens

The shell and each screen, in the reference's terms. Components are built with
the screen that needs them (section 10).

**Shell.** A 64px icon rail on the left, a card of its own on the canvas: the
logo mark at the top, then Problems, Progress, Interview, and Settings pinned to
the bottom. Items are 40px squares with an 18px outline icon; the active one is
filled `accent` with a white icon, `rounded-lg`. Every item has a tooltip naming
it and its shortcut. The rail replaces the top navigation bar. To the right of
it, each page has a **header** on the canvas, not in a card: title (`text-xl`,
600), one muted line of real context beneath ("171 problems · 4 due for
review"), and on the right the search pill (`surface`, `rounded-full`, "Search"
plus a `Ctrl K` chip, opening the palette) and the solved counter.

**Problem list.** Two cards: filters (topic, difficulty, status, starred) in a
narrow card on the left, and the table in a wide card beside it, with its own
toolbar row (search field, a Segmented control for All / Due / Starred, the
count). Rows 36px, hairline dividers, status glyph first, numbers `tnum` and
right-aligned. The row under the pointer takes `surface-sunken`; the current row
has a 2px accent bar at its left edge.

**Workspace.** Three cards with 12px gutters: the statement (tabs across its top,
Description / Hints / Coach / Editorial / Notes / Submissions), the editor, and
the results panel under the editor. A toolbar row above the editor card: a
Segmented control for Python / Java, secondary buttons (Reset, Bookmark,
Interview mode), and on the right **Run** (secondary, `rounded-md`), **Submit**
(primary pill) and **AI Help** (primary-outline pill with the coach mark and a
`Ctrl Shift H` chip) - one filled pill per region. Monaco gets **its own theme**,
defined from the tokens with `monaco.editor.defineTheme`: background `surface`,
line numbers `fg-subtle`, selection `accent-subtle`, and keywords moved to a
violet (~hue 300) so the code never shares the accent's blue. The verdict line in
the results card leads with a verdict tile: a 20px `rounded-sm` square in the
verdict's subtle tint with its glyph, then the verdict in words.

**Coach tab.** The coach's words in Newsreader `text-md`, the rubric as small
pips, the user's messages in Inter. The recommendation sits in a Callout.

**Progress.** The one screen that is a dashboard, laid out like the reference's:

- A wide **Solved** card: the count as a `text-3xl` 700 numeral, a delta chip
  ("+3 this week"), a Segmented range control (1M / 3M / All), and a line chart
  of solves over time in the accent, with the permitted area fill. Beneath a
  divider, three sub-stats with icon tiles: Mastered, Due for review, Current streak.
- A **Coach brief** card beside it: the coach mark, a one-sentence serif headline
  ("You are strongest in hash maps; graphs have stalled for nine days."), a short
  list of the signals behind it, and a Callout with the suggested next problem
  and a primary pill to open it.
- A row of three cards: **Recent submissions** (verdict tile, problem, topic ·
  when, time right-aligned), **Review queue** (due items, same row pattern), and
  **Topics** (each topic's name, percentage, and a segmented bar of its problems:
  solved in accent, remaining in `border`; a topic behind its review schedule
  uses `warn` with the words "behind").

**Interview.** A header, then one card for the running sitting (stage as a
Segmented display, clock in `tnum`), the transcript in the coach's serif.

**Settings.** One column of cards, one per section, each with a title, a muted
line saying what the section is for, and label / control rows at a fixed control
column width, so inputs line up down the page.

## 9. Keyboard and focus

The app is usable without a mouse. Not "mostly" - the whole loop of open, read,
type, run, submit is reachable from the keyboard.

| Shortcut           | Does                    |
| ------------------ | ----------------------- |
| `Ctrl+K`           | Command palette         |
| `Ctrl+Enter`       | Run                     |
| `Ctrl+Shift+Enter` | Submit                  |
| `Ctrl+J`           | Toggle the bottom panel |
| `Ctrl+Shift+H`     | AI Help                 |
| `Ctrl+S`           | Save now (and format)   |
| `Shift+Alt+F`      | Format (Monaco's own)   |

`Ctrl+/` is Monaco's comment toggle and is never bound. Shortcuts are shown
where the control is: in its tooltip, and as a `Kbd` chip inside the pill for
the three that matter most (search, AI Help, Submit's tooltip).

Focus rules:

- The focus ring is never removed. `focus-ring` is the one implementation;
  `focus-ring-inset` exists for controls flush with a card edge. A field whose
  container shows focus instead (the palette's input) says so in a comment and
  gives the container `focus-within` the same ring.
- The ring must be visible against the accent fill it may sit beside: `focus` is
  lighter than `accent` in dark and darker in light, with a 2px offset.
- It is `:focus-visible`, so a mouse click does not ring the button.
- The rail is a `nav` landmark; its items are links in visual order.
- Focus order follows the visual order. If it does not, the markup is wrong.
- Anything that opens closes on Escape and returns focus where it came from.

## 10. Components are built with the screen that needs them

Primitives in `apps/web/src/ui/` today: `Button`, `Input`, `Tabs`, `Tooltip`.
This design adds, each when its first screen is built and promoted to `ui/` when
a second one needs it:

| Pattern           | First needed by | What it is                                                                                            |
| ----------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `Card`            | Shell           | `surface`, `border`, `shadow-card`, `rounded-xl`, a title slot and an action slot (the ↗ link button) |
| `Button` variants | Workspace       | `primary` becomes a pill; `secondary` stays `rounded-md`; new `primary-outline`                       |
| `Segmented`       | Workspace       | Radix Toggle Group in a `surface-sunken` tray, selected segment filled `accent`                       |
| `Kbd`             | Shell           | `rounded-xs` chip, `text-2xs`, `surface-sunken`, `fg-muted`                                           |
| `RailItem`        | Shell           | Icon link with tooltip, active state                                                                  |
| `Stat`            | Progress        | Numeral, label, optional delta chip                                                                   |
| `Callout`         | Coach, Progress | `accent-subtle` inset, `rounded-lg`, no border                                                        |
| `ListRow`         | Progress        | Icon or verdict tile, title, meta line, right-aligned value                                           |
| `SegmentBar`      | Progress        | A row of small segments, one per item, for topic progress                                             |
| `CoachMark`       | Coach           | 8px `accent` dot in a 2px `accent-subtle` ring - flat, no gradient                                    |

Icons are `lucide-react` (ISC licence): outline, 1.5px stroke, 16px in text and
18px in the rail. It is an icon set, not a component library; the CLAUDE.md rule
against component kits stands. Radix is for behaviour and never for looks.

## 11. Themes, density, motion

**Both themes are first-class.** Dark is designed (section 4), and every screen
is reviewed in both. `data-theme` on `<html>` overrides; its absence means follow
the OS.

**Minimum width is 1024px.** Below that the workspace stops being usable and we
say so rather than reflowing. At 1024 the rail stays, card gutters drop to 12px,
and the list's filter card collapses behind a Filters button.

**Motion** is 75ms, colour and opacity. Nothing slides, bounces, scales on press
or fades in on load. `prefers-reduced-motion` is respected globally in
`styles/base.css`.

## 12. Loading, empty and error; accessibility

Unchanged in substance from the first version:

- Every screen that waits on a query has all three states, each a sentence rather
  than a spinner. **Loading** is a skeleton in the shape of what is coming, inside
  the card that is coming, never pulsing and invisible for its first 150ms.
  **Empty** says why and offers the way out. **Error** says what failed and offers
  "Try again" (`ErrorState`).
- `styles/contrast.test.ts` measures the token pairs in both themes on every unit
  run, and gains the card-edge pair (section 7). `e2e/a11y.spec.ts` runs axe over
  every screen in both themes and fails on `serious` or `critical`. Monaco is
  excluded; nothing else is.
- Automated rules catch a minority of real barriers; the checklist below catches
  the rest.

## 13. Review checklist

- [ ] Uses semantic tokens, not ramp colours or raw hex.
- [ ] Reviewed in **both** themes; dark judged on its own terms.
- [ ] Reachable and operable by keyboard alone; focus order matches visual order.
- [ ] Focus ring present, not overridden, visible beside an accent fill.
- [ ] No state signalled by colour alone; blue only for action or location.
- [ ] Text contrast ≥ 4.5:1, meaningful borders and icons ≥ 3:1, both themes.
- [ ] Spacing on the 4px step; card, gutter and row spacing as section 6.
- [ ] Radius by size (section 6); nothing nested at the same radius as its parent.
- [ ] Shadows only `shadow-card` on cards (light only) and `shadow-overlay` on what floats.
- [ ] Every card answers one question; no KPI-tile grid, no card inside a card.
- [ ] No gradient except a chart's area fill; no emoji; one accent.
- [ ] Serif only for the coach's words.
- [ ] Loading, empty and error states exist - an empty list says why.
- [ ] Numbers read in columns use `tnum`.
- [ ] Any new component is needed by the screen being built, not by a future one.
- [ ] Behaviour worth keeping has an RTL test; a golden path has a Playwright one.
- [ ] `npm run test:e2e` still passes, axe included, in both themes.

---

If a screen looks like a generic dashboard template, it is wrong - whatever the
checklist says. The reference is a direction, not a template: every card here
exists because a user practising algorithms asked the question it answers.
