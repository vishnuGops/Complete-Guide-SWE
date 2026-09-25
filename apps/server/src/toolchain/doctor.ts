import { spawn } from 'node:child_process';
import type { RuntimeCheck, RuntimeReport } from '@devpromax/shared';
import {
  DOCKER_COMMAND,
  DOCKER_IMAGES,
  EXECUTOR_KIND,
  JAVAC_COMMAND,
  JAVA_COMMAND,
  PYTHON_COMMAND,
  type ExecutorKind,
} from '../judge/executors/commands.js';
import { BUNDLED } from '../config.js';
import { ansiCodePage, resolveCommand, roundTrips, unrepresentable } from './codePage.js';

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

/**
 * What to do about a broken runtime in an installed copy (ROADMAP P10-2, D26).
 *
 * The usual advice - install Python, set `DEVPROMAX_PYTHON` - is wrong there
 * twice over: the launcher overrides that variable with the runtime it brought,
 * and the user never installed a runtime to begin with. What they can do is put
 * the copy back, and the data survives that because it is not in it.
 */
export const REINSTALL_GUIDANCE =
  'This runtime comes with DevProMax, so the installed copy is damaged. Install DevProMax again over it; your practice history is kept.';

/** The advice for an installed copy, or the one for a checkout. */
function advice(bundled: boolean, checkout: string): string {
  return bundled ? REINSTALL_GUIDANCE : checkout;
}

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

export function parsePythonVersion(text: string): { major: number; minor: number } | null {
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
export function parseJavaVersion(text: string): number | null {
  const match = /(\d+)(?:\.(\d+))?(?:\.\d+)?/.exec(text.replace(/^[^\d]*/, ''));
  if (!match) return null;
  const first = Number(match[1]);
  if (first === 1 && match[2] !== undefined) return Number(match[2]);
  return first;
}

async function checkPython(command: string, bundled: boolean): Promise<RuntimeCheck> {
  const result = await probe(command, ['--version']);
  const base = { name: 'python' as const, command };

  if (isStoreAlias(result)) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: 'the `python` on your PATH is the Microsoft Store alias, not Python.',
      guidance: advice(
        bundled,
        'Install Python 3.10 or newer from python.org, or set DEVPROMAX_PYTHON to the full path of a real python.exe. Turning off the alias under Settings › Apps › App execution aliases also works.',
      ),
    };
  }

  if (result.failure !== undefined) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: `\`${command} --version\` failed: ${result.failure}.`,
      guidance: advice(
        bundled,
        'Install Python 3.10 or newer from python.org, or set DEVPROMAX_PYTHON to the interpreter you want the judge to use.',
      ),
    };
  }

  const version = parsePythonVersion(`${result.stdout}\n${result.stderr}`);
  if (version === null) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: `\`${command} --version\` answered something unexpected.`,
      guidance: advice(
        bundled,
        'Set DEVPROMAX_PYTHON to the interpreter you want the judge to use.',
      ),
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
      guidance: advice(
        bundled,
        'Install Python 3.10 or newer, or point DEVPROMAX_PYTHON at a newer interpreter you already have.',
      ),
    };
  }

  return { ...base, ok: true, version: text, problem: null, guidance: null };
}

/**
 * A JDK under a folder the ANSI code page cannot spell (ROADMAP P10-1).
 *
 * Checked before the probe, because the probe's own failure - "could not find
 * java.dll", from a JDK that plainly has one - says nothing about why, and a
 * JDK that somehow answered would still fail the moment the judge used it.
 */
async function codePageProblem(
  name: 'java' | 'javac',
  command: string,
  bundled: boolean,
): Promise<RuntimeCheck | null> {
  const codePage = await ansiCodePage();
  if (codePage === null) return null;
  const location = resolveCommand(command);
  if (location === null || roundTrips(location, codePage) !== false) return null;

  const chars = unrepresentable(location, codePage).join(' ');
  return {
    name,
    command,
    ok: false,
    version: null,
    problem: `${location} is under a folder name Windows cannot pass to Java: this system's code page (${String(codePage)}) has no character for ${chars}.`,
    guidance: bundled
      ? 'DevProMax is installed in a folder Java cannot be started from. Uninstall it, keeping your data, and install it again into a folder such as C:\\DevProMax.'
      : 'Move the JDK to a folder whose path uses only characters from your Windows language settings, such as C:\\Java, or point DEVPROMAX_JAVA and DEVPROMAX_JAVAC at a JDK that is in one.',
  };
}

