# Design

The rules this app's interface is built and reviewed against (ROADMAP D16,
P0-8). `ROADMAP.md` section 2 says what was decided; this says what it means in
front of a screen.

It is a working document with teeth: section 12 is a checklist, and a screen
that fails it does not merge. Where it is silent, decide in the spirit of
section 1 and then write down what you decided.

---

## 1. What we are making

A tool for one developer practising algorithms at their desk, used for hours at
a time, mostly by keyboard, often beside a terminal and an editor.

That single sentence decides most arguments:

- **Dense beats airy.** The problem list shows two hundred rows and the
  workspace shows a statement, an editor and a results panel at once. Whitespace
  that would be generous on a marketing page is a scrolled-away row here.
- **Quiet beats expressive.** The interesting thing on screen is always the
  user's code or the judge's answer. Chrome that competes with it is a bug.
- **Fast beats animated.** Transitions exist to show that something moved, not
  to be enjoyed. 75ms, colour and opacity only.
- **Legible beats clever.** Someone reading a failing test at midnight needs
  contrast, tabular figures and a diff they can scan — not a layout they have to
  learn first.

## 2. What "not AI slop" means here

The phrase in the ROADMAP is a real constraint, so it gets a concrete list. None
of the following appears in this app:

| Not this                                    | Because                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A grid of cards with drop shadows           | The signature of every generated dashboard. Related things go in a table or a list.                   |
| Hero sections, centred marketing copy       | Nobody is being sold anything. The app opens on the work.                                             |
| Gradients, glassmorphism, glow              | Decoration with no meaning, and it fights the code editor for attention.                              |
| Emoji as UI (🚀 in a button, ✅ for a pass) | Renders differently on every platform, reads as unserious, and carries no semantics.                  |
| More than one accent colour                 | Two accents mean neither one signals anything.                                                        |
| Stock component-kit defaults                | Tailwind's default blue and shadcn's default card are the look everyone recognises as "AI made this". |
| Confetti, celebratory toasts, streak flames | Solving a Hard problem is its own reward; the status flips to Solved and that is the reward.          |
| Icon-only buttons with no tooltip or label  | A row of unlabelled glyphs is a memory test.                                                          |

The positive version: **this should look like it was made by someone who uses
it.** Borders and headings do the separating; type weight and colour do the
ranking; nothing is there that does not answer a question the user is asking.

## 3. Tokens

Defined in `apps/web/src/styles/tokens.css`, visible in both themes at
`/dev/kitchen-sink` (dev only).

Two layers, and the split is the rule that matters:

- **Ramps** (`neutral-*`, `accent-*`, `success-*`, `warn-*`, `danger-*`) are
  fixed. `neutral-700` is the same colour in both themes.
- **Semantic tokens** (`bg`, `surface`, `fg`, `border`, `accent`, `success`, …)
  are what components use, and the only thing the theme swaps.

> A component that writes `bg-neutral-100` has hard-coded the light theme. Use
> the semantic name. If none fits, add one — do not reach past them into a ramp.

Colours are OKLCH so that equal steps in the ramp look equal.

### The accent

One accent, indigo-violet. The choice is functional rather than a taste: green,
amber and red are spoken for by verdicts, and an accent sharing a hue with a
verdict turns every status dot into a guess. Indigo sits furthest from all three.

The accent means **"this is the action"** or **"this is where you are"**:
primary buttons, the active tab's bar, focus rings, the current row. It is never
decoration.

## 4. Type

Inter for the interface, JetBrains Mono for anything the user could paste into an
editor. Both self-hosted — the app works offline apart from the coach, and a font
from a CDN is a font that does not arrive on a plane.

| Token       | Size | Used for                                     |
| ----------- | ---- | -------------------------------------------- |
| `text-2xs`  | 11px | Dense metadata, keyboard hints. Never prose. |
| `text-xs`   | 12px | Labels, table metadata, captions             |
| `text-sm`   | 13px | Dense UI: buttons, tabs, table cells         |
| `text-base` | 14px | Body text, problem statements                |
| `text-md`   | 16px | Lead paragraphs, the statement's first line  |
| `text-lg`   | 18px | Panel titles                                 |
| `text-xl`   | 22px | Page titles                                  |
| `text-2xl`  | 28px | The largest thing in the app                 |

