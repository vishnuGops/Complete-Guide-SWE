# CLAUDE.md — DevProMax

Working agreement for AI-assisted development on this repo. Read `ROADMAP.md` first; it holds the goals, the architecture decisions (D1–D25) and the prioritised task table.

## What this project is

DevProMax is a local-first, LeetCode-style DSA training app for **Python and Java**. A React web UI lists 171 original problems across 14 topics, sorted by difficulty; users run and submit code against hidden tests in a local judge; an on-demand **AI Help** button sends the current code to an LLM coach (user-supplied Anthropic or Gemini key) that responds with rubric feedback and hints until the solution is Mastered.

Current state: **M5 reached (2026-09-22)** — release 1.0; M4 was reached 2026-09-18. The catalogue is 171 validated problems with generated hidden tests (M3); the learning loop is complete apart from P7-10 — progressive hints, the editorial unlock with a diff, submission history, notes, the dashboard and its exportable skills report, interview mode, the command palette with bookmarks and recommendations, the spaced-repetition review queue, and version drift with Re-verify. M5's P8-1 … P8-5 are done: end-to-end tests with a flake budget, performance budgets and Lighthouse ≥ 90, the doctor, welcome, movable `data/` and backups, the README and CHANGELOG, and the legacy `temp/` archive retired (git history keeps it; last at `2c01d25`). Beyond v1, P9-1 (mock interview), P9-2 (Docker executor), P9-4 (OpenAI-compatible provider) and P9-5 (format on save, with optional `black` / `google-java-format`) are done.

Two tasks are not to be started and say so in their rows: **P7-10** needs measured human solving times, and **P9-3** (more languages) is deferred by the owner until the existing app is solid.

## Stack (decided, see ROADMAP D1–D25)

- TypeScript everywhere. npm workspaces: `apps/web` (React 19, Vite, React Router, TanStack Query, Monaco, Tailwind v4 tokens, Radix primitives), `apps/server` (Fastify; `judge/`, `problems/`, `coach/`, `db/`, `api/` folders inside), `packages/shared` (zod schemas + types). No other workspaces.
- Persistence is `node:sqlite` with hand-written SQL and checked-in migrations. No ORM. `better-sqlite3` only as a documented fallback. Everything the app writes lives under `data/`; `DEVPROMAX_DATA` moves that directory and `DEVPROMAX_DB` moves just the database file (P8-3).
- Judge runs `python` and `javac`/`java` as local subprocesses with a harness. All tests of a run execute in one process with a per-test watchdog; isolation per test only after a timeout. Two test modes (`function`, `operations`) and three expect modes (`return`, `mutatedArgs`, `both`). Java arguments are typed by reflection from a fixed supported-type table. Custom checkers are TypeScript run in-process. `DEVPROMAX_EXECUTOR=docker` runs the same executors in locked-down containers instead (P9-2, `judge/executors/docker.ts`); every restriction there is asserted in `docker.test.ts` and attempted from inside in `docker.integration.test.ts`, so do not drop a flag without replacing its test. Judge containers carry the label `devpromax.judge=1`, which the home server's ntfy watcher relies on to stay quiet.
- The API binds to `127.0.0.1`, checks the `Host` header, and requires the `X-DevProMax-Client` header on every `/api` request. Do not loosen this.
- Problems are directories under `problems/<topic>/<slug>/`, validated by `npm run problems:validate`. Hidden tests come from each problem's `generator.py` with the reference solution as oracle.
- LLM access goes through a `CoachProvider` adapter with Anthropic and Gemini implementations. Never call a vendor SDK directly from UI or route code.
- The coach is **on-demand only** (AI Help button). Never auto-call the LLM on Run/Submit. Skip the API call when the code is the untouched starter or has no meaningful body.
- Package scope is `@devpromax/*`; the SQLite file is `data/devpromax.db`.

## Environment

- Windows 11, PowerShell primary shell. Paths may contain spaces; always quote.
- The project is worked on from two Windows 11 PCs. Both have Node 24, npm 11, Python 3.14 and a JDK 25. On the second (the home server, 4-core 2017 Xeon) the default `python` is 3.11 and must stay so, so Python 3.14 is uv-managed and the judge reaches it through the user env var `DEVPROMAX_PYTHON`; that machine also has uv and Docker Desktop. Not installed anywhere: pnpm. `npm run doctor` says what a machine is missing, including the two optional formatters (P9-5), which neither machine is required to have: `black` on PATH or as `python -m black` (or `DEVPROMAX_BLACK`), and google-java-format's `-all-deps.jar` via `DEVPROMAX_GOOGLE_JAVA_FORMAT`. Their integration tests are opt-in with `DEVPROMAX_FORMATTER_TESTS=1`.
- Keep timing assumptions honest for the slower machine: a reference solution that needs most of its time limit there is a problem to fix (P2-16), not a flake.
- Supported user runtimes: Python ≥ 3.10, Java ≥ 21. Compile Java with `--release 21`; the harness must not use features newer than Python 3.10.
- Judge and tests must work on both Windows and Linux; CI runs judge integration on both. Use `path.join`, spawn without `shell: true`, pass UTF-8 flags, kill process trees explicitly.

## Commands (to be kept current as tooling lands)

