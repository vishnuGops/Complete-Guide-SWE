# ROADMAP — DevProMax

DevProMax is a local-first, LeetCode-style training environment for DSA interview prep in **Python** and **Java**, with an on-demand LLM coach (AI Help) that reviews the code written so far until the solution is interview-perfect.

**Where it stands:** release 1.0 shipped (M5, 2026-09-22) and the whole-codebase audit after it is closed (M5.1, 2026-09-24). Every completed task and milestone is in [docs/archive/ROADMAP-completed.md](docs/archive/ROADMAP-completed.md); code comments that cite a task ID (`ROADMAP P2-16`) resolve there.

Status legend: `Not started` · `In progress` · `Done` · `Blocked`

Rules:

- The open-task table (section 5) is **always sorted by the Priority column** (1 = do first). When adding a task, insert it at its priority and renumber below it.
- When a task changes state, update its Status cell in the same commit as the work. When it is **Done**, move its row to the end of the archive's task table in that same commit (drop the Priority and Status cells), so this file only ever lists what is left.
- Task IDs are never reused. The next free IDs per phase are listed under the table.

Revision history: [CHANGELOG.md](CHANGELOG.md), newest first.

---

## 1. Goals

| Goal | What "done" looks like |
| --- | --- |
| Full DSA coverage | Every topic in the 14-topic curriculum has Easy, Medium and Hard problems, ordered as a learning path. |
| LeetCode-grade workspace | Statement + examples + constraints, Monaco editor, Run (sample + custom tests) and Submit (hidden tests), verdicts with diffs, submission history, editorial, hints, notes, timer. |
| LLM coach, not an answer key | With a user-supplied API key (Anthropic or Gemini), an **AI Help** button gives constructive, rubric-based feedback and hints on the code written so far. The coach never dumps the full solution unless the problem is already solved and the user asks. |
| Visible progress | Scrollable problem list shows Not started / In progress / Solved / Mastered; filterable by topic, difficulty and status; a dashboard shows strengths and weak spots and exports a shareable skills report. |
| Not AI slop | A deliberate design system (tokens, one accent, dense tool-like layout, real keyboard support, dark/light) with a written set of principles that reviews are checked against. |
| Trustworthy | Unit, contract, integration (real Python/Java processes), component and end-to-end tests run in CI. Every problem's reference solutions must pass its own tests in both languages before it can merge. |

Out of scope for v1: accounts and cloud sync, multi-tenant hosting, languages beyond Python and Java, contests, discussion forums, acceptance rates and runtime percentiles (meaningless for one user), company tags, LSP-grade autocomplete, code formatting on save (shipped after v1 anyway as P9-5, optional and off by default).

---

## 2. Architecture decisions (with reasoning)