async function checkJava(
  name: 'java' | 'javac',
  command: string,
  args: readonly string[],
  bundled: boolean,
): Promise<RuntimeCheck> {
  const misplaced = await codePageProblem(name, command, bundled);
  if (misplaced !== null) return misplaced;

  const result = await probe(command, args);
  const base = { name, command };
  const guidance = advice(
    bundled,
    'Install a JDK 21 or newer - Temurin from adoptium.net is the usual choice - or set DEVPROMAX_JAVA and DEVPROMAX_JAVAC to the ones you want used. A JRE is not enough: the judge compiles.',
  );

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

// ---------------------------------------------------------------------------
// Docker (ROADMAP P9-2)
// ---------------------------------------------------------------------------

/**
 * The language version an image was built with, from the variables the
 * official images set: `PYTHON_VERSION=3.14.0` in `python:*`, and
 * `JAVA_VERSION=jdk-21.0.8+9` in `eclipse-temurin:*`.
 *
 * Read from the image's configuration rather than by running it, because
 * running it means starting a container - which is slower, and which anything
 * watching the daemon would see as a service starting.
 */
export function parseImageVersion(env: string, language: 'python' | 'java'): string | null {
  if (language === 'python') {
    const match = /^PYTHON_VERSION=(\d+)\.(\d+)/m.exec(env);
    return match ? `${match[1]!}.${match[2]!}` : null;
  }
  const match = /^JAVA_VERSION=(?:jdk-?)?(\d+)/m.exec(env);
  return match ? match[1]! : null;
}

async function checkDockerDaemon(): Promise<RuntimeCheck> {
  const result = await probe(DOCKER_COMMAND, ['version', '--format', '{{.Server.Version}}']);
  const base = { name: 'docker' as const, command: DOCKER_COMMAND };
  const version = result.stdout.trim();

  if (result.failure !== undefined) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: `\`${DOCKER_COMMAND} version\` failed: ${result.failure}.`,
      guidance:
        'Install Docker (Docker Desktop on Windows and macOS), set DEVPROMAX_DOCKER to its full path, or unset DEVPROMAX_EXECUTOR to run the judge locally.',
    };
  }
  if (result.code !== 0 || version === '') {
    return {
      ...base,
      ok: false,
      version: null,
      problem: 'Docker is installed, and its daemon is not running.',
      guidance:
        'Start Docker Desktop (or the Docker service), or unset DEVPROMAX_EXECUTOR to run the judge locally.',
    };
  }
  return { ...base, ok: true, version, problem: null, guidance: null };
}

async function checkImage(language: 'python' | 'java'): Promise<RuntimeCheck> {
  const image = DOCKER_IMAGES[language];
  const variable =
    language === 'python' ? 'DEVPROMAX_DOCKER_PYTHON_IMAGE' : 'DEVPROMAX_DOCKER_JAVA_IMAGE';
  const base = { name: language, command: image };
  const result = await probe(DOCKER_COMMAND, [
    'image',
    'inspect',
    '--format',
    '{{range .Config.Env}}{{println .}}{{end}}',
    image,
  ]);

  if (result.failure !== undefined || result.code !== 0) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: `The image ${image} is not on this machine.`,
      guidance: `Run: docker pull ${image} - or set ${variable} to an image you have.`,
    };
  }

  const version = parseImageVersion(result.stdout, language);
  if (version === null) {
    return {
      ...base,
      ok: false,
      version: null,
      problem: `${image} does not say which ${language === 'python' ? 'Python' : 'Java'} it has.`,
      guidance: `Set ${variable} to an official ${language === 'python' ? 'python' : 'eclipse-temurin JDK'} image.`,
    };
  }

  const recent =
    language === 'python'
      ? (() => {
          const [major, minor] = version.split('.').map(Number) as [number, number];
          return (
            major > MINIMUM_PYTHON.major ||
            (major === MINIMUM_PYTHON.major && minor >= MINIMUM_PYTHON.minor)
          );
        })()
      : Number(version) >= MINIMUM_JAVA;

  if (!recent) {
    return {
      ...base,
      ok: false,
      version,
      problem: `${image} has ${language === 'python' ? 'Python' : 'Java'} ${version}, older than the judge needs.`,
      guidance: `Set ${variable} to an image with ${language === 'python' ? 'Python 3.10' : 'a JDK 21'} or newer.`,
    };
  }
  return { ...base, ok: true, version, problem: null, guidance: null };
}

/**
 * Checks everything the configured executor needs, concurrently.
 *
 * Locally that is the three runtimes: Java and Python are independent, and
 * doing them in series puts two JVM start-ups in the way of the first page
 * load. In Docker it is the daemon and the two images - and not the local
 * runtimes, which the judge then never touches.
 */
export interface DoctorOptions {
  /** An installed copy's advice rather than a checkout's (P10-2); `DEVPROMAX_BUNDLED` by default. */
  bundled?: boolean;
  /** The three local commands; the configured ones by default. */
  commands?: { python: string; java: string; javac: string };
}

export async function runDoctor(
  executor: ExecutorKind = EXECUTOR_KIND,
  options: DoctorOptions = {},
): Promise<RuntimeReport> {
  const bundled = options.bundled ?? BUNDLED;
  const commands = options.commands ?? {
    python: PYTHON_COMMAND,
    java: JAVA_COMMAND,
    javac: JAVAC_COMMAND,
  };
  const checks =
    executor === 'docker'
      ? await Promise.all([checkDockerDaemon(), checkImage('python'), checkImage('java')])
      : await Promise.all([
          checkPython(commands.python, bundled),
          checkJava('java', commands.java, ['-version'], bundled),
          checkJava('javac', commands.javac, ['-version'], bundled),
        ]);

  return {
    executor,
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
