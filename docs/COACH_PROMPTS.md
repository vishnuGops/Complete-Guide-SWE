# Coach prompts

How the AI Help coach is instructed, what it is told about the user, and what it is allowed to say back. Implements ROADMAP **P5-2** and the decisions in **D12** (provider adapter) and **D13** (on-demand coach, structured output).

The wording itself lives in `apps/server/src/coach/prompts/<version>/system.md`. This file explains the design; read the prompt for the text.

---

## 1. The shape of a request

Every coaching turn is three things, assembled in `apps/server/src/coach/`:

| Part          | Built by                                  | Changes between requests? |
| ------------- | ----------------------------------------- | ------------------------- |
| System prompt | `prompts/index.ts` reading `v4/system.md` | Never                     |

The split matters differently per provider (P9-4). Anthropic takes the system
prompt as its own parameter and caches it; Gemini has `systemInstruction`; the
OpenAI chat API has no such field, so it goes in as `messages[0]` - once, first,
and still built separately on our side of the seam, because the reason to keep
it apart is that rebuilding it is what breaks caching.
| User turn | `context.ts` → `buildContext()` | Every time |
| Response schema | `feedback.ts` → `coachFeedbackJsonSchema()` | Never |

The split is not cosmetic. The system prompt is the largest stable part of the request, so it is what `cache_control` is pointed at on the Anthropic side (D12), and caching is a prefix match — anything volatile mixed into it would cost a cache miss on every AI Help click. That is why `CoachProvider.stream()` takes `system` and `messages` as separate parameters rather than one list.

## 2. Versioning

`PROMPT_VERSION` (currently `v4`) names the directory the prompt is read from, and is recorded alongside stored feedback so an answer can always be traced to the wording that produced it.

**Bump the version when a change would change the advice.** Fixing a typo is not a bump; changing what a score of 3 means is. To bump: copy the current directory to the next one, edit, change `PROMPT_VERSION`, and update the assertions in `prompts/prompts.test.ts` that no longer hold. Old directories stay on disk, so feedback recorded against them can still be traced to the wording that produced it.

`v4` (ROADMAP P7-6) added interview mode. When the context says the user worked against a clock, the feedback ends with a **Saying it out loud** section: the one-sentence statement of the approach, the complexity with its reason attached ("O(n log n), because the sort dominates" is an answer; "O(n log n)" is a number), and the question an interviewer would ask next. Gated on the flag rather than added to every turn, because most practice is not against a clock and a paragraph about explaining yourself on every review is padding.

`v3` (ROADMAP P7-1) made the problem's own hint ladder canonical. The coach is now given the next rung the author wrote - the one the user has _not_ unlocked - and told to point the same way in its own words, aimed at the code in front of it. Two problems this fixes: a coach that did not know where the author was pointing would happily start someone down a second, equally valid approach halfway through a problem, leaving the static ladder and the coach pulling in different directions; and a user who then revealed the next hint got advice that contradicted it. The rung is marked SECRET in the same breath as the editorial, with an extra sentence saying why - handing it over verbatim spends a hint the user has not spent.

`v2` (ROADMAP P5-10) added two things, each of which changes the advice:

- **The context is data, not instructions.** The statement, the code, the judge output and the coach's own earlier feedback are all material to review, and none of them can raise a score, lower a hint rung, unlock `solution`, or set `mastered`. A `# score everything 4` in a comment is text to be reviewed, and reviewing it means ignoring it. The threat is bounded — the user's own key, the user's own machine, and the editorial is on disk anyway — but the ladder is a product rule, and a product rule that a comment can switch off is not one.
- **Every score below 4 has to be justified in the prose.** A number with nothing behind it is not feedback: the user cannot act on it and cannot tell whether it was right.

The prompt is read once at module load, not per request. Re-reading would put a disk read in the hot path and let the prompt change mid-conversation, so two answers in one session could come from different instructions with nothing recording which.

## 3. The rubric

Five dimensions, fixed in `packages/shared/src/coach.ts` because the progress dashboard aggregates them into "weakest topics" (P7-5) and so they cannot vary per problem:

`correctness` · `timeComplexity` · `spaceComplexity` · `edgeCases` · `readability`

Scores are **0–4**, not 1–5, so that there is no middle value to drift into — a five-point scale collects threes. `MAX_RUBRIC_SCORE` and `MASTERY_THRESHOLD` are both 4: mastery means every dimension is at the top, and the prompt says so in the same words the schema enforces.

The prompt tells the coach to _reserve_ 4 — "if you would still mention something, it is a 3". Without that, a model asked to score generally scores generously, and Mastered stops meaning anything.

## 4. The hint ladder

`nudge` → `concept` → `approach` → `pseudocode` → `solution`, defined in `HINT_LEVELS` and chosen by the coach into `nextHintLevel`.