| # | Decision | Reasoning | Alternatives rejected |
| --- | --- | --- | --- |
| D1 | **Local-first single-user app.** `npm start` launches a server on localhost and opens the browser. Data lives in a local SQLite file. | No infra to run, works offline except LLM calls, the API key never leaves the machine, and the target user is one developer practising at their desk. | Hosted multi-user SaaS (auth, billing, abuse handling of a code runner — none of it needed for the stated goal). |
| D2 | **TypeScript end-to-end, three-workspace npm monorepo.** `apps/web` (React 19 + Vite + React Router), `apps/server` (Fastify; judge and problem loader live inside it as folders), `packages/shared` (types + zod schemas). | One toolchain, one test runner (Vitest), API types shared with the UI so the contract cannot drift, Node 24 already installed. Running Python/Java is a subprocess spawn whichever language the backend uses, so backend choice does not affect judge quality; Node's `child_process` gives streaming, timeouts and process-tree control. Problem content is data, so Python/Java contributors never need to touch the backend. Confirmed by owner 2026-09-16; collapsed from five workspaces to three in the audit to cut build-graph overhead. | Python FastAPI backend (second toolchain, two test runners, duplicated types). Electron (heavier, no benefit over a localhost tab). Separate `judge`/`problems` packages (extra manifests, no reuse yet). |
| D3 | **Harness-based judge running local subprocesses** (owner confirmed local-only, 2026-09-16). User submits a `Solution` class. A per-language harness deserialises JSON test inputs, invokes the solution, serialises the output, and the judge compares with a comparator. **All tests of a run execute in one process** with an in-harness per-test watchdog; after a timeout, a crash or a `System.exit`, the judge restarts the batch at the test after the failing one, so a run costs one process per failure plus one (P2-17, 2026-09-24; until then it re-ran every remaining test in a process of its own). A solution that never reports `ready` is one load failure for the whole run. | This machine has Python 3.14 and Java 25 but **no Docker**. LeetCode uses the same harness model, so problems feel familiar. One process per run keeps Submit under a second instead of paying JVM/interpreter startup per test. Limits (wall-clock timeout, output cap, Java `-Xmx`, process-tree kill) protect against accidents like infinite loops. Threat model is explicit: the user runs their own code on their own machine. Restarting after the failure rather than isolating everything after it keeps what isolation was for - the failing test cannot take innocent tests with it - without making every innocent test pay a JVM start: one early TLE among forty hidden tests used to cost thirty-nine, with no stall watchdog on any of them (2026-09-24 audit). | Docker sandbox *as the default* (unavailable on the first machine; now shipped as an opt-in executor behind the same interface, `DEVPROMAX_EXECUTOR=docker`, P9-2, 2026-09-22 - local stays the default because it needs nothing installed beyond the runtimes and is a second faster per Run). Per-test process launches (slow). stdin/stdout-only judging (parsing boilerplate, unlike interviews). |
| D4 | **Two test modes and three expectation modes.** Mode `function`: call one method with arguments. Mode `operations`: construct the class, then apply a sequence of `[method, args]` operations and collect every return value (design problems: LRU cache, MinStack, Trie, Union-Find, streams). Expectation `return`, `mutatedArgs` (in-place problems: rotate array, remove duplicates returning k, sort colours), or `both`. | Without these, all design-style problems and every in-place problem are unsupported; that is Batch E and a large part of Batches A–C. | Function-only harness. Per-problem bespoke harnesses. |
| D5 | **Java argument typing by reflection.** The Java harness inspects the declared parameter and return types of the target method and deserialises JSON accordingly from a fixed supported-type table (`int`, `long`, `double`, `boolean`, `char`, `String`, `int[]`, `int[][]`, `long[]`, `double[]`, `char[]`, `char[][]`, `String[]`, `List<Integer>`, `List<List<Integer>>`, `List<String>`, `ListNode`, `TreeNode`, `ListNode[]`). Python deserialises JSON natively with helper conversions for `ListNode`/`TreeNode`. | No codegen step and no duplicated signature metadata; the starter's signature is the source of truth. The table is documented so authors know what they can use. | Codegen of a call site from `meta.json`; a JSON type DSL. |
| D6 | **Custom checkers are TypeScript run in-process by the judge.** Comparators: `exact`, `unorderedList`, `unorderedListOfLists`, `floatTolerance(eps)`, `checker` (a `checker.ts` in the problem dir receiving input, expected and actual). | One implementation, no extra subprocess, unit-testable with Vitest. | Checkers in Python or Java (two implementations or language coupling). |
| D7 | **Problems are git-tracked directories, not database rows.** `problems/<topic>/<slug>/` holds `meta.json`, `statement.md`, `tests.json`, `hints.json`, `editorial.md`, `starter.py`, `starter.java`, `reference.py`, `reference.java`, optional `generator.py`, optional `checker.ts`, optional `assets/`. A validator CLI enforces the schema and runs both references through the judge. | Reviewable in PRs, diffable, authorable by hand or with LLM assistance, and CI can prove every problem is solvable in both languages. | Problems stored in SQLite (not reviewable, no CI guarantee). |
| D8 | **Original problem statements.** Classic problems are rewritten in our own words with our own examples and tests. | LeetCode statements are copyrighted; the underlying algorithms are not. | Copying statements verbatim. |
| D9 | **Authoring pipeline is mandatory infrastructure, built before the catalogue.** Scaffold CLI, a per-problem random-input `generator.py` that uses the reference solution as the oracle to produce hidden tests, the validator as the merge gate, and `docs/AUTHORING.md` with the prompt and checklist used when drafting problems with Claude Code. No runtime LLM dependency for authoring. | ~200 problems × (statement, ≥ 10 hidden tests, hints, editorial, four code files) is the largest cost in the plan; hand-writing hidden tests is the slowest and least reliable part. Generators also make property-style QA (P6-7) free. | Hand-authored tests; an LLM-calling authoring script (redundant with Claude Code plus the validator gate). |
| D10 | **Fine-grained difficulty rating** (1–10) in addition to the Easy/Medium/Hard tier. Easy 1–3, Medium 4–7, Hard 8–10. Default list sort = rating asc, then curriculum topic order. | "Start easy and progress" needs an order finer than three buckets. Rating also drives "next recommended problem". | Tier-only sorting (arbitrary order inside a tier). |
| D11 | **Four progress states** (owner confirmed 2026-09-16): Not started → In progress (**first Run or Submit**; saving a draft does not count) → Solved (Submit accepted) → Mastered (accepted **and** the coach's rubric passes). Status is tracked per language and rolled up as the best status. | The brief asks for "until they are perfect", which is stronger than "accepted". Counting drafts would mark problems In progress merely from browsing. | Binary done/not-done. Draft-triggered In progress. |
| D12 | **Provider-agnostic LLM adapter, bring-your-own key.** v1 providers: **Anthropic** (Messages API, structured output, streaming, prompt caching) and **Google Gemini** (Gemini API, JSON response schema, streaming). Transport per vendor, decided in P5-1: Anthropic through the official `@anthropic-ai/sdk`, Gemini through `fetch`. | Owner chose Anthropic and Gemini (2026-09-16). An adapter keeps prompts provider-neutral and lets tests mock the provider. The asymmetric transport is asymmetric on purpose: streaming structured output from Anthropic means SSE framing, delta variants, mid-stream errors and typed error classes, all of which the vendor already maintains, so hand-rolling it to avoid a dependency would buy a worse implementation; Gemini's streaming half is `data:` lines of JSON, which is genuinely all it is. Both take an injected `fetch`, so neither reaches the network in tests. 2026-09-24 (P5-11): the structured-output schema reaches Anthropic through the SDK's own `transformJSONSchema`, so the vendor's rules for what a schema may contain are the vendor's copy rather than a second copy of ours that goes stale - zod still validates every answer, including the limits the transform moves into descriptions; which models take adaptive thinking and `effort` is a capability map beside the price table (`anthropicCapabilities` in `packages/shared/src/cost.ts`), so the request and the estimate cannot disagree; and a 400 shows the vendor's own message, trimmed and with the key scrubbed, because only the vendor knows which part of a request it refused. | Hard-coding one vendor. OpenAI-compatible/Ollama deferred to stretch (P9-4). One transport for both, which would mean either hand-writing Anthropic's stream or adding a second SDK to read four fields off Gemini's. |
| D13 | **Coach is on-demand via an "AI Help" button, never auto-triggered.** It reviews the code written so far plus the latest judge results if any. A local pre-check runs first: if the editor equals the starter or contains no meaningful logic, no API call is made and the panel asks the user to write more. After an Accepted submit the UI nudges (non-blocking) to request a mastery check. **Coach receives:** statement, constraints, target complexity, editorial approach (flagged secret), the user's code, latest judge results, revealed hints, and a summary of prior attempts. **Coach returns** structured JSON: per-dimension scores, markdown feedback, next hint level, `mastered` flag. | Owner decision (2026-09-16): on-demand keeps cost under the user's control and lets the coach help mid-attempt. Structured output lets the UI render a rubric card and lets the status engine set Mastered deterministically. The pre-check avoids paying for empty prompts; the nudge stops Mastered from depending on the user remembering to click. | Auto-trigger on every Run/Submit (cost, noise). Free-form chat only (unparseable, cannot drive status). |
| D14 | **Persistence with `node:sqlite`, hand-written SQL, checked-in migrations.** DB at `data/devpromax.db`. Fallback to `better-sqlite3` only if `node:sqlite` proves unstable on Node 24. | Removes the only native module from the stack, which is the most common Windows install failure on new Node versions. Eight tables do not justify an ORM. | Drizzle + better-sqlite3 (native build risk, ORM overhead). |
| D15 | **Local server hardening.** Bind to `127.0.0.1` only; reject requests whose `Host` is not localhost (DNS-rebinding defence); require a custom header (`X-DevProMax-Client`) on every `/api` request so cross-origin calls fail CORS preflight; only `application/json` bodies accepted. | The server can execute arbitrary code; any browser tab on the machine could otherwise POST to `/api/run`. The `/api` rules apply to the route the router *matched* (with the decoded path as a fallback), never to the raw URL: `/%61pi/...` reaches the same handler as `/api/...`, and a check on the raw string is a check an attacker can spell around - the 2026-09-24 audit reset progress that way from a no-cors form (P3-8). Fastify's default `text/plain` parser is removed, so a simple-request content type cannot be turned into a body on any route, whatever the hook decides. | Trusting localhost implicitly. Checking `request.url` (what existed until P3-8). |
| D16 | **Hand-built design system on Radix primitives + Tailwind v4 tokens, components built just-in-time.** Second version (2026-09-22, P9-6), from a reference the owner chose: a pale cool-grey canvas with white rounded cards (hairline border, a faint lift in light, tonal steps in dark), a slim icon rail, one saturated royal-blue accent, Inter for UI, JetBrains Mono for code and Newsreader serif for the coach's words only, big tabular stat numerals on Progress. Kept from the first version: one accent, semantic tokens over OKLCH ramps, the 4px step, no gradients (except a chart's area fill), no emoji as UI, colour never alone, both themes first-class, 75ms colour-and-opacity motion. Principles live in `docs/DESIGN.md` and are part of code review. Shortcuts: `Ctrl+Enter` run, `Ctrl+Shift+Enter` submit, `Ctrl+J` toggle bottom panel, `Ctrl+Shift+H` AI Help (`Ctrl+/` is Monaco's comment toggle and is not used). | Slop comes from stock component kits and default palettes. Radix gives accessibility without imposing a look. The first version ruled out cards and shadows entirely; the owner preferred the calmer card-based look, so the rule became "no card that does not answer one question", and the functional rules (contrast, verdict hues, keyboard, offline fonts) carried over unchanged. The serif marks advice apart from interface. | shadcn/ui or MUI out of the box. A full component library before any product screen. A KPI-tile grid. Keeping the violet accent (it would clash less with Monaco, but the owner chose the reference's blue; the editor gets its own theme instead). |
| D17 | **Test pyramid is mandatory.** Vitest unit; problem contract tests; judge integration tests that spawn real `python`/`java`; React Testing Library component tests; Playwright E2E for golden paths; LLM adapter tests against recorded fixtures (no network in CI). CI: lint, unit and judge integration on `ubuntu-latest` + `windows-latest` per PR; E2E on Ubuntu per PR and on Windows nightly. | The judge is OS-sensitive (process killing, paths, encodings), so Windows must be in CI for it. Windows E2E on every PR is slow and adds little beyond the judge coverage. | Linux-only CI. Full matrix for everything. |
| D18 | **Legacy content archived to `temp/`**, untouched, kept until the app is built out (owner decision 2026-09-16). **Retired 2026-09-22 (P8-5)** on the owner's confirmation: the app is built out, and git history keeps every file (`git show 2c01d25:temp/...`). | The old files are stubs and a CodeSignal drill kit; nothing there feeds the new app, but the owner wants it kept as a reference during the build. | Deleting immediately. |
| D19 | **The API key rests in plaintext in the local SQLite file, with the environment variable as the override.** Recommended by the 2026-09-17 audit; stands unless the owner objects. | The machine is single-user and local (D1) and the key already has to be decryptable by this process without a prompt, so encrypting it with a key stored beside it is theatre. An OS keychain (DPAPI, Keychain, libsecret) needs a native module, which D14 removed from the stack for install-failure reasons. The real exposures are elsewhere and are closed by tasks: the judge child environment (P2-11), logs (redaction is tested), responses (`apiKeyMasked` is structural), exports (P7-5 must never read the settings table). Document the file's location and permissions in ARCHITECTURE. | `keytar`/DPAPI (native module). AES with a local key file (no threat it defends against). |
| D20 | **A coaching conversation is one feedback context plus the follow-ups after it, and chat turns are under the same cap and cost accounting as feedback.** Recommended by the 2026-09-17 audit. | Replaying every stored context makes the eighth follow-up carry eight statements, eight editorials and eight code snapshots, none cacheable, and today none of it is capped. One context per window keeps chat a cheap prose exchange about the review just given; a new AI Help click starts a new window. 2026-09-24 (P5-13): the window's last history turn carries a cache breakpoint - never the new message, which is the part that changes - so a follow-up rereads the review it asks about from the cache instead of paying for it again; and follow-ups get their own uncached instruction block (prose, no JSON, no scores) instead of the rubric prompt's "return JSON" (P5-12). | Unbounded history (what exists). A token-budgeted sliding window over everything (still replays contexts, and needs a tokeniser). |
| D21 | **A stated constraint is a tested constraint.** Every problem's generator reaches the maximum size the statement gives, and every problem whose target complexity beats the obvious approach carries at least one hidden test that the obvious approach cannot finish within the time limit. The validator warns when the largest hidden input is under half of a stated bound. Recommended by the 2026-09-17 audit. | Three seed problems say 10^5 and test 1000, so the quadratic solution the editorial says will time out passes, and Solved stops meaning what the statement claims. The coach quotes the constraints when explaining complexity, so the claim has to be true. | Constraints as aspiration (what exists). Dropping stated maxima altogether (removes the reason to think about complexity). |
| D22 | **Integers on the wire are bounded to the safe-integer range (\|n\| ≤ 2^53 − 1)** in inputs and expected outputs; the validator rejects a test value outside it. Recommended by the 2026-09-17 audit. | The judge parses results with `JSON.parse`, so two different 64-bit answers that round to the same double compare equal, and Java's reader throws on a Node-stringified 2^63. No planned problem needs full 64-bit answers; sums to 10^18 can be phrased modulo 10^9+7, as interview problems usually are. | A bigint-aware JSON path end to end (harness, protocol, zod, comparators, UI) for problems that do not exist. |
| D23 | **Problem validation is incremental on pull requests and full on `main` and nightly.** A PR validates the problems it changed, unless the judge, a harness or a checker changed, in which case everything. Recommended by the 2026-09-17 audit. | 1.7 s per problem × 200 × two OSes is twelve machine-minutes per push for content that did not change. `main` and the nightly lane keep the whole-catalogue guarantee D7 promises. | Full validation everywhere (slow). Validation only on `main` (a broken problem merges first). |
| D24 | **In production one Fastify process on one port serves both the built UI and the API.** `npm start` sets `NODE_ENV=production`, serves `apps/web/dist` with an SPA fallback, and shuts down on `SIGINT`/`SIGTERM`. Recommended by the 2026-09-17 audit. | Today `npm start` runs the API alone and nothing serves the UI. One origin means no CORS, the Host allow-list covers page loads too, and the client header stays an `/api` rule. | A second static server on another port (CORS, two processes to stop). Vite preview in production (dev tooling in the start path). |
| D25 | **A manual override can raise a status to Solved at most; Mastered is only ever set by the coach.** Recommended by the 2026-09-17 audit, implemented by P5-10: the override clamps rather than refuses, so the highest status that is the user's to claim is still granted. D11's wording is superseded here. | "I solved this on paper" is a real claim the user is entitled to make. "The coach passed this" is not something the user can assert, and an override to Mastered today unlocks the editorial and the `solution` rung with no submission behind it, which is the one thing D13 exists to prevent. | Override to any state (what exists). No override at all (punishes solving elsewhere). |