`base` is 14px because this is a tool, not an article: at 16px a third of the
problem list and half the editor go off screen. Nothing below 12px carries
meaning a user must read to work.

Weights: 400 for text, 500 for controls and emphasis, 600 for headings. Never
700 — at these sizes it smears.

Numbers that sit in columns and are read by comparison — timings, test counts,
ratings — get the `tnum` utility. Proportional digits jump as they update.

## 5. Space, shape, elevation

**8-pt grid.** The Tailwind step is 4px, so even steps (`p-2` = 8px) land on the
grid. Odd steps are a deliberate half-step for dense insets, not a free hand.

In hand-written CSS — `markdown.css` is the only place there is any — a spacing
step is `calc(var(--spacing) * 3)`, never `var(--spacing-3)`. Tailwind v4 has one
`--spacing` variable and multiplies it inside each utility; there is no
`--spacing-3` to reference, so the shorter spelling resolves to nothing, the
declaration is dropped, and the result looks exactly like forgetting to write it.
It cost every margin in the problem statement once.

**Radii** stop at 8px (`rounded-lg`), and almost everything is `rounded-md`
(5px). Rounder reads as a card, and cards read as a dashboard.

**One shadow**, `shadow-overlay`, and only for things that float above the page:
tooltips, menus, dialogs. Panels, rows and inputs are separated by a border.
If you are reaching for a shadow to group things, use a border or a heading.

## 6. Colour carries meaning, and never alone

Three semantic hues, each meaning exactly one thing:

| Hue       | Means                          | Verdicts   |
| --------- | ------------------------------ | ---------- |
| `success` | The judge accepted it          | AC         |
| `warn`    | It ran, but outside its budget | TLE, MLE   |
| `danger`  | It failed                      | WA, RE, CE |

Progress statuses: Not started is `fg-subtle`, In progress is `accent`, Solved
and Mastered are `success` — distinguished from each other by shape, not shade.

**Never colour alone.** Every state carries a second signal: a word, a shape, an
icon, an `aria-` attribute. `Input` sets `aria-invalid` as well as the red
border for exactly this reason. Roughly one reader in twelve cannot separate the
red from the green, and every one of them still has to read a verdict.

Contrast: 4.5:1 for text, 3:1 for borders and icons that carry meaning, in
**both** themes. `fg-subtle` is the floor, and it is for text that repeats
something already on screen.

## 7. Components are built with the screen that needs them

Four primitives exist today: `Button`, `Input`, `Tabs`, `Tooltip`. All four are
needed by every P4 screen and none can be written well without Radix or the
tokens.

Everything else — tables, panels, the verdict banner, the diff view — is built
with the screen that needs it. A component library written ahead of the product
is a set of guesses, and the guesses get bent to fit rather than fixed.

When a second screen needs something the first one built, promote it to
`src/ui/` then, with both uses in front of you.

Radix is for behaviour and never for looks: keyboard handling, focus management,
ARIA wiring. No other component library is added to this project (CLAUDE.md).

## 8. Keyboard and focus

The app is usable without a mouse. Not "mostly" — the whole loop of open, read,
type, run, submit is reachable from the keyboard.

