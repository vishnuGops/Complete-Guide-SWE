import { describe, expect, it } from 'vitest';
import { doctorSummary, parseImageVersion } from './doctor.js';

/**
 * The doctor's reporting (ROADMAP P8-3), on hand-made reports where every
 * branch is reachable. The checks themselves spawn the real runtimes, so they
 * are in `doctor.integration.test.ts` (ROADMAP P8-7).
 */

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
      doctorSummary({
        executor: 'local',
        checks: [ok],
        ok: true,
        checkedAt: '2026-09-18T09:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('names the problem, the fix, and what still works', () => {
    const summary = doctorSummary({
      executor: 'local',
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

describe('the Docker checks (P9-2)', () => {
  it('reads the language version from the variables the official images set', () => {
    const python = ['PATH=/usr/local/bin:/usr/bin', 'LANG=C.UTF-8', 'PYTHON_VERSION=3.14.0'].join(
      '\n',
    );
    const temurin = ['PATH=/opt/java/openjdk/bin:/usr/bin', 'JAVA_VERSION=jdk-21.0.8+9'].join('\n');
    expect(parseImageVersion(python, 'python')).toBe('3.14');
    expect(parseImageVersion(temurin, 'java')).toBe('21');
    // An image that does not say is an image the doctor cannot vouch for.
    expect(parseImageVersion('PATH=/usr/bin', 'python')).toBeNull();
    expect(parseImageVersion(python, 'java')).toBeNull();
  });
});
