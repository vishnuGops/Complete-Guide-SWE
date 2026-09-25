import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MINIMUM_JAVA,
  MINIMUM_PYTHON,
  REINSTALL_GUIDANCE,
  doctorSummary,
  runDoctor,
} from './doctor.js';

/**
 * The first-run doctor against the real machine (ROADMAP P8-3).
 *
 * `runDoctor` spawns the real runtimes, which is the point of it - a check that
 * asked `PATH` would miss both failures that actually happen, a version that is
 * too old and Windows' Store alias. So the test of the check is that it agrees
 * with the machine it is running on. That makes these integration tests: a JVM
 * start is seconds on the slower machine, and `npm run test:unit` is the suite
 * promised to be seconds and Node only (ROADMAP P8-7). The reporting is tested
 * on hand-made reports in `doctor.test.ts`, where every branch is reachable.
 */

describe('runDoctor', () => {
  it('finds the runtimes this machine has, and says which command it used', async () => {
    const report = await runDoctor('local');

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
    const report = await runDoctor('local');
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

describe('the Docker checks (P9-2)', () => {
  it('checks the daemon and the two images, and says what to do about each', async () => {
    // Runs whether or not this machine has Docker: the checks are queries to
    // the daemon, never a container, and a machine without Docker is one of
    // the answers they exist to give. Still a spawn of the `docker` CLI, which
    // is why it lives here and not beside the parsing test.
    const report = await runDoctor('docker');

    expect(report.executor).toBe('docker');
    expect(report.checks.map((check) => check.name)).toEqual(['docker', 'python', 'java']);
    expect(report.ok).toBe(report.checks.every((check) => check.ok));
    for (const check of report.checks) {
      if (check.ok) {
        expect(check.version).not.toBeNull();
      } else {
        expect(check.problem).not.toBeNull();
        expect(check.guidance).not.toBeNull();
      }
    }
  }, 60_000);
});

describe('an installed copy (P10-2)', () => {
  // Runtimes that are not there, the way a damaged install looks. The spawns
  // fail at once, so this costs nothing; it is here because it spawns at all.
  const missing = path.join(os.tmpdir(), 'devpromax-no-such-runtime');
  const commands = {
    python: path.join(missing, 'python.exe'),
    java: path.join(missing, 'java.exe'),
    javac: path.join(missing, 'javac.exe'),
  };

  it('says to reinstall, not to install Python or set a variable the launcher overrides', async () => {
    const report = await runDoctor('local', { bundled: true, commands });

    expect(report.ok).toBe(false);
    for (const check of report.checks) {
      expect(check.problem).not.toBeNull();
      expect(check.guidance).toBe(REINSTALL_GUIDANCE);
    }
    const summary = doctorSummary(report) ?? '';
    expect(summary).toContain('Install DevProMax again');
    expect(summary).not.toContain('DEVPROMAX_');
    expect(summary).not.toContain('python.org');
  });

  it('keeps the checkout advice for a checkout', async () => {
    const report = await runDoctor('local', { bundled: false, commands });

    const guidance = report.checks.map((check) => check.guidance ?? '');
    expect(guidance[0]).toContain('DEVPROMAX_PYTHON');
    expect(guidance[1]).toContain('JDK 21');
    expect(guidance).not.toContain(REINSTALL_GUIDANCE);
  });
});