| Shortcut           | Does                    |
| ------------------ | ----------------------- |
| `Ctrl+Enter`       | Run                     |
| `Ctrl+Shift+Enter` | Submit                  |
| `Ctrl+J`           | Toggle the bottom panel |
| `Ctrl+Shift+H`     | AI Help                 |
| `Ctrl+S`           | Save now (and format)   |
| `Shift+Alt+F`      | Format (Monaco's own)   |

`Ctrl+/` is Monaco's comment toggle and is never bound. Shortcuts are shown in
the tooltip of the control they trigger, so they are discoverable without a
cheatsheet.

Focus rules:

- The focus ring is never removed. The `focus-ring` utility is the one
  implementation; `focus-ring-inset` exists for controls flush with a panel edge.
- It is `:focus-visible`, so a mouse click does not ring the button.
- Focus order follows the visual order. If it does not, the markup is wrong —
  do not patch it with `tabIndex`.
- Anything that opens (tooltip, menu, dialog) closes on Escape and returns focus
  where it came from.

## 9. Themes, density, motion

**Both themes are first-class.** Dark is not a filter over light: every screen is
reviewed in both. `data-theme` on `<html>` overrides; its absence means follow
the OS, which is why `applyTheme('system')` removes the attribute instead of
writing a resolved value.

**Minimum width is 1024px.** Below that the workspace stops being usable and we
say so rather than reflowing into a phone layout nobody will practise on. The
shell hides the app and shows that sentence under `max-[1023px]`, in CSS: no
resize listener, no state, and nothing to be wrong on the first paint. Whichever
half is hidden is `display: none`, so it is out of the accessibility tree too —
a notice with the whole app still tabbable behind it would be worse than none.

**Motion** is 75ms, colour and opacity. Nothing slides, bounces or fades in on
load. `prefers-reduced-motion` is respected globally in `styles/base.css`.

## 10. Loading, empty and error

Every screen that waits on a query has all three, and each one is a sentence
rather than a spinner.

**Loading** is a skeleton in the shape of what is coming — rows where the rows
will be — built from the `Skeleton` primitive and wrapped in `Loading`, which
adds the one thing a screen reader needs (`role="status"`, "Loading problems")
and hides the blocks themselves. Two rules, both written down in the `skeleton`
utility in `tokens.css`: it never pulses, and it stays invisible for its first
150ms. On a local server most queries answer before it ever appears, which is
the intended outcome — a flash of grey where content should have been is worse
than a beat of nothing.

**Empty** says why it is empty and, where there is one, offers the way out: a
filtered list that matched nothing gets a "Clear all filters" button, and a
catalogue with no problems in it names the command that would find them. "No
results" on its own is a dead end.

**Error** says what failed, what the server said, and offers "Try again"
(`ErrorState`). The retry earns its place here specifically: the usual cause is
the local server restarting under a file watcher, which fixes itself in the time
it takes to read the message.

## 11. Accessibility, checked twice

The checklist below is read by a person. Two things are also machine-checked,
because they are the two that rot quietly:

- `styles/contrast.test.ts` measures the token pairs out of `tokens.css`, in
  both themes, on every unit-test run.
- `e2e/a11y.spec.ts` runs axe over all four screens in both themes in a real
  browser, and fails on any `serious` or `critical` finding. It is a real
  browser because computed contrast, visibility and layout do not exist in
  jsdom. Monaco is excluded — its internals are not ours to fix — and nothing
  else is.

Automated rules catch a minority of real barriers. They have never caught a
confusing label or a focus order that jumps across the screen; that is what the
checklist is for.

## 12. Review checklist

Every UI change is checked against this list. It is short so it actually gets
used.

- [ ] Uses semantic tokens, not ramp colours or raw hex.
- [ ] Reviewed in **both** themes.
- [ ] Reachable and operable by keyboard alone; focus order matches visual order.
- [ ] Focus ring present and not overridden.
- [ ] No state signalled by colour alone.
- [ ] Text contrast ≥ 4.5:1, meaningful borders and icons ≥ 3:1, both themes.
- [ ] Spacing on the 8-pt grid; radius `rounded-md` unless there is a reason.
- [ ] No shadow except on something that floats.
- [ ] Nothing from the section 2 list: no card grid, no hero, no gradient, no
      emoji in chrome, no second accent.
- [ ] Loading, empty and error states exist — an empty list says why it is empty
      (section 10).
- [ ] Numbers read in columns use `tnum`.
- [ ] Any new component is needed by the screen being built, not by a future one.
- [ ] Behaviour worth keeping has an RTL test; a golden path has a Playwright one.
- [ ] `npm run test:e2e` still passes, axe included, in both themes.

---

If a screen looks like a generic dashboard template, it is wrong — whatever the
checklist says.