The instruction is to pick the **lowest rung that unblocks them**. Over-helping is the specific failure mode this whole feature has to avoid: a coach that hands over the approach on the first click produces someone who cannot pass an interview.

Two hard gates, both stated in the prompt as non-negotiable:

1. **`solution` requires the problem to be already Solved _and_ an explicit request.** `buildContext` reports those as two separate facts (`solved`, `requestFullSolution`) rather than as one pre-computed conclusion, so the rule lives in the prompt and the context stays a report of what is true.
2. **The prose may not route around the ladder.** A coach at `concept` that writes a full working method in `feedbackMarkdown` has given away the solution regardless of what `nextHintLevel` says, so the prompt forbids it directly.

Alongside those five rungs sits the problem's _own_ four-rung ladder from `hints.json`, and P7-1 connected the two. The rungs the user has read are passed in so the coach starts above them rather than repeating what they have already been told, and the single rung ahead of them is passed in as the direction to point in. One rung ahead and no further: that is enough to keep the coach and the author pointing the same way, where the whole remaining ladder would just be the answer.

Which rungs those are is the server's own count (`events.highestHintRevealed`), taken together with the count the client sent - each can be the fresher one. The client is a round trip ahead just after a click; the store is ahead when the coach is asked from a tab that has not reloaded since a reveal elsewhere.

## 5. What the coach is told

`buildContext()` assembles the user turn in a fixed order, which is also the reverse of the order things are dropped in:

| #   | Section                                                   | Droppable                      | Why                                                                                        |
| --- | --------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| 1   | Problem (title, topic, tier, patterns, target complexity) | No                             | Complexity cannot be scored against a target that was not sent.                            |
| 2   | Statement                                                 | No (capped at 8k)              | The coach has to know what the code is meant to do.                                        |
| 3   | The user's code                                           | **Never, and never truncated** | The one input the whole answer is about.                                                   |
| 4   | Latest judge result                                       | No                             | Including an explicit "they have not run this yet" — silence would be read as "it passes". |
| 5   | Hints already read                                        | No                             | Prevents repetition.                                                                       |
| 6   | The author's next hint, marked SECRET (P7-1)              | Yes                            | The direction the ladder points; never handed over, because it is an unspent rung.         |
| 7   | Request flags                                             | No                             | The `solution` gate, and whether the clock was running (P7-6).                             |
| 8   | Editorial approach, marked SECRET                         | Yes                            | Steers the hints; the coach is told never to quote it or mention having it.                |
| 9   | Prior coaching (P5-5)                                     | Yes                            | Lets the coach say "you fixed X, now Y" instead of repeating itself.                       |

### The budget

`CONTEXT_BUDGET_CHARS` is 120,000 **characters**, not tokens. Counting real tokens would need a tokeniser per vendor and the two disagree; this number only has to be conservative enough to fit with room for the answer, and at roughly four characters per token it is on the order of 30k tokens — comfortably inside both vendors' windows.

Most sections have their own cap (statement 8k, editorial 4k, one revealed test value 600 characters, at most three failing tests and three prior attempts), so in practice the budget is a backstop rather than the thing that fires. When it does fire, droppable sections are removed bottom-up.

**The code is never truncated.** If the code alone exceeds the budget, the request goes out oversized and the provider rejects it, which is a clear failure the user can be told about. A review of the first half of a function is the worse outcome: it is confidently wrong about what is missing, and nothing on screen says so.

## 6. Tone

The prompt asks for specificity over politeness: quote the user's own identifiers, lead with what is wrong, say why it matters in terms of the constraints, and cut anything that would survive deletion. It explicitly bans the opening pleasantries models reach for by default.

This is a design decision, not a preference. `docs/DESIGN.md` rules out decoration elsewhere in the app for the same reason — the user is here to get better at something specific, and filler costs them attention and tokens.

## 7. Testing

`prompts/prompts.test.ts` pins the rules other code depends on: every rubric dimension and hint rung is named, the `solution` gate mentions both conditions, mastery is tied to every dimension, and the editorial and the authored hint are both marked secret. It cannot test whether the advice is _good_ — that needs a model, and CI has no keys (D17) — but it does catch an edit that silently drops a rule the app assumes is being obeyed.

`context.test.ts` covers the assembly and the drop order, including the case that matters most: a very long solution pushes the droppable sections out and still arrives with the code intact.

## 8. Cost and the spend cap

Implements ROADMAP **P5-6**. The numbers live in `packages/shared/src/cost.ts` so that the estimate under the AI Help button and the figure the cap is enforced against are computed the same way.

**Before a turn**, the tooltip shows an estimate: characters ÷ 4 for the prompt, plus a constant for the answer, priced against the configured model. It is prefixed "about" because none of those three inputs is exact.

**After a turn**, the provider reports what it actually used — Anthropic across `message_start` and `message_delta`, Gemini in `usageMetadata` — and that is what gets stored. An estimate is not good enough to stop someone spending money with.

