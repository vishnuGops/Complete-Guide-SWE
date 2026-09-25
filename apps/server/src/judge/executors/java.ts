import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompileError } from '@devpromax/shared';
import type { HarnessPayload } from '../protocol.js';
import { workspaceAt, type Workspace } from '../workspace.js';
import type {
  Executor,
  HarnessRun,
  PrepareFailure,
  PrepareOptions,
  PrepareResult,
  RunLimits,
} from './types.js';
import { localLauncher, type Launcher } from './launcher.js';
import {
  compileTimeoutMessage,
  harnessClassMessage,
  isHarnessClassName,
  parseJavacOutput,
  publicClassMessage,
  summariseCompileFailure,
} from './compileErrors.js';
import { PAYLOAD_FILE, runHarness } from './harnessRun.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARNESS_SOURCE = path.resolve(HERE, '..', 'harness', 'DevProMaxMain.java');

export { JAVA_COMMAND, JAVAC_COMMAND } from './commands.js';

const SOLUTION_FILE = 'Solution.java';
/**
 * The harness, under a name nobody would write by accident (ROADMAP P2-11).
 *
 * It used to be `Main.java` holding `Main`, `Json` and `Convert`, which are
 * three names a user might reasonably give a helper class. The names are
 * `DevProMax*` now, and the ones we cannot rename because the user's own
 * signatures use them - `ListNode`, `TreeNode` - are named as reserved in the
 * message instead.
 */
const HARNESS_FILE = 'DevProMaxMain.java';

/** Language level users write against (CLAUDE.md > Environment). */
const JAVA_RELEASE = '21';

/**
 * Heap ceiling. This is what makes MLE a verdict we can honestly report for
 * Java: without `-Xmx` an allocation storm would be killed by the OS instead,
 * and the user would see a mystery crash.
 */
const MAX_HEAP = '-Xmx256m';
/** Stack, matched by the harness's per-test thread so deep recursion behaves alike. */
const MAX_STACK = '-Xss64m';

/**
 * The same diagnostics on every machine (ROADMAP P2-19).
 *
 * javac localises its messages and writes them in the console's code page:
 * on a German Windows the parser's `error:` was `Fehler:`, so no diagnostic was
 * recognised, and any non-ASCII source in the excerpt arrived as mojibake from a
 * cp1252 stderr decoded as UTF-8. Both are properties of the compiler's JVM, set
 * with `-J`. The last two only make the compiler's JVM cheaper to start: C1
 * alone and the serial collector take a tenth of a second off a compile that
 * lives for under one, and neither touches the code the user's program runs.
 */
const JAVAC_JVM_FLAGS = [
  '-J-Duser.language=en',
  '-J-Duser.country=US',
  '-J-Dstdout.encoding=UTF-8',
  '-J-Dstderr.encoding=UTF-8',
  '-J-XX:TieredStopAtLevel=1',
  '-J-XX:+UseSerialGC',
];

const JAVAC_FLAGS = [
  ...JAVAC_JVM_FLAGS,
  '--release',
  JAVA_RELEASE,
  '-encoding',
  'UTF-8',
  '-nowarn',
];

/** The runtime's side of the same promise: English messages, UTF-8 streams. */
const JAVA_LOCALE_FLAGS = [
  '-Duser.language=en',
  '-Duser.country=US',
  '-Dfile.encoding=UTF-8',
  '-Dstdout.encoding=UTF-8',
  '-Dstderr.encoding=UTF-8',
];

/**
 * The Java executor, over whichever launcher decides where it runs (P9-2).
 * `-d` and `-cp` name the workspace as the compiler and the JVM will see it.
 */
