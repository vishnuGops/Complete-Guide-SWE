-- 006_interviews.sql - mock interviews (ROADMAP P9-1).
--
-- One row per sitting. The conversation itself is not in here: an interview is
-- a coach conversation with a different system prompt, so its turns live in
-- `coach_messages` like every other turn and this table holds what makes the
-- sitting a sitting - which problems, how long, how far through, and the
-- debrief at the end.
--
-- Deliberately not joined to `coach_sessions` by a foreign key. A session is
-- created lazily, on the first thing the candidate says, and an interview that
-- was started and abandoned before a word was typed is still a row worth
-- keeping: it is the honest record that someone opened one and walked away.
CREATE TABLE interviews (
  id          TEXT    NOT NULL PRIMARY KEY,
  -- The problems chosen, as a JSON array of slugs, in the order they are asked.
  -- JSON rather than a child table: the list is read whole, written once, and
  -- never queried across rows.
  slugs       TEXT    NOT NULL,
  -- Wall-clock budget in milliseconds. Stored rather than assumed constant, so
  -- a 30-minute sitting recorded last month still reads as one.
  budget_ms   INTEGER NOT NULL CHECK (budget_ms > 0),
  -- Which problem is being discussed, 0-based; equal to the number of problems
  -- once the last one is done.
  at          INTEGER NOT NULL DEFAULT 0 CHECK (at >= 0),
  -- Where in the sitting this is: approach, coding, review, debrief, done. No
  -- CHECK, for the same reason `events.type` has none - the set grows with the
  -- feature and nothing branches on an unknown value except the screen, which
  -- has a default.
  stage       TEXT    NOT NULL DEFAULT 'approach',
  -- The coach conversation carrying the interviewer's turns, once one exists.
  session_id  TEXT,
  -- Markdown, written at the end. NULL while the interview is still running,
  -- which is also how "finished" is told from "abandoned".
  debrief     TEXT,
  created_at  TEXT    NOT NULL,
  ended_at    TEXT
);

-- "Is there one running" is the only query this table serves on the hot path.
CREATE INDEX interviews_by_date ON interviews (created_at DESC);