```
npm install                 # all workspaces
npm run dev                 # web + server with hot reload
npm start                   # production build, then app + API on 127.0.0.1:5174 (one process; Ctrl+C stops it)
npm test                    # Vitest unit + contract + judge integration (npm run test:watch for watch mode)
npm run test:unit           # everything except *.integration.test.ts (seconds, Node only)
npm run test:integration    # only *.integration.test.ts (spawns real python/java)
npm run test:e2e            # Playwright (its own database: DEVPROMAX_DB=data/e2e.db)
npm run perf:lighthouse     # Lighthouse over the built app in both themes; run `npm run build` first
npm run screenshots         # retake the README's screenshots from the built app
npm run lint && npm run typecheck           # lint:fix, format and format:check also exist
npm run problems:validate [--static] [--changed <ref>] [slug]   # schema (and both references pass)
npm run problems:new <topic> <slug>
npm run problems:gen <slug>                   # regenerate hidden tests from generator.py
npm run problems:gen -- --check [slug]        # fail if tests no longer match their generator
npm run problems:schema [--check]             # regenerate docs/schema/*.json from the zod schemas
npm run doctor                                # check python/java/javac and their versions (P8-3), and list the optional formatters (P9-5)
npm run db:backup [-- <file>]                 # consistent copy of the practice database (VACUUM INTO)
npm run db:restore -- <file>                  # put a backup back; the displaced one is kept beside it
```

Do not invent others without adding them here.

## Conventions

- **TypeScript strict**, no `any` without a comment explaining why. Shared request/response shapes live in `packages/shared` and are the single source of truth for both sides.
- **Tests ship with the change.** Judge changes need integration tests that spawn real interpreters. UI behaviour needs RTL tests; golden paths need Playwright. New problems must pass `problems:validate` before commit.
- **Problem format** is specified in `docs/PROBLEM_FORMAT.md`; `docs/schema/*.schema.json` is generated from the zod schemas by `npm run problems:schema` and must never be hand-edited.
- **Problem content** must be original wording (no copied LeetCode text), include ≥ 3 visible samples with explanations and ≥ 10 generated hidden tests with edge cases (empty, single element, max size, duplicates, negatives), a hints ladder, an editorial, and starter + reference in both languages. Follow `docs/AUTHORING.md` once it exists.
- **Design** follows `docs/DESIGN.md`, and its section 13 checklist is part of every UI review. Version 2 (2026-09-22, P9-6, being implemented): white rounded cards on a pale canvas with an icon rail, one royal-blue accent, Inter + JetBrains Mono with Newsreader serif for the coach's words only. In short: semantic tokens only (never a ramp colour or raw hex), one accent, 4px spacing step, every card answers one question (no KPI-tile grids, no cards in cards), no gradients except a chart's area fill, no emoji in UI chrome, real keyboard support, both themes reviewed. Components are built with the screen that needs them, not ahead of time; the primitives in `apps/web/src/ui/` are the exception and the reference page is `/dev/kitchen-sink`. Contrast is enforced twice: `apps/web/src/styles/contrast.test.ts` measures the tokens rather than trusting them, and `apps/web/e2e/a11y.spec.ts` runs axe over every screen in both themes in a real browser. If a screen looks like a generic dashboard template, it is wrong. A whole-UI design pass uses the `design-update` skill (`.claude/skills/design-update/`): it captures every screen in both themes into `data/design-audit/`, measures painted values against the tokens, audits the source, and plans fixes by priority, token layer first. Its `redesign` mode restyles the app to a reference or brief: proposed tokens are previewed on every screen, reviewed, and approved by the owner before any source changes.
- **Shortcuts**: `Ctrl+Enter` run, `Ctrl+Shift+Enter` submit, `Ctrl+S` save now (formatting first when the preference is on), `Ctrl+J` toggle bottom panel, `Ctrl+Shift+H` AI Help, `Shift+Alt+F` format (a Monaco action, present only when the language's formatter was found). Never bind `Ctrl+/` (Monaco comment toggle).
- **Progress status** changes only on Run, Submit, coach mastery, or manual override. Saving a draft never changes status.
- **Coach prompts** are versioned files under `apps/server/src/coach/prompts/` and documented in `docs/COACH_PROMPTS.md`. The coach never reveals a full solution unless the problem is Solved and the user explicitly asked.
- **Secrets**: API keys are stored locally, masked in the UI, never logged, never included in exports or fixtures.
- Prefer small, reviewable commits scoped to one ROADMAP task. Commit messages reference the task ID, e.g. `P2-3: Java executor with compile-error mapping`.

## Working with ROADMAP.md

- The task table is **always sorted by Priority**. Insert new tasks at the right priority and renumber the rows below.
- Update a task's Status (`Not started` / `In progress` / `Done` / `Blocked`) in the same commit as the work.
- If an implementation deviates from a decision in section 2, update the decision row with the new reasoning rather than silently diverging, and add a line to the revision history.

## Do not

- Add a UI component library (shadcn, MUI, Chakra, Ant). Radix primitives + our tokens only.
- Add a second backend language, a second package manager, an ORM, or OpenAPI generation.
- Run user-submitted code outside the judge's workspace/limit machinery, or expose the server beyond `127.0.0.1`.
- Commit `data/`, `node_modules/`, build outputs, or any `.env`.
