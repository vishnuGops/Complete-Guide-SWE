import { tmpdir } from 'node:os';
import {
  FORMATTER_FOR,
  LANGUAGES,
  MAX_CODE_BYTES,
  type FormatResponse,
  type FormatterName,
  type FormatterStatus,
  type Language,
} from '@devpromax/shared';
import { JAVA_COMMAND, PYTHON_COMMAND } from './judge/executors/commands.js';
import { childEnv } from './judge/childEnv.js';
import { runProcess, type SpawnOptions, type SpawnResult } from './judge/process.js';

/**
 * Format on save (ROADMAP P9-5): `black` for Python, `google-java-format` for
 * Java, both run as subprocesses and both optional.
 *
 * **Found, not installed.** Nothing here downloads anything. The first time
 * something asks - the server warms it at start-up, the workspace asks when it
 * opens - each formatter is looked for by running it with `--version`, and the
 * answer is kept until Settings asks for a fresh one. A formatter that is not
 * there makes the feature absent in the UI, not an error on every save.
 *
 * **Where they are looked for**, first answer wins:
 *
 *   - `black`: `DEVPROMAX_BLACK` if set (and nothing else, so an override that
 *     is wrong says so rather than being quietly bypassed); otherwise `black`
 *     on PATH, then `<judge python> -m black`.
 *   - `google-java-format`: `DEVPROMAX_GOOGLE_JAVA_FORMAT` if set - a path to
 *     the release's `-all-deps.jar`, run with the judge's `java`, or to an
 *     executable; otherwise `google-java-format` on PATH.
 *
 * **What they are not.** They are not the judge: they parse the code and never
 * run it, so they run on this machine whichever executor is configured, and
 * outside the judge queue. They still get the judge's allow-listed environment
 * (P2-11), a wall-clock limit and an output cap, because a formatter is a
 * program someone else wrote and the coach key is still not its business.
 */

/** A cold JVM on the slower machine, plus the formatter's own start-up. */
export const FORMAT_TIMEOUT_MS = 20_000;

/** Formatting can grow code a little (line breaks, spaces); never by 4x. */
const OUTPUT_CAP = MAX_CODE_BYTES * 4;

export interface FormatterCommand {
  command: string;
  /** Arguments that come before the formatter's own, e.g. `-m black`. */
  prefix: string[];
}

type Runner = (options: SpawnOptions) => Promise<SpawnResult>;

export interface FormattersOptions {
  env?: NodeJS.ProcessEnv;
  /** Stand-in for `runProcess`, so the unit tests need no formatter. */
  run?: Runner;
  pythonCommand?: string;
  javaCommand?: string;
}

export interface Formatters {
  /** One entry per language. Cached after the first call unless `refresh`. */
  status(refresh?: boolean): Promise<FormatterStatus[]>;
  format(language: Language, code: string): Promise<FormatResponse>;
}

/** How a formatter is found, in the order it is looked for. */
export function candidates(
  name: FormatterName,
  env: NodeJS.ProcessEnv,
  pythonCommand: string,
  javaCommand: string,
): FormatterCommand[] {
  if (name === 'black') {
    const override = env['DEVPROMAX_BLACK']?.trim();
    if (override) return [{ command: override, prefix: [] }];
    return [
      { command: 'black', prefix: [] },
      { command: pythonCommand, prefix: ['-m', 'black'] },
    ];
  }

  const override = env['DEVPROMAX_GOOGLE_JAVA_FORMAT']?.trim();
  if (override) {
    return /\.jar$/i.test(override)
      ? [{ command: javaCommand, prefix: ['-jar', override] }]
      : [{ command: override, prefix: [] }];
  }
  return [{ command: 'google-java-format', prefix: [] }];
}

export function describeCommand(found: FormatterCommand): string {
  return [found.command, ...found.prefix].join(' ');
}

/**
 * The version from `--version`.
 *
 * `black, 26.5.1 (compiled: yes)` and `google-java-format: Version 1.36.1`.
 * Both streams are searched: which one a tool writes its version to is the
 * kind of thing that changes between releases.
 */
export function parseFormatterVersion(name: FormatterName, text: string): string | null {
  const match =
    name === 'black'
      ? /\bblack,?\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?)/i.exec(text)
      : /\bVersion\s+(\d+\.\d+(?:\.\d+)?)/i.exec(text);
  return match ? match[1]! : null;
}

const GUIDANCE: Record<FormatterName, string> = {
  black:
    'Install black (`pip install black`, or `uv tool install black`) so that `black` is on your PATH, or set DEVPROMAX_BLACK to its full path, then check again.',
  'google-java-format':
    'Download google-java-format-<version>-all-deps.jar from its GitHub releases and set DEVPROMAX_GOOGLE_JAVA_FORMAT to the jar, then restart the app. It runs with the same java as the judge.',
};

/**
 * The formatter's complaint, shorn of the parts that name its plumbing.
 *
 * `error: cannot format -: Cannot parse for target version Python 3.14: 3:7: def f( :`
 * becomes `Cannot parse for target version Python 3.14: 3:7: def f( :`, and
 * `<stdin>:3:16: error: illegal start of type` becomes
 * `3:16: illegal start of type`. The `-` and `<stdin>` are how each tool names
 * standard input, which the user never typed and cannot act on. The first
 * `line:column` in what is left is where the caret goes.
 */
