# Coach prompts

How the AI Help coach is instructed, what it is told about the user, and what it is allowed to say back. Implements ROADMAP **P5-2** and the decisions in **D12** (provider adapter) and **D13** (on-demand coach, structured output).

The wording itself lives in `apps/server/src/coach/prompts/<version>/system.md`. This file explains the design; read the prompt for the text.

---

## 1. The shape of a request

Every coaching turn is built from these, assembled in `apps/server/src/coach/`:

| Part                          | Built by                                                         | Changes between requests? |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------- |
| System prompt                 | `prompts/index.ts` reading `v4/system.md`                        | Never                     |
| Follow-up block (chat only)   | `prompts/index.ts` reading `followup/system.md`                  | Never                     |
| User turn                     | `context.ts` → `buildContext()`                                  | Every time                |
| Response schema (review only) | `feedback.ts` → `coachFeedbackJsonSchema()`, narrowed per vendor | Never                     |

The split matters differently per provider (P9-4). Anthropic takes the system
prompt as its own parameter and caches it; Gemini has `systemInstruction`; the
OpenAI chat API has no such field, so it goes in as `messages[0]` - once, first,
and still built separately on our side of the seam, because the reason to keep
it apart is that rebuilding it is what breaks caching. The follow-up block is a
second system block on Anthropic, a second `systemInstruction` part on Gemini,
and joined onto the one system message for OpenAI-compatible servers, many of
which accept exactly one.

The split is not cosmetic. The system prompt is the largest stable part of the request, so it is what `cache_control` is pointed at on the Anthropic side (D12), and caching is a prefix match — anything volatile mixed into it would cost a cache miss on every AI Help click. That is why `CoachProvider.stream()` takes `system` and `messages` as separate parameters rather than one list.

## 2. Versioning

`PROMPT_VERSION` (currently `v4`) names the directory the prompt is read from, and is recorded alongside stored feedback so an answer can always be traced to the wording that produced it.

**Bump the version when a change would change the advice.** Fixing a typo is not a bump; changing what a score of 3 means is. To bump: copy the current directory to the next one, edit, change `PROMPT_VERSION`, and update the assertions in `prompts/prompts.test.ts` that no longer hold. Old directories stay on disk, so feedback recorded against them can still be traced to the wording that produced it.

The **follow-up block** (`prompts/followup/system.md`, ROADMAP P5-12) is deliberately outside that scheme, like the interviewer. A chat turn used to be sent the rubric prompt alone, which ends "return JSON matching the required schema" - to a turn that sends no schema - and the model had to guess which half of its instructions to break; sometimes it answered a one-line question with a scored JSON document. The block says the turn answers in plain Markdown, scores nothing, and that the ladder and both halves of the solution gate still hold. It is its own uncached block rather than a line in `system.md` because `system.md` is the cached prefix of every review and this is not part of those, and it is unversioned because nothing it produces is stored with a score. It narrows the format and leaves every rule `PROMPT_VERSION` tracks where it was, so `v4` is still `v4`.

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

**The server holds the gate too** (ROADMAP P5-12). A model that follows its prompt will never set `solution` past the gate, but "will never" is a claim about a model, and this is the one product rule the ladder exists for. So `gateHintLevel` in `coachService.ts` clamps `nextHintLevel` to `pseudocode` unless the problem is solved _and_ the request asked for the full solution, before the answer is stored or sent. The prose already streamed cannot be unsaid; what the panel and the history record as the rung given can be.

Which rungs those are is the server's own count (`events.highestHintRevealed`), taken together with the count the client sent - each can be the fresher one. The client is a round trip ahead just after a click; the store is ahead when the coach is asked from a tab that has not reloaded since a reveal elsewhere.

## 5. What the coach is told

`buildContext()` assembles the user turn in a fixed order, which is also the reverse of the order things are dropped in:

| #   | Section                                                   | Droppable                      | Why                                                                                                   |
| --- | --------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1   | Problem (title, topic, tier, patterns, target complexity) | No                             | Complexity cannot be scored against a target that was not sent.                                       |
| 2   | Statement                                                 | No (capped at 8k)              | The coach has to know what the code is meant to do.                                                   |
| 3   | The user's code                                           | **Never, and never truncated** | The one input the whole answer is about.                                                              |
| 4   | Latest judge result                                       | No                             | Including an explicit "they have not run this yet" — silence would be read as "it passes". See below. |
| 5   | Hints already read                                        | No                             | Prevents repetition.                                                                                  |
| 6   | The author's next hint, marked SECRET (P7-1)              | Yes                            | The direction the ladder points; never handed over, because it is an unspent rung.                    |
| 7   | Request flags                                             | No                             | The `solution` gate, and whether the clock was running (P7-6).                                        |
| 8   | Editorial approach, marked SECRET                         | Yes                            | Steers the hints; the coach is told never to quote it or mention having it.                           |
| 9   | Prior coaching (P5-5)                                     | Yes                            | Lets the coach say "you fixed X, now Y" instead of repeating itself.                                  |

