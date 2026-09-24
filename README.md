# DevProMax

A local-first, LeetCode-style trainer for data structures and algorithms, in **Python and Java**.
171 original problems, a judge that runs your code on your own machine, and an optional LLM coach
that reviews what you wrote instead of handing you the answer.

Nothing leaves your machine except a coach request you asked for, sent with a key you supplied.

![The problem list, filtered by topic and difficulty](docs/screenshots/problem-list.png)

## Features

- **171 problems across 14 topics**, from Arrays to Dynamic Programming and advanced data
  structures, each tagged by difficulty and pattern. Filter by topic, tier and status; search
  titles and your own notes.
- **A local judge.** **Run** checks your code against the samples and any cases you add;
  **Submit** runs the hidden tests and records the verdict (Accepted, Wrong Answer, Time Limit,
  Runtime Error, Compile Error, Memory Limit). It can also run inside locked-down Docker
  containers.
- **AI Help, on demand only.** A coach scores your code on a five-part rubric and gives the smallest
  hint that unblocks you. It works with Anthropic, Gemini or any OpenAI-compatible endpoint, shows
  the cost of a turn before you spend it, and respects a spending cap. It never runs on its own,
  and it gives a full solution only for a problem you've already solved, and only when you ask.
- **Learning aids:** a four-rung hint ladder, revealed one rung at a time; an editorial that
  unlocks once you solve the problem, with a diff against your code; submission history you can
  open, compare and restore; per-problem notes.
- **Progress:** per-topic and per-tier progress, a streak calendar, weak spots taken from the
  coach's scores, and a skills report you can export as Markdown, a web page or JSON (it never
  includes your code).
- **Spaced repetition:** solved problems come back after 3, 7 and 21 days, to be re-solved with
  the hints closed.
- **Interview practice:** a stopwatch or countdown that hides hints while it runs, and a 45-minute
  mock interview with an LLM interviewer that asks for your approach before your code.
- **Workspace comforts:** a command palette, bookmarks, a "next recommended problem", optional
  `black` / `google-java-format` formatting, Vim keybindings, and light and dark themes.

