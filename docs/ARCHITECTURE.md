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

---

## 2. Threat model

### 2.1 What we are and are not defending against

DevProMax runs arbitrary code on the user's machine. That is the product, not a
flaw. The threat model has to be stated precisely or the mitigations look either
paranoid or inadequate.

**Not in scope.** Protecting the user from their own solutions. It is their code,
their machine, their account. A solution that deletes a file or opens a socket is
doing something the user could have done in a terminal a moment earlier. There is
no sandbox on this machine to provide one with (no Docker — see D3), and
pretending otherwise would be worse than being clear about it. The `data/judge/`
workspace is isolation for _tidiness_, not for security.

**In scope, and the reason the hardening exists.** Stopping anything else on the
machine — above all, a web page in another browser tab — from reaching the
endpoint that runs code. That attacker does not need to read our responses. A
fire-and-forget `POST /api/run` that makes us compile and execute a payload is
already a full compromise, and `fetch(..., {mode: 'no-cors'})` or a plain
`<form>` submit can issue one without ever seeing the reply.

### 2.2 The four checks

Each is independently sufficient; they are layered because each has a failure
mode the others do not.

| #   | Check                                   | Stops                                                                                                                                                          | Where                   |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Bind to `127.0.0.1`                     | Anything off-machine connecting at all. `0.0.0.0` would expose a code runner to the local network — a coffee-shop Wi‑Fi away from remote execution.            | `config.ts`, `index.ts` |
| 2   | `Host` must be a loopback name          | DNS rebinding: an attacker's domain resolving to `127.0.0.1` so their page can talk to us as a same-origin peer. Their `Host` header still names their domain. | `api/hardening.ts`      |
| 3   | `X-DevProMax-Client` required on `/api` | Simple cross-origin requests. A custom header makes a request non-simple, so the browser must preflight — and we answer no preflight.                          | `api/hardening.ts`      |
| 4   | `application/json` bodies only          | `<form>` POSTs, which cannot set that content type and are the one cross-origin request a browser will send without a preflight.                               | `api/hardening.ts`      |

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
3. **Isolation fallback.** When a per-test timeout fires, the harness records the
   TLE and exits; the judge then re-runs only the tests that never got a chance,
   one process each, and sets `isolationFallback` on the result. A runaway thread
   cannot be stopped safely in either language, so bowing out is the honest
   option rather than pretending to interrupt it.

### 3.2 Limits

| Limit               | Value                                                     | Why                                                                                                                                 |
| ------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Per-test wall clock | 2 s Java, 4 s Python, per-problem override                | Python is roughly half the speed on this kind of work; a single figure would either be too tight for Python or useless for Java.    |
| Compile             | 20 s, once per run                                        | `javac` on a cold JVM is slow; per-test compilation never happens.                                                                  |
| Java heap           | `-Xmx256m`                                                | Makes `MLE` an honest verdict. Without it an allocation storm is an OS kill the user cannot interpret.                              |
| Java stack          | `-Xss64m`, matched by the harness thread                  | Deep recursion behaves the same in both languages.                                                                                  |
| Python recursion    | 10,000, on a 64 MB stack thread                           | The raised limit would overflow the default 1 MB stack and crash the process; on the big stack it reports `RecursionError` instead. |
| Output              | 16 KB per test in the harness, 64 KB per run in the judge | A runaway `print` should not exhaust memory before it can be truncated.                                                             |

CPython has no equivalent of `-Xmx` here, so Python memory exhaustion is reported
as `RE`. Claiming `MLE` would mean claiming a limit the judge does not enforce.

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

### 3.4 The harness protocol

Both harnesses implement the same contract, which is why the judge core knows
nothing about either language beyond how to start one:

- **In**: `payload.json` — mode, entry, expect, per-test timeout, absolute paths,
  and the tests.
- **Out**: `results.jsonl` — one record per test, flushed immediately.
- **Exit codes**: `0` every test attempted, `2` the solution could not be loaded,
  `3` a per-test timeout fired and the rest were abandoned.

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

## 4. Persistence

`node:sqlite` with hand-written SQL and checked-in migrations applied at startup
(D14). The database is a single file at `data/devpromax.db`, which is gitignored
along with the judge workspaces. There is no ORM: eight tables do not justify
one, and removing the last native module from the stack removes the most common
Windows install failure.

**Migrations** are `.sql` files in `apps/server/src/db/migrations/`, named
`NNN_snake_case.sql` and numbered contiguously from `001`. The runner compares
`PRAGMA user_version` with the highest checked-in version and applies what is
missing, each migration and its version bump inside one transaction — so an
interrupted upgrade leaves the database on the last version that fully applied,
never between two. Contiguity is enforced rather than assumed: the failure this
guards against is two branches each adding an `002_`, where whichever merged
second would never run on a database that already recorded version 2.

**Tables**: `submissions`, `drafts`, `problem_progress`, `coach_sessions`,
`coach_messages`, `notes`, `settings`, `events`. Timestamps are ISO-8601 UTC
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

---

## 5. Testing strategy

| Layer                               | Tool                                  | What it proves                                                                                                           |
| ----------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Schemas, comparators, status engine | Vitest unit                           | Edge cases, in isolation.                                                                                                |
| Problem packages                    | `problems:validate --static`          | The catalogue's structure.                                                                                               |
| Problem correctness                 | `problems:validate`                   | Both references pass every test in both languages — the merge gate.                                                      |
| Judge                               | Vitest integration, real subprocesses | Process handling, encodings, the harness protocol. Run on Windows _and_ Linux in CI, because this layer is OS-sensitive. |
| Components                          | React Testing Library                 | UI behaviour.                                                                                                            |
| Golden paths                        | Playwright                            | The flows a user actually performs.                                                                                      |
| LLM adapters                        | Recorded fixtures                     | No network in CI.                                                                                                        |

Mocking the judge's subprocesses would test nothing that matters: nearly every
bug this layer can have lives in exactly the things a mock removes.

---

## 6. Continuous integration

Two workflows, both in `.github/workflows/`.

`ci.yml` runs on every pull request and every push to `main`:

| Job      | Runners                           | Steps                                                           |
| -------- | --------------------------------- | --------------------------------------------------------------- |
| `static` | `ubuntu-latest`, `windows-latest` | `lint`, `format:check`, `typecheck`, and `build` on Ubuntu only |
| `test`   | `ubuntu-latest`, `windows-latest` | `test:unit`, `test:integration`, `problems:validate`            |
| `e2e`    | `ubuntu-latest`                   | Playwright golden paths, report uploaded as an artifact         |

`nightly-e2e.yml` runs the Playwright suite on `windows-latest` at 06:00 UTC and
on demand. Windows E2E is slow and the flakiest lane we have, so it does not
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
