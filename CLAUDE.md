# CLAUDE.md — DevProMax

Working agreement for AI-assisted development on this repo. Read `ROADMAP.md` first; it holds the goals, the architecture decisions (D1–D25), the repository layout and the open tasks. Completed tasks and milestones are in `docs/archive/ROADMAP-completed.md`, which is where a `ROADMAP P2-16` in a code comment resolves.

## What this project is

DevProMax is a local-first, LeetCode-style DSA training app for **Python and Java**. A React web UI lists 171 original problems across 14 topics, sorted by difficulty; users run and submit code against hidden tests in a local judge; an on-demand **AI Help** button sends the current code to an LLM coach (user-supplied Anthropic or Gemini key) that responds with rubric feedback and hints until the solution is Mastered.

Current state: **release 1.0 (M5, 2026-09-22)**, then the whole-codebase audit (M5.1, 2026-09-24) and a janitorial pass (P8-9). The catalogue is 171 validated problems with generated hidden tests; the learning loop, the coach, interview and mock-interview modes, the Docker executor, the OpenAI-compatible provider, optional formatting and the DESIGN.md v2 redesign are all shipped. What each task did and why is in the archive and in `CHANGELOG.md`.

The current work is phase **P10**, a one-click Windows installer that bundles its own Node, Python and JDK (D26, milestone M6). P10-6 (licence) and P10-7 (code signing) each start with an owner decision.

Four tasks are not to be started and say so in their rows: **P7-10** needs measured human solving times; **P9-3** (more languages) is deferred by the owner until the existing app is solid; **P10-10** (Docker image) needs a decision on D15; and **P10-11** (macOS) needs an Apple Developer account.

## Stack (decided, see ROADMAP D1–D25)

