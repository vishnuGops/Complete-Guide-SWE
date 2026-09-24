import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { CoachFeedback } from '@devpromax/shared';
import {
  createDatabase,
  IN_MEMORY,
  loadMigrations,
  migrate,
  openDatabase,
  type Repositories,
} from '../index.js';

let repos: Repositories;

const feedback: CoachFeedback = {
  summary: 'Correct, but the inner loop makes it quadratic.',
  scores: {
    correctness: 4,
    timeComplexity: 2,
    spaceComplexity: 4,
    edgeCases: 3,
    readability: 4,
  },
  feedbackMarkdown: 'The inner loop on line 4 rescans the prefix each time.',
  nextHintLevel: 'concept',
  nextStep: 'Replace the inner scan with a lookup.',
  mastered: false,
};

beforeEach(() => {
  repos = createDatabase({ file: IN_MEMORY });
});

afterEach(() => {
  repos.close();
});

describe('coach sessions', () => {
  it('creates a session scoped to a problem and language', () => {
    const session = repos.coach.createSession('pair-sum-index', 'python');

    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(repos.coach.getSession(session.id)).toEqual(session);
  });

  it('finds the latest session for a problem and language', () => {
    repos.coach.createSession('pair-sum-index', 'python');
    const newer = repos.coach.createSession('pair-sum-index', 'python');
    repos.coach.createSession('pair-sum-index', 'java');

    expect(repos.coach.latestSession('pair-sum-index', 'python')?.id).toBe(newer.id);
  });

  it('has no session for a problem the coach has never seen', () => {
    expect(repos.coach.latestSession('min-value-stack', 'java')).toBeNull();
  });

  it('lists the sessions of a problem across languages', () => {
    repos.coach.createSession('pair-sum-index', 'python');
    repos.coach.createSession('pair-sum-index', 'java');
    repos.coach.createSession('min-value-stack', 'java');

    expect(repos.coach.listSessions('pair-sum-index')).toHaveLength(2);
  });
});