---

## 3. Repository layout

```
.
├── apps/
│   ├── server/                  Fastify API, judge, coach; one process in production (D24)
│   │   ├── scripts/             build helpers (copy-assets.mjs)
│   │   └── src/
│   │       ├── index.ts         buildServer() and the dev entry; start.ts is the production entry
│   │       ├── config.ts        paths, ports, environment
│   │       ├── api/             HTTP: errors, hardening (D15), static web serving
│   │       │   ├── routes/      one file per resource, plus their inject tests
│   │       │   └── services/    what the routes call: runs, coach, dashboard, settings, catalogue …
│   │       ├── judge/           executors (python, java, docker), harness sources, comparators, queue
│   │       ├── coach/           provider adapters (Anthropic, Gemini, OpenAI-compatible), prompts, context
│   │       ├── db/              node:sqlite, migrations/, repos/, backup
│   │       ├── problems/        loader, validator, generator runner, scaffold
│   │       ├── toolchain/       doctor (runtime checks) and the optional formatters
│   │       └── cli/             every npm-script entry point: db, doctor, problems/{validate,gen,new,emit-schema}
│   └── web/                     React 19 + Vite + Monaco
│       ├── e2e/                 Playwright specs
│       ├── scripts/             lighthouse, screenshots, flake budget
│       └── src/
│           ├── app/             shell, routing, theme, command palette, welcome
│           ├── screens/         one folder per screen: problems, workspace, progress, interview, settings
│           ├── ui/              Radix-based primitives (see /dev/kitchen-sink)
│           ├── api/             typed client, TanStack Query hooks, coach stream
│           ├── editor/          Monaco setup, models, theme
│           ├── markdown/        sanitised statement renderer
│           ├── shortcuts/       the shortcut table and provider
│           ├── styles/          tokens.css, base.css, index.css
│           └── lib/             small shared helpers
├── packages/
│   └── shared/                  zod schemas + types shared by web and server
├── problems/                    content: problems/<topic>/<slug>/
├── docs/                        architecture, problem format, authoring, design, coach prompts; archive/
├── data/                        runtime SQLite and judge workspaces (gitignored)
├── ROADMAP.md                   this file
└── CLAUDE.md                    working agreement for AI-assisted development
```

