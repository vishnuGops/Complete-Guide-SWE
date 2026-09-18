import { describe, expect, it } from 'vitest';
import { doctorSummary, MINIMUM_JAVA, MINIMUM_PYTHON, runDoctor } from './doctor.js';

/**
 * The first-run doctor (ROADMAP P8-3).
 *
 * `runDoctor` spawns the real runtimes, which is the point of it - a check that
 * asked `PATH` would miss both failures that actually happen, a version that is
 * too old and Windows' Store alias. So the test of the check is that it agrees
 * with the machine it is running on, and the test of the *reporting* is done on
 * hand-made reports, where every branch is reachable.
 */

describe('runDoctor', () => {
  it('finds the runtimes this machine has, and says which command it used', async () => {
    const report = await runDoctor();

    expect(report.checks.map((check) => check.name)).toEqual(['python', 'java', 'javac']);
    expect(report.ok).toBe(report.checks.every((check) => check.ok));
    for (const check of report.checks) {
      expect(check.command.length).toBeGreaterThan(0);
      // Either it works and has a version, or it does not and says why *and*
      // what to do. A check that reports neither is a check nobody can act on.
      if (check.ok) {
        expect(check.version).not.toBeNull();
        expect(check.problem).toBeNull();
      } else {
        expect(check.problem).not.toBeNull();
        expect(check.guidance).not.toBeNull();
      }
    }
  }, 60_000);

  it('reports versions at or above the minimums CLAUDE.md states', async () => {
    // CI installs Python 3.12 and Java 21; this machine has newer. Asserted
    // rather than assumed, because the harness is written to the floor and a
    // runner that quietly downgraded would make every judge test lie.
    const report = await runDoctor();
    const python = report.checks.find((check) => check.name === 'python');
    const java = report.checks.find((check) => check.name === 'java');

    if (python?.ok) {
      const [major, minor] = (python.version ?? '0.0').split('.').map(Number);
      expect(
        (major ?? 0) > MINIMUM_PYTHON.major ||
          ((major ?? 0) === MINIMUM_PYTHON.major && (minor ?? 0) >= MINIMUM_PYTHON.minor),
      ).toBe(true);
    }
    if (java?.ok) expect(Number(java.version)).toBeGreaterThanOrEqual(MINIMUM_JAVA);
  }, 60_000);
});

describe('doctorSummary', () => {
  const ok = {
    name: 'python' as const,
    command: 'python',
    ok: true,
    version: '3.12',
    problem: null,
    guidance: null,
  };
  const broken = {
    name: 'java' as const,
    command: 'java',
    ok: false,
    version: null,
    problem: 'it is not on your PATH.',
    guidance: 'Install a JDK 21 or newer.',
  };

  it('says nothing when everything is in order', () => {
    // A start-up that prints good news every time is a start-up nobody reads,
    // and then the once it matters the bad news is in with the noise.
    expect(
      doctorSummary({ checks: [ok], ok: true, checkedAt: '2026-09-18T09:00:00.000Z' }),
    ).toBeNull();
  });

  it('names the problem, the fix, and what still works', () => {
    const summary = doctorSummary({
      checks: [ok, broken],
      ok: false,
      checkedAt: '2026-09-18T09:00:00.000Z',
    });

    expect(summary).toContain('java: it is not on your PATH.');
    expect(summary).toContain('Install a JDK 21 or newer.');
    // The app is still usable, and saying so is the difference between a
    // warning and a scare.
    expect(summary).toContain('The app still starts');
    // And it does not list the runtime that is fine.
    expect(summary).not.toContain('python');
  });
});