export function parseFormatterError(
  name: FormatterName,
  stderr: string,
): { message: string; line?: number; column?: number } {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');

  let first =
    name === 'black'
      ? (lines.find((line) => /^error:/i.test(line)) ?? lines[0] ?? '')
      : (lines.find((line) => /error:/i.test(line)) ?? lines[0] ?? '');

  first =
    name === 'black'
      ? first.replace(/^error:\s*cannot format\s+-:\s*/i, '')
      : first.replace(/^<stdin>:/, '').replace(/^(\d+:\d+):\s*error:\s*/i, '$1: ');

  const message = first.trim() === '' ? 'The formatter could not read this code.' : first.trim();
  const at = /(?:^|\s)(\d+):(\d+)(?::|\s|$)/.exec(message);
  if (!at) return { message };
  return { message, line: Number(at[1]), column: Number(at[2]) };
}

function formatArgs(name: FormatterName): string[] {
  // `-q`: black otherwise reports "1 file reformatted" on stderr, and stderr
  // is where a real complaint would be looked for.
  // `--aosp`: four-space indents, which is what every Java starter uses.
  return name === 'black' ? ['-q', '-'] : ['--aosp', '-'];
}

interface Found {
  status: FormatterStatus;
  command: FormatterCommand | null;
}

export function createFormatters(options: FormattersOptions = {}): Formatters {
  const env = options.env ?? process.env;
  const run = options.run ?? runProcess;
  const pythonCommand = options.pythonCommand ?? PYTHON_COMMAND;
  const javaCommand = options.javaCommand ?? JAVA_COMMAND;
  const cwd = tmpdir();

  const spawnWith = (found: FormatterCommand, args: string[], input?: string) =>
    run({
      command: found.command,
      args: [...found.prefix, ...args],
      cwd,
      timeoutMs: FORMAT_TIMEOUT_MS,
      outputCap: OUTPUT_CAP,
      env: childEnv(process.env, { PYTHONIOENCODING: 'utf-8' }),
      ...(input === undefined ? {} : { input }),
    });

  async function detect(language: Language): Promise<Found> {
    const name = FORMATTER_FOR[language];
    const tried = candidates(name, env, pythonCommand, javaCommand);

    for (const candidate of tried) {
      try {
        const result = await spawnWith(candidate, ['--version']);
        const version = parseFormatterVersion(name, `${result.stdout}\n${result.stderr}`);
        if (result.code === 0 && !result.killed && version !== null) {
          return {
            command: candidate,
            status: {
              language,
              name,
              available: true,
              version,
              command: describeCommand(candidate),
              guidance: null,
            },
          };
        }
      } catch {
        // Not on PATH. The next candidate, or "not found".
      }
    }

    return {
      command: null,
      status: {
        language,
        name,
        available: false,
        version: null,
        command: describeCommand(tried[0]!),
        guidance: GUIDANCE[name],
      },
    };
  }

  let found: Promise<Record<Language, Found>> | null = null;

  const detectAll = (refresh: boolean): Promise<Record<Language, Found>> => {
    if (found === null || refresh) {
      found = Promise.all(LANGUAGES.map(detect)).then(
        (entries) =>
          Object.fromEntries(entries.map((entry) => [entry.status.language, entry])) as Record<
            Language,
            Found
          >,
      );
    }
    return found;
  };

  /*
   * One run at a time per language (ROADMAP P3-10).
   *
   * Every save with format-on-save is a request, and a held Ctrl+S or a burst
   * of saves used to start one formatter process each - a JVM apiece for Java,
   * on a four-core machine that is also running the judge. Queued behind each
   * other they cost the same in total and never more than one process per
   * language at once.
   */
  const lanes = new Map<Language, Promise<unknown>>();

  function oneAtATime(language: Language, job: () => Promise<FormatResponse>) {
    const previous = lanes.get(language) ?? Promise.resolve();
    const turn = previous.then(job);
    // The lane waits for this run to finish, not for it to succeed.
    lanes.set(
      language,
      turn.catch(() => undefined),
    );
    return turn;
  }

  async function formatNow(language: Language, code: string): Promise<FormatResponse> {
    const { command, status } = (await detectAll(false))[language];
    if (command === null) {
      return {
        outcome: 'unavailable',
        message: `${status.name} is not installed on this machine.`,
      };
    }

    let result: SpawnResult;
    try {
      result = await spawnWith(command, formatArgs(status.name), code);
    } catch {
      // It answered `--version` once and cannot be started now: uninstalled
      // since. Forget it, so Settings and the next save both find out.
      found = null;
      return {
        outcome: 'unavailable',
        message: `${status.name} could not be started. Check it again in Settings.`,
      };
    }

    if (result.killed) {
      return {
        outcome: 'unavailable',
        message: `${status.name} did not finish within ${String(FORMAT_TIMEOUT_MS / 1000)} seconds.`,
      };
    }
    if (result.outputTruncated) {
      return { outcome: 'unavailable', message: `${status.name} wrote more than it was given.` };
    }
    if (result.code !== 0) {
      return { outcome: 'invalid', ...parseFormatterError(status.name, result.stderr) };
    }
    return { outcome: 'formatted', code: result.stdout, changed: result.stdout !== code };
  }

  return {
    async status(refresh = false) {
      const all = await detectAll(refresh);
      return LANGUAGES.map((language) => all[language].status);
    },

    format(language, code) {
      return oneAtATime(language, () => formatNow(language, code));
    },
  };
}

/** The server's instance. Detection is shared by every request. */
export const formatters: Formatters = createFormatters();