export function createJavaExecutor(launcher: Launcher): Executor {
  async function compile(
    workspace: Workspace,
    code: string,
    options: PrepareOptions,
  ): Promise<PrepareResult> {
    const started = Date.now();
    // The user's classes are package-private, so the file name never has to
    // match the class name - `Solution.java` holds `class MinValueStack` quite
    // happily, and javac's line numbers then line up with the user's editor.
    await workspace.write(SOLUTION_FILE, code);

    const harness = await ensureHarness(launcher, options);
    if (!harness.ok) return { ...harness.failure, timeMs: Date.now() - started };

    const result = await launcher.run(
      'javac',
      [
        ...JAVAC_FLAGS,
        // The harness is on the class path, already compiled (ROADMAP P2-18):
        // javac used to compile its thousand lines beside every solution, which
        // was most of a Java Run's compile time.
        '-cp',
        launcher.shared(workspace, harness.dir),
        '-d',
        launcher.dir(workspace),
        launcher.path(workspace, SOLUTION_FILE),
      ],
      workspace,
      {
        timeoutMs: options.compileTimeoutMs,
        outputCap: 64 * 1024,
        shared: harness.dir,
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );

    const timeMs = Date.now() - started;
    if (result.code === 0) {
      const collisions = await harnessCollisions(workspace, code);
      if (collisions.length > 0) {
        return { ok: false, timeMs, errors: collisions, stderr: '' };
      }
      return { ok: true, timeMs, shared: harness.dir };
    }

    // A killed javac produced no diagnostics at all, so the generic summary
    // called it "compilation failed" - which reads as "your code is wrong" for
    // what is actually a machine too busy to compile it (ROADMAP P2-11).
    if (result.killed) {
      return {
        ok: false,
        timeMs,
        errors: [{ message: compileTimeoutMessage(options.compileTimeoutMs), severity: 'error' }],
        stderr: result.stderr,
      };
    }

    const output = `${result.stdout}\n${result.stderr}`;
    const { errors, harnessErrors } = parseJavacOutput(output, SOLUTION_FILE);

    if (errors.length === 0 && harnessErrors.length > 0) {
      // The harness failed to compile, which is our bug and not the user's.
      // Say so plainly rather than presenting it as their compile error.
      return harnessFailure(output, timeMs);
    }

    return {
      ok: false,
      timeMs,
      errors:
        errors.length > 0
          ? errors.map(rewritePublicClass)
          : [{ message: summariseCompileFailure(output), severity: 'error' }],
      stderr: output,
    };
  }

  return {
    language: 'java',
    solutionFile: SOLUTION_FILE,
    startupMs: launcher.startupMs,

    prepare: compile,
    check: compile,

    run(workspace: Workspace, payload: HarnessPayload, limits: RunLimits): Promise<HarnessRun> {
      const classPath = [
        launcher.dir(workspace),
        ...(limits.shared === undefined ? [] : [launcher.shared(workspace, limits.shared)]),
      ].join(launcher.pathDelimiter);

      return runHarness(
        launcher,
        workspace,
        'java',
        [
          MAX_HEAP,
          MAX_STACK,
          ...JAVA_LOCALE_FLAGS,
          '-XX:+UseSerialGC',
          '-cp',
          classPath,
          'DevProMaxMain',
          launcher.path(workspace, PAYLOAD_FILE),
        ],
        payload,
        SOLUTION_FILE,
        limits,
      );
    },
  };
}

export const javaExecutor: Executor = createJavaExecutor(localLauncher);

function harnessFailure(output: string, timeMs: number): PrepareFailure {
  return {
    ok: false,
    timeMs,
    errors: [
      {
        message: `the judge's Java harness failed to compile: ${summariseCompileFailure(output)}`,
        severity: 'error',
      },
    ],
    stderr: output,
  };
}

/** `class X is public, should be declared in a file named X.java` (ROADMAP P2-19). */
const PUBLIC_CLASS = /^class (\w+) is public, should be declared in a file named \1\.java$/;

function rewritePublicClass(error: CompileError): CompileError {
  const name = PUBLIC_CLASS.exec(error.message)?.[1];
  return name === undefined ? error : { ...error, message: publicClassMessage(name) };
}

// ---------------------------------------------------------------------------
// Declared harness classes
// ---------------------------------------------------------------------------

/**
 * Classes the user declared under a name the harness owns (ROADMAP P2-11).
 *
 * With the harness compiled beside the solution this was javac's `duplicate
 * class`, rewritten into an explanation. Compiled separately (P2-18) there is no
 * duplicate for javac to see - the user's `ListNode` simply compiles, and at run
 * time one of the two shadows the other, so the harness builds nodes the
 * solution does not recognise. The class files the compile wrote are the
 * reliable evidence, and the explanation is the one it always was.
 */
async function harnessCollisions(workspace: Workspace, code: string): Promise<CompileError[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(workspace.dir);
  } catch {
    return [];
  }
  const names = entries
    .filter((entry) => entry.endsWith('.class'))
    .map((entry) => entry.slice(0, -'.class'.length))
    .filter(isHarnessClassName)
    .sort();

  return names.map((name) => ({
    ...declarationOf(code, name),
    message: harnessClassMessage(name),
    severity: 'error' as const,
  }));
}

/** Where `name` is declared, for the editor marker; nothing when it cannot tell. */
function declarationOf(code: string, name: string): { line?: number; column?: number } {
  const pattern = new RegExp(String.raw`\b(?:class|interface|enum|record)\s+(${name})\b`);
  const lines = code.split(/\r?\n/);
  for (const [index, text] of lines.entries()) {
    const match = pattern.exec(text);
    if (match) return { line: index + 1, column: match.index + match[0].indexOf(name) + 1 };
  }
  return {};
}

// ---------------------------------------------------------------------------
// The shared, precompiled harness (ROADMAP P2-18)
// ---------------------------------------------------------------------------

const HARNESS_MARKER = 'DevProMaxMain.class';
const HARNESS_PREFIX = 'java-harness-';
/** Builds of a harness nobody runs any more are removed after this long. */
const STALE_BUILD_MS = 24 * 60 * 60 * 1000;

/** `javac -version`, once per launcher per process: the compiler does not change under us. */
const compilerIdentities = new Map<string, Promise<string>>();
/** Builds in progress, so two Runs that arrive together compile the harness once. */
const building = new Map<string, Promise<HarnessBuild>>();