---

## 4. Curriculum

Fourteen topics in learning-path order — Foundation: Arrays → HashMap → Sorting → Binary Search · Linear: Linked List → Stack → Matrix · Non-linear: Binary Tree → Heap → Graph · Techniques: Backtracking → Dynamic Programming → Bit Manipulation · Advanced: Data Structures (Trie, Segment Tree, Fenwick, Union-Find, LRU/LFU).

The catalogue is 171 problems. [docs/CURRICULUM.md](docs/CURRICULUM.md) lists them topic by topic, with the patterns each teaches and the problems that were cut and why.

---

## 5. Open tasks

| Priority | ID | Phase | Task | Execution plan | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | P7-10 | P7 | Difficulty calibration | The tiers and ratings shipped by P6-1 … P6-6 are estimates made while authoring; nobody has solved these problems under a clock. P7-6 records time-to-solve on the submission, which is the missing input. Once there is a run of solved-with-timer submissions, compare median time-to-solve against the stated tier and rating, flag the problems whose ratings sit more than a tier away from their times, and correct `meta.json` with a version bump (P7-9 then tells anyone who solved the old version). Do not calibrate off a single solver, and do not let the clock override a rating the editorial justifies - a problem can be quick to type and hard to see. | Not started |
| 2 | P9-3 | P9 | More languages | C++, JavaScript/TypeScript, Go via new harnesses; content gets references per language incrementally. 2026-09-22: **deferred by the owner** until the existing app is solid; do not start without asking. When it resumes, the proposal on the table is JavaScript first (Node is already on both machines, so no new toolchain), a problem offering a language only once it has a reference in it, and Arrays as the pilot topic. | Blocked |

Phases: **P0** Foundations · **P1** Problem format · **P2** Judge + authoring pipeline · **P3** API + persistence · **P4** Web UI · **P5** LLM coach · **P6** Catalogue scale-up · **P7** Learning features · **P8** Hardening & release · **P9** Stretch

Next free IDs: P0-9 · P1-4 · P2-20 · P3-11 · P4-19 · P5-14 · P6-9 · P7-12 · P8-10 · P9-8

---

## 6. Milestones

M0 through M5.1 are reached; their exit criteria are in the [archive](docs/archive/ROADMAP-completed.md#milestones). No milestone is open. The next one is named when P9-3 resumes or new work is planned.

---

## 7. Revision history

Moved to [CHANGELOG.md](CHANGELOG.md) on 2026-09-18 (P8-4), newest first. Add an entry there in the same commit as the work, under its date, keyed by the task it closes.
