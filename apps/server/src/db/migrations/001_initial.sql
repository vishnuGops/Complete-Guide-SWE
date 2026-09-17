-- 001_initial.sql - the whole schema as of ROADMAP P3-2.
--
-- Conventions used throughout:
--   * Timestamps are ISO-8601 UTC strings ("2026-09-17T09:00:00.000Z"), which is
--     what the zod schemas in @devpromax/shared already carry. Nothing is
--     converted on the way in or out, and the strings sort chronologically.
--   * Enumerations the domain treats as closed get a CHECK constraint, so a typo
--     fails at the write rather than three screens later in the UI.
--   * Rows are keyed by problem slug, not by a numeric problem id. The slug is
--     the stable identifier on disk and in URLs; a problem id would be a second
--     name for the same thing and could disagree with the first.

-- Every submit, kept forever: the history view restores old code into the
-- editor, so this table is an archive rather than a cache.
CREATE TABLE submissions (
  id              TEXT    PRIMARY KEY,
  slug            TEXT    NOT NULL,
  language        TEXT    NOT NULL CHECK (language IN ('python', 'java')),
  -- Snapshot of the editor at submit time.
  code            TEXT    NOT NULL,
  verdict         TEXT    NOT NULL CHECK (verdict IN ('AC', 'WA', 'TLE', 'RE', 'CE', 'MLE')),
  passed          INTEGER NOT NULL CHECK (passed >= 0),
  total           INTEGER NOT NULL CHECK (total >= 0),
  time_ms         REAL    NOT NULL CHECK (time_ms >= 0),
  -- meta.version at submit time. Tests change; a verdict recorded against
  -- version 2 must not be reread as if it had faced version 5's tests.
  problem_version INTEGER NOT NULL CHECK (problem_version >= 1),
  created_at      TEXT    NOT NULL
);

-- The list is always "this problem, this language, newest first".
CREATE INDEX submissions_by_problem ON submissions (slug, language, created_at DESC);
CREATE INDEX submissions_by_date ON submissions (created_at DESC);

-- Autosaved editor content: one draft per problem and language. Saving a draft
-- never touches problem_progress (D11) - browsing and typing are not attempts.
CREATE TABLE drafts (
  slug       TEXT NOT NULL,
  language   TEXT NOT NULL CHECK (language IN ('python', 'java')),
  code       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (slug, language)
);

-- Status per problem *and* language. The headline status shown in the list is
-- the best of a problem's rows, computed by the status engine (P3-3), not stored
-- here: storing it would create a second source of truth to keep in sync.
CREATE TABLE problem_progress (
  slug              TEXT    NOT NULL,
  language          TEXT    NOT NULL CHECK (language IN ('python', 'java')),
  status            TEXT    NOT NULL CHECK (status IN ('not_started', 'in_progress', 'solved', 'mastered')),
  attempts          INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  solved_at         TEXT,
  mastered_at       TEXT,
  last_attempted_at TEXT,
  PRIMARY KEY (slug, language)
);

CREATE INDEX problem_progress_by_status ON problem_progress (status);

-- One coach conversation, scoped to a problem and language (D13): context from
-- another problem would only make the coach vaguer.
CREATE TABLE coach_sessions (
  id         TEXT NOT NULL PRIMARY KEY,
  slug       TEXT NOT NULL,
  language   TEXT NOT NULL CHECK (language IN ('python', 'java')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX coach_sessions_by_problem ON coach_sessions (slug, language, created_at DESC);

CREATE TABLE coach_messages (
  id         TEXT NOT NULL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES coach_sessions (id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'coach')),
  -- Markdown as rendered in the panel.
  content    TEXT NOT NULL,
  -- The structured CoachFeedback JSON when this message carried one; NULL for
  -- plain chat turns. Kept whole so P5-5 can summarise past attempts without
  -- another provider call.
  feedback   TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX coach_messages_by_session ON coach_messages (session_id, created_at);

-- Per-problem notes, not per-language: a note is about the problem, and a user
-- who solves it twice should not have to find which language they wrote under.
CREATE TABLE notes (
  slug       TEXT NOT NULL PRIMARY KEY,
  body       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Key/value rather than one row of columns, and one row per top-level settings
-- section. A partial update writes only the sections it touches, and adding a
-- section later needs no migration.
CREATE TABLE settings (
  key   TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
);

-- Append-only activity log behind streaks and the dashboard (P7-5). Deliberately
-- has no CHECK on `type`: unlike a verdict, the set of things worth recording
-- grows with the learning features, and a migration per new event type would buy
-- nothing - nothing branches on this column, it is only counted and grouped.
CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL,
  slug       TEXT,
  language   TEXT CHECK (language IS NULL OR language IN ('python', 'java')),
  -- Optional JSON detail (verdict, duration, ...).
  payload    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX events_by_date ON events (created_at DESC);
CREATE INDEX events_by_problem ON events (slug, created_at DESC);
