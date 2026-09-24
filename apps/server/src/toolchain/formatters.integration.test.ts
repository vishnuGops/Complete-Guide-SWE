import { beforeAll, describe, expect, it } from 'vitest';
import { createFormatters, type Formatters } from './formatters.js';

/**
 * The real `black` and `google-java-format` (ROADMAP P9-5).
 *
 * Opt-in with `DEVPROMAX_FORMATTER_TESTS=1`, because neither formatter is
 * something this project asks anyone to install - the feature is optional, so
 * its tests are too. CI's formatter lane installs both and sets it; locally,
 * point `DEVPROMAX_BLACK` and `DEVPROMAX_GOOGLE_JAVA_FORMAT` at them first.
 * When the variable is set and a formatter is missing, the suite fails with
 * the fix rather than skipping, since a lane that silently tests nothing is
 * worse than no lane.
 */

const enabled = process.env['DEVPROMAX_FORMATTER_TESTS'] === '1';
let formatters: Formatters;

beforeAll(async () => {
  if (!enabled) return;
  formatters = createFormatters();
  for (const status of await formatters.status()) {
    if (!status.available) {
      throw new Error(`the formatter suite needs ${status.name}: ${status.guidance ?? ''}`);
    }
  }
}, 60_000);

describe.skipIf(!enabled)('black', () => {
  it('formats', async () => {
    expect(await formatters.format('python', 'x=[1,2 ,3]\ndef f( a ):\n  return a\n')).toEqual({
      outcome: 'formatted',
      code: 'x = [1, 2, 3]\n\n\ndef f(a):\n    return a\n',
      changed: true,
    });
  });

  it('leaves formatted code alone and says so', async () => {
    const code = 'class Solution:\n    def f(self) -> int:\n        return 1\n';
    expect(await formatters.format('python', code)).toEqual({
      outcome: 'formatted',
      code,
      changed: false,
    });
  });

  it('keeps text outside ASCII intact', async () => {
    const response = await formatters.format('python', "s='naïve — ✓'\n");
    expect(response).toMatchObject({ outcome: 'formatted', code: 's = "naïve — ✓"\n' });
  });

  it('points at the line that does not parse', async () => {
    const response = await formatters.format('python', 'x = 1\ndef f( :\n    pass\n');
    expect(response).toMatchObject({ outcome: 'invalid', line: 2 });
  });
});

describe.skipIf(!enabled)('google-java-format', () => {
  it('formats in the four-space AOSP style the starters use', async () => {
    expect(await formatters.format('java', 'class Solution{int f(){return 1;}}\n')).toEqual({
      outcome: 'formatted',
      code: 'class Solution {\n    int f() {\n        return 1;\n    }\n}\n',
      changed: true,
    });
  });

  it('keeps text outside ASCII intact', async () => {
    const response = await formatters.format('java', 'class A{String s="naïve — ✓";}\n');
    expect(response).toMatchObject({ outcome: 'formatted' });
    if (response.outcome === 'formatted') expect(response.code).toContain('"naïve — ✓"');
  });

  it('points at the line that does not parse', async () => {
    const response = await formatters.format('java', 'class A {\n  int f( { return 1; }\n}\n');
    expect(response).toMatchObject({ outcome: 'invalid', line: 2 });
    if (response.outcome === 'invalid') expect(response.message).not.toMatch(/<stdin>/);
  });
});
