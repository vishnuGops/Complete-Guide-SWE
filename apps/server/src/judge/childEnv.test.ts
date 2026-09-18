import { describe, expect, it } from 'vitest';
import { ALLOWED_CHILD_ENV, childEnv } from './childEnv.js';

/**
 * The allow-list (ROADMAP P2-11).
 *
 * The integration tests prove the real thing - a real `print` of a real
 * environment - and these prove the parts a subprocess cannot show: that the
 * list is an allow-list rather than a deny-list, and that a Windows-cased
 * `Path` is matched.
 */

describe('childEnv', () => {
  it('keeps only what is on the list', () => {
    const env = childEnv({
      PATH: '/usr/bin',
      HOME: '/home/user',
      COACH_API_KEY: 'sk-ant-secret',
      DEVPROMAX_DB: '/data/devpromax.db',
      AWS_SECRET_ACCESS_KEY: 'secret',
      npm_config_registry: 'https://registry.npmjs.org',
    });

    expect(env).toEqual({ PATH: '/usr/bin', HOME: '/home/user' });
  });

  it('is an allow-list, so an unknown variable is dropped without being named', () => {
    // The point of the direction: a secret invented next year is excluded by a
    // list written this year, and nobody has to remember to deny it.
    const env = childEnv({ SOME_FUTURE_SECRET: 'x', PATH: '/usr/bin' });
    expect(Object.keys(env)).toEqual(['PATH']);
  });

  it('matches names case-insensitively, as Windows spells them', () => {
    // `process.env` on Windows keeps the parent's casing: `Path`, `SystemRoot`,
    // `Temp`. A literal lookup would find none of them and the child would get
    // no PATH at all - which is how "python is not recognised" happens on one
    // machine and not another.
    const env = childEnv({ Path: 'C:\\Python314', SystemRoot: 'C:\\WINDOWS' });
    expect(env).toEqual({ Path: 'C:\\Python314', SystemRoot: 'C:\\WINDOWS' });
  });

  it('drops a variable that is set but empty rather than passing undefined', () => {
    expect(childEnv({ PATH: undefined, HOME: '/home/user' })).toEqual({ HOME: '/home/user' });
  });

  it("merges the judge's own values last", () => {
    expect(childEnv({ PATH: '/usr/bin' }, { PYTHONHASHSEED: '0' })).toEqual({
      PATH: '/usr/bin',
      PYTHONHASHSEED: '0',
    });
  });

  it('carries no secret-shaped name on the list itself', () => {
    for (const name of ALLOWED_CHILD_ENV) {
      expect(name).not.toMatch(/KEY|TOKEN|SECRET|PASSWORD|DEVPROMAX/);
    }
  });
});
