import { describe, expect, it } from 'vitest';
import {
  candidates,
  createFormatters,
  parseFormatterError,
  parseFormatterVersion,
} from './formatters.js';
import type { SpawnOptions, SpawnResult } from '../judge/process.js';

/**
 * Finding and running the formatters (ROADMAP P9-5), without either of them.
 *
 * The runner is a stand-in that answers by command, so these tests pin what
 * is looked for, in which order, with which arguments, and what each exit is
 * turned into. `formatters.integration.test.ts` runs the real two.
 */

function result(overrides: Partial<SpawnResult> = {}): SpawnResult {
  return {
    code: 0,
    signal: null,
    stdout: '',
    stderr: '',
    killed: false,
    outputTruncated: false,
    elapsedMs: 5,
    ...overrides,
  };
}

type Answer = (options: SpawnOptions) => SpawnResult | 'ENOENT';

function fakeRunner(answer: Answer) {
  const calls: SpawnOptions[] = [];
  const run = (options: SpawnOptions): Promise<SpawnResult> => {
    calls.push(options);
    const outcome = answer(options);
    if (outcome === 'ENOENT') {
      return Promise.reject(Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }));
    }
    return Promise.resolve(outcome);
  };
  return { run, calls };
}

const BLACK_VERSION = 'black, 26.5.1 (compiled: yes)\nPython (CPython) 3.12.14\n';
const GJF_VERSION = 'google-java-format: Version 1.36.1\n';

/** Both formatters present, on PATH, and formatting by upper-casing. */
function bothInstalled(): Answer {
  return (options) => {
    if (options.args.includes('--version')) {
      if (options.command === 'black') return result({ stdout: BLACK_VERSION });
      if (options.command === 'google-java-format') return result({ stdout: GJF_VERSION });
      return 'ENOENT';
    }
    return result({ stdout: (options.input ?? '').toUpperCase() });
  };
}

describe('where each formatter is looked for', () => {
  it('tries black on PATH, then the judge python with -m black', () => {
    expect(candidates('black', {}, 'py3', 'java')).toEqual([
      { command: 'black', prefix: [] },
      { command: 'py3', prefix: ['-m', 'black'] },
    ]);
  });

  it('uses only DEVPROMAX_BLACK when it is set, so a wrong override says so', () => {
    expect(candidates('black', { DEVPROMAX_BLACK: 'C:\\tools\\black.exe' }, 'py3', 'java')).toEqual(
      [{ command: 'C:\\tools\\black.exe', prefix: [] }],
    );
  });

  it('runs a google-java-format jar with the judge java', () => {
    expect(
      candidates(
        'google-java-format',
        { DEVPROMAX_GOOGLE_JAVA_FORMAT: 'C:\\Program Files\\gjf\\gjf-all-deps.JAR' },
        'py3',
        'C:\\jdk\\bin\\java.exe',
      ),
    ).toEqual([
      {
        command: 'C:\\jdk\\bin\\java.exe',
        prefix: ['-jar', 'C:\\Program Files\\gjf\\gjf-all-deps.JAR'],
      },
    ]);
  });

  it('runs a google-java-format executable as itself', () => {
    expect(
      candidates('google-java-format', { DEVPROMAX_GOOGLE_JAVA_FORMAT: '/opt/gjf' }, 'py', 'java'),
    ).toEqual([{ command: '/opt/gjf', prefix: [] }]);
  });

  it('looks for google-java-format on PATH by default', () => {
    expect(candidates('google-java-format', {}, 'py', 'java')).toEqual([
      { command: 'google-java-format', prefix: [] },
    ]);
  });
});

describe('reading a version', () => {
  it.each([
    ['black', BLACK_VERSION, '26.5.1'],
    ['black', 'black, version 22.3.0\n', '22.3.0'],
    ['black', 'python -m black: No module named black', null],
    ['google-java-format', GJF_VERSION, '1.36.1'],
    ['google-java-format', 'Error: Unable to access jarfile x.jar', null],
  ] as const)('%s from %j', (name, text, expected) => {
    expect(parseFormatterVersion(name, text)).toBe(expected);
  });
});

