import { spawn } from 'node:child_process';
import type { RuntimeCheck, RuntimeReport } from '@devpromax/shared';
import { JAVAC_COMMAND, JAVA_COMMAND, PYTHON_COMMAND } from './judge/executors/commands.js';

/**
 * The first-run doctor (ROADMAP P8-3).
 *
 * The judge shells out to `python`, `javac` and `java`, and when one of them is
 * missing the failure arrives as a spawn error in the middle of someone's first
 * Run - which reads as "this app is broken" rather than as "Java is not
 * installed". So the three runtimes are checked up front, with the version each
 * one reports and, when something is wrong, the one sentence that fixes it.
 *
 * Every check is a real subprocess. Looking for the binary on `PATH` would miss
 * the two failures that actually happen: a runtime that is present but too old,
 * and Windows' Microsoft Store alias.
 *
 * `process` is the global, not an `import ... from 'node:process'`. That import
 * in a module the server loads stops `npm run dev` from starting the API at all
 * under `tsx watch` on Windows - silently, with no error on either stream - and
 * cost an hour to find. Nothing else in `apps/server` imports it either.
 */

/** Minimums from CLAUDE.md > Environment. The harness uses no newer syntax. */
export const MINIMUM_PYTHON = { major: 3, minor: 10 } as const;
export const MINIMUM_JAVA = 21;

/** Long enough for a JVM on a cold cache, short enough not to hang a start-up. */
const PROBE_TIMEOUT_MS = 20_000;

interface Probe {
  code: number | null;
  stdout: string;
  stderr: string;
  failure?: string;
}

async function probe(command: string, args: readonly string[]): Promise<Probe> {
  return new Promise<Probe>((resolve) => {
    // No shell: the command may be an absolute path with spaces in it, which is
    // the normal case for a JDK on Windows.
    const child = spawn(command, [...args], { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const done = (probeResult: Probe): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(probeResult);
    };

    const timer = setTimeout(() => {
      child.kill();
      done({ code: null, stdout, stderr, failure: 'it did not answer within 20 seconds' });
    }, PROBE_TIMEOUT_MS);

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      done({
        code: null,
        stdout,
        stderr,
        failure: error.code === 'ENOENT' ? 'it is not on your PATH' : error.message,
      });
    });
    child.on('close', (code) => {
      done({ code, stdout, stderr });
    });
  });
}

/**
 * Windows' Microsoft Store alias for Python.
 *
 * A fresh Windows has a `python.exe` on `PATH` that is not Python: it is a stub
 * under `WindowsApps` that opens the Store. It exits 9009 with nothing on
 * stdout, which looks like a hundred other failures unless you know - and every
 * Windows user who has not installed Python hits it first (audit 2026-09-17).
 */
function isStoreAlias(result: Probe): boolean {
  if (process.platform !== 'win32') return false;
  if (result.stdout.trim() !== '') return false;
  const noise = `${result.stderr}`.toLowerCase();
  return (
    result.code === 9009 ||
    result.code === 49 ||
    noise.includes('windowsapps') ||
    noise.includes('microsoft store')
  );
}