### The judge result

The section existed from P5-2 and nothing filled it until P5-12, so every review opened with "they have not run this code yet" — including the one straight after eleven failing tests, and the mastery check after an Accepted. It now comes from the **latest stored submission** for the problem and language, because a Run is not persisted and a submission is the one verdict the server keeps. Only the totals survive in the store, and the context says so, so the coach does not reason about failing tests it has not been shown.

It is offered only as evidence about the code it came from. When the editor holds something else (compared ignoring trailing whitespace), the context says the latest submission was of different code and that this version has not been judged: an old WA is not evidence about the fix that followed it, and presenting it as this code's result would have the coach hunting a bug that is gone.

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

**Before a turn**, the tooltip shows an estimate: characters ÷ 4 for the prompt, plus a constant for the answer (`ESTIMATED_OUTPUT_TOKENS`, 900) and, on a model that thinks, a constant for the thinking (`ESTIMATED_THINKING_TOKENS`, 3,000), priced against the configured model. It is prefixed "about" because none of those inputs is exact. The thinking allowance is P5-13's: thinking is billed as output, never appears in the answer, and on a rubric review at medium effort it is the larger half of the turn — the estimate without it was a quarter of what the first real bill said. Whether a model thinks is `modelThinks` in `cost.ts`, which reads the same capability map the Anthropic adapter dispatches on (below), so the estimate and the request cannot disagree about it.

**After a turn**, the provider reports what it actually used — Anthropic across `message_start` and `message_delta`, Gemini in `usageMetadata` — and that is what gets stored. An estimate is not good enough to stop someone spending money with.

These properties are deliberate:

- **The price table will go stale, and fails safe.** An unknown model is charged at the _dearest_ rate known for its provider, so a price we do not have trips the cap early rather than late.
- **Cache traffic is priced, because a cache write costs _more_ than plain input** (1.25x, against 0.1x for a read). P5-6 left it out on the reasoning that caching only lowers a bill; that is true from the second turn onward and wrong for the first, which writes the whole system prompt into the cache. The largest part of a session's opening turn was being counted as free (P5-9).
- **A model of `null` is not unknown.** It resolves through `COACH_DEFAULT_MODEL` to the specific model the provider will actually use. Charging the default configuration — the one most users never change — at the unknown-model rate would overstate every estimate they ever see.
- **A vendor that reports nothing is recorded as `NULL`, not `0`**, and the cap charges such a turn at the dearest known rate over a full-sized prompt (`unreportedTurnCostUsd`). Summing `NULL` as zero made the cap ignore exactly the turns that went wrong, so a conversation that kept failing expensively never reached it (P5-9).
- **Chat is under the same cap and the same accounting as feedback.** It was under neither, so a tripped cap could be walked around by phrasing the next question as a follow-up (P5-9).
- **A price the table carries as more than two numbers.** Cache reads are a tenth of input for every model except `claude-opus-5-5`, whose reads are a twentieth ($0.20 against $4); `ModelPrice.cacheReadPerMTok` overrides the multiplier for it. Before P5-11 that model was not in the table at all and was charged at Fable's rate, double the real one.
- **Gemini's thinking is output.** 2.5-series models report it as `thoughtsTokenCount`, separately from the answer, and bill it at the output rate. Only the answer was being counted (P5-13).

### What "session" means

The cap is **per conversation** — one `coach_sessions` row, which is one problem in one language. That is the unit a runaway actually happens in: someone going round and round on a problem they are stuck on. It does **not** bound an evening spread across twenty problems.

It is also checked _before_ a turn, against what has already been spent, because a turn's cost is not knowable until it is made. So the cap is a floor the next turn may cross, not a ceiling it cannot: with a $1 cap the spend stops somewhere in the first dollar and a bit, never at twenty.

The way out is **New conversation** in the Coach panel (`newConversation` on the feedback request), which is what the refusal has always told the user to do. Until P5-9 nothing let them.

### What one conversation sends (D20)

A conversation, for prompt purposes, is **the latest feedback context plus every turn after it**. A feedback context is large — statement, editorial, code, judge output, prior attempts — so replaying every one of them meant the eighth follow-up carried eight statements and eight code snapshots, none of it cacheable, in an exchange the user experiences as a chat. Earlier reviews are not lost: the attempt memory (P5-5) summarises them inside the current context, with a diff of what changed.

`windowHistory` finds the last coach turn carrying a rubric and starts one row before it. A new AI Help click writes a new context and so opens a new window by definition.

