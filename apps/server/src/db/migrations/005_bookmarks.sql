-- 005_bookmarks.sql - starred problems (ROADMAP P7-7).
--
-- Keyed by problem and not by language, for the same reason notes are: a
-- bookmark is about the problem, and someone who comes back to it in the other
-- language has not stopped meaning to come back to it.
--
-- Its own table rather than a column on problem_progress. A bookmark is not
-- progress - it survives reset-all-progress, like a note does, because it is
-- something the user wrote down rather than something the app recorded about
-- them - and a problem can be bookmarked before it has any progress row at all.
CREATE TABLE bookmarks (
  slug       TEXT NOT NULL PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE INDEX bookmarks_by_date ON bookmarks (created_at DESC);