type HarnessBuild = { ok: true; dir: string } | { ok: false; failure: PrepareFailure };

/**
 * The compiled harness for this harness source and this compiler, building it
 * if no run has yet.
 *
 * Keyed by a hash of both: an edited `DevProMaxMain.java` or an upgraded JDK is
 * a new directory rather than a stale one. The build goes to a scratch
 * directory and is renamed into place, so a directory that exists is complete -
 * two servers, or a server and the validator, can race for it and both win.
 */
async function ensureHarness(launcher: Launcher, options: PrepareOptions): Promise<HarnessBuild> {
  const source = await fs.readFile(HARNESS_SOURCE, 'utf8');
  const identity = await compilerIdentity(launcher, options);
  const key = createHash('sha256')
    .update(`${source}\n--release ${JAVA_RELEASE}\n${identity}`)
    .digest('hex')
    .slice(0, 16);
  const dir = path.join(options.cacheDir, `${HARNESS_PREFIX}${key}`);

  if (await exists(path.join(dir, HARNESS_MARKER))) return { ok: true, dir };

  let pending = building.get(dir);
  if (!pending) {
    pending = buildHarness(launcher, options, source, dir).finally(() => {
      building.delete(dir);
    });
    building.set(dir, pending);
  }
  return pending;
}

async function buildHarness(
  launcher: Launcher,
  options: PrepareOptions,
  source: string,
  dir: string,
): Promise<HarnessBuild> {
  const scratch = await scratchIn(options.cacheDir);
  try {
    await scratch.write(HARNESS_FILE, source);
    await fs.mkdir(scratch.file('classes'), { recursive: true });

    // Deliberately not cancellable: the build is shared, and the next Run
    // wants it whether or not the one that started it is still listening.
    const result = await launcher.run(
      'javac',
      [
        ...JAVAC_FLAGS,
        '-d',
        launcher.path(scratch, 'classes'),
        launcher.path(scratch, HARNESS_FILE),
      ],
      scratch,
      { timeoutMs: options.compileTimeoutMs, outputCap: 64 * 1024 },
    );

    if (result.code !== 0) {
      const output = `${result.stdout}\n${result.stderr}`;
      return {
        ok: false,
        failure: result.killed
          ? {
              ok: false,
              timeMs: 0,
              errors: [
                { message: compileTimeoutMessage(options.compileTimeoutMs), severity: 'error' },
              ],
              stderr: output,
            }
          : harnessFailure(output, 0),
      };
    }

    try {
      await fs.rename(scratch.file('classes'), dir);
    } catch (error) {
      // Someone else's build landed first; theirs is as good as ours.
      if (!(await exists(path.join(dir, HARNESS_MARKER)))) throw error;
    }
    await pruneStaleBuilds(options.cacheDir, dir);
    return { ok: true, dir };
  } finally {
    await scratch.dispose();
  }
}

/**
 * The compiler's own account of its version, which is what the harness build
 * is keyed by. Remembered per launcher, and forgotten on failure so that a JDK
 * installed after start-up is found by the next Run.
 */
function compilerIdentity(launcher: Launcher, options: PrepareOptions): Promise<string> {
  const cached = compilerIdentities.get(launcher.kind);
  if (cached) return cached;

  const pending = (async () => {
    const scratch = await scratchIn(options.cacheDir);
    try {
      const result = await launcher.run('javac', ['-version'], scratch, {
        timeoutMs: options.compileTimeoutMs,
        outputCap: 4096,
      });
      return `${launcher.kind} ${result.stdout.trim()} ${result.stderr.trim()}`.trim();
    } finally {
      await scratch.dispose();
    }
  })();
  compilerIdentities.set(launcher.kind, pending);
  pending.catch(() => compilerIdentities.delete(launcher.kind));
  return pending;
}

async function scratchIn(cacheDir: string): Promise<Workspace> {
  const id = `.build-${randomUUID()}`;
  const dir = path.join(cacheDir, id);
  await fs.mkdir(dir, { recursive: true });
  return workspaceAt(id, dir);
}

/**
 * Removes harness builds for a source or compiler that is no longer current,
 * and scratch directories a crashed build left. Only ever when a new build has
 * just landed, which is rare; and only what is a day old, so a second checkout
 * running a different harness beside this one is not pulled out from under it.
 */
async function pruneStaleBuilds(cacheDir: string, keep: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(cacheDir);
  } catch {
    return;
  }
  const cutoff = Date.now() - STALE_BUILD_MS;
  for (const entry of entries) {
    const full = path.join(cacheDir, entry);
    if (full === keep) continue;
    if (!entry.startsWith(HARNESS_PREFIX) && !entry.startsWith('.build-')) continue;
    try {
      const stat = await fs.stat(full);
      if (stat.mtimeMs > cutoff) continue;
      await fs.rm(full, { recursive: true, force: true });
    } catch {
      // Raced with another pruner, or still in use on Windows; next time.
    }
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
