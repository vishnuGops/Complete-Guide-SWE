-- 007_session_kind.sql - what a coach conversation is for (ROADMAP P5-12).
--
-- A mock interview (P9-1) keeps its turns in coach_messages like any other
-- conversation, which was the right call - one cap, one cost ledger, one
-- history window - but left nothing telling an interview's session apart from
-- an AI Help one. The next AI Help click on the interview's first problem took
-- the interview as "the latest conversation": the interviewer's exchange went
-- to the coach as history, and the review was charged against the interview's
-- spend cap.
--
-- 'coach' by default, because every row written before this is either an AI
-- Help conversation or an interview this migration can identify below; the
-- CHECK is there for the same reason the language column has one - the service
-- branches on this value, so an unknown one is a bug to fail on at the write.
ALTER TABLE coach_sessions
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'coach' CHECK (kind IN ('coach', 'interview'));

-- The interviews that got as far as a first exchange point at their session.
UPDATE coach_sessions SET kind = 'interview'
 WHERE id IN (SELECT session_id FROM interviews WHERE session_id IS NOT NULL);