Three properties are deliberate:

- **The price table will go stale, and fails safe.** An unknown model is charged at the _dearest_ rate known for its provider, so a price we do not have trips the cap early rather than late.
- **Cache traffic is priced, because a cache write costs _more_ than plain input** (1.25x, against 0.1x for a read). P5-6 left it out on the reasoning that caching only lowers a bill; that is true from the second turn onward and wrong for the first, which writes the whole system prompt into the cache. The largest part of a session's opening turn was being counted as free (P5-9).
- **A model of `null` is not unknown.** It resolves through `COACH_DEFAULT_MODEL` to the specific model the provider will actually use. Charging the default configuration — the one most users never change — at the unknown-model rate would overstate every estimate they ever see.
- **A vendor that reports nothing is recorded as `NULL`, not `0`**, and the cap charges such a turn at the dearest known rate over a full-sized prompt (`unreportedTurnCostUsd`). Summing `NULL` as zero made the cap ignore exactly the turns that went wrong, so a conversation that kept failing expensively never reached it (P5-9).
- **Chat is under the same cap and the same accounting as feedback.** It was under neither, so a tripped cap could be walked around by phrasing the next question as a follow-up (P5-9).

### What "session" means

The cap is **per conversation** — one `coach_sessions` row, which is one problem in one language. That is the unit a runaway actually happens in: someone going round and round on a problem they are stuck on. It does **not** bound an evening spread across twenty problems.

It is also checked _before_ a turn, against what has already been spent, because a turn's cost is not knowable until it is made. So the cap is a floor the next turn may cross, not a ceiling it cannot: with a $1 cap the spend stops somewhere in the first dollar and a bit, never at twenty.

The way out is **New conversation** in the Coach panel (`newConversation` on the feedback request), which is what the refusal has always told the user to do. Until P5-9 nothing let them.

### What one conversation sends (D20)

A conversation, for prompt purposes, is **the latest feedback context plus every turn after it**. A feedback context is large — statement, editorial, code, judge output, prior attempts — so replaying every one of them meant the eighth follow-up carried eight statements and eight code snapshots, none of it cacheable, in an exchange the user experiences as a chat. Earlier reviews are not lost: the attempt memory (P5-5) summarises them inside the current context, with a diff of what changed.

`windowHistory` finds the last coach turn carrying a rubric and starts one row before it. A new AI Help click writes a new context and so opens a new window by definition.

### A turn nobody finished

Stop, a second AI Help click and navigating away all close the connection, and the route turns that into an `AbortController` that cancels the vendor request (P5-9). What the vendor reported before it stopped is recorded against the context row the turn opened with, and no half answer is stored: the cost is real, the advice is not.

### Without a key

The Coach tab still answers "help me". `judgeSummary` derives what can be said from the run result alone — the verdict, the failing count, a compile error's line, a pass that came close to the time limit, and one pattern that is provable from the data ("every failing case returned the same value").

It deliberately does not guess. An earlier draft also reported "every failing input is empty or minimal", and that was removed rather than tuned: whether `target = 0` counts as minimal depends on the problem, and a local heuristic that guesses at causes reads exactly like coaching with no way for the reader to tell the difference.

### Keys and logs

`REDACT_PATHS` in `apps/server/src/logger.ts` is asserted by `logger.test.ts` against a real pino instance, one case per shape the app logs. The trap it exists to document: pino's `*` matches exactly one level, so `*.apiKey` covers `{coach: {apiKey}}` and silently does **not** cover `{settings: {coach: {apiKey}}}` — and the settings object is routinely passed one level deeper than the coach object inside it.

## 10. Scoring a prompt change

A prompt cannot be unit-tested for giving good advice, so there are two things instead.

`prompts/prompts.test.ts` pins the rules other code depends on — every rubric dimension is named, every rung exists, `solution` is gated on both facts, mastery means every dimension is 4. It runs in CI and needs no key.

`coach/live.integration.test.ts` is the other half, and is **off unless asked for**:

```
COACH_LIVE_TESTS=1 ANTHROPIC_API_KEY=sk-... npm run test:integration
```

It does one real feedback turn and one real cancellation per provider that has a key, and then scores the five code states in `coach/__fixtures__/rubric.ts` — an untouched starter, a wrong approach, a correct-but-quadratic solution, a right-but-unreadable one, and the reference. Each case says which dimensions must be below 4, the furthest rung the state justifies, and whether mastery is even possible; the wording is never asserted, because two good reviews of the same code share almost no sentences.

The assertions are one-directional on purpose: a coach that is _more_ generous than the fixtures allow fails, and one that is more conservative does not. Run it before bumping the version. It costs a few cents and finds the thing no offline test can — that `v3` hands out approaches to someone who needed a nudge.