describe('coach messages', () => {
  it('stores a plain chat turn with no feedback attached', () => {
    const session = repos.coach.createSession('pair-sum-index', 'python');
    const message = repos.coach.addMessage(session.id, { role: 'user', content: 'Why quadratic?' });

    expect(message.feedback).toBeNull();
    expect(repos.coach.listMessages(session.id)).toEqual([message]);
  });

  it('round-trips structured feedback through JSON', () => {
    const session = repos.coach.createSession('pair-sum-index', 'python');
    repos.coach.addMessage(session.id, { role: 'coach', content: 'md', feedback });

    const [stored] = repos.coach.listMessages(session.id);
    expect(stored?.feedback).toEqual(feedback);
  });

  it('keeps messages in the order they were sent', () => {
    const session = repos.coach.createSession('pair-sum-index', 'python');
    repos.coach.addMessage(session.id, { role: 'user', content: 'first' });
    repos.coach.addMessage(session.id, { role: 'coach', content: 'second' });
    repos.coach.addMessage(session.id, { role: 'user', content: 'third' });

    expect(repos.coach.listMessages(session.id).map((m) => m.content)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('moves the session updated_at with each message', () => {
    const session = repos.coach.createSession('pair-sum-index', 'python');
    const message = repos.coach.addMessage(session.id, { role: 'user', content: 'hello' });

    expect(repos.coach.getSession(session.id)?.updatedAt).toBe(message.createdAt);
  });

  it('refuses a message whose session does not exist', () => {
    expect(() =>
      repos.coach.addMessage('4f1b9d1e-0000-4000-8000-000000000000', {
        role: 'user',
        content: 'orphan',
      }),
    ).toThrow();
  });

  it('returns only feedback turns as attempt memory, newest first', () => {
    const session = repos.coach.createSession('pair-sum-index', 'python');
    repos.coach.addMessage(session.id, { role: 'user', content: 'chat' });
    repos.coach.addMessage(session.id, { role: 'coach', content: 'older', feedback });
    repos.coach.addMessage(session.id, { role: 'coach', content: 'newer', feedback });

    const recent = repos.coach.recentFeedback('pair-sum-index', 'python', 5);
    expect(recent.map((m) => m.content)).toEqual(['newer', 'older']);
  });

  it('keeps attempt memory to the language it came from', () => {
    const python = repos.coach.createSession('pair-sum-index', 'python');
    const java = repos.coach.createSession('pair-sum-index', 'java');
    repos.coach.addMessage(python.id, { role: 'coach', content: 'python note', feedback });
    repos.coach.addMessage(java.id, { role: 'coach', content: 'java note', feedback });

    expect(repos.coach.recentFeedback('pair-sum-index', 'java', 5).map((m) => m.content)).toEqual([
      'java note',
    ]);
  });

  it('honours the attempt-memory limit', () => {
    const session = repos.coach.createSession('pair-sum-index', 'python');
    for (let i = 0; i < 5; i += 1) {
      repos.coach.addMessage(session.id, { role: 'coach', content: `n${i}`, feedback });
    }
    expect(repos.coach.recentFeedback('pair-sum-index', 'python', 2)).toHaveLength(2);
  });

  it('deletes a session with its messages', () => {
    const session = repos.coach.createSession('pair-sum-index', 'python');
    repos.coach.addMessage(session.id, { role: 'user', content: 'hello' });

    expect(repos.coach.deleteSession(session.id)).toBe(true);
    expect(repos.coach.deleteSession(session.id)).toBe(false);
    expect(repos.coach.listMessages(session.id)).toEqual([]);
  });
});

describe('what a session is for (P5-12, migration 007)', () => {
  it('is an AI Help conversation unless the caller says otherwise', () => {
    const session = repos.coach.createSession('pair-sum-index', 'python');
    expect(session.kind).toBe('coach');
    expect(repos.coach.getSession(session.id)?.kind).toBe('coach');
  });

  it('never offers an interview as the conversation AI Help continues', () => {
    const coach = repos.coach.createSession('pair-sum-index', 'python');
    // Newer, same problem, same language - exactly what used to win.
    const interview = repos.coach.createSession('pair-sum-index', 'python', 'interview');

    expect(interview.kind).toBe('interview');
    expect(repos.coach.latestSession('pair-sum-index', 'python')?.id).toBe(coach.id);
  });

  it('refuses a kind the service does not know', () => {
    expect(() =>
      repos.db.exec(
        "INSERT INTO coach_sessions (id, slug, language, kind, created_at, updated_at) VALUES ('x', 's', 'python', 'chat', 'a', 'a')",
      ),
    ).toThrow(/CHECK/);
  });

  it('marks the sessions existing interviews already point at', () => {
    // A database at version 6, with an interview that got as far as talking.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-migrations-'));
    try {
      for (const migration of loadMigrations().filter((m) => m.version <= 6)) {
        fs.writeFileSync(path.join(dir, migration.file), migration.sql, 'utf8');
      }
      const db = openDatabase({ file: IN_MEMORY });
      migrate(db, dir);
      db.exec(`
        INSERT INTO coach_sessions (id, slug, language, created_at, updated_at)
          VALUES ('help', 'pair-sum-index', 'python', 'a', 'a'),
                 ('talk', 'pair-sum-index', 'python', 'b', 'b');
        INSERT INTO interviews (id, slugs, budget_ms, created_at, session_id)
          VALUES ('i', '["pair-sum-index"]', 60000, 'b', 'talk');
      `);

      migrate(db);

      const kinds = db.prepare('SELECT id, kind FROM coach_sessions ORDER BY id').all() as {
        id: string;
        kind: string;
      }[];
      expect(kinds).toEqual([
        { id: 'help', kind: 'coach' },
        { id: 'talk', kind: 'interview' },
      ]);
      db.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