- TypeScript everywhere. npm workspaces: `apps/web` (React 19, Vite, React Router, TanStack Query, Monaco, Tailwind v4 tokens, Radix primitives), `apps/server` (Fastify; `api/` with `routes/` and `services/`, `judge/`, `problems/`, `coach/`, `db/`, `toolchain/`, and `cli/` for every npm-script entry point), `packages/shared` (zod schemas + types). No other workspaces.
- Persistence is `node:sqlite` with hand-written SQL and checked-in migrations. No ORM. `better-sqlite3` only as a documented fallback. Everything the app writes lives under `data/`; `DEVPROMAX_DATA` moves that directory and `DEVPROMAX_DB` moves just the database file (P8-3).
- Judge runs `python` and `javac`/`java` as local subprocesses with a harness. All tests of a run execute in one process with a per-test watchdog; isolation per test only after a timeout. Two test modes (`function`, `operations`) and three expect modes (`return`, `mutatedArgs`, `both`). Java arguments are typed by reflection from a fixed supported-type table. Custom checkers are TypeScript run in-process. `DEVPROMAX_EXECUTOR=docker` runs the same executors in locked-down containers instead (P9-2, `judge/executors/docker.ts`); every restriction there is asserted in `docker.test.ts` and attempted from inside in `docker.integration.test.ts`, so do not drop a flag without replacing its test. Judge containers carry the label `devpromax.judge=1`, which the home server's ntfy watcher relies on to stay quiet.
- The API binds to `127.0.0.1`, checks the `Host` header, and requires the `X-DevProMax-Client` header on every `/api` request. Do not loosen this.
- Problems are directories under `problems/<topic>/<slug>/`, validated by `npm run problems:validate`. Hidden tests come from each problem's `generator.py` with the reference solution as oracle.
- LLM access goes through a `CoachProvider` adapter with Anthropic, Gemini and OpenAI-compatible implementations. Never call a vendor SDK directly from UI or route code.
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
npm run dev                 # web + server with hot reload (dev:web and dev:server are its two halves, and internal: the e2e config starts them separately)
npm run build               # shared, then server, then web; what `npm start`, perf:lighthouse and screenshots run from
npm start                   # production build, then app + API on 127.0.0.1:5174 (one process; Ctrl+C stops it)
npm run launch              # production build, then the installed copy's launcher (P10-3) against this machine's runtimes: reuses a running server, remembers its port in data/launcher.json, opens the browser; `npm run launch -- backup|restore <file>|doctor` are its subcommands
npm test                    # Vitest unit + contract + judge integration (npm run test:watch for watch mode)
npm run test:unit           # everything except *.integration.test.ts (seconds, Node only)
npm run test:integration    # only *.integration.test.ts, one file at a time (spawns real python/java); the whole-catalogue case needs DEVPROMAX_CATALOGUE_TESTS=1
npm run test:coverage       # npm test with v8 coverage: a summary here, HTML in coverage/; measured, never a gate
npm run test:e2e            # Playwright on its own ports (5183 web, 5184 API; DEVPROMAX_E2E_WEB_PORT / DEVPROMAX_E2E_API_PORT) and a data/e2e.db emptied every run; safe beside `npm run dev`
npm run test:e2e:flake-budget -w @devpromax/web   # after a CI-mode e2e run: fail if more than the budget passed only on retry
npm run perf:lighthouse     # Lighthouse over the built app in both themes; run `npm run build` first
npm run screenshots         # retake the README's screenshots from the built app
npm run lint && npm run typecheck           # lint:fix, format and format:check also exist
npm run problems:validate -- [--static] [--changed <ref>] [slug]   # schema (and both references pass); flags need the `--`
npm run problems:new <topic> <slug>
npm run problems:gen <slug>                   # regenerate hidden tests from generator.py
npm run problems:gen -- --check [slug]        # fail if tests no longer match their generator
npm run problems:schema [-- --check]          # regenerate (or verify) docs/schema/*.json from the zod schemas
npm run doctor                                # check python/java/javac and their versions (P8-3), and list the optional formatters (P9-5)
npm run db:backup -- [<file>] [--include-key] # consistent copy of the practice database (VACUUM INTO); the API key is left out unless asked
npm run db:restore -- <file>                  # put a backup back; the displaced one (and its WAL) is kept beside it; refuses while the app is running
```

Do not invent others without adding them here.

## Conventions

- **TypeScript strict**, no `any` without a comment explaining why. Shared request/response shapes live in `packages/shared` and are the single source of truth for both sides.
- **Tests ship with the change.** Judge changes need integration tests that spawn real interpreters. UI behaviour needs RTL tests; golden paths need Playwright. New problems must pass `problems:validate` before commit.
- **Problem format** is specified in `docs/PROBLEM_FORMAT.md`; `docs/schema/*.schema.json` is generated from the zod schemas by `npm run problems:schema` and must never be hand-edited.
- **Problem content** must be original wording (no copied LeetCode text), include ≥ 3 visible samples with explanations and ≥ 10 generated hidden tests with edge cases (empty, single element, max size, duplicates, negatives), a hints ladder, an editorial, and starter + reference in both languages. Follow `docs/AUTHORING.md`.
- **Design** follows `docs/DESIGN.md`, and its section 13 checklist is part of every UI review. Version 2 (P9-6, shipped 2026-09-23): white rounded cards on a pale canvas with an icon rail, one royal-blue accent, Inter + JetBrains Mono with Newsreader serif for the coach's words only. In short: semantic tokens only (never a ramp colour or raw hex), one accent, 4px spacing step, every card answers one question (no KPI-tile grids, no cards in cards), no gradients except a chart's area fill, no emoji in UI chrome, real keyboard support, both themes reviewed. Components are built with the screen that needs them, not ahead of time; the primitives in `apps/web/src/ui/` are the exception and the reference page is `/dev/kitchen-sink`. Contrast is enforced twice: `apps/web/src/styles/contrast.test.ts` measures the tokens rather than trusting them, and `apps/web/e2e/a11y.spec.ts` runs axe over every screen in both themes in a real browser. If a screen looks like a generic dashboard template, it is wrong. A whole-UI design pass uses the `design-update` skill (`.claude/skills/design-update/`): it captures every screen in both themes into `data/design-audit/`, measures painted values against the tokens, audits the source, and plans fixes by priority, token layer first. Its `redesign` mode restyles the app to a reference or brief: proposed tokens are previewed on every screen, reviewed, and approved by the owner before any source changes.
- **Shortcuts**: `Ctrl+Enter` run, `Ctrl+Shift+Enter` submit, `Ctrl+S` save now (formatting first when the preference is on), `Ctrl+J` toggle bottom panel, `Ctrl+Shift+H` AI Help, `Ctrl+K` command palette, `Shift+Alt+F` format (a Monaco action, present only when the language's formatter was found). Never bind `Ctrl+/` (Monaco comment toggle).
- **Progress status** changes only on Run, Submit, coach mastery, or manual override. Saving a draft never changes status.
- **Coach prompts** are versioned files under `apps/server/src/coach/prompts/` and documented in `docs/COACH_PROMPTS.md`. The coach never reveals a full solution unless the problem is Solved and the user explicitly asked.
- **Secrets**: API keys are stored locally, masked in the UI, never logged, never included in exports or fixtures.
- Prefer small, reviewable commits scoped to one ROADMAP task. Commit messages reference the task ID, e.g. `P2-3: Java executor with compile-error mapping`.

## Working with ROADMAP.md

- ROADMAP lists **open tasks only**, always sorted by Priority. Insert new tasks at the right priority and renumber the rows below; take the next free ID listed under the table.
- Update a task's Status (`Not started` / `In progress` / `Done` / `Blocked`) in the same commit as the work. When a task is Done, move its row to the end of the task table in `docs/archive/ROADMAP-completed.md` in that commit (without the Priority and Status cells).
- If an implementation deviates from a decision in section 2, update the decision row with the new reasoning rather than silently diverging, and add a line to the revision history.

## Do not

- Add a UI component library (shadcn, MUI, Chakra, Ant). Radix primitives + our tokens only.
- Add a second backend language, a second package manager, an ORM, or OpenAPI generation.
- Run user-submitted code outside the judge's workspace/limit machinery, or expose the server beyond `127.0.0.1`.
- Commit `data/`, `node_modules/`, build outputs, or any `.env`.
