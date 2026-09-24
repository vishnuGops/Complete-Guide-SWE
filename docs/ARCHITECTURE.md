# Architecture

This document covers how DevProMax is put together and, in particular, the
threat model behind the judge and the local server. The reasoning behind each
decision lives in `ROADMAP.md` section 2 (D1–D18); this document says how those
decisions are realised in code.

---

## 1. Shape of the system

```
browser (127.0.0.1:5173 in dev, served by the server in production)
   │  fetch /api/*  with X-DevProMax-Client
   ▼
apps/server  (Fastify, 127.0.0.1 only)
   ├── api/        routes + hardening
   ├── db/         node:sqlite, migrations, repositories
   ├── problems/   loader, validator, authoring CLIs
   ├── coach/      provider adapters (Anthropic, Gemini)
   └── judge/      workspaces, executors, harnesses, comparators
                      │  spawn
                      ▼
               python / javac + java     (subprocesses, one workspace per run)
```

`packages/shared` holds the zod schemas both sides import, so a request shape
cannot drift between the UI and the server.

**In the web app** (`apps/web`), every screen but the problem list is a lazy
route behind the shell's error boundary, which resets when the path changes
(P4-18, P4-15). Two hooks own the workspace's state that outlives a render:
`useDebouncedAutosave` writes drafts and notes only under the scope the text was
loaded from, flushes on scope change, unmount and `pagehide` (keepalive, or an
ordinary request past the browser's 64 KB keepalive cap), and retries a failed
write with a visible note (P4-14); `useJudgeFlow` owns the one verdict on screen
and drops any answer whose `slug:language` is no longer the one showing
(P4-15). The shortcut registry listens on the window in the capture phase, so a
field that handles its own keys opts out with `data-shortcuts="local"`, and a
busy screen keeps its bindings registered as no-ops rather than letting a key
fall through to Monaco.

---

## 2. Threat model

### 2.1 What we are and are not defending against

DevProMax runs arbitrary code on the user's machine. That is the product, not a
flaw. The threat model has to be stated precisely or the mitigations look either
paranoid or inadequate.

**Not in scope.** Protecting the user from their own solutions. It is their code,
their machine, their account. A solution that deletes a file or opens a socket is
doing something the user could have done in a terminal a moment earlier. By
default there is no sandbox, and pretending otherwise would be worse than being
clear about it: the `data/judge/` workspace is isolation for _tidiness_, not for
security. Where Docker is installed, `DEVPROMAX_EXECUTOR=docker` runs every judge
step in a locked-down container instead (§3.6, D3) — for someone pasting in code
they did not write, or who simply wants the line drawn. It is an option, not the
baseline this model relies on.

**In scope, and the reason the hardening exists.** Stopping anything else on the
machine — above all, a web page in another browser tab — from reaching the
endpoint that runs code. That attacker does not need to read our responses. A
fire-and-forget `POST /api/run` that makes us compile and execute a payload is
already a full compromise, and `fetch(..., {mode: 'no-cors'})` or a plain
`<form>` submit can issue one without ever seeing the reply.

### 2.2 The four checks

They are layered because each has a failure mode the others do not. Checks 3
and 4 were once described as each sufficient on its own; the 2026-09-24 audit
(P3-8) showed that a check is only as good as its idea of which requests it
covers.

| #   | Check                                   | Stops                                                                                                                                                          | Where                   |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Bind to `127.0.0.1`                     | Anything off-machine connecting at all. `0.0.0.0` would expose a code runner to the local network — a coffee-shop Wi‑Fi away from remote execution.            | `config.ts`, `index.ts` |
| 2   | `Host` must be a loopback name          | DNS rebinding: an attacker's domain resolving to `127.0.0.1` so their page can talk to us as a same-origin peer. Their `Host` header still names their domain. | `api/hardening.ts`      |
| 3   | `X-DevProMax-Client` required on `/api` | Simple cross-origin requests. A custom header makes a request non-simple, so the browser must preflight — and we answer no preflight.                          | `api/hardening.ts`      |
| 4   | `application/json` bodies only          | `<form>` POSTs, which cannot set that content type and are the one cross-origin request a browser will send without a preflight.                               | `api/hardening.ts`      |

**The `/api` checks key on the route the router matched, never on the raw URL**
(P3-8, `isApiRequest` in `api/hardening.ts`). find-my-way decodes a path before
routing, so `/%61pi/settings/reset-progress` reaches the same handler as
`/api/settings/reset-progress` while `request.url` still reads `/%61pi/...`; a
check on the raw string is a check an attacker can spell around, and until P3-8
this one could be - a no-cors form post from any tab reset progress. The check
reads `request.routeOptions.url`, and when nothing matched it falls back to the
decoded, slash-collapsed, lower-cased path, because wrongly treating a path as
API costs only a 403 on what would have been a 404. Fastify's default
`text/plain` parser is removed as well, so a simple-request content type cannot
become a body on any route, whatever a hook decides.

**No CORS headers are ever sent.** This is load-bearing, not an omission: it is
what makes check 3 work. There is deliberately no `@fastify/cors` in this project,
and adding one — even "just for development" — would open the hole all four
checks exist to close.

The client header is **not a secret** and is not treated as one. Any value
satisfies it. Its only job is to force a preflight.

### 2.3 Secrets

The user's LLM API key is stored in the local SQLite database. It is never
logged (pino redacts the paths in `logger.ts`), never returned by the API
(`SettingsView` omits the field entirely rather than nulling it, so there is no
field to leak through), and never included in an export or a test fixture.
`COACH_API_KEY` in the environment overrides the stored value.

**Backups leave the key out** (P3-10). D19 accepts the key at rest in the live
database, on the machine it belongs to; a backup exists to travel to another
disk or a synced folder, which is a different place. `db:backup` nulls
`coach.apiKey` in the copy with `secure_delete` on and an in-memory journal, then
vacuums it, so the key's bytes are gone from the file and not merely from its
row. `--include-key` keeps it for someone who wants a backup that restores
everything.

**One key slot, several vendors.** The server cannot tell whose key it holds, so
Settings says keys are per vendor and, after a provider switch, that the stored
one may belong to the previous provider. Where a provider lives is decided in
one place, `providerOptionsFor` in `settingsService.ts`: a configured `baseUrl`
applies only to a provider that needs one, so a leftover local URL is never
handed an Anthropic key (P5-11).

---

## 3. The judge

### 3.1 One process per run, not per test

All the tests of a run execute in a single subprocess (D3). Paying JVM or
interpreter startup per test would put a Submit into the tens of seconds, which
changes what the tool is for.

The cost is that one hanging test could take the whole batch with it. Three
things make that survivable:

1. **Results stream to a file, not stdout.** The harness writes JSON Lines to
   `results.jsonl`, flushing after each test. A killed process therefore still
   leaves behind everything it finished — and the user's own `print` cannot
   corrupt the result stream, because results never travel over stdout at all.
2. **The harness enforces each test's own budget.** Python uses a timer thread,
   Java a join timeout on a worker thread.
3. **Restart after a failure** (P2-17). When a test times out, crashes the
   process or calls `System.exit`, the harness records it and exits - a runaway
   thread cannot be stopped safely in either language, so bowing out is the
   honest option rather than pretending to interrupt it - and the judge starts a
   new batch at the test after it: one process per failure plus one, with
   `isolationFallback` set. Until P2-17 it re-ran every remaining test in a
   process of its own, so one early TLE among forty tests cost thirty-nine JVM
   starts. A solution that never reports `ready` (a loop at module level, a static
   initialiser that throws or exits) is one load failure for every test rather
   than a re-run per test. Every batch, restarts included, has the stall
   watchdog.

### 3.2 Limits

| Limit               | Value                                                                                  | Why                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Per-test wall clock | 2 s Java, 4 s Python, per-problem override                                             | Python is roughly half the speed on this kind of work; a single figure would either be too tight for Python or useless for Java.    |
| Compile             | 20 s, once per run                                                                     | `javac` on a cold JVM is slow; per-test compilation never happens.                                                                  |
| Java heap           | `-Xmx256m`                                                                             | Makes `MLE` an honest verdict. Without it an allocation storm is an OS kill the user cannot interpret.                              |
| Java stack          | `-Xss64m`, matched by the harness thread                                               | Deep recursion behaves the same in both languages.                                                                                  |
| Python recursion    | 10,000, on a 64 MB stack thread                                                        | The raised limit would overflow the default 1 MB stack and crash the process; on the big stack it reports `RecursionError` instead. |
| Output              | 16 KB per test in the harness, 64 KB per run in the judge (stdout and stderr together) | A runaway `print` should not exhaust memory before it can be truncated.                                                             |

CPython has no equivalent of `-Xmx` here, so Python memory exhaustion is reported
as `RE`. Claiming `MLE` would mean claiming a limit the judge does not enforce.

A Java `StackOverflowError` is reported as one even when unwinding it outlasts
the budget: under `-Xss64m` a one-line runaway recursion is about four million
frames deep, and unwinding them took longer than two seconds on a loaded machine,
so the audit's baseline saw TLE. A worker at least 1,000 frames deep when its
budget runs out gets up to two more seconds, and only an overflow earns `RE` from
it - anything else is still TLE (P2-19).

### 3.3 Process handling

Every spawn goes through `judge/process.ts`, which:

- passes arguments **verbatim, never through a shell** — both safer and the only
  way paths with spaces behave identically on Windows and Linux;
- **closes stdin**, so a solution that reads input fails immediately with EOF
  rather than hanging until the timeout and reporting a confusing TLE;
- **kills the whole process tree** on timeout (`taskkill /T /F` on Windows, a
  negative-PID signal to the process group on POSIX). An orphaned grandchild
  would otherwise hold the workspace open, which on Windows makes it
  undeletable;
- waits for `close` rather than `exit`, so output written just before exit is not
  lost.

Workspaces live at `data/judge/<uuid>/`. **No part of that path is derived from
user input** — not the slug, not a file name from the request — so there is
nothing to traverse out of. They are removed in a `finally`, and a startup sweep
clears any left by a process that died before it could, touching only directories
older than an hour so it cannot race a run in progress.

**The compiled Java harness is cached beside the workspaces** (P2-18), in
`data/devpromax-judge-cache/java-harness-<hash>`, the hash covering the harness
source, `--release`, the launcher and `javac -version`. It is built once in a
scratch directory and renamed into place, so a directory that exists is
complete, and it is never inside `data/judge`, which the startup sweep empties.
Each run compiles only `Solution.java` against it (about 0.7-0.9 s off a Java
Run here). A user class named `ListNode`, `TreeNode` or `DevProMax*` is found from
the class files javac wrote and explained as before, now with its line.

**A closed tab cancels its run** (P2-17): the request's `close` aborts a signal
that reaches the queue, which drops a waiting run, and `runProcess`, which kills
a running one's tree. Nothing is recorded for an aborted run, because nobody
saw the verdict.

### 3.4 The harness protocol

Both harnesses implement the same contract, which is why the judge core knows
nothing about either language beyond how to start one:

- **In**: `payload.json` — mode, entry, expect, per-test timeout, absolute paths,
  and the tests.
- **Out**: `results.jsonl` — one record per test, flushed immediately.
- **Ready**: `{"event":"ready"}` once the solution has loaded and its entry
  point is found (P2-17). A batch that ends without it is a load failure, not a
  test failure.
- **Exit codes**: `0` every test attempted, `2` the solution could not be loaded,
  `3` a per-test timeout fired and the rest were abandoned, `4` the solution
  ended the process (`System.exit`, reported against its test by a shutdown hook).
- A record that names a test but fails the schema - a number beyond what JSON
  can carry, say - becomes an `UnreadableResult` for that test rather than
  vanishing (P2-19). A Python `SyntaxError` is the harness's own `compile` record,
  lifted into CE with its line and column; there is no separate syntax-check
  process on Run or Submit (P2-18).

Argument typing comes from the user's own signature (D5) — Python reads the
method's annotations, Java reflects on the declared parameter types — so no
metadata anywhere repeats what the starter already says.

### 3.5 Run and Submit

Both go through the same judge; they differ in what they run and what they are
allowed to write down (`apps/server/src/api/runService.ts`).

|            | Tests                             | Recorded                                                                                           |
| ---------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Run**    | Samples plus the user's own cases | That they are working on it: In progress, and an activity event                                    |
| **Submit** | Samples plus every hidden test    | The code, verdict, slowest test, and the problem version it faced; an accepted run makes it Solved |

A **custom case is input with no expectation**. Run with custom input answers
"what does my code do with this", which is a different question from "is my code
correct", so the judge reports the value rather than grading it — a crash is
still a runtime error, but a surprising answer is not a wrong one. The arity and,
for operations problems, the legal method names come from the problem's own
samples, which are what the harness actually calls the solution with. The same
parser runs in the editor and on the server (`packages/shared/src/customTests.ts`):
the editor validating as the user types is a convenience for them, not a
guarantee to us.

**Hidden tests stay hidden, except the first one that fails.** A Submit that
only said "wrong answer on test 7" would give the user nothing to work with; a
Submit that showed all forty would hand them the test set. The policy lives in
the judge rather than in the service, because it has to apply to everything that
runs hidden tests — including the validator, which turns it off deliberately.

---

### 3.6 The Docker executor (optional)

`DEVPROMAX_EXECUTOR=docker` swaps _where_ code runs and nothing else (P9-2). The
executor interface was kept small for exactly this: the Python and Java
executors are built over a `Launcher` (`judge/executors/launcher.ts`), which
answers two questions — what a workspace file is called from the program's
side, and how to start a program — and the Docker launcher answers them with
`/ws/...` and `docker run`. Harness, protocol, verdicts, comparators and the
isolation fallback are the same code in both modes; the integration suite runs
the pilots through containers and expects the local executor's verdicts.

Every judge step (a Java compile, the Java harness build - once per harness
version - and a batch of tests; Python has no separate syntax check since P2-18)
is one
`docker run --rm` of a stock image — `python:3.14-slim` and
`eclipse-temurin:21-jdk` by default, overridable with
`DEVPROMAX_DOCKER_PYTHON_IMAGE` / `DEVPROMAX_DOCKER_JAVA_IMAGE` — with the
workspace bind-mounted at `/ws` and the cached harness read-only at
`/devpromax`. One container per step rather than a long-lived
one per run, because the judge kills steps (stall, timeout, restart) and a
killed container is gone, where a killed `docker exec` is not.

What each container is denied:

| Flag                                                    | Stops                                                          |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `--network none`                                        | exfiltration, downloads, reaching this API on 127.0.0.1        |
| `--read-only`, tmpfs `/tmp` (64 MB)                     | writes anywhere but the workspace the judge deletes            |
| `--cap-drop ALL`, `no-new-privileges`, non-root         | escalation inside the container                                |
| `--memory 1g` (no swap), `--pids-limit 256`, `--cpus 2` | a fork bomb or allocation storm reaching the machine           |
| only `HOME` and `LANG` via `--env`                      | the server's environment — P2-11's allow-list, made structural |
| `timeout -s KILL` around the program                    | a container outliving a server that died without killing it    |
| `--pull never`                                          | a 200 MB download disguised as a compile timeout               |

The user is the server's own `uid:gid` on Linux, where bind mounts keep real
ownership and a root-written `.class` file would be undeletable, and `nobody`
under Docker Desktop, whose file sharing ignores ownership.

Killing the `docker` client does not stop its container, so `runProcess` takes an
`onKill` hook that every kill path calls — the wall clock, the stall watchdog and
Ctrl+C — and the launcher uses it to `docker kill` the container by name. A
failure of Docker itself (daemon down, image missing, an image without `javac`)
is a `JudgeUnavailableError`, answered as `503 JudgeUnavailable` with the fix in
the message; a solution's own failure, including one that exits 125 or prints
the daemon's words, is never mistaken for one. The doctor checks the daemon and
reads each image's language version from its configuration, so checking never
starts a container.

Every container carries the label `devpromax.judge=1`, so anything watching the
daemon can tell a judge step from a service. It costs about a second per Run on
Docker Desktop (two container starts): measured 2026-09-22 on a 4-core Xeon,
Python 0.26 s → 1.2 s and Java 1.2 s → 2.1 s. Since P2-18 a Python Run is
one container start rather than two, and a Java compile no longer includes the
harness.

### 3.7 Formatters (optional)

`black` and `google-java-format` (AOSP style, the starters' four-space indent)
run as subprocesses through the same `runProcess` as the judge, with the code on
stdin and the allow-listed environment (P9-5, `apps/server/src/formatters.ts`).
They are not the judge: they parse code and never run it, so they run on this
machine whichever executor is configured, and outside the judge queue. Neither
ships with the app. Each is found by running it with `--version` - `DEVPROMAX_BLACK`,
else `black`, else `<judge python> -m black`; `DEVPROMAX_GOOGLE_JAVA_FORMAT` (a jar,
run with the judge's `java`, or an executable), else `google-java-format` - once at
start-up and again when Settings asks. `POST /api/format` answers `formatted`,
`invalid` (the formatter's complaint, with its line) or `unavailable`, all 200s:
code that does not parse yet is the normal state of code being written.

The workspace shows Format only for a language whose formatter was found. The
answer is applied as one undoable Monaco edit, and only if the editor still
holds exactly what was sent. `Ctrl+S` saves the draft at once and formats first
when the `formatOnSave` preference is on. It is deliberately not tied to the
autosave, which fires mid-line.

## 4. Persistence

`node:sqlite` with hand-written SQL and checked-in migrations applied at startup
(D14). The database is a single file at `data/devpromax.db`, which is gitignored
along with the judge workspaces. There is no ORM: nine tables do not justify
one, and removing the last native module from the stack removes the most common
Windows install failure.

**Where it lives is configurable** (P8-3). `DEVPROMAX_DATA` moves the whole
directory - the database, the judge's workspaces, a backup written beside them -
which is what someone with a checkout on a synced drive wants. `DEVPROMAX_DB`
moves only the database file and wins over it, being the narrower of the two; it
exists because the end-to-end suite needs exactly that and nothing else.

**Migrations** are `.sql` files in `apps/server/src/db/migrations/`, named
`NNN_snake_case.sql` and numbered contiguously from `001`. The runner compares
`PRAGMA user_version` with the highest checked-in version and applies what is
missing, each migration and its version bump inside one transaction — so an
interrupted upgrade leaves the database on the last version that fully applied,
never between two. Contiguity is enforced rather than assumed: the failure this
guards against is two branches each adding an `002_`, where whichever merged
second would never run on a database that already recorded version 2.

**Tables**: `submissions`, `drafts`, `problem_progress`, `coach_sessions`,
`coach_messages`, `notes`, `bookmarks`, `settings`, `events`, `interviews`.
`coach_sessions.kind` is `coach` or `interview` (migration 007, P5-12): an
interview's turns are a coach conversation with another system prompt, and AI
Help's "latest conversation" must never be one of them. Timestamps are ISO-8601 UTC
strings, which is exactly what the zod schemas in `@devpromax/shared` carry, so
no value is converted on the way in or out and string ordering is chronological
ordering. Closed enumerations (language, verdict, status) carry CHECK
constraints; `events.type` deliberately does not, because nothing branches on it
and the set of things worth recording grows with the learning features.

**Repositories** in `apps/server/src/db/repos/` are the only place SQL lives.
Routes receive a `Repositories` handle, never a raw database, which is what keeps
a new query testable against an in-memory database without starting a server.
They store and retrieve; they do not decide. In particular `problem_progress`
rows are written exactly as given, because the rule that a later Wrong Answer
never demotes Solved belongs to the status engine (P3-3), and a rule implemented
in two places is a rule that will disagree with itself.

**Four things are derived rather than stored**, and the pattern is deliberate
(P7-1, P7-2, P7-8, P7-9). How many hint rungs are open is `MAX(rung)` over the
`hint_revealed` events; whether the editorial is unlocked is "solved, or an
`editorial_revealed` event exists"; the review queue is a count of accepted
submissions plus arithmetic; and version drift is the newest accepted
`problem_version` against the one on disk. Each could have been a column, and
each column would have held exactly what another table already said - including
through reset-all-progress, which clears the activity log and would otherwise
leave a user with no history and four hints still open.

**Backup and restore** (`db/backup.ts`, `npm run db:backup` / `db:restore`) use
SQLite's `VACUUM INTO` rather than copying the file. A live database is three
files - the database, the write-ahead log and its shared-memory index - so a
copy of the first one is missing whatever is still in the log; `VACUUM INTO`
asks SQLite for a consistent copy, which is correct while the app is running. A
restore inspects the candidate before it moves anything (is it SQLite, does it
carry our schema version, is that version one this build understands) and moves
the displaced database aside rather than deleting it. Since P3-10 it also
checkpoints the live database first, moves its `-wal` and `-shm` beside the
displaced copy instead of deleting them - they can hold the last work before a
hard stop, which is the work that made someone reach for a backup - and refuses
while the app answers `/health` or the file is busy: on Linux the rename would
succeed and the running server would keep writing to the file just moved aside.
`db:backup` opens without migrating (a backup copies what is there) and fails
when there is no database rather than backing up a new empty one.

**Days are the viewer's** (P7-11). Timestamps stay UTC everywhere they are
stored; only the dashboard's bucketing into days moves. The client sends its
IANA zone as `?tz=` and the streak, the calendar and the first-solves chart
count in it, because a streak is a promise about the practiser's own days and a
UTC day splits an evening in the Americas across two of them.

**The catalogue is read through caches** (P3-9). The list, the workspace and
the judge find problems through a remembered slug-to-directory map
(`discoverProblemsCached` / `locateProblem` in `problems/loader.ts`) and Submit
keeps the eight most recent fully-parsed packages; Run loads the samples only.
List entries are stamped on `meta.json`, packages on all nine files, and every
mtime cache follows git's "racily clean" rule with a 50 ms window: a reading
taken too soon after a write is not trusted and is read again, because Windows
stamps files from a clock with ticks of several milliseconds. The validator and
the CLIs read uncached. The review queue and the dashboard read SQL aggregates
(`submissions.acceptedSummary`, `events.countByType`) rather than the archive.

---

## 5. The HTTP API

Fastify, bound to `127.0.0.1`, behind the four checks in section 2. Every route
lives in `apps/server/src/api/routes/`, is thin, and delegates to a service in
`apps/server/src/api/` that can be tested without a server.

| Route                                    | Does                                                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET /api/problems`                      | List + filters (`topic`, `tier`, `status`, `q`, `language`) + sort                                              |
| `GET /api/problems/:slug`                | Everything the workspace opens with: statement, samples, hints, starters, drafts, progress, related             |
| `GET /api/problems/:slug/assets/*`       | Images referenced by a statement, from that problem's `assets/` only                                            |
| `GET /api/problems/:slug/submissions`    | Submission history, newest first                                                                                |
| `POST /api/run` · `POST /api/submit`     | The judge, with the Run/Submit semantics of section 3.5                                                         |
| `GET /api/progress`                      | Per-status, per-topic and per-tier counts over the whole catalogue                                              |
| `PUT` · `DELETE /api/drafts/:slug/:lang` | Autosave, and reset-to-starter                                                                                  |
| `PUT /api/progress/:slug/:lang`          | The manual override — the only thing that may move a status down (D11)                                          |
| `GET` · `PUT /api/settings`              | Settings, with the coach API key write-only (below)                                                             |
| `POST /api/settings/test-connection`     | One authenticated call to the configured provider                                                               |
| `POST /api/settings/reset-progress`      | Wipes practice, keeps notes, bookmarks and settings                                                             |
| `GET /api/settings/doctor`               | Spawns `python`, `java` and `javac` and reports versions and problems (P8-3)                                    |
| `POST /api/problems/:slug/hints`         | Opens a hint rung; the body names the rung, so a doubled request is idempotent (P7-1)                           |
| `POST /api/problems/:slug/editorial`     | Unlocks the editorial early, recorded and permanent (P7-2)                                                      |
| `POST /api/problems/:slug/re-verify`     | Re-submits the last accepted code against the tests as they stand (P7-9)                                        |
| `PUT` · `DELETE /api/notes/:slug`        | Per-problem notes; a blank body deletes the row (P7-4)                                                          |
| `PUT` · `DELETE /api/bookmarks/:slug`    | Starred problems (P7-7)                                                                                         |
| `GET /api/next?mode=`                    | What to do next: `recommended`, `random` or `review` - with the reason (P7-7, P7-8)                             |
| `GET /api/dashboard?tz=`                 | Streak, recent activity, rubric averages per topic, the review queue (P7-5, P7-8), in the viewer's days (P7-11) |
| `GET /api/dashboard/report?format=&tz=`  | The skills report as JSON, markdown or one self-contained HTML file (P7-5)                                      |
| `POST /api/coach/feedback` · `/chat`     | The coach, as a server-sent event stream (P5-3)                                                                 |

Two routes in that table answer with something other than JSON: the coach pair
stream, because the whole point is showing an answer while it is still being
written, and the report is an attachment - a file to keep rather than a page to
look at.

**Validation.** Requests are parsed with the zod schemas in
`packages/shared/src/api.ts` — the same file the web client imports, so a shape
cannot drift between the two sides. Fastify's own JSON-schema validation is not
used; one validator and one source of truth is worth more than the marginal
speed of the other.

**Errors** all leave through one envelope, `{ error, message, issues? }`
(`api/errors.ts`), including Fastify's own — a 404 for an unknown route and a 400
for a malformed body look like everything else, so the client has one failure
shape to handle rather than two. `error` is a machine-readable tag (`NotFound`,
`BadRequest`, `NoApiKey`, `JudgeError`); `message` is a sentence fit to show a
user; `issues` point at the offending field.

**The catalogue** (`api/catalogue.ts`) reads `problems/` once in production and
per request everywhere else, because an author with `npm run dev` open expects an
edited statement on reload while a running app should not re-read two hundred
directories per keystroke. A package that does not parse is logged and skipped:
`npm run problems:validate` is the gate for correctness, and one problem being
mid-edit must not take the list page down.

**Three things are withheld by the server rather than by the UI.** Hidden tests
never leave the judge except for the first failing one (section 3.5); the
editorial is `null` until the problem is solved or explicitly revealed — a locked
editorial that was already in the payload is not locked — and the reference
solutions ride with it, absent from the payload rather than sent and hidden.
The coach is given one hint rung the user has _not_ opened (P7-1), marked secret
in its context beside the editorial, so that its nudge points where the problem's
author was pointing; it is told never to hand it over.

**A third provider speaks a protocol rather than to a vendor** (P9-4).
`openai-compatible` covers Ollama, LM Studio, llama.cpp, vLLM and anything in
front of them, which is what makes coaching possible with no request leaving the
machine. Two things are different about it and both are consequences of the
endpoint being the user's own: its address is a _setting_ rather than a constant,
and its cost is unknowable - `MODEL_PRICES` for it is empty on purpose, the spend
cap does not apply, and Settings says so instead of showing a confident `$0.00`.
Structured output is negotiated rather than assumed: `json_schema` first, and one
retry in `json_object` when the server says it cannot, because the answer is
re-validated against the zod schema here either way.

**The coach API key is write-only across this boundary.** `GET /api/settings`
returns a `SettingsView`, which has no `apiKey` field at all: the UI sees
`apiKeyMasked` (last four characters) and `apiKeySource` (`none` / `settings` /
`env`). `COACH_API_KEY` in the environment overrides the stored key, because a
shell that exports one expects it to be used. The raw key leaves the database in
exactly one direction — into a provider request made from
`apps/server/src/coach/`, behind the `CoachProvider` adapter, which is also the
only place that knows which vendor is configured.

---

## 6. Testing strategy

| Layer                               | Tool                                  | What it proves                                                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schemas, comparators, status engine | Vitest unit                           | Edge cases, in isolation.                                                                                                                                                                                                                            |
| Problem packages                    | `problems:validate --static`          | The catalogue's structure.                                                                                                                                                                                                                           |
| Problem correctness                 | `problems:validate`                   | Both references pass every test in both languages — the merge gate.                                                                                                                                                                                  |
| Judge                               | Vitest integration, real subprocesses | Process handling, encodings, the harness protocol. Run on Windows _and_ Linux in CI, because this layer is OS-sensitive. One file at a time (the `server-integration` project): four files at once on four cores measure the machine, not the judge. |
| Components                          | React Testing Library                 | UI behaviour.                                                                                                                                                                                                                                        |
| Golden paths                        | Playwright                            | The flows a user actually performs.                                                                                                                                                                                                                  |
| LLM adapters                        | Recorded fixtures                     | No network in CI.                                                                                                                                                                                                                                    |
| Accessibility                       | axe over every screen, both themes    | No serious or critical violation, in a real browser rather than from a linter.                                                                                                                                                                       |
| Performance                         | Playwright budgets, Lighthouse        | A 500-row list, a cold start, a burst of submissions; and ≥ 90 on the built app in both themes.                                                                                                                                                      |

Vitest has four projects: `shared`, `server` (unit), `server-integration` (real
interpreters, `fileParallelism: false`) and `web` (jsdom). The whole-catalogue
reference run in `references.integration.test.ts` is opt-in
(`DEVPROMAX_CATALOGUE_TESTS=1`), since `problems:validate` already is that run.

**Tests never touch the owner's data** (P8-6). Opening the default database
under Vitest throws, so a test that forgets an in-memory database fails loudly
instead of migrating `data/devpromax.db`. Playwright starts its own API on 5184
over a freshly emptied `data/e2e.db` (`e2e/reset-db.mjs`, which refuses any
other file name) and its own Vite on 5183, never reuses a running server, and
so never shares ports or a database with `npm run dev` - it used to, and its
coach spec blanked the stored API key.

Mocking the judge's subprocesses would test nothing that matters: nearly every
bug this layer can have lives in exactly the things a mock removes.

**Retries are a CI-only affordance, and they are counted** (P8-1). Locally
`retries` is 0, because a flake has to be seen to be fixed; in CI a test gets
two more attempts, and `apps/web/scripts/flake-budget.mjs` fails the job when
more than two tests passed only on a retry. A suite that quietly retries its way
to green is a suite nobody trusts, and a budget of zero is one that gets deleted
the first time a shared runner hiccups.

---

## 7. Continuous integration

Two workflows, both in `.github/workflows/`.

`ci.yml` runs on every pull request and every push to `main`:

| Job          | Runners                           | Steps                                                                                                   |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `static`     | `ubuntu-latest`, `windows-latest` | `lint`, `format:check`, `typecheck`, schemas, and `build` on Ubuntu only                                |
| `test`       | `ubuntu-latest`, `windows-latest` | `test:unit`, `test:integration`, `problems:validate` (changed problems on a PR, all of them on `main`)  |
| `generators` | `ubuntu-latest`                   | `problems:gen --check`: the changed problems on a PR, everything when generation itself changed         |
| `e2e`        | `ubuntu-latest`                   | `build`, then Playwright - including the production spec, which fails rather than skips without a build |
| `docker`     | `ubuntu-latest`                   | pulls the judge images, `doctor` and the Docker executor suite                                          |
| `formatters` | `ubuntu-latest`                   | installs the formatters, `doctor` and the formatter suite                                               |

`nightly-e2e.yml` (the "Nightly" workflow) runs at 06:00 UTC and on demand: the
Playwright suite on `windows-latest` after a build, the whole catalogue's
`problems:validate` on both operating systems, and `problems:gen --check` - what
D23 says nightly does. Playwright's Chromium is cached per Playwright version by
the `.github/actions/playwright-chromium` composite action, and Dependabot opens
weekly PRs for npm and for the Actions. Windows E2E is slow and the flakiest lane we have, so it does not
gate PRs — but Windows is the owner's primary platform, and a break there is a
break for the only user who matters.

The split between `test:unit` and `test:integration` is the `*.integration.test.ts`
suffix. Unit tests run in seconds and need nothing but Node; integration tests
spawn real `python` and `javac`/`java`, which is why they run on both operating
systems rather than just the cheap one. `problems:validate` runs the full
validator, not `--static`: the content gate is that both reference solutions
pass every test in both languages.

Toolchain versions come from `.nvmrc` (Node), `setup-python` 3.12 and
`setup-java` temurin 21 — the floor of the supported range, so a feature newer
than the floor fails in CI rather than on a user's machine. The judge resolves
`python`, `javac` and `java` from `PATH`, which is exactly what both setup
actions provide on both runners, so no `DEVPROMAX_*` overrides are needed.

**Branch protection is a repository setting, not a file.** On GitHub, under
Settings → Branches → `main`, require these checks before merging:
`static (ubuntu-latest)`, `static (windows-latest)`, `test (ubuntu-latest)`,
`test (windows-latest)`, `e2e (ubuntu-latest)`.
