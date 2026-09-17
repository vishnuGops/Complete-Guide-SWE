# ROADMAP — DevProMax

DevProMax is a local-first, LeetCode-style training environment for DSA interview prep in **Python** and **Java**, with an on-demand LLM coach (AI Help) that reviews the code written so far until the solution is interview-perfect.

Status legend: `Not started` · `In progress` · `Done` · `Blocked`

Rule: the task table is **always sorted by the Priority column** (1 = do first). When adding a task, insert it at its priority and renumber below it. When a task changes state, update its Status cell in the same commit as the work.

---

## 1. Goals

| Goal | What "done" looks like |
| --- | --- |
| Full DSA coverage | Every topic in the 14-topic curriculum has Easy, Medium and Hard problems, ordered as a learning path. |
| LeetCode-grade workspace | Statement + examples + constraints, Monaco editor, Run (sample + custom tests) and Submit (hidden tests), verdicts with diffs, submission history, editorial, hints, notes, timer. |
| LLM coach, not an answer key | With a user-supplied API key (Anthropic or Gemini), an **AI Help** button gives constructive, rubric-based feedback and hints on the code written so far. The coach never dumps the full solution unless the problem is already solved and the user asks. |
| Visible progress | Scrollable problem list shows Not started / In progress / Solved / Mastered; filterable by topic, difficulty and status; a dashboard shows strengths and weak spots. |
| Not AI slop | A deliberate design system (tokens, one accent, dense tool-like layout, real keyboard support, dark/light) with a written set of principles that reviews are checked against. |
| Trustworthy | Unit, contract, integration (real Python/Java processes), component and end-to-end tests run in CI on Windows and Linux. Every problem's reference solutions must pass its own tests in both languages before it can merge. |

Out of scope for v1: accounts and cloud sync, multi-tenant hosting, languages beyond Python and Java, contests, discussion forums.

---

## 2. Architecture decisions (with reasoning)