function parsePythonVersion(text: string): { major: number; minor: number } | null {
  // `python --version` prints to stdout on 3.4+ and to stderr on 2.x; both are
  // passed in here, because a 2.x install is one of the answers this gives.
  const match = /Python (\d+)\.(\d+)/.exec(text);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/**
 * The feature release from a Java version string.
 *
 * `javac 21.0.4` and `openjdk version "21.0.4" 2024-07-16` both mean 21. Java 8
 * and earlier say `1.8.0_412`, where the number that matters is the second one.
 */
function parseJavaVersion(text: string): number | null {
  const match = /(\d+)(?:\.(\d+))?(?:\.\d+)?/.exec(text.replace(/^[^\d]*/, ''));
  if (!match) return null;
  const first = Number(match[1]);
  if (first === 1 && match[2] !== undefined) return Number(match[2]);
  return first;
}

async function checkPython(): Promise<RuntimeCheck> {
  const result = await probe(PYTHON_COMMAND, ['--version']);
  const base = { name: 'python' as const, command: PYTHON_COMMAND };

  if (isStoreAlias(result)) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: 'the `python` on your PATH is the Microsoft Store alias, not Python.',
      guidance:
        'Install Python 3.10 or newer from python.org, or set DEVPROMAX_PYTHON to the full path of a real python.exe. Turning off the alias under Settings › Apps › App execution aliases also works.',
    };
  }

  if (result.failure !== undefined) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: `\`${PYTHON_COMMAND} --version\` failed: ${result.failure}.`,
      guidance:
        'Install Python 3.10 or newer from python.org, or set DEVPROMAX_PYTHON to the interpreter you want the judge to use.',
    };
  }

  const version = parsePythonVersion(`${result.stdout}\n${result.stderr}`);
  if (version === null) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: `\`${PYTHON_COMMAND} --version\` answered something unexpected.`,
      guidance: 'Set DEVPROMAX_PYTHON to the interpreter you want the judge to use.',
    };
  }

  const text = `${String(version.major)}.${String(version.minor)}`;
  const recent =
    version.major > MINIMUM_PYTHON.major ||
    (version.major === MINIMUM_PYTHON.major && version.minor >= MINIMUM_PYTHON.minor);

  if (!recent) {
    return {
      ...base,
      ok: false,
      version: text,
      problem: `Python ${text} is older than the 3.10 the harness needs.`,
      guidance:
        'Install Python 3.10 or newer, or point DEVPROMAX_PYTHON at a newer interpreter you already have.',
    };
  }

  return { ...base, ok: true, version: text, problem: null, guidance: null };
}

async function checkJava(
  name: 'java' | 'javac',
  command: string,
  args: readonly string[],
): Promise<RuntimeCheck> {
  const result = await probe(command, args);
  const base = { name, command };
  const guidance =
    'Install a JDK 21 or newer - Temurin from adoptium.net is the usual choice - or set DEVPROMAX_JAVA and DEVPROMAX_JAVAC to the ones you want used. A JRE is not enough: the judge compiles.';

  if (result.failure !== undefined) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: `\`${command} ${args.join(' ')}\` failed: ${result.failure}.`,
      guidance,
    };
  }

  // `java -version` writes to stderr on every version anyone still runs.
  const version = parseJavaVersion(`${result.stdout}\n${result.stderr}`);
  if (version === null) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: `\`${command} ${args.join(' ')}\` answered something unexpected.`,
      guidance,
    };
  }

  if (version < MINIMUM_JAVA) {
    return {
      ...base,
      ok: false,
      version: String(version),
      problem: `Java ${String(version)} is older than the ${String(MINIMUM_JAVA)} the starters compile against.`,
      guidance,
    };
  }

  return { ...base, ok: true, version: String(version), problem: null, guidance: null };
}

/**
 * Checks all three, concurrently.
 *
 * Java and Python are independent, and doing them in series puts two JVM
 * start-ups in the way of the first page load.
 */
export async function runDoctor(): Promise<RuntimeReport> {
  const [python, java, javac] = await Promise.all([
    checkPython(),
    checkJava('java', JAVA_COMMAND, ['-version']),
    checkJava('javac', JAVAC_COMMAND, ['-version']),
  ]);

  const checks = [python, java, javac];
  return {
    checks,
    ok: checks.every((check) => check.ok),
    checkedAt: new Date().toISOString(),
  };
}

/**
 * What to print at start-up, or null when everything is in order.
 *
 * Nothing at all when the answer is "fine": a start-up that prints three lines
 * of good news every time is a start-up nobody reads, and then the one time it
 * matters the bad news is in the same place as the noise.
 */
export function doctorSummary(report: RuntimeReport): string | null {
  if (report.ok) return null;

  const lines = ['', 'DevProMax checked the runtimes the judge needs and found a problem:'];
  for (const check of report.checks) {
    if (check.ok) continue;
    lines.push('', `  ${check.name}: ${check.problem ?? 'not usable'}`);
    if (check.guidance !== null) lines.push(`    ${check.guidance}`);
  }
  lines.push(
    '',
    '  The app still starts, and everything except running code works.',
    '  Settings shows this check too, so you can fix it and reload.',
    '',
  );
  return lines.join('\n');
}