![A problem, a solution, and the judge's verdict](docs/screenshots/workspace.png)

## Requirements

- **Node.js 24+** (npm 11)
- **Python 3.10+** and **JDK 21+** on your `PATH`, or Docker (see
  [Running the judge in Docker](#running-the-judge-in-docker))

## Quick start

```
npm install
npm start          # builds, then serves the app and API on http://127.0.0.1:5174
npm run doctor     # if a Run fails: says which runtime is missing and how to fix it
```

For development, with hot reload:

```
npm run dev        # web on http://127.0.0.1:5173, API on 127.0.0.1:5174
```

## Using it

1. Pick a problem from the list (`/`) and write a solution in Python or Java.
2. **Run** to try it against the samples. Add your own cases in the Testcase panel. A Run records
   nothing.
3. **Submit** to run the hidden tests. An accepted submission marks the problem **Solved**. A status
   only ever goes up: a later wrong answer never takes Solved away.
4. Stuck? Open the **Hints** tab, or press **AI Help** for feedback on the code you have. Once a
   problem is Solved, a coach review that clears the bar on every rubric part makes it
   **Mastered**.
5. Check **Progress** (`/progress`) for your streak, weak topics and review queue.

![Progress: streak, topics, and the skills report](docs/screenshots/progress.png)

| Shortcut           | Action                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| `Ctrl+Enter`       | Run                                                                    |
| `Ctrl+Shift+Enter` | Submit                                                                 |
| `Ctrl+Shift+H`     | AI Help                                                                |
| `Ctrl+S`           | Save now (formats first, if format on save is on)                      |
| `Shift+Alt+F`      | Format (shown only when that language's formatter is found)            |
| `Ctrl+J`           | Show or hide the bottom panel                                          |
| `Ctrl+K`           | Command palette: any problem, next recommended, random, due for review |

### Setting up AI Help

Open **Settings › Coach**, choose a provider, paste your API key, and optionally set a spending
cap. **Test connection** checks the key without spending anything. The key is stored only in your
local database, and the `COACH_API_KEY` environment variable overrides it. Using a real key for the
first time? Follow [docs/API_KEY_TESTING.md](docs/API_KEY_TESTING.md).

### Running the judge in Docker

With Docker installed, the judge can run every step in a throwaway container: no network, a
read-only filesystem, and memory and process limits. You then don't need Python or a JDK locally.

```
docker pull python:3.14-slim
docker pull eclipse-temurin:21-jdk
DEVPROMAX_EXECUTOR=docker npm start     # PowerShell: $env:DEVPROMAX_EXECUTOR='docker'; npm start
```

Each Run costs about a second more for container start-up. Judge containers carry the label
`devpromax.judge=1`.

## Configuration

Everything is optional. Most preferences (editor, judge limits, theme, coach) live in **Settings**.

| Variable                                                                           | Purpose                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `DEVPROMAX_PYTHON`, `DEVPROMAX_JAVA`, `DEVPROMAX_JAVAC`                            | Use a specific runtime instead of the one on `PATH`                      |
| `DEVPROMAX_EXECUTOR=docker`                                                        | Run the judge in containers                                              |
| `DEVPROMAX_DOCKER`, `DEVPROMAX_DOCKER_PYTHON_IMAGE`, `DEVPROMAX_DOCKER_JAVA_IMAGE` | Docker binary and the images it uses                                     |
| `DEVPROMAX_PORT`                                                                   | Server port (default `5174`)                                             |
| `DEVPROMAX_DATA`                                                                   | Move the whole `data/` directory                                         |
| `DEVPROMAX_DB`                                                                     | Move just the database file                                              |
| `COACH_API_KEY`                                                                    | Coach API key; overrides the one saved in Settings                       |
| `DEVPROMAX_BLACK`                                                                  | Path to `black`, if it isn't on `PATH` or reachable as `python -m black` |
| `DEVPROMAX_GOOGLE_JAVA_FORMAT`                                                     | Path to google-java-format's `-all-deps.jar`                             |

## Your data

Everything the app writes lives in `data/`. Your progress is one SQLite file,
`data/devpromax.db`.

```
npm run db:backup                  # consistent copy, safe while the app runs; the API key is left out
npm run db:backup -- --include-key # ...or kept
npm run db:restore -- <file>       # put a backup back (stop the app first); the old file is kept beside it
```

## Development

```
npm test                   # unit, contract and judge integration (spawns real python/java)
npm run test:unit          # everything except *.integration.test.ts; seconds
npm run test:e2e           # Playwright, on its own ports and database; safe beside `npm run dev`
npm run lint && npm run typecheck && npm run format:check
npm run perf:lighthouse    # performance and accessibility on the built app (run `npm run build` first)
```

The repo is an npm workspace: `apps/server` (Fastify API, judge, coach), `apps/web` (React UI) and
`packages/shared` (zod schemas and types both sides use). Problems are content, under
`problems/<topic>/<slug>/`. [ROADMAP.md](ROADMAP.md#3-repository-layout) maps the folders.

### Adding a problem

```
npm run problems:new <topic> <slug>      # scaffold a package
npm run problems:gen <slug>              # generate hidden tests from generator.py
npm run problems:validate <slug>         # schema checks, then both reference solutions must pass
```

A problem needs an original statement, three or more samples, ten or more generated hidden tests,
a hint ladder, an editorial, and starter plus reference code in both languages.
[docs/AUTHORING.md](docs/AUTHORING.md) walks through it.

## Documentation

| Doc                                           | What it covers                                  |
| --------------------------------------------- | ----------------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)       | How the pieces fit: judge, API, coach, database |
| [PROBLEM_FORMAT.md](docs/PROBLEM_FORMAT.md)   | The problem package specification               |
| [AUTHORING.md](docs/AUTHORING.md)             | Writing a new problem                           |
| [CURRICULUM.md](docs/CURRICULUM.md)           | The catalogue, topic by topic                   |
| [DESIGN.md](docs/DESIGN.md)                   | The design system and its review checklist      |
| [COACH_PROMPTS.md](docs/COACH_PROMPTS.md)     | How the coach is instructed                     |
| [API_KEY_TESTING.md](docs/API_KEY_TESTING.md) | Checking AI Help against a real key, safely     |
| [ROADMAP.md](ROADMAP.md)                      | Goals, architecture decisions, open tasks       |
| [CHANGELOG.md](CHANGELOG.md)                  | What changed and why, newest first              |
| [CLAUDE.md](CLAUDE.md)                        | Working agreement for AI-assisted development   |