| # | Decision | Reasoning | Alternatives rejected |
| --- | --- | --- | --- |
| D1 | **Local-first single-user app.** `npm start` launches a server on localhost and opens the browser. Data lives in a local SQLite file. | No infra to run, works offline except LLM calls, the API key never leaves the machine, and the target user is one developer practising at their desk. | Hosted multi-user SaaS (auth, billing, abuse handling of a code runner — none of it needed for the stated goal). |
| D2 | **TypeScript end-to-end, npm workspaces monorepo.** `apps/web` (React 19 + Vite), `apps/server` (Fastify), `packages/shared` (types + zod schemas), `packages/judge`, `packages/problems`. | One toolchain, one test runner (Vitest), API types shared with the UI so the contract cannot drift, Node 24 already installed. Running Python/Java is a subprocess spawn whichever language the backend uses, so backend choice does not affect judge quality; Node's `child_process` gives streaming, timeouts and process-tree control. Problem content is data, so Python/Java contributors never need to touch the backend. Confirmed by owner 2026-09-16. | Python FastAPI backend (second toolchain, two test runners, duplicated types). Electron (heavier, no benefit over a localhost tab). |
| D3 | **Harness-based judge running local subprocesses** (owner confirmed local-only for now, 2026-09-16). User submits a `Solution` class. A per-language harness deserialises JSON test inputs, calls the method, serialises the output, and the judge compares with a comparator (exact / unordered / float tolerance / custom checker). | This machine has Python 3.14 and Java 25 but **no Docker**. LeetCode uses the same harness model, so problems feel familiar. Limits (wall-clock timeout, output cap, Java `-Xmx`, process-tree kill) protect against accidents like infinite loops. Threat model is explicit: the user runs their own code on their own machine. | Docker sandbox (unavailable here; kept as a pluggable executor for later). stdin/stdout-only judging (forces users to write parsing boilerplate, unlike interviews). |
| D4 | **Problems are git-tracked directories, not database rows.** `problems/<topic>/<slug>/` holds `meta.json`, `statement.md`, `tests.json`, `starter.py`, `starter.java`, `reference.py`, `reference.java`, `hints.json`, `editorial.md`. A validator CLI enforces the schema and runs both references through the judge. | Reviewable in PRs, diffable, authorable by hand or with LLM assistance, and CI can prove every problem is solvable in both languages. | Problems stored in SQLite (not reviewable, no CI guarantee). |
| D5 | **Original problem statements.** Classic problems are rewritten in our own words with our own examples and tests. | LeetCode statements are copyrighted; the underlying algorithms are not. | Copying statements verbatim. |
| D6 | **Fine-grained difficulty rating** (1–10) in addition to the Easy/Medium/Hard tier. Easy 1–3, Medium 4–7, Hard 8–10. Default list sort = rating asc, then curriculum topic order. | "Start easy and progress" needs an order finer than three buckets. Rating also drives "next recommended problem". | Tier-only sorting (arbitrary order inside a tier). |
| D7 | **Four progress states** (owner confirmed 2026-09-16)**:** Not started → In progress (any run, or a saved draft) → Solved (Submit accepted) → Mastered (accepted **and** the coach's rubric passes: target complexity met, edge cases handled, clean idiomatic code). Status is tracked per language and rolled up. | The brief asks for "until they are perfect", which is stronger than "accepted". Mastered is the explicit signal; the three requested filters map onto Not started / In progress / (Solved + Mastered). | Binary done/not-done. |
| D8 | **Provider-agnostic LLM adapter, bring-your-own key.** v1 providers: **Anthropic** (Messages API, structured output, streaming, prompt caching) and **Google Gemini** (Gemini API, JSON response schema, streaming). | Owner chose Anthropic and Gemini (2026-09-16). An adapter keeps prompts provider-neutral and lets tests mock the provider. | Hard-coding one vendor. OpenAI-compatible/Ollama deferred to stretch (P9-5). |
| D9 | **Coach is on-demand via an "AI Help" button, never auto-triggered.** It reviews the code written so far plus the latest judge results if any. A local pre-check runs first: if the editor equals the starter or contains no meaningful logic, no API call is made and the panel asks the user to write more. **Coach receives:** statement, constraints, target complexity, editorial approach (flagged secret), the user's code, latest judge results, revealed hints, and a summary of prior attempts. **Coach returns** structured JSON: per-dimension scores, markdown feedback, next hint level, `mastered` flag. | Owner decision (2026-09-16): on-demand keeps cost under the user's control and lets the coach help mid-attempt, not only after a run. Structured output lets the UI render a rubric card and lets the status engine set Mastered deterministically. The pre-check avoids paying for empty prompts. | Auto-trigger on every Run/Submit (cost, noise). Free-form chat only (unparseable, cannot drive status). |
| D10 | **Hand-built design system on Radix primitives + Tailwind v4 tokens.** Inter for UI, JetBrains Mono for code. One accent colour, neutral greys, 8-pt spacing, no gradients, no hero sections, no emoji as UI, no shadowed card grids. Principles live in `docs/DESIGN.md` and are part of code review. | Slop comes from stock component kits and default palettes. Radix gives accessibility (focus, ARIA, keyboard) without imposing a look. | shadcn/ui or MUI out of the box (instantly recognisable generic look). |
| D11 | **Test pyramid is mandatory, not aspirational.** Vitest unit; problem contract tests; judge integration tests that spawn real `python`/`java`; React Testing Library component tests; Playwright E2E for the golden path; LLM adapter tests against recorded fixtures (no network in CI). CI matrix: `ubuntu-latest` + `windows-latest`. | The brief asks for "well established tests". The judge is OS-sensitive (process killing, paths), so Windows must be in CI. | Linux-only CI. |
| D12 | **Legacy content archived to `temp/`**, untouched, kept until the app is built out (owner decision 2026-09-16). | The old files are stubs and a CodeSignal drill kit; nothing there feeds the new app, but the owner wants it kept as a reference during the build. | Deleting immediately. |

---

## 3. Planned repository layout

```
.
├── apps/
│   ├── web/                 React + Vite + Monaco; Playwright E2E lives here
│   └── server/              Fastify API, SQLite (Drizzle), judge orchestration, LLM coach
├── packages/
│   ├── shared/              Domain types + zod schemas shared by web and server
│   ├── judge/               Executors (python, java), harnesses, comparators, limits
│   └── problems/            Loader, validator CLI, problem JSON schema
├── problems/                Content: problems/<topic>/<slug>/...
├── docs/                    ARCHITECTURE.md, PROBLEM_FORMAT.md, DESIGN.md, CURRICULUM.md, COACH_PROMPTS.md
├── data/                    Runtime SQLite (`devpromax.db`) + judge workspaces (gitignored)
├── temp/                    Archived legacy content (see D12)
├── ROADMAP.md               This file
└── CLAUDE.md                Working agreement for AI-assisted development
```

---

## 4. Curriculum (14 topics, learning-path order)

Foundation: Arrays → HashMap → Sorting → Binary Search · Linear: Linked List → Stack → Matrix · Non-linear: Binary Tree → Heap → Graph · Techniques: Backtracking → Dynamic Programming → Bit Manipulation · Advanced: Data Structures (Trie, Segment Tree, Fenwick, Union-Find, LRU/LFU)

Target catalogue for v1: **~200 problems** (roughly 14 per topic: 5 Easy, 6 Medium, 3 Hard). Vertical slice first (20 problems), then scale in batches.

---

## 5. Task table

Phases: **P0** Foundations · **P1** Problem content model · **P2** Judge · **P3** API + persistence · **P4** Web UI · **P5** LLM coach · **P6** Catalogue scale-up · **P7** Learning features · **P8** Hardening & release · **P9** Stretch

| Priority | ID | Phase | Task | Execution plan | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | P0-1 | P0 | Archive legacy content | `git mv` `DSA/`, `Interview Asssessment/`, `.github/` and the old `README.md` into `temp/` so history is preserved. Do not edit anything inside `temp/`. | Done |
| 2 | P0-2 | P0 | Write ROADMAP.md and CLAUDE.md | Capture goals, architecture decisions with reasoning, repo layout, curriculum, and this task table. CLAUDE.md records conventions, commands and the working agreement. | Done |
| 3 | P0-3 | P0 | Resolve open questions with the owner | Answered 2026-09-16: app name **DevProMax**; providers Anthropic + Gemini; local subprocess judge; TypeScript backend; Mastered accepted; ~200 problems for v1; coach on-demand via "AI Help" button; `temp/` kept until the app is built out. Decisions D2, D3, D7, D8, D9, D12 updated. | Done |
| 4 | P0-4 | P0 | Scaffold monorepo and tooling | npm workspaces; `apps/web`, `apps/server`, `packages/shared`, `packages/judge`, `packages/problems`. TypeScript strict, ESLint (typescript-eslint, react-hooks, jsx-a11y), Prettier, Vitest root config, Playwright in `apps/web`, `.editorconfig`, `.nvmrc`, expanded `.gitignore` (`data/`, `node_modules/`, build outputs). Root scripts: `dev`, `start`, `build`, `test`, `test:e2e`, `lint`, `typecheck`, `problems:validate`. | Not started |
| 5 | P0-5 | P0 | CI pipeline | GitHub Actions workflow with matrix `ubuntu-latest` + `windows-latest`; `actions/setup-node` 24, `setup-python` 3.12+, `setup-java` 21+. Jobs: lint + typecheck → unit → problem contract → judge integration → E2E smoke. Cache npm. Required status checks on `main`. | Not started |
| 6 | P0-6 | P0 | Shared domain model | In `packages/shared`: zod schemas + inferred types for `Problem`, `ProblemMeta`, `TestCase`, `Comparator`, `Language`, `RunRequest`, `RunResult`, `Verdict` (AC/WA/TLE/RE/CE/MLE), `Submission`, `ProgressStatus`, `CoachFeedback`, `Settings`. Unit tests for schema edge cases. | Not started |
| 7 | P0-7 | P0 | Design system foundation | `docs/DESIGN.md` principles (see D10). Tailwind v4 theme tokens: colour scales (neutral + one accent + semantic success/warn/danger), type scale, spacing, radii, elevation, focus ring. Light/dark via `data-theme`. Base components on Radix: Button, IconButton, Input, Select, Tabs, Dialog, Tooltip, Badge, Kbd, ResizablePanel/SplitPane, Toast. A `/dev/kitchen-sink` route rendering all states for visual review. Component tests for keyboard behaviour. | Not started |
| 8 | P1-1 | P1 | Problem package specification | Write `docs/PROBLEM_FORMAT.md` and a JSON schema. `meta.json`: id, slug, title, topic, patterns[], tier, rating (1–10), order, functionName, signature per language, comparator, limits, related[]. `statement.md`: objective, input/output, constraints, 2–3 worked examples. `tests.json`: `samples[]` (visible) and `hidden[]`, each `{input: {...args}, expected}`. `hints.json`: ordered ladder. `editorial.md`: approach, complexity, pitfalls. Starter and reference files per language. | Not started |
| 9 | P1-2 | P1 | Typed I/O and comparators | Define the JSON wire format for: primitives, strings, arrays, nested arrays, matrices, `ListNode` (array form), `TreeNode` (level-order with nulls), graphs (edge lists / adjacency). Comparators: `exact`, `unorderedList`, `unorderedListOfLists`, `floatTolerance(eps)`, `anyValid` (custom checker script per problem). Serialisers implemented identically in the Python and Java harness libraries; cross-language round-trip tests. | Not started |
| 10 | P1-3 | P1 | Problem loader and validator CLI | `packages/problems`: load all problem dirs, parse and validate against schema, detect duplicate slugs/ids, ensure both languages present, compile starters, run both references through the judge and require all tests pass. `npm run problems:validate [slug]` with clear, file-pointed errors. Runs in CI as the problem contract job. | Not started |
| 11 | P1-4 | P1 | Seed vertical-slice catalogue (20 problems) | Author 20 original problems across Arrays, HashMap, Sorting, Binary Search, Stack (Easy + Medium) covering two pointers, sliding window, prefix sum, frequency map, monotonic stack, boundary binary search. Each with tests (≥ 3 samples, ≥ 10 hidden incl. edge cases), hints, editorial, both starters and references. All pass the validator. | Not started |
| 12 | P1-5 | P1 | Problem authoring workflow | `npm run problems:new <topic> <slug>` scaffolds a package. Optional LLM-assisted draft script (statement, tests, editorial) that still requires human review. Authoring checklist in `docs/PROBLEM_FORMAT.md`: originality, constraint realism, edge cases (empty, single, max size, duplicates, negatives), difficulty calibration. | Not started |
| 13 | P2-1 | P2 | Judge core | `packages/judge`: `runProblem({problem, language, code, tests, mode})` → creates isolated workspace under `data/judge/<uuid>/`, picks executor, runs tests sequentially, collects per-test `{verdict, expected, actual, stdout, stderr, timeMs}`, aggregates overall verdict, always cleans up. Concurrency queue (default 2). | Not started |
| 14 | P2-2 | P2 | Python executor | `runner.py` harness: import user module, instantiate `Solution`, call `functionName` with deserialised args, serialise result via a dedicated fd/file (so user `print` never corrupts results), catch and report exceptions with traceback. Spawn `python -X utf8 -I`, per-test timeout, recursion limit raised to 10⁴. | Not started |
| 15 | P2-3 | P2 | Java executor | `Main.java` harness with a small dependency-free JSON reader/writer and `ListNode`/`TreeNode` helpers. `javac -d <ws>` once per submission, then `java -Xmx256m -Xss64m -cp <ws> Main` per test. Compile errors parsed into `{line, column, message}` for editor markers. | Not started |
| 16 | P2-4 | P2 | Limits and safety | Wall-clock timeout per test (default 5 s Python, 5 s Java after compile; overridable per problem). Kill full process tree on timeout (`taskkill /T /F` on Windows, process group on POSIX). Cap stdout/stderr at 64 KB. Workspace paths never derived from user input. Document threat model in `docs/ARCHITECTURE.md`. | Not started |
| 17 | P2-5 | P2 | Run vs Submit semantics | Run = sample tests + user custom cases, results not persisted as submissions (but marks In progress). Submit = all tests, fail-fast optional, persisted with code snapshot, verdict, timing; Accepted → Solved. | Not started |
| 18 | P2-6 | P2 | Judge test suite | Unit: comparators, serialisers, compile-error parser, verdict aggregation. Integration (spawns real interpreters): AC, WA with diff, TLE (infinite loop), RE (exception), CE (Java syntax error), stdout noise tolerated, deep recursion, large output cap. Runs on both CI OSes. | Not started |
| 19 | P3-1 | P3 | Fastify API | Routes: `GET /api/problems?topic&tier&status&q&language`, `GET /api/problems/:slug`, `POST /api/run`, `POST /api/submit`, `GET /api/problems/:slug/submissions`, `GET /api/progress`, `PUT /api/drafts/:slug/:language`, `GET/PUT /api/settings`, `POST /api/coach/feedback` (SSE stream), `POST /api/coach/chat`. Request/response validated with shared zod schemas; OpenAPI generated for docs. | Not started |
| 20 | P3-2 | P3 | SQLite persistence | Drizzle + better-sqlite3, DB at `data/devpromax.db`. Tables: `submissions`, `drafts`, `problem_progress` (per slug+language), `coach_sessions`, `coach_messages`, `notes`, `settings`, `events`. Migrations checked in. Repository layer with unit tests against an in-memory DB. | Not started |
| 21 | P3-3 | P3 | Progress status engine | Pure function deriving `NotStarted / InProgress / Solved / Mastered` per problem from events (draft saved, run, submit accepted, coach mastered, manual override). Roll-up across languages = best status. Exhaustive unit tests, including regressions (a later WA never demotes Solved). | Not started |
| 22 | P3-4 | P3 | Settings and API key handling | Settings page data: provider (Anthropic / Gemini), model, API key, judge timeouts, spend cap. Key stored in local DB (masked in UI, never logged, excluded from exports), env var override `COACH_API_KEY`. "Test connection" endpoint. | Not started |
| 23 | P3-5 | P3 | API tests | Fastify `inject` tests per route: validation errors, filtering/sorting correctness, submit→progress transition, draft round-trip, settings masking. | Not started |
| 24 | P4-1 | P4 | App shell | Routing (`/`, `/problems/:slug`, `/progress`, `/settings`), top bar with global progress, theme toggle, command palette (`Ctrl+K`) and shortcut registry (`Ctrl+Enter` run, `Ctrl+Shift+Enter` submit, `Ctrl+/` toggle panel). TanStack Query for server state. | Not started |
| 25 | P4-2 | P4 | Problem list page | Virtualised, scrollable table: status icon, title, topic, patterns, tier, rating, last attempted. Default sort rating asc then curriculum order; sortable columns; search box. Row click opens workspace. Sticky header with counts (e.g. "Solved 42 / 200"). | Not started |
| 26 | P4-3 | P4 | Filters | Sidebar filters: topic (multi, with per-topic solved/total counts), tier, status (Not started / In progress / Solved / Mastered), language solved-in. All filters persisted in URL query so views are shareable/bookmarkable. Clear-all. Empty-state copy when nothing matches. | Not started |
| 27 | P4-4 | P4 | Problem workspace | Resizable split: left tabs Description / Hints / Editorial (locked until Solved) / Submissions / Notes; right Monaco editor (lazy-loaded) with language switch, starter code, reset-to-starter, autosave draft (debounced), format on save; bottom panel Testcases (samples + custom) / Results / Coach. Layout persisted in localStorage. | Not started |
| 28 | P4-5 | P4 | Run and Submit results UI | Verdict banner (AC/WA/TLE/RE/CE) with timing; per-test rows with expected vs actual side-by-side diff; stdout/stderr disclosure; compile errors mapped to Monaco markers and clickable; keyboard navigation between failed tests. | Not started |
| 29 | P4-6 | P4 | Live status propagation | On Accepted, invalidate list/progress queries so the row flips to Solved without reload; subtle non-blocking confirmation (no confetti). Per-topic progress bars in sidebar update. | Not started |
| 30 | P4-7 | P4 | UI tests | RTL component tests: filters, sort, status icons, results diff, shortcuts. Playwright golden path: open list → filter Easy+Arrays → open problem → run (see sample pass) → submit → status Solved in list → reload persists. Runs against a seeded DB. | Not started |
| 31 | P4-8 | P4 | Design polish and a11y pass | Review every screen against `docs/DESIGN.md`; loading skeletons, empty states, error states, focus rings, 1024 px minimum width behaviour, axe audit with zero serious violations, colour-contrast check for both themes. | Not started |
| 32 | P5-1 | P5 | LLM provider adapter | `CoachProvider` interface: `stream(messages, schema) → AsyncIterable<chunk> + final parsed JSON`. Implementations: Anthropic Messages API (structured output, prompt caching for the static system prompt) and Google Gemini API (`responseSchema`, streaming). Model picker per provider with sensible defaults. Errors surfaced as actionable messages (bad key, rate limit, model unavailable). | Not started |
| 33 | P5-2 | P5 | Coach prompt design | `docs/COACH_PROMPTS.md` + versioned prompt files. Rubric dimensions: correctness, time complexity vs target, space complexity, edge-case handling, readability/idiom, interview communication. Hint ladder: nudge → concept → approach → pseudocode; full solution only when Solved and user explicitly asks. Tone: specific, kind, no fluff, references the user's actual lines. Context builder with token budget and truncation rules. | Not started |
| 34 | P5-3 | P5 | "AI Help" button and Coach panel | Button in the workspace toolbar (and `Ctrl+Shift+H`). Local pre-check: if code equals the starter (normalised whitespace/comments) or has no meaningful body, show "Write some code first, then ask for help" without calling the API. Otherwise stream markdown into the Coach panel with the latest judge results attached if a Run/Submit happened; rubric card with dimension scores; "next step" callout; follow-up chat thread scoped to the problem. Loading, error and no-key states. | Not started |
| 35 | P5-4 | P5 | Mastery decision | When AI Help is requested after an Accepted Submit, the coach returns `mastered` only if every rubric dimension meets threshold. Status engine promotes to Mastered; user can manually mark/unmark. Mastered visible in list and filters. | Not started |
| 36 | P5-5 | P5 | Progressive attempt memory | Store compact summaries of previous coach feedback and code deltas per problem; include in context so the coach says "you fixed X, now Y" instead of repeating itself. | Not started |
| 37 | P5-6 | P5 | Cost, privacy and fallback | Token estimate shown next to the AI Help button; per-session spend cap in settings; key redaction in logs; when no key is configured the button opens Settings, and a deterministic judge-only summary (failed cases, timing hints) is still shown after Run/Submit so the app is useful without an LLM. | Not started |
| 38 | P5-7 | P5 | Coach test suite | Adapter contract tests with recorded fixtures (no network in CI); prompt snapshot tests; structured-output parsing failure handling; UI tests with a mocked stream; status-engine tests for Mastered transitions. | Not started |
| 39 | P6-1 | P6 | Curriculum map | `docs/CURRICULUM.md`: for each of the 14 topics, the patterns to cover and the planned problem list (title, tier, rating, pattern), ordered as a path. This is the content backlog for P6-2..P6-6. | Not started |
| 40 | P6-2 | P6 | Batch A: Arrays, HashMap, Sorting, Binary Search | ~45 problems total (extending the seed). Patterns: two pointers, sliding window, prefix sum, Kadane, intervals, frequency maps, grouping, complement lookup, custom sort, counting sort, boundary/rotated/answer binary search. All validated in CI. | Not started |
| 41 | P6-3 | P6 | Batch B: Linked List, Stack, Matrix | ~40 problems. Fast/slow pointers, in-place reversal, dummy head, merge; monotonic stack, parsing, min-stack; spiral, rotation, grid BFS/DFS, islands. | Not started |
| 42 | P6-4 | P6 | Batch C: Binary Tree, Heap, Graph | ~45 problems. Traversals, BST ops, LCA, construction, serialisation; top-K, two heaps, merge-K; BFS/DFS, topological sort, union-find, Dijkstra, bipartite. | Not started |
| 43 | P6-5 | P6 | Batch D: Backtracking, DP, Bit Manipulation | ~45 problems. Subsets/permutations/combinations, N-Queens, word search; 1D/2D DP, knapsack, LCS/LIS, edit distance, DP on grids; XOR tricks, bit counting, bitmask DP. | Not started |
| 44 | P6-6 | P6 | Batch E: Advanced data structures | ~25 problems. Trie, segment tree, Fenwick, union-find design, LRU/LFU, monotonic deque, design-style problems. | Not started |
| 45 | P6-7 | P6 | Content QA | LLM-assisted review pass for ambiguity and missing constraints; property-based hidden-test generation against references; difficulty calibration by solving time; fix findings. | Not started |
| 46 | P7-1 | P7 | Progressive hints | Hints tab reveals one rung at a time; reveals recorded and shown to the coach (so it does not repeat them). | Not started |
| 47 | P7-2 | P7 | Editorial unlock | Editorial tab unlocks after Solved or via explicit "reveal solution" (recorded). Shows approach, complexity, pitfalls and reference code in both languages with a diff-against-my-code view. | Not started |
| 48 | P7-3 | P7 | Submission history | List of submissions per problem with verdict, language, time; open any, diff against current editor, restore into editor. | Not started |
| 49 | P7-4 | P7 | Notes | Per-problem markdown notes with autosave; searchable from the list. | Not started |
| 50 | P7-5 | P7 | Progress dashboard | `/progress`: solved/mastered per topic, per tier, streak calendar, recent activity, weakest topics (from coach rubric scores), export progress as JSON/markdown "skills report" for sharing. | Not started |
| 51 | P7-6 | P7 | Interview mode | Optional timer (stopwatch or countdown), hides hints/editorial while running, records time-to-solve on the submission; coach feedback adds a "how you'd explain this in an interview" section. | Not started |
| 52 | P7-7 | P7 | Navigation aids | Bookmarks, random unsolved problem, "next recommended" (lowest rating unsolved in weakest topic), related problems links from `meta.related`. | Not started |
| 53 | P7-8 | P7 | Spaced repetition review queue | Solved problems resurface after 3/7/21 days for a re-solve without hints; Mastered extends intervals. Queue visible on dashboard. | Not started |
| 54 | P8-1 | P8 | Full E2E coverage | Playwright suites for filters, workspace, run/submit verdict types, coach panel (mocked), settings, dashboard, keyboard-only flow. Flake budget tracked; retries only in CI. | Not started |
| 55 | P8-2 | P8 | Performance | List virtualisation verified with 500 problems; Monaco code-split; judge queue under load; server cold start under 2 s; Lighthouse performance and a11y ≥ 90 on both themes. | Not started |
| 56 | P8-3 | P8 | Packaging and first-run | `npm start` builds once and serves; first-run doctor checks `python`/`java`/`javac` on PATH and shows install guidance; `data/` location configurable; backup/restore of the DB. | Not started |
| 57 | P8-4 | P8 | Documentation | README (quick start, screenshots), `docs/ARCHITECTURE.md`, `docs/PROBLEM_FORMAT.md` (contributing problems), `docs/DESIGN.md`, `docs/COACH_PROMPTS.md`, CHANGELOG. | Not started |
| 58 | P8-5 | P8 | Retire `temp/` | Owner wants `temp/` kept until the app is built out. Revisit at M5; delete only with explicit confirmation (history keeps it). | Blocked |
| 59 | P9-1 | P9 | Mock interview mode | LLM acts as interviewer: picks 2 problems for 45 min, asks for verbal approach before coding, probes complexity, produces a written debrief. | Not started |
| 60 | P9-2 | P9 | Docker executor | Optional sandboxed executor when Docker is available; same executor interface. | Not started |
| 61 | P9-3 | P9 | More languages | C++, JavaScript/TypeScript, Go via new harnesses; content gets references per language incrementally. | Not started |
| 62 | P9-4 | P9 | Shareable profile page | Static HTML export of the skills report for sharing with recruiters. | Not started |
| 63 | P9-5 | P9 | OpenAI-compatible provider | Adapter for OpenAI-compatible endpoints (`baseUrl`), which also covers Ollama/LM Studio for fully offline coaching. | Not started |

---

## 6. Milestones

| Milestone | Includes | Exit criteria |
| --- | --- | --- |
| M1 Vertical slice | P0-4 … P4-7 with the 20 seed problems | Open the app, filter to Easy, solve a problem in Python and Java, see it flip to Solved; all tests green in CI on both OSes. |
| M2 Coach | P5-1 … P5-7 | With an Anthropic or Gemini key configured, AI Help streams rubric feedback on the current code; empty code is rejected locally; a clean optimal accepted solution reaches Mastered. |
| M3 Full catalogue | P6-1 … P6-7 | ~200 validated problems across all 14 topics and three tiers. |
| M4 Learning loop | P7-1 … P7-8 | Hints, editorial, history, notes, dashboard, timer, review queue. |
| M5 Release 1.0 | P8-1 … P8-5 | Packaged `npm start`, docs complete, `temp/` retired. |