describe('reading a complaint', () => {
  it('takes the plumbing out of black and keeps the position', () => {
    const stderr =
      'error: cannot format -: Cannot parse for target version Python 3.14: 3:7:     def f( :\n    def f( :\n          ^\nParseError: bad input\n';
    expect(parseFormatterError('black', stderr)).toEqual({
      message: 'Cannot parse for target version Python 3.14: 3:7:     def f( :',
      line: 3,
      column: 7,
    });
  });

  it('takes <stdin> and "error:" out of google-java-format', () => {
    const stderr =
      '<stdin>:1:16: error: illegal start of type\nclass A{int f( {}}\n               ^\n';
    expect(parseFormatterError('google-java-format', stderr)).toEqual({
      message: '1:16: illegal start of type',
      line: 1,
      column: 16,
    });
  });

  it('still says something when there is nothing to read', () => {
    expect(parseFormatterError('black', '')).toEqual({
      message: 'The formatter could not read this code.',
    });
  });
});

describe('detection', () => {
  it('reports both formatters with their versions and commands', async () => {
    const { run } = fakeRunner(bothInstalled());
    const status = await createFormatters({ env: {}, run }).status();
    expect(status).toEqual([
      {
        language: 'python',
        name: 'black',
        available: true,
        version: '26.5.1',
        command: 'black',
        guidance: null,
      },
      {
        language: 'java',
        name: 'google-java-format',
        available: true,
        version: '1.36.1',
        command: 'google-java-format',
        guidance: null,
      },
    ]);
  });

  it('falls back to python -m black when black is not on PATH', async () => {
    const { run } = fakeRunner((options) => {
      if (options.command === 'py3' && options.args.join(' ') === '-m black --version') {
        return result({ stdout: BLACK_VERSION });
      }
      return 'ENOENT';
    });
    const [python] = await createFormatters({ env: {}, run, pythonCommand: 'py3' }).status();
    expect(python).toMatchObject({ available: true, command: 'py3 -m black' });
  });

  it('does not count a python without black as black', async () => {
    const { run } = fakeRunner((options) =>
      options.command === 'black'
        ? 'ENOENT'
        : result({ code: 1, stderr: 'py3: No module named black\n' }),
    );
    const [python, java] = await createFormatters({ env: {}, run, pythonCommand: 'py3' }).status();
    expect(python).toMatchObject({ available: false, version: null, command: 'black' });
    expect(python?.guidance).toMatch(/pip install black/);
    expect(java?.guidance).toMatch(/DEVPROMAX_GOOGLE_JAVA_FORMAT/);
  });

  it('looks once and remembers, until asked to look again', async () => {
    const { run, calls } = fakeRunner(bothInstalled());
    const formatters = createFormatters({ env: {}, run });
    await formatters.status();
    await formatters.status();
    await formatters.format('python', 'x');
    const probes = () => calls.filter((call) => call.args.includes('--version')).length;
    expect(probes()).toBe(2);

    await formatters.status(true);
    expect(probes()).toBe(4);
  });

  it('never hands a formatter the coach key', async () => {
    const saved = process.env['COACH_API_KEY'];
    process.env['COACH_API_KEY'] = 'sk-secret';
    try {
      const { run, calls } = fakeRunner(bothInstalled());
      await createFormatters({ env: {}, run }).format('python', 'x');
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect(call.env?.['COACH_API_KEY']).toBeUndefined();
    } finally {
      if (saved === undefined) delete process.env['COACH_API_KEY'];
      else process.env['COACH_API_KEY'] = saved;
    }
  });
});

