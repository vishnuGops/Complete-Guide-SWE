# CLAUDE.md — DevProMax

Working agreement for AI-assisted development on this repo. Read `ROADMAP.md` first; it holds the goals, the architecture decisions (D1–D12) and the prioritised task table.

## What this project is

DevProMax is a local-first, LeetCode-style DSA training app for **Python and Java**. A React web UI lists ~200 original problems across 14 topics, sorted by difficulty; users run and submit code against hidden tests in a local judge; an on-demand **AI Help** button sends the current code to an LLM coach (user-supplied Anthropic or Gemini key) that responds with rubric feedback and hints until the solution is Mastered.

Current state: **planning complete, implementation not started.** Legacy content is archived in `temp/`, kept until the app is built out, and must not be edited.

## Stack (decided, see ROADMAP D1–D11)

- TypeScript everywhere. npm workspaces: `apps/web` (React 19, Vite, Monaco, Tailwind v4 tokens, Radix primitives), `apps/server` (Fastify, Drizzle + better-sqlite3), `packages/shared` (zod schemas + types), `packages/judge`, `packages/problems`.
- Judge runs `python` and `javac`/`java` as local subprocesses with a harness. No Docker on the dev machine.
- Problems are directories under `problems/<topic>/<slug>/`, validated by `npm run problems:validate`.
- LLM access goes through a `CoachProvider` adapter with Anthropic and Gemini implementations. Never call a vendor SDK directly from UI or route code.
- The coach is **on-demand only** (AI Help button). Never auto-call the LLM on Run/Submit. Skip the API call when the code is the untouched starter or has no meaningful body.
- Package scope is `@devpromax/*`; the SQLite file is `data/devpromax.db`.

## Environment

- Windows 11, PowerShell primary shell. Paths may contain spaces; always quote.
- Installed: Node 24, npm 11, Python 3.14, OpenJDK 25. Not installed: Docker, pnpm, uv.
- Judge and tests must work on both Windows and Linux; CI runs both. Use `path.join`, spawn without `shell: true`, kill process trees explicitly.

## Commands (to be kept current as tooling lands)

```
npm install                 # all workspaces
npm run dev                 # web + server with hot reload
npm start                   # production build + serve on localhost
npm test                    # Vitest unit + contract + judge integration
npm run test:e2e            # Playwright
npm run lint && npm run typecheck
npm run problems:validate [slug]   # schema + reference solutions pass in both languages
npm run problems:new <topic> <slug>
```

Until P0-4 lands, none of these exist yet. Do not invent others without adding them here.

## Conventions

- **TypeScript strict**, no `any` without a comment explaining why. Shared request/response shapes live in `packages/shared` and are the single source of truth for both sides.
- **Tests ship with the change.** Judge changes need integration tests that spawn real interpreters. UI behaviour needs RTL tests; golden paths need Playwright. New problems must pass `problems:validate` before commit.
- **Problem content** must be original wording (no copied LeetCode text), include ≥ 3 visible samples and ≥ 10 hidden tests with edge cases (empty, single element, max size, duplicates, negatives), hints ladder, editorial, and starter + reference in both languages.
- **Design** follows `docs/DESIGN.md` once written; until then: one accent colour, neutral greys, 8-pt spacing, Inter + JetBrains Mono, no gradients, no hero sections, no emoji in UI chrome, no card grids with drop shadows, real keyboard support, both themes. If a screen looks like a generic dashboard template, it is wrong.
- **Coach prompts** are versioned files under `docs/COACH_PROMPTS.md` / `apps/server/src/coach/prompts/`. The coach never reveals a full solution unless the problem is Solved and the user explicitly asked.
- **Secrets**: API keys are stored locally, masked in the UI, never logged, never included in exports or fixtures.
- Prefer small, reviewable commits scoped to one ROADMAP task. Commit messages reference the task ID, e.g. `P2-3: Java executor with compile-error mapping`.

## Working with ROADMAP.md

- The task table is **always sorted by Priority**. Insert new tasks at the right priority and renumber the rows below.
- Update a task's Status (`Not started` / `In progress` / `Done` / `Blocked`) in the same commit as the work.
- If an implementation deviates from a decision in section 2, update the decision row with the new reasoning rather than silently diverging.

## Do not

- Edit or delete anything in `temp/` (owner wants it kept until the app is built out, see P8-5).
- Add a UI component library (shadcn, MUI, Chakra, Ant). Radix primitives + our tokens only.
- Add a second backend language or a second package manager.
- Run user-submitted code outside the judge's workspace/limit machinery.
- Commit `data/`, `node_modules/`, build outputs, or any `.env`.