### A turn nobody finished

Stop, a second AI Help click and navigating away all close the connection, and the route turns that into an `AbortController` that cancels the vendor request (P5-9). What the vendor reported before it stopped is recorded against the context row the turn opened with, and no half answer is stored: the cost is real, the advice is not.

Anthropic reports the final output count only in `message_delta`, at the end; the figure on `message_start` is a placeholder of about one token. So a turn stopped after a minute of thinking used to be recorded as having written one token. When the final count never arrives, the adapter now charges what it saw streamed (text and thinking, at four characters a token) plus, on a model that thinks, the thinking allowance — what it was most likely doing when it stopped (P5-13). Pessimistic on purpose, for the same reason the unreported turn is.

### What a follow-up resends, and what it caches

A follow-up resends its whole window (D20) every turn, and until P5-13 only the system prompt was cached, so the review being discussed was paid for at the full input rate on every question about it. `streamCoachTurn` now marks the **last turn of history** as a cache breakpoint — never the new message, which is the one part guaranteed to differ next time (an interview's carries the clock, and what is stored of it is only what was typed). One breakpoint in the history, one on the system prompt: two of the four Anthropic allows. Vendors without explicit caching ignore the mark.

Prose turns — follow-ups and the interviewer — also ask for `effort: 'low'` where a review asks for `'medium'`. Scoring five dimensions is reasoning; "why is that O(n)?" is a paragraph about reasoning already done, and medium-effort thinking was most of what a chat turn cost.

### Without a key

The Coach tab still answers "help me". `judgeSummary` derives what can be said from the run result alone — the verdict, the failing count, a compile error's line, a pass that came close to the time limit, and one pattern that is provable from the data ("every failing case returned the same value").

It deliberately does not guess. An earlier draft also reported "every failing input is empty or minimal", and that was removed rather than tuned: whether `target = 0` counts as minimal depends on the problem, and a local heuristic that guesses at causes reads exactly like coaching with no way for the reader to tell the difference.

### What Anthropic is actually sent (P5-11)

Written after the first audit against the real API rather than recorded fixtures, which only ever proved the request was the one we built — not that the vendor would take it.

- **The schema in the vendor's dialect.** zod's JSON Schema carries `$schema`, `minLength`/`maxLength`, `minimum`/`maximum`, `default` and no `additionalProperties: false`; structured outputs refuse every one, so every AI Help click would have been a 400. `toAnthropicSchema` runs it through the SDK's own `transformJSONSchema` (`@anthropic-ai/sdk/lib/transform-json-schema`), which closes every object and moves each constraint it drops into the field's description, where the model still reads it. The SDK's copy of the vendor's rules rather than ours, because ours would be out of date the first time they change. The transform is conservative: it also demotes a string `enum` to description text, so `nextHintLevel`'s rungs are guidance to the model rather than a hard constraint — the prompt names them, and the answer is parsed against the real zod schema either way, so an off-list rung fails as "an unexpected shape" rather than being stored. Gemini narrows the unmodified schema its own way (`toGeminiSchema`), and the OpenAI-compatible path is unchanged.
- **A capability map, not one request for every model.** `anthropicCapabilities` in `packages/shared/src/cost.ts` reads the model id: Opus and Sonnet 4.6 and everything since take adaptive thinking and `effort`, and only those; Haiku 4.5 and older refuse both with a 400, so they are asked without thinking, without effort, and with an 8k `max_tokens` (the older ones cap output below 32k). An id it cannot read is treated as not thinking — a request without thinking is accepted by every model, and one with it is refused by every model that predates it.
- **Errors that say what to do.** A 404 on the messages endpoint is the model, not the key ("has no model called X"). A 400 now carries the vendor's own explanation, trimmed to 300 characters and with the key scrubbed out of it — the one status where only the vendor knows what was wrong. An `error` event mid-stream (status line already sent as 200) is mapped by its `type`: `overloaded_error`, `rate_limit_error`, `api_error` and `timeout_error` are retryable, where they used to be "failed unexpectedly" with no retry offered. `stop_reason: "refusal"` is final and says the key is fine; `model_context_window_exceeded` says to start a new conversation.
- **An idle watchdog, and one retry.** The SDK's `timeout` covers the wait for headers only, and a streaming response sends those at once, so nothing ended a stream that went silent without closing. The adapter wraps `fetch` and re-arms a 90-second timer on every chunk of _bytes_ — not events, because the SDK drops `ping` before our loop sees it, and a long think is a stretch of pings. Retries are 1 rather than the SDK's 2: each is a whole new turn, billed from the start.
- **One place that knows where the vendor lives.** `providerOptionsFor` in `settingsService.ts` feeds both "Test connection" and every turn. The stored base URL applies only to a provider whose address is a setting (`needsBaseUrl`, i.e. OpenAI-compatible); before, the test sent it to any provider (an Anthropic key went to a leftover `127.0.0.1:11434`) and the turns sent it to none (an endpoint that passed the test was never used).

### Keys and logs

`REDACT_PATHS` in `apps/server/src/logger.ts` is asserted by `logger.test.ts` against a real pino instance, one case per shape the app logs. The trap it exists to document: pino's `*` matches exactly one level, so `*.apiKey` covers `{coach: {apiKey}}` and silently does **not** cover `{settings: {coach: {apiKey}}}` — and the settings object is routinely passed one level deeper than the coach object inside it.

## 9. Scoring a prompt change

A prompt cannot be unit-tested for giving good advice, so there are two things instead.

`prompts/prompts.test.ts` pins the rules other code depends on — every rubric dimension is named, every rung exists, `solution` is gated on both facts, mastery means every dimension is 4. It runs in CI and needs no key.

`coach/live.integration.test.ts` is the other half, and is **off unless asked for**. How to run it, in two passes and with what it costs, is `docs/API_KEY_TESTING.md` Step 1.

It does one real feedback turn, one real cancellation, one follow-up sent the way `streamChat` sends it (two system blocks, a cached history turn, no schema - it must come back as prose) and one interviewer turn per provider that has a key, plus one review on Haiku 4.5 when there is an Anthropic key (the model the capability map exists for), and then scores the five code states in `coach/__fixtures__/rubric.ts` — an untouched starter, a wrong approach, a correct-but-quadratic solution, a right-but-unreadable one, and the reference. Each case says which dimensions must be below 4, the furthest rung the state justifies, and whether mastery is even possible; the wording is never asserted, because two good reviews of the same code share almost no sentences.

The assertions are one-directional on purpose: a coach that is _more_ generous than the fixtures allow fails, and one that is more conservative does not. Run it before bumping the version. It costs a few cents and finds the thing no offline test can — that a new version hands out approaches to someone who needed a nudge.

## 10. The interviewer

The mock interview (ROADMAP P9-1) drives the same provider seam with a different system prompt, `prompts/interviewer/system.md`. It is deliberately **unversioned**: nothing is stored against it, nothing is scored by it, and there is no history of answers to trace back to a wording. `PROMPT_VERSION` exists so a number in the database can be explained; a conversation that leaves no number behind needs no number.

It is a different job, not a different tone. The coach reviews finished work and is told to be useful; the interviewer sits opposite someone mid-problem and is told, in the first line, that it is not the coach. Three rules carry the feature:

- **The approach before the code.** It asks what the candidate would do and pushes back on it. This is the part practice normally leaves out, and it is the whole reason the screen exists.
- **The complexity with the reason attached.** The same bar `v4` sets for the coach's _Saying it out loud_ section: `"O(n log n)"` is a number, `"O(n log n) because the sort dominates the single pass after it"` is an answer, and the first form is not accepted.
- **No answers.** It probes, it does not hand over. A mock interview that helps is not a measurement of anything.

The debrief is one turn like any other, streamed and then stored on the interview row. It is told that a debrief saying everything went well is worth nothing - an honest one is the only part of the sitting with any value afterwards.

The context-is-data rule from `v2` applies here too, and for the same reason: the statement, the candidate's own code and their drafts all arrive as material, and none of them can talk the interviewer into giving the answer.

The stage is described to it in **its own words** (`INTERVIEWER_STAGE_NOTE`, P5-12), not in the sentence on the candidate's screen: `STAGE_PROMPT.approach` ends "the interviewer will push back", and an interviewer handed the candidate's instructions is being asked to play both parts.

**Its conversation is its own** (P5-12, migration 007). An interview's turns live in `coach_messages` like any other conversation — one cap, one ledger, one history window — but `coach_sessions.kind` now says `'interview'`, and the AI Help button's "latest conversation" only ever finds `'coach'` ones. Before, the next AI Help click on the interview's first problem continued the interview: the interviewer's exchange went to the coach as history and the review was charged against the interview's spend. A follow-up cannot be sent into an interview session either.

**The transcript is read back from it.** `GET /api/interview` carries `transcript`, oldest first: the candidate's stored words (not the stage-and-clock preamble sent with them) as `you`, the interviewer's replies as `them`, blank turns skipped, and the debrief exchange left out because the debrief is its own field and its own section on the screen.

What the interviewer is told about the sitting is assembled in `interviewService.ts` and goes **with the message rather than into history** - the stage, the clock, what has been submitted, the current statement and the drafts are all true _now_, and a stale copy three turns back would have it asking about a stage the candidate has left.
