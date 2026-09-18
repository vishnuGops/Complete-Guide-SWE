# CLAUDE.md — DevProMax

Working agreement for AI-assisted development on this repo. Read `ROADMAP.md` first; it holds the goals, the architecture decisions (D1–D18) and the prioritised task table.

## What this project is

DevProMax is a local-first, LeetCode-style DSA training app for **Python and Java**. A React web UI lists 169 original problems across 14 topics, sorted by difficulty; users run and submit code against hidden tests in a local judge; an on-demand **AI Help** button sends the current code to an LLM coach (user-supplied Anthropic or Gemini key) that responds with rubric feedback and hints until the solution is Mastered.

Current state: **M4 reached (2026-09-18)**, and M5 all but done. The catalogue is 169 validated problems with generated hidden tests (M3); the learning loop is complete apart from P7-10 — progressive hints, the editorial unlock with a diff, submission history, notes, the dashboard and its exportable skills report, interview mode, the command palette with bookmarks and recommendations, the spaced-repetition review queue, and version drift with Re-verify. M5 has P8-1 (76 end-to-end tests with a flake budget), P8-2 (performance budgets and Lighthouse ≥ 90) and P8-3 (doctor, welcome, movable `data/`, backup and restore) done; P8-4 documentation is the last open one.

Three tasks cannot be finished here and say so in their rows: **P7-10** needs measured human solving times, **P2-15** needs an owner decision about expressing cycles and graph node references on the wire, and **P8-5** (retire `temp/`) is blocked by the owner. Legacy content is archived in `temp/`, kept until the app is built out, and must not be edited.

## Stack (decided, see ROADMAP D1–D17)

- TypeScript everywhere. npm workspaces: `apps/web` (React 19, Vite, React Router, TanStack Query, Monaco, Tailwind v4 tokens, Radix primitives), `apps/server` (Fastify; `judge/`, `problems/`, `coach/`, `db/`, `api/` folders inside), `packages/shared` (zod schemas + types). No other workspaces.
- Persistence is `node:sqlite` with hand-written SQL and checked-in migrations. No ORM. `better-sqlite3` only as a documented fallback. Everything the app writes lives under `data/`; `DEVPROMAX_DATA` moves that directory and `DEVPROMAX_DB` moves just the database file (P8-3).
- Judge runs `python` and `javac`/`java` as local subprocesses with a harness. All tests of a run execute in one process with a per-test watchdog; isolation per test only after a timeout. Two test modes (`function`, `operations`) and three expect modes (`return`, `mutatedArgs`, `both`). Java arguments are typed by reflection from a fixed supported-type table. Custom checkers are TypeScript run in-process.
- The API binds to `127.0.0.1`, checks the `Host` header, and requires the `X-DevProMax-Client` header on every `/api` request. Do not loosen this.
- Problems are directories under `problems/<topic>/<slug>/`, validated by `npm run problems:validate`. Hidden tests come from each problem's `generator.py` with the reference solution as oracle.
- LLM access goes through a `CoachProvider` adapter with Anthropic and Gemini implementations. Never call a vendor SDK directly from UI or route code.
- The coach is **on-demand only** (AI Help button). Never auto-call the LLM on Run/Submit. Skip the API call when the code is the untouched starter or has no meaningful body.
- Package scope is `@devpromax/*`; the SQLite file is `data/devpromax.db`.

## Environment

- Windows 11, PowerShell primary shell. Paths may contain spaces; always quote.
- Installed: Node 24, npm 11, Python 3.14, OpenJDK 25. Not installed: Docker, pnpm, uv.
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
npm run doctor                                # check python/java/javac and their versions (P8-3)
npm run db:backup [-- <file>]                 # consistent copy of the practice database (VACUUM INTO)
npm run db:restore -- <file>                  # put a backup back; the displaced one is kept beside it
```

Do not invent others without adding them here.

## Conventions

- **TypeScript strict**, no `any` without a comment explaining why. Shared request/response shapes live in `packages/shared` and are the single source of truth for both sides.
- **Tests ship with the change.** Judge changes need integration tests that spawn real interpreters. UI behaviour needs RTL tests; golden paths need Playwright. New problems must pass `problems:validate` before commit.
- **Problem format** is specified in `docs/PROBLEM_FORMAT.md`; `docs/schema/*.schema.json` is generated from the zod schemas by `npm run problems:schema` and must never be hand-edited.
- **Problem content** must be original wording (no copied LeetCode text), include ≥ 3 visible samples with explanations and ≥ 10 generated hidden tests with edge cases (empty, single element, max size, duplicates, negatives), a hints ladder, an editorial, and starter + reference in both languages. Follow `docs/AUTHORING.md` once it exists.
- **Design** follows `docs/DESIGN.md`, and its section 12 checklist is part of every UI review. In short: semantic tokens only (never a ramp colour or raw hex), one accent, 8-pt spacing, Inter + JetBrains Mono, no gradients, no hero sections, no emoji in UI chrome, no card grids with drop shadows, real keyboard support, both themes reviewed. Components are built with the screen that needs them, not ahead of time; the primitives in `apps/web/src/ui/` are the exception and the reference page is `/dev/kitchen-sink`. Contrast is enforced twice: `apps/web/src/styles/contrast.test.ts` measures the tokens rather than trusting them, and `apps/web/e2e/a11y.spec.ts` runs axe over every screen in both themes in a real browser. If a screen looks like a generic dashboard template, it is wrong.
- **Shortcuts**: `Ctrl+Enter` run, `Ctrl+Shift+Enter` submit, `Ctrl+J` toggle bottom panel, `Ctrl+Shift+H` AI Help. Never bind `Ctrl+/` (Monaco comment toggle).
- **Progress status** changes only on Run, Submit, coach mastery, or manual override. Saving a draft never changes status.
- **Coach prompts** are versioned files under `apps/server/src/coach/prompts/` and documented in `docs/COACH_PROMPTS.md`. The coach never reveals a full solution unless the problem is Solved and the user explicitly asked.
- **Secrets**: API keys are stored locally, masked in the UI, never logged, never included in exports or fixtures.
- Prefer small, reviewable commits scoped to one ROADMAP task. Commit messages reference the task ID, e.g. `P2-3: Java executor with compile-error mapping`.

## Working with ROADMAP.md

- The task table is **always sorted by Priority**. Insert new tasks at the right priority and renumber the rows below.
- Update a task's Status (`Not started` / `In progress` / `Done` / `Blocked`) in the same commit as the work.
- If an implementation deviates from a decision in section 2, update the decision row with the new reasoning rather than silently diverging, and add a line to the revision history.

## Do not

- Edit or delete anything in `temp/` (owner wants it kept until the app is built out, see P8-5).
- Add a UI component library (shadcn, MUI, Chakra, Ant). Radix primitives + our tokens only.
- Add a second backend language, a second package manager, an ORM, or OpenAPI generation.
- Run user-submitted code outside the judge's workspace/limit machinery, or expose the server beyond `127.0.0.1`.
- Commit `data/`, `node_modules/`, build outputs, or any `.env`.