describe('formatting', () => {
  it('sends the code on stdin with each formatter’s arguments', async () => {
    const { run, calls } = fakeRunner(bothInstalled());
    const formatters = createFormatters({ env: {}, run });

    expect(await formatters.format('python', 'x = 1\n')).toEqual({
      outcome: 'formatted',
      code: 'X = 1\n',
      changed: true,
    });
    expect(await formatters.format('java', 'class a {}\n')).toMatchObject({ outcome: 'formatted' });

    const formatCalls = calls.filter((call) => call.input !== undefined);
    expect(formatCalls.map((call) => [call.command, ...call.args])).toEqual([
      ['black', '-q', '-'],
      ['google-java-format', '--aosp', '-'],
    ]);
  });

  it('runs one formatter process per language at a time (P3-10)', async () => {
    let running = 0;
    let most = 0;
    const run = async (options: SpawnOptions): Promise<SpawnResult> => {
      if (options.args.includes('--version')) {
        return result({ stdout: options.command === 'black' ? BLACK_VERSION : GJF_VERSION });
      }
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return result({ stdout: options.input ?? '' });
    };
    const formatters = createFormatters({ env: {}, run });

    // A burst of saves: five Python requests at once.
    const answers = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => formatters.format('python', `x = ${String(n)}\n`)),
    );

    expect(most).toBe(1);
    // Each still gets its own answer, in its own order.
    expect(answers.map((answer) => (answer.outcome === 'formatted' ? answer.code : null))).toEqual([
      'x = 1\n',
      'x = 2\n',
      'x = 3\n',
      'x = 4\n',
      'x = 5\n',
    ]);
  });

  it('does not make one language wait for the other', async () => {
    let running = 0;
    let most = 0;
    const run = async (options: SpawnOptions): Promise<SpawnResult> => {
      if (options.args.includes('--version')) {
        return result({ stdout: options.command === 'black' ? BLACK_VERSION : GJF_VERSION });
      }
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return result({ stdout: options.input ?? '' });
    };
    const formatters = createFormatters({ env: {}, run });

    await Promise.all([formatters.format('python', 'x\n'), formatters.format('java', 'y\n')]);
    expect(most).toBe(2);
  });

  it('says when nothing changed', async () => {
    const { run } = fakeRunner(bothInstalled());
    expect(await createFormatters({ env: {}, run }).format('python', 'ALREADY\n')).toEqual({
      outcome: 'formatted',
      code: 'ALREADY\n',
      changed: false,
    });
  });

  it('turns a parse failure into the formatter’s message and position', async () => {
    const { run } = fakeRunner((options) =>
      options.args.includes('--version')
        ? result({ stdout: BLACK_VERSION })
        : result({ code: 123, stderr: 'error: cannot format -: Cannot parse: 2:4: oops\n' }),
    );
    expect(await createFormatters({ env: {}, run }).format('python', 'x(')).toEqual({
      outcome: 'invalid',
      message: 'Cannot parse: 2:4: oops',
      line: 2,
      column: 4,
    });
  });

  it('is unavailable, without spawning anything, when the formatter was not found', async () => {
    const { run, calls } = fakeRunner(() => 'ENOENT');
    const response = await createFormatters({ env: {}, run }).format('java', 'class A {}');
    expect(response).toEqual({
      outcome: 'unavailable',
      message: 'google-java-format is not installed on this machine.',
    });
    expect(calls.every((call) => call.input === undefined)).toBe(true);
  });

  it('reports a formatter that hung rather than returning its partial output', async () => {
    const { run } = fakeRunner((options) =>
      options.args.includes('--version')
        ? result({ stdout: BLACK_VERSION })
        : result({ killed: true, code: null, stdout: 'half' }),
    );
    expect(await createFormatters({ env: {}, run }).format('python', 'x')).toMatchObject({
      outcome: 'unavailable',
      message: expect.stringMatching(/did not finish/) as unknown,
    });
  });

  it('refuses truncated output rather than replacing the code with part of it', async () => {
    const { run } = fakeRunner((options) =>
      options.args.includes('--version')
        ? result({ stdout: BLACK_VERSION })
        : result({ outputTruncated: true, stdout: 'x = ' }),
    );
    expect(await createFormatters({ env: {}, run }).format('python', 'x')).toMatchObject({
      outcome: 'unavailable',
    });
  });

  it('forgets a formatter that has disappeared since it was found', async () => {
    let installed = true;
    const { run, calls } = fakeRunner((options) => {
      if (!installed) return 'ENOENT';
      return options.args.includes('--version')
        ? result({ stdout: BLACK_VERSION })
        : result({ stdout: 'ok' });
    });
    const formatters = createFormatters({ env: {}, run });
    await formatters.status();
    installed = false;

    expect(await formatters.format('python', 'x')).toMatchObject({ outcome: 'unavailable' });
    const before = calls.length;
    const [python] = await formatters.status();
    expect(calls.length).toBeGreaterThan(before);
    expect(python?.available).toBe(false);
  });
});
